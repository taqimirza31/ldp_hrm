import { Router, Request, Response } from "express";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { requireAuth, requireRole } from "../middleware/auth";

config();
const sql = neon(process.env.DATABASE_URL!);
const router = Router();

// ==================== INTEGRATION STUBS (V2-ready) ====================
//
// These are pure function stubs that log intent.
// In V2, replace with real implementations (Microsoft SSO, Google Workspace, etc.)
// without changing the offboarding logic that calls them.

/**
 * V2: Revoke SSO, email, VPN, SaaS accounts.
 * Currently logs intent only.
 */
function revokeSystemAccess(employee: { id: string; work_email: string; first_name: string; last_name: string }) {
  console.log(
    `[OFFBOARDING HOOK] revokeSystemAccess: Revoking access for ${employee.first_name} ${employee.last_name} (${employee.work_email}).`,
    `V2: Disable Microsoft 365, Google Workspace, VPN, SaaS accounts.`
  );
  // V2: await microsoftGraph.disableUser(employee.work_email);
  // V2: await googleAdmin.suspendUser(employee.work_email);
}

/**
 * V2: Mark all assets for physical return and trigger IT notification.
 * V1: Updates assigned_systems status to 'available' and notes with return context.
 */
async function markAssetsForReturn(employeeId: string) {
  console.log(`[OFFBOARDING HOOK] markAssetsForReturn: Flagging assets for employee ${employeeId}`);
  // Mark all assigned/home assets as available (returned)
  await sql`
    UPDATE assigned_systems
    SET status = 'available',
        notes = COALESCE(notes, '') || ' [Auto-flagged for return on offboarding completion]',
        updated_at = NOW()
    WHERE user_id = ${employeeId}
      AND status IN ('assigned', 'home')
  `;
}

/**
 * V2: Disable biometric, block attendance API.
 * V1: Logs intent. The attendance API can check employee status = 'offboarded'
 * to block new check-ins without any code change in the attendance module.
 */
function disableAttendance(employeeId: string) {
  console.log(
    `[OFFBOARDING HOOK] disableAttendance: Employee ${employeeId} attendance will be blocked.`,
    `Attendance routes already check employment_status — setting 'offboarded' is sufficient.`
  );
}

/**
 * Master integration hook called when offboarding completes.
 * Add new integrations here without modifying core offboarding logic.
 */
async function onOffboardingComplete(employee: {
  id: string; work_email: string; first_name: string; last_name: string;
}) {
  revokeSystemAccess(employee);
  await markAssetsForReturn(employee.id);
  disableAttendance(employee.id);
}

// ==================== RUNTIME EVALUATION HOOK ====================
//
// This is a pure function, NOT a cron job. Call it:
// - On HR dashboard load
// - On login
// - On any API access where freshness matters
// It checks if any in-notice offboarding has reached its exit_date
// and auto-completes it.

/**
 * Evaluate all offboarding records that are past their exit date
 * but not yet completed, and complete them.
 * Returns the list of employee IDs that were auto-completed.
 */
async function evaluateOffboardings(): Promise<string[]> {
  const today = new Date().toISOString().split("T")[0];

  const pending = await sql`
    SELECT o.id as offboarding_id, o.employee_id,
           e.id as emp_pk, e.work_email, e.first_name, e.last_name
    FROM offboarding_records o
    INNER JOIN employees e ON e.id = o.employee_id
    WHERE o.status IN ('initiated', 'in_notice')
      AND o.exit_date <= ${today}
  `;

  const completed: string[] = [];

  for (const row of pending) {
    await completeOffboardingInternal(
      row.offboarding_id,
      row.emp_pk,
      {
        id: row.emp_pk,
        work_email: row.work_email,
        first_name: row.first_name,
        last_name: row.last_name,
      },
      "system" // auto-completed by runtime evaluation
    );
    completed.push(row.emp_pk);
  }

  if (completed.length > 0) {
    console.log(`[OFFBOARDING EVAL] Auto-completed ${completed.length} offboarding(s): ${completed.join(", ")}`);
  }

  return completed;
}

