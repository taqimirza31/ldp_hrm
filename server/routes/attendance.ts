import { Router } from "express";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { requireAuth, requireRole } from "../middleware/auth";

config();
const sql = neon(process.env.DATABASE_URL!);
const router = Router();

// ==================== HELPERS ====================

/**
 * Derive attendance status by comparing check-in time to shift start + grace.
 * This is the core calculation logic – shift-aware, device-agnostic.
 */
function deriveStatus(
  checkInTime: Date | null,
  checkOutTime: Date | null,
  shiftStart: string | null,  // "HH:MM" or null
  shiftEnd: string | null,    // "HH:MM" or null
  graceMinutes: number = 15
): "present" | "late" | "half_day" | "absent" {
  if (!checkInTime) return "absent";
  if (!shiftStart || !shiftEnd) return "present"; // No shift assigned → can't determine late

  // Build shift start datetime on the check-in date
  const dateStr = checkInTime.toISOString().split("T")[0];
  const shiftStartDt = new Date(`${dateStr}T${shiftStart}:00`);
  const shiftEndDt = new Date(`${dateStr}T${shiftEnd}:00`);
  // Handle overnight shifts
  if (shiftEndDt <= shiftStartDt) shiftEndDt.setDate(shiftEndDt.getDate() + 1);

  const shiftDurationMs = shiftEndDt.getTime() - shiftStartDt.getTime();
  const graceMs = graceMinutes * 60 * 1000;
  const lateThreshold = new Date(shiftStartDt.getTime() + graceMs);

  // If checked in after grace period → late
  if (checkInTime > lateThreshold) {
    // If worked less than half the shift → half_day
    if (checkOutTime) {
      const workedMs = checkOutTime.getTime() - checkInTime.getTime();
      if (workedMs < shiftDurationMs / 2) return "half_day";
    }
    return "late";
  }

  // Checked in on time – check if half day (left early)
  if (checkOutTime) {
    const workedMs = checkOutTime.getTime() - checkInTime.getTime();
    if (workedMs < shiftDurationMs / 2) return "half_day";
  }

  return "present";
}

/**
 * Calculate hours worked from check-in/out timestamps.
 */
function hoursWorked(checkIn: string | null, checkOut: string | null): number {
  if (!checkIn || !checkOut) return 0;
  const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.max(0, diff / 3600000);
}

/**
 * Calculate overtime: hours worked beyond shift duration.
 */
function overtimeHours(
  checkIn: string | null,
  checkOut: string | null,
  shiftStart: string | null,
  shiftEnd: string | null
): number {
  if (!checkIn || !checkOut || !shiftStart || !shiftEnd) return 0;
  const worked = hoursWorked(checkIn, checkOut);
  const dateStr = new Date(checkIn).toISOString().split("T")[0];
  const startDt = new Date(`${dateStr}T${shiftStart}:00`);
  const endDt = new Date(`${dateStr}T${shiftEnd}:00`);
  if (endDt <= startDt) endDt.setDate(endDt.getDate() + 1);
  const shiftHours = (endDt.getTime() - startDt.getTime()) / 3600000;
  return Math.max(0, worked - shiftHours);
}

async function logAudit(attendanceId: string, action: string, performedBy: string | null, reason?: string, changes?: any) {
  await sql`
    INSERT INTO attendance_audit (attendance_id, action, performed_by, reason, changes)
    VALUES (${attendanceId}, ${action}, ${performedBy}, ${reason || null}, ${changes ? JSON.stringify(changes) : null})
  `;
}

/**
 * Get the active shift for an employee on a given date.
 */
async function getEmployeeShift(employeeId: string, dateStr: string) {
  const rows = await sql`
    SELECT s.* FROM employee_shifts es
    JOIN shifts s ON s.id = es.shift_id
    WHERE es.employee_id = ${employeeId}
      AND es.effective_from <= ${dateStr}
      AND (es.effective_to IS NULL OR es.effective_to >= ${dateStr})
      AND s.is_active = true
    ORDER BY es.effective_from DESC
    LIMIT 1
  `;
  return rows[0] || null;
}