/**
 * Evaluate a single employee's offboarding status.
 * Returns true if the employee was auto-offboarded.
 */
async function evaluateEmployeeOffboarding(employeeId: string): Promise<boolean> {
  const today = new Date().toISOString().split("T")[0];

  const rows = await sql`
    SELECT o.id as offboarding_id, o.employee_id,
           e.id as emp_pk, e.work_email, e.first_name, e.last_name
    FROM offboarding_records o
    INNER JOIN employees e ON e.id = o.employee_id
    WHERE o.employee_id = ${employeeId}
      AND o.status IN ('initiated', 'in_notice')
      AND o.exit_date <= ${today}
    LIMIT 1
  `;

  if (rows.length === 0) return false;

  const row = rows[0];
  await completeOffboardingInternal(
    row.offboarding_id,
    row.emp_pk,
    { id: row.emp_pk, work_email: row.work_email, first_name: row.first_name, last_name: row.last_name },
    "system"
  );
  return true;
}

// ==================== CORE LOGIC ====================

/**
 * Internal function to complete an offboarding.
 * Sets employee status to offboarded, marks completed_at, fires hooks.
 */
async function completeOffboardingInternal(
  offboardingId: string,
  employeeId: string,
  employee: { id: string; work_email: string; first_name: string; last_name: string },
  performedBy: string
) {
  // 1. Update offboarding record
  await sql`
    UPDATE offboarding_records
    SET status = 'completed', completed_at = NOW(), updated_at = NOW()
    WHERE id = ${offboardingId}
  `;

  // 2. Update employee status to offboarded
  await sql`
    UPDATE employees
    SET employment_status = 'offboarded',
        exit_date = NOW(),
        updated_at = NOW()
    WHERE id = ${employeeId}
  `;

  // 3. Audit log
  await sql`
    INSERT INTO offboarding_audit_log (offboarding_id, action, performed_by, details)
    VALUES (${offboardingId}, 'complete', ${performedBy}, 'Offboarding completed. Employee status set to offboarded. Integration hooks fired.')
  `;

  // 4. Fire integration hooks
  await onOffboardingComplete(employee);
}

/**
 * Generate default offboarding tasks including asset return tasks.
 */
async function generateDefaultTasks(offboardingId: string, employeeId: string) {
  // Standard tasks
  const standardTasks = [
    { taskType: "handover", title: "Complete project handover documentation" },
    { taskType: "knowledge_transfer", title: "Knowledge transfer sessions with replacement/team" },
    { taskType: "exit_interview", title: "Conduct exit interview" },
    { taskType: "final_settlement", title: "Process final salary settlement" },
  ];

  for (const t of standardTasks) {
    await sql`
      INSERT INTO offboarding_tasks (offboarding_id, task_type, title)
      VALUES (${offboardingId}, ${t.taskType}, ${t.title})
    `;
  }

  // Auto-create asset_return tasks from assigned systems
  const assets = await sql`
    SELECT id, asset_id, user_name, ram, storage, processor, status
    FROM assigned_systems
    WHERE user_id = ${employeeId}
      AND status IN ('assigned', 'home')
  `;

  for (const asset of assets) {
    await sql`
      INSERT INTO offboarding_tasks (offboarding_id, task_type, title, related_asset_id, notes)
      VALUES (
        ${offboardingId},
        'asset_return',
        ${"Return asset: " + asset.asset_id + (asset.processor ? " (" + asset.processor + ")" : "")},
        ${asset.id},
        ${"Asset ID: " + asset.asset_id + ", Status: " + asset.status}
      )
    `;
  }
}

// ==================== API ROUTES ====================

// ---------- LIFECYCLE ----------

/**
 * POST /api/offboarding/initiate
 * Initiates offboarding for an employee.
 * Calculates exit_date, generates default tasks, auto-creates asset tasks.
 */
router.post("/initiate", requireAuth, requireRole(["admin", "hr"]), async (req: Request, res: Response) => {
  try {
    const {
      employeeId,
      offboardingType,
      reason,
      noticeRequired,
      noticePeriodDays,
      exitDateOverride, // HR can set a specific exit date
      remarks,
    } = req.body;

    if (!employeeId || !offboardingType) {
      return res.status(400).json({ error: "employeeId and offboardingType are required" });
    }

    // Validate employee exists and is active
    const empRows = await sql`
      SELECT id, first_name, last_name, work_email, employment_status
      FROM employees WHERE id = ${employeeId}
    `;
    if (empRows.length === 0) return res.status(404).json({ error: "Employee not found" });
    const emp = empRows[0];

    if (emp.employment_status === "offboarded") {
      return res.status(400).json({ error: "Employee is already offboarded" });
    }

    // Check for existing active offboarding
    const existing = await sql`
      SELECT id FROM offboarding_records
      WHERE employee_id = ${employeeId} AND status IN ('initiated', 'in_notice')
    `;
    if (existing.length > 0) {
      return res.status(400).json({ error: "An active offboarding already exists for this employee" });
    }

    // Guard: prevent onboarding if offboarding initiated
    const onboardingCheck = await sql`
      SELECT id FROM onboarding_records
      WHERE employee_id = ${employeeId} AND status IN ('not_started', 'in_progress')
    `;
    if (onboardingCheck.length > 0) {
      return res.status(400).json({ error: "Cannot initiate offboarding while employee is still being onboarded" });
    }

    // Calculate exit date
    let exitDate: string;
    let status: string;

    if (noticeRequired && noticePeriodDays && noticePeriodDays > 0) {
      if (exitDateOverride) {
        exitDate = exitDateOverride;
      } else {
        const d = new Date();
        d.setDate(d.getDate() + noticePeriodDays);
        exitDate = d.toISOString().split("T")[0];
      }
      status = "in_notice";
    } else {
      // Immediate exit
      exitDate = exitDateOverride || new Date().toISOString().split("T")[0];
      status = "initiated";
    }

    // Who is initiating
    const initiatedBy = req.user!.employeeId || req.user!.id;

    // Create offboarding record
    const result = await sql`
      INSERT INTO offboarding_records (
        employee_id, initiated_by, offboarding_type, reason,
        notice_required, notice_period_days, exit_date, status, remarks
      ) VALUES (
        ${employeeId}, ${initiatedBy}, ${offboardingType}, ${reason || null},
        ${noticeRequired || false}, ${noticePeriodDays || null},
        ${exitDate}, ${status}, ${remarks || null}
      ) RETURNING *
    `;
    const record = result[0];

    // Update employee with exit info
    await sql`
      UPDATE employees SET
        exit_type = ${offboardingType},
        resignation_reason = ${reason || null},
        exit_date = ${exitDate},
        resignation_date = ${offboardingType === "resignation" ? new Date().toISOString() : null},
        updated_at = NOW()
      WHERE id = ${employeeId}
    `;

    // Generate default tasks (including asset return tasks)
    await generateDefaultTasks(record.id, employeeId);

    // Audit log
    await sql`
      INSERT INTO offboarding_audit_log (offboarding_id, action, performed_by, details)
      VALUES (${record.id}, 'initiate', ${initiatedBy},
        ${"Offboarding initiated. Type: " + offboardingType + ". Notice: " + (noticeRequired ? noticePeriodDays + " days" : "None") + ". Exit date: " + exitDate})
    `;

    // If no notice required and exit date is today or past, complete immediately
    const today = new Date().toISOString().split("T")[0];
    if (!noticeRequired && exitDate <= today) {
      await completeOffboardingInternal(
        record.id,
        employeeId,
        { id: emp.id, work_email: emp.work_email, first_name: emp.first_name, last_name: emp.last_name },
        initiatedBy
      );
      const updated = await sql`SELECT * FROM offboarding_records WHERE id = ${record.id}`;
      return res.status(201).json(updated[0]);
    }

    res.status(201).json(record);
  } catch (error: any) {
    console.error("Error initiating offboarding:", error);
    res.status(500).json({ error: "Failed to initiate offboarding" });
  }
});