// ==================== SHIFT CRUD ====================

/** GET /api/attendance/shifts — List all shifts */
router.get("/shifts", requireAuth, async (req, res) => {
  try {
    const rows = await sql`
      SELECT s.*,
        (SELECT count(*)::int FROM employee_shifts es WHERE es.shift_id = s.id AND (es.effective_to IS NULL OR es.effective_to >= CURRENT_DATE)) as active_employees
      FROM shifts s ORDER BY s.name
    `;
    res.json(rows);
  } catch (error) {
    console.error("Error fetching shifts:", error);
    res.status(500).json({ error: "Failed to fetch shifts" });
  }
});

/** POST /api/attendance/shifts — Create a shift */
router.post("/shifts", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const { name, startTime, endTime, graceMinutes, weeklyPattern, isActive } = req.body;
    if (!name || !startTime || !endTime) {
      return res.status(400).json({ error: "Name, startTime, endTime are required" });
    }
    const rows = await sql`
      INSERT INTO shifts (name, start_time, end_time, grace_minutes, weekly_pattern, is_active)
      VALUES (${name}, ${startTime}, ${endTime}, ${graceMinutes ?? 15}, ${JSON.stringify(weeklyPattern ?? [true,true,true,true,true,false,false])}, ${isActive ?? true})
      RETURNING *
    `;
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error("Error creating shift:", error);
    res.status(500).json({ error: "Failed to create shift" });
  }
});

/** PATCH /api/attendance/shifts/:id — Update a shift */
router.patch("/shifts/:id", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, startTime, endTime, graceMinutes, weeklyPattern, isActive } = req.body;
    const rows = await sql`
      UPDATE shifts SET
        name = COALESCE(${name}, name),
        start_time = COALESCE(${startTime}, start_time),
        end_time = COALESCE(${endTime}, end_time),
        grace_minutes = COALESCE(${graceMinutes}, grace_minutes),
        weekly_pattern = COALESCE(${weeklyPattern ? JSON.stringify(weeklyPattern) : null}, weekly_pattern),
        is_active = COALESCE(${isActive}, is_active),
        updated_at = NOW()
      WHERE id = ${id} RETURNING *
    `;
    if (rows.length === 0) return res.status(404).json({ error: "Shift not found" });
    res.json(rows[0]);
  } catch (error) {
    console.error("Error updating shift:", error);
    res.status(500).json({ error: "Failed to update shift" });
  }
});

/** DELETE /api/attendance/shifts/:id */
router.delete("/shifts/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const { id } = req.params;
    await sql`DELETE FROM shifts WHERE id = ${id}`;
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting shift:", error);
    res.status(500).json({ error: "Failed to delete shift" });
  }
});

// ==================== EMPLOYEE SHIFT ASSIGNMENT ====================

/** GET /api/attendance/employee-shifts — List all assignments */
router.get("/employee-shifts", requireAuth, async (req, res) => {
  try {
    const rows = await sql`
      SELECT es.*, s.name as shift_name, s.start_time, s.end_time,
        e.first_name, e.last_name, e.employee_id as emp_code, e.department
      FROM employee_shifts es
      JOIN shifts s ON s.id = es.shift_id
      JOIN employees e ON e.id = es.employee_id
      ORDER BY es.effective_from DESC
    `;
    res.json(rows);
  } catch (error) {
    console.error("Error fetching employee shifts:", error);
    res.status(500).json({ error: "Failed to fetch employee shifts" });
  }
});