/**
 * PATCH /api/offboarding/:id/exit-date
 * HR override of exit_date (audited).
 */
router.patch("/:id/exit-date", requireAuth, requireRole(["admin", "hr"]), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { exitDate, reason } = req.body;

    if (!exitDate) return res.status(400).json({ error: "exitDate is required" });

    const existing = await sql`SELECT * FROM offboarding_records WHERE id = ${id}`;
    if (existing.length === 0) return res.status(404).json({ error: "Offboarding record not found" });
    if (existing[0].status === "completed" || existing[0].status === "cancelled") {
      return res.status(400).json({ error: `Cannot modify a ${existing[0].status} offboarding` });
    }

    const previousDate = existing[0].exit_date;
    const performedBy = req.user!.employeeId || req.user!.id;

    await sql`
      UPDATE offboarding_records SET exit_date = ${exitDate}, updated_at = NOW()
      WHERE id = ${id}
    `;

    // Also update the employee's exit_date
    await sql`
      UPDATE employees SET exit_date = ${exitDate}, updated_at = NOW()
      WHERE id = ${existing[0].employee_id}
    `;

    // Audit
    await sql`
      INSERT INTO offboarding_audit_log (offboarding_id, action, performed_by, details, previous_value, new_value)
      VALUES (${id}, 'update_exit_date', ${performedBy},
        ${"Exit date changed" + (reason ? ". Reason: " + reason : "")},
        ${previousDate}, ${exitDate})
    `;

    const updated = await sql`SELECT * FROM offboarding_records WHERE id = ${id}`;
    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ error: "Failed to update exit date" });
  }
});

/**
 * POST /api/offboarding/:id/cancel
 * Cancels an active offboarding. Reverts employee exit info.
 */
router.post("/:id/cancel", requireAuth, requireRole(["admin", "hr"]), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const existing = await sql`SELECT * FROM offboarding_records WHERE id = ${id}`;
    if (existing.length === 0) return res.status(404).json({ error: "Offboarding record not found" });
    if (existing[0].status === "completed") return res.status(400).json({ error: "Cannot cancel a completed offboarding" });
    if (existing[0].status === "cancelled") return res.status(400).json({ error: "Already cancelled" });

    const performedBy = req.user!.employeeId || req.user!.id;

    await sql`
      UPDATE offboarding_records
      SET status = 'cancelled', remarks = COALESCE(${reason || null}, remarks), updated_at = NOW()
      WHERE id = ${id}
    `;

    // Revert employee exit info
    await sql`
      UPDATE employees
      SET exit_date = NULL, exit_type = NULL, resignation_date = NULL, resignation_reason = NULL, updated_at = NOW()
      WHERE id = ${existing[0].employee_id}
    `;

    // Audit
    await sql`
      INSERT INTO offboarding_audit_log (offboarding_id, action, performed_by, details)
      VALUES (${id}, 'cancel', ${performedBy}, ${"Offboarding cancelled" + (reason ? ". Reason: " + reason : "")})
    `;

    const updated = await sql`SELECT * FROM offboarding_records WHERE id = ${id}`;
    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ error: "Failed to cancel offboarding" });
  }
});

/**
 * POST /api/offboarding/:id/complete
 * Manually complete an offboarding (only allowed if today >= exit_date).
 */
router.post("/:id/complete", requireAuth, requireRole(["admin", "hr"]), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await sql`SELECT * FROM offboarding_records WHERE id = ${id}`;
    if (existing.length === 0) return res.status(404).json({ error: "Offboarding record not found" });
    if (existing[0].status === "completed") return res.status(400).json({ error: "Already completed" });
    if (existing[0].status === "cancelled") return res.status(400).json({ error: "Cannot complete a cancelled offboarding" });

    const today = new Date().toISOString().split("T")[0];
    if (existing[0].exit_date > today) {
      return res.status(400).json({
        error: `Cannot complete before exit date (${existing[0].exit_date}). Today is ${today}.`,
      });
    }

    // Get employee details for hooks
    const empRows = await sql`SELECT id, work_email, first_name, last_name FROM employees WHERE id = ${existing[0].employee_id}`;
    if (empRows.length === 0) return res.status(404).json({ error: "Employee not found" });
    const emp = empRows[0];
    const performedBy = req.user!.employeeId || req.user!.id;

    await completeOffboardingInternal(id, emp.id, emp as any, performedBy);

    const updated = await sql`SELECT * FROM offboarding_records WHERE id = ${id}`;
    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ error: "Failed to complete offboarding" });
  }
});