/** POST /api/attendance/employee-shifts — Assign shift to employee */
router.post("/employee-shifts", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const { employeeId, shiftId, effectiveFrom, effectiveTo } = req.body;
    if (!employeeId || !shiftId || !effectiveFrom) {
      return res.status(400).json({ error: "employeeId, shiftId, effectiveFrom required" });
    }
    // Validate employee exists
    const emp = await sql`SELECT id FROM employees WHERE id = ${employeeId}`;
    if (emp.length === 0) return res.status(404).json({ error: "Employee not found" });

    // End any overlapping active assignment
    await sql`
      UPDATE employee_shifts SET effective_to = ${effectiveFrom}
      WHERE employee_id = ${employeeId} AND (effective_to IS NULL OR effective_to >= ${effectiveFrom})
    `;

    const rows = await sql`
      INSERT INTO employee_shifts (employee_id, shift_id, effective_from, effective_to)
      VALUES (${employeeId}, ${shiftId}, ${effectiveFrom}, ${effectiveTo || null})
      RETURNING *
    `;
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error("Error assigning shift:", error);
    res.status(500).json({ error: "Failed to assign shift" });
  }
});

/** DELETE /api/attendance/employee-shifts/:id */
router.delete("/employee-shifts/:id", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    await sql`DELETE FROM employee_shifts WHERE id = ${req.params.id}`;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to remove assignment" });
  }
});

// ==================== ATTENDANCE: CHECK-IN / CHECK-OUT ====================

/** POST /api/attendance/check-in — Employee checks in (web source) */
router.post("/check-in", requireAuth, async (req, res) => {
  try {
    const employeeId = req.user!.employeeId;
    if (!employeeId) return res.status(400).json({ error: "No employee profile linked" });

    const today = new Date().toISOString().split("T")[0];

    // Check for existing record today
    const existing = await sql`
      SELECT * FROM attendance_records WHERE employee_id = ${employeeId} AND date = ${today}
    `;
    if (existing.length > 0 && existing[0].check_in_time) {
      return res.status(400).json({ error: "Already checked in today" });
    }

    const now = new Date();
    const shift = await getEmployeeShift(employeeId, today);
    const status = deriveStatus(now, null, shift?.start_time, shift?.end_time, shift?.grace_minutes);

    const rows = await sql`
      INSERT INTO attendance_records (employee_id, date, check_in_time, source, status, created_by)
      VALUES (${employeeId}, ${today}, ${now.toISOString()}, 'web', ${status}, ${req.user!.id})
      RETURNING *
    `;

    await logAudit(rows[0].id, "create", req.user!.id, "Web check-in");
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error("Error checking in:", error);
    res.status(500).json({ error: "Failed to check in" });
  }
});

/** POST /api/attendance/check-out — Employee checks out */
router.post("/check-out", requireAuth, async (req, res) => {
  try {
    const employeeId = req.user!.employeeId;
    if (!employeeId) return res.status(400).json({ error: "No employee profile linked" });

    const today = new Date().toISOString().split("T")[0];
    const existing = await sql`
      SELECT * FROM attendance_records WHERE employee_id = ${employeeId} AND date = ${today}
    `;
    if (existing.length === 0 || !existing[0].check_in_time) {
      return res.status(400).json({ error: "No check-in found for today" });
    }
    if (existing[0].check_out_time) {
      return res.status(400).json({ error: "Already checked out today" });
    }

    const now = new Date();
    const shift = await getEmployeeShift(employeeId, today);
    const status = deriveStatus(
      new Date(existing[0].check_in_time),
      now,
      shift?.start_time,
      shift?.end_time,
      shift?.grace_minutes
    );

    const rows = await sql`
      UPDATE attendance_records
      SET check_out_time = ${now.toISOString()}, status = ${status}, updated_at = NOW()
      WHERE id = ${existing[0].id}
      RETURNING *
    `;

    await logAudit(rows[0].id, "update", req.user!.id, "Web check-out", { check_out_time: [null, now.toISOString()], status: [existing[0].status, status] });
    res.json(rows[0]);
  } catch (error) {
    console.error("Error checking out:", error);
    res.status(500).json({ error: "Failed to check out" });
  }
});

// ==================== MANUAL ATTENDANCE (HR/Admin) ====================

/** POST /api/attendance/manual — HR/Admin creates/overwrites a record */
router.post("/manual", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const { employeeId, date, checkInTime, checkOutTime, source, remarks } = req.body;
    if (!employeeId || !date) {
      return res.status(400).json({ error: "employeeId and date required" });
    }

    const shift = await getEmployeeShift(employeeId, date);
    const checkIn = checkInTime ? new Date(checkInTime) : null;
    const checkOut = checkOutTime ? new Date(checkOutTime) : null;
    const status = deriveStatus(checkIn, checkOut, shift?.start_time, shift?.end_time, shift?.grace_minutes);

    // Upsert: update existing or create new
    const existing = await sql`
      SELECT * FROM attendance_records WHERE employee_id = ${employeeId} AND date = ${date}
    `;

    let row;
    if (existing.length > 0) {
      const rows = await sql`
        UPDATE attendance_records SET
          check_in_time = ${checkInTime || null},
          check_out_time = ${checkOutTime || null},
          source = ${source || "manual"},
          status = ${status},
          remarks = ${remarks || null},
          updated_at = NOW()
        WHERE id = ${existing[0].id} RETURNING *
      `;
      row = rows[0];
      await logAudit(row.id, "update", req.user!.id, remarks || "Manual override", {
        check_in_time: [existing[0].check_in_time, checkInTime],
        check_out_time: [existing[0].check_out_time, checkOutTime],
        status: [existing[0].status, status]
      });
    } else {
      const rows = await sql`
        INSERT INTO attendance_records (employee_id, date, check_in_time, check_out_time, source, status, remarks, created_by)
        VALUES (${employeeId}, ${date}, ${checkInTime || null}, ${checkOutTime || null}, ${source || "manual"}, ${status}, ${remarks || null}, ${req.user!.id})
        RETURNING *
      `;
      row = rows[0];
      await logAudit(row.id, "create", req.user!.id, remarks || "Manual entry");
    }

    res.json(row);
  } catch (error) {
    console.error("Error creating manual record:", error);
    res.status(500).json({ error: "Failed to create manual record" });
  }
});

// ==================== BIOMETRIC INGEST PLACEHOLDER (V2) ====================

/**
 * POST /api/attendance/ingest
 *
 * V2 Placeholder: Biometric devices will POST punch events here.
 * Expected payload: { employeeId, timestamp, type: "in"|"out", deviceId }
 * For now returns 501 — implement device logic in V2 without schema changes.
 */
router.post("/ingest", requireAuth, async (req, res) => {
  // V2: Parse biometric device payload, create attendance_records with source="biometric"
  // The schema already supports this — no migration needed.
  res.status(501).json({
    error: "Biometric ingest not implemented",
    message: "This endpoint is reserved for V2 biometric device integration. " +
             "When implemented, devices POST { employeeId, timestamp, type, deviceId } here. " +
             "Records will be created with source='biometric' using the existing schema."
  });
});

// ==================== QUERY ENDPOINTS ====================

/** GET /api/attendance/today — Current user's today record */
router.get("/today", requireAuth, async (req, res) => {
  try {
    const employeeId = req.user!.employeeId;
    if (!employeeId) return res.json(null);

    const today = new Date().toISOString().split("T")[0];
    const rows = await sql`
      SELECT ar.*, s.name as shift_name, s.start_time as shift_start, s.end_time as shift_end, s.grace_minutes
      FROM attendance_records ar
      LEFT JOIN employee_shifts es ON es.employee_id = ar.employee_id
        AND es.effective_from <= ${today} AND (es.effective_to IS NULL OR es.effective_to >= ${today})
      LEFT JOIN shifts s ON s.id = es.shift_id AND s.is_active = true
      WHERE ar.employee_id = ${employeeId} AND ar.date = ${today}
      LIMIT 1
    `;
    res.json(rows[0] || null);
  } catch (error) {
    console.error("Error fetching today:", error);
    res.status(500).json({ error: "Failed to fetch today's record" });
  }
});