// ---------- TASK MANAGEMENT ----------

/**
 * PATCH /api/offboarding/tasks/:taskId
 * Update task status (complete, waive) with notes.
 */
router.patch("/tasks/:taskId", requireAuth, requireRole(["admin", "hr"]), async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { status, notes, assignedTo } = req.body;

    const existing = await sql`SELECT * FROM offboarding_tasks WHERE id = ${taskId}`;
    if (existing.length === 0) return res.status(404).json({ error: "Task not found" });

    const task = existing[0];
    const performedBy = req.user!.employeeId || req.user!.id;
    const prevStatus = task.status;

    let completedAt = task.completed_at;
    if (status === "completed" && prevStatus !== "completed") completedAt = new Date();

    await sql`
      UPDATE offboarding_tasks SET
        status = COALESCE(${status || null}, status),
        notes = COALESCE(${notes || null}, notes),
        assigned_to = COALESCE(${assignedTo || null}, assigned_to),
        completed_at = ${completedAt},
        updated_at = NOW()
      WHERE id = ${taskId}
    `;

    // If asset_return task completed, update the asset status
    if (status === "completed" && task.task_type === "asset_return" && task.related_asset_id) {
      await sql`
        UPDATE assigned_systems
        SET status = 'available',
            notes = COALESCE(notes, '') || ' [Returned during offboarding]',
            updated_at = NOW()
        WHERE id = ${task.related_asset_id}
      `;
    }

    // Audit
    if (status && status !== prevStatus) {
      await sql`
        INSERT INTO offboarding_audit_log (offboarding_id, action, performed_by, details, previous_value, new_value)
        VALUES (${task.offboarding_id}, ${status === "completed" ? "complete_task" : "waive_task"},
          ${performedBy}, ${"Task: " + task.title}, ${prevStatus}, ${status})
      `;
    }

    const updated = await sql`SELECT * FROM offboarding_tasks WHERE id = ${taskId}`;
    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ error: "Failed to update task" });
  }
});

/**
 * GET /api/offboarding/tasks/:offboardingId
 * Get all tasks for an offboarding record.
 */
router.get("/tasks/:offboardingId", requireAuth, async (req: Request, res: Response) => {
  try {
    const tasks = await sql`
      SELECT t.*,
        e.first_name as assignee_first_name, e.last_name as assignee_last_name
      FROM offboarding_tasks t
      LEFT JOIN employees e ON e.id = t.assigned_to
      WHERE t.offboarding_id = ${req.params.offboardingId}
      ORDER BY
        CASE t.task_type
          WHEN 'asset_return' THEN 1
          WHEN 'handover' THEN 2
          WHEN 'knowledge_transfer' THEN 3
          WHEN 'exit_interview' THEN 4
          WHEN 'final_settlement' THEN 5
        END
    `;
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

// ---------- QUERIES ----------

/**
 * GET /api/offboarding
 * List all offboarding records with employee details and task progress.
 * Runs evaluateOffboardings() first to auto-complete any past-due records.
 */
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    // Runtime evaluation — auto-complete any past-due offboardings
    await evaluateOffboardings();

    const { status, department } = req.query;

    let query = `
      SELECT o.*,
        e.first_name, e.last_name, e.work_email, e.employee_id as emp_id,
        e.department, e.job_title, e.avatar,
        ie.first_name as initiator_first_name, ie.last_name as initiator_last_name,
        (SELECT COUNT(*)::int FROM offboarding_tasks t WHERE t.offboarding_id = o.id) as total_tasks,
        (SELECT COUNT(*)::int FROM offboarding_tasks t WHERE t.offboarding_id = o.id AND t.status IN ('completed', 'waived')) as done_tasks
      FROM offboarding_records o
      INNER JOIN employees e ON e.id = o.employee_id
      LEFT JOIN employees ie ON ie.id = o.initiated_by
    `;

    const conditions: string[] = [];
    const params: any[] = [];

    if (status && status !== "all") {
      params.push(status);
      conditions.push(`o.status = $${params.length}`);
    }
    if (department) {
      params.push(department);
      conditions.push(`e.department = $${params.length}`);
    }

    if (conditions.length > 0) query += " WHERE " + conditions.join(" AND ");
    query += " ORDER BY o.initiated_at DESC";

    const records = await sql(query, params);
    res.json(records);
  } catch (error) {
    console.error("Error fetching offboarding records:", error);
    res.status(500).json({ error: "Failed to fetch offboarding records" });
  }
});