/** GET /api/attendance/employee/:id?from=&to= — Records for specific employee */
router.get("/employee/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const from = (req.query.from as string) || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
    const to = (req.query.to as string) || new Date().toISOString().split("T")[0];

    const rows = await sql`
      SELECT ar.*, s.name as shift_name, s.start_time as shift_start, s.end_time as shift_end, s.grace_minutes
      FROM attendance_records ar
      LEFT JOIN employee_shifts es ON es.employee_id = ar.employee_id
        AND es.effective_from <= ar.date AND (es.effective_to IS NULL OR es.effective_to >= ar.date)
      LEFT JOIN shifts s ON s.id = es.shift_id
      WHERE ar.employee_id = ${id} AND ar.date >= ${from} AND ar.date <= ${to}
      ORDER BY ar.date DESC
    `;
    res.json(rows);
  } catch (error) {
    console.error("Error fetching employee attendance:", error);
    res.status(500).json({ error: "Failed to fetch attendance" });
  }
});

/** GET /api/attendance/report — Aggregated report for HR dashboard */
router.get("/report", requireAuth, requireRole(["admin", "hr", "manager"]), async (req, res) => {
  try {
    const from = (req.query.from as string) || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
    const to = (req.query.to as string) || new Date().toISOString().split("T")[0];
    const department = req.query.department as string | undefined;
    const employeeId = req.query.employeeId as string | undefined;

    let query = `
      SELECT ar.*, e.first_name, e.last_name, e.employee_id as emp_code, e.department,
        s.name as shift_name, s.start_time as shift_start, s.end_time as shift_end, s.grace_minutes
      FROM attendance_records ar
      JOIN employees e ON e.id = ar.employee_id
      LEFT JOIN employee_shifts es ON es.employee_id = ar.employee_id
        AND es.effective_from <= ar.date AND (es.effective_to IS NULL OR es.effective_to >= ar.date)
      LEFT JOIN shifts s ON s.id = es.shift_id
      WHERE ar.date >= $1 AND ar.date <= $2
    `;
    const params: any[] = [from, to];

    if (department) {
      params.push(department);
      query += ` AND e.department = $${params.length}`;
    }
    if (employeeId) {
      params.push(employeeId);
      query += ` AND ar.employee_id = $${params.length}`;
    }

    query += ` ORDER BY ar.date DESC, e.first_name`;

    // Use tagged template for parameterized query
    const rows = await sql(query, params);

    // Compute derived fields for each row
    const enriched = rows.map((r: any) => ({
      ...r,
      hours_worked: hoursWorked(r.check_in_time, r.check_out_time),
      overtime: overtimeHours(r.check_in_time, r.check_out_time, r.shift_start, r.shift_end),
    }));

    res.json(enriched);
  } catch (error) {
    console.error("Error generating report:", error);
    res.status(500).json({ error: "Failed to generate report" });
  }
});

/** GET /api/attendance/stats — Summary statistics for dashboard */
router.get("/stats", requireAuth, async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    const [presentToday] = await sql`
      SELECT count(*)::int as count FROM attendance_records WHERE date = ${today} AND status IN ('present', 'late')
    `;
    const [lateToday] = await sql`
      SELECT count(*)::int as count FROM attendance_records WHERE date = ${today} AND status = 'late'
    `;
    const [absentToday] = await sql`
      SELECT count(*)::int as count FROM employees e
      WHERE e.employment_status = 'active'
        AND e.id NOT IN (SELECT employee_id FROM attendance_records WHERE date = ${today})
    `;
    const [totalActive] = await sql`
      SELECT count(*)::int as count FROM employees WHERE employment_status = 'active'
    `;

    res.json({
      today: today,
      present: presentToday.count,
      late: lateToday.count,
      absent: absentToday.count,
      totalEmployees: totalActive.count,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

/** GET /api/attendance/audit/:attendanceId — Audit trail for a record */
router.get("/audit/:attendanceId", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const rows = await sql`
      SELECT * FROM attendance_audit WHERE attendance_id = ${req.params.attendanceId} ORDER BY created_at DESC
    `;
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch audit trail" });
  }
});

export default router;