/**
 * GET /api/offboarding/:employeeId/details
 * Get full offboarding details for an employee including tasks, assets, and audit log.
 */
router.get("/:employeeId/details", requireAuth, async (req: Request, res: Response) => {
  try {
    const { employeeId } = req.params;

    // Run single-employee evaluation
    await evaluateEmployeeOffboarding(employeeId);

    const records = await sql`
      SELECT o.*,
        e.first_name, e.last_name, e.work_email, e.employee_id as emp_id,
        e.department, e.job_title, e.avatar, e.employment_status,
        ie.first_name as initiator_first_name, ie.last_name as initiator_last_name
      FROM offboarding_records o
      INNER JOIN employees e ON e.id = o.employee_id
      LEFT JOIN employees ie ON ie.id = o.initiated_by
      WHERE o.employee_id = ${employeeId}
      ORDER BY o.initiated_at DESC
      LIMIT 1
    `;

    if (records.length === 0) return res.status(404).json({ error: "No offboarding record found for this employee" });
    const record = records[0];

    // Tasks
    const tasks = await sql`
      SELECT t.*,
        ae.first_name as assignee_first_name, ae.last_name as assignee_last_name
      FROM offboarding_tasks t
      LEFT JOIN employees ae ON ae.id = t.assigned_to
      WHERE t.offboarding_id = ${record.id}
      ORDER BY
        CASE t.task_type
          WHEN 'asset_return' THEN 1
          WHEN 'handover' THEN 2
          WHEN 'knowledge_transfer' THEN 3
          WHEN 'exit_interview' THEN 4
          WHEN 'final_settlement' THEN 5
        END
    `;

    // Current assigned assets
    const assets = await sql`
      SELECT id, asset_id, user_name, ram, storage, processor, status, assigned_date
      FROM assigned_systems
      WHERE user_id = ${employeeId}
      ORDER BY assigned_date DESC
    `;

    // Audit log
    const auditLog = await sql`
      SELECT * FROM offboarding_audit_log
      WHERE offboarding_id = ${record.id}
      ORDER BY created_at ASC
    `;

    res.json({ ...record, tasks, assets, audit_log: auditLog });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch offboarding details" });
  }
});

/**
 * GET /api/offboarding/audit/:offboardingId
 * Get audit log for an offboarding record.
 */
router.get("/audit/:offboardingId", requireAuth, async (req: Request, res: Response) => {
  try {
    const log = await sql`
      SELECT * FROM offboarding_audit_log
      WHERE offboarding_id = ${req.params.offboardingId}
      ORDER BY created_at ASC
    `;
    res.json(log);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch audit log" });
  }
});

/**
 * GET /api/offboarding/evaluate
 * Manually trigger runtime evaluation (useful for dashboard polling).
 * Returns list of auto-completed employee IDs.
 */
router.get("/evaluate", requireAuth, async (_req: Request, res: Response) => {
  try {
    const completed = await evaluateOffboardings();
    res.json({ evaluated: true, autoCompleted: completed });
  } catch (error) {
    res.status(500).json({ error: "Failed to evaluate offboardings" });
  }
});

export default router;
