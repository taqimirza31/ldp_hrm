import { BaseRepository } from "../../core/base/BaseRepository.js";

export class AttendanceRepository extends BaseRepository {
  // ── Shifts ──────────────────────────────────────────────────────────────────
  async listShifts() {
    return this.sql`
      SELECT s.*, (SELECT count(*)::int FROM employee_shifts es WHERE es.shift_id = s.id AND (es.effective_to IS NULL OR es.effective_to >= CURRENT_DATE)) as active_employees
      FROM shifts s ORDER BY s.name
    ` as Promise<any[]>;
  }
  async createShift(d: any) {
    const rows = await this.sql`INSERT INTO shifts(name,start_time,end_time,grace_minutes,weekly_pattern,is_active) VALUES(${d.name},${d.startTime},${d.endTime},${d.graceMinutes??15},${JSON.stringify(d.weeklyPattern??[true,true,true,true,true,false,false])},${d.isActive??true}) RETURNING *` as any[];
    return rows[0];
  }
  async updateShift(id: string, d: any) {
    const rows = await this.sql`UPDATE shifts SET name=COALESCE(${d.name??null},name),start_time=COALESCE(${d.startTime??null},start_time),end_time=COALESCE(${d.endTime??null},end_time),grace_minutes=COALESCE(${d.graceMinutes??null},grace_minutes),weekly_pattern=COALESCE(${d.weeklyPattern?JSON.stringify(d.weeklyPattern):null},weekly_pattern),is_active=COALESCE(${d.isActive??null},is_active),updated_at=NOW() WHERE id=${id} RETURNING *` as any[];
    return rows[0] ?? null;
  }
  async deleteShift(id: string) { await this.sql`DELETE FROM shifts WHERE id=${id}`; }

  // ── Employee Shifts ─────────────────────────────────────────────────────────
  async listEmployeeShifts() {
    return this.sql`
      SELECT es.*, s.name as shift_name, s.start_time, s.end_time, e.first_name, e.last_name, e.employee_id as emp_code, e.department
      FROM employee_shifts es JOIN shifts s ON s.id=es.shift_id JOIN employees e ON e.id=es.employee_id ORDER BY es.effective_from DESC
    ` as Promise<any[]>;
  }
  async getEmployeeById(id: string) { const r = await this.sql`SELECT id FROM employees WHERE id=${id}` as any[]; return r[0]??null; }
  async endOverlappingAssignments(employeeId: string, effectiveFrom: string) { await this.sql`UPDATE employee_shifts SET effective_to=${effectiveFrom} WHERE employee_id=${employeeId} AND (effective_to IS NULL OR effective_to >= ${effectiveFrom})`; }
  async createEmployeeShift(employeeId: string, shiftId: string, effectiveFrom: string, effectiveTo: string|null) {
    const rows = await this.sql`INSERT INTO employee_shifts(employee_id,shift_id,effective_from,effective_to) VALUES(${employeeId},${shiftId},${effectiveFrom},${effectiveTo}) RETURNING *` as any[];
    return rows[0];
  }
  async deleteEmployeeShift(id: string) { await this.sql`DELETE FROM employee_shifts WHERE id=${id}`; }

  // ── Shift for date ──────────────────────────────────────────────────────────
  async getShiftForEmployee(employeeId: string, dateStr: string) {
    const rows = await this.sql`SELECT s.* FROM employee_shifts es JOIN shifts s ON s.id=es.shift_id WHERE es.employee_id=${employeeId} AND es.effective_from<=${dateStr} AND (es.effective_to IS NULL OR es.effective_to>=${dateStr}) AND s.is_active=true ORDER BY es.effective_from DESC LIMIT 1` as any[];
    return rows[0] ?? null;
  }

  // ── Attendance Records ──────────────────────────────────────────────────────
  async getTodayRecord(employeeId: string, today: string) {
    const r = await this.sql`SELECT id,check_in_time,check_out_time FROM attendance_records WHERE employee_id=${employeeId} AND date=${today}` as any[];
    return r[0] ?? null;
  }
  async getEmployeeInfo(employeeId: string) {
    const r = await this.sql`SELECT employment_status,exit_date,join_date FROM employees WHERE id=${employeeId}` as any[];
    return r[0] ?? null;
  }
  async createCheckIn(employeeId: string, today: string, now: Date, status: string, createdBy: string) {
    const rows = await this.sql`INSERT INTO attendance_records(employee_id,date,check_in_time,source,status,created_by) VALUES(${employeeId},${today},${now.toISOString()},'web',${status},${createdBy}) RETURNING *` as any[];
    await this.logAudit(rows[0].id, "create", createdBy, "Web check-in");
    return rows[0];
  }
  async updateCheckOut(recordId: string, now: Date, status: string) {
    const rows = await this.sql`UPDATE attendance_records SET check_out_time=${now.toISOString()},status=${status},updated_at=NOW() WHERE id=${recordId} RETURNING *` as any[];
    await this.logAudit(recordId, "update", null, "Web check-out");
    return rows[0];
  }
  async listRecords(filters: { employeeId?: string; startDate?: string; endDate?: string; status?: string; limit: number; offset: number }) {
    const { employeeId, startDate, endDate, status, limit, offset } = filters;
    const params: any[] = []; const conds: string[] = [];
    if (employeeId) { params.push(employeeId); conds.push(`ar.employee_id=$${params.length}`); }
    if (startDate) { params.push(startDate); conds.push(`ar.date>=$${params.length}`); }
    if (endDate) { params.push(endDate); conds.push(`ar.date<=$${params.length}`); }
    if (status) { params.push(status); conds.push(`ar.status=$${params.length}`); }
    params.push(limit, offset);
    return this.sql(`SELECT ar.*,e.first_name,e.last_name,e.employee_id as emp_code,e.department FROM attendance_records ar JOIN employees e ON e.id=ar.employee_id ${conds.length?`WHERE ${conds.join(" AND ")}`:""} ORDER BY ar.date DESC,ar.created_at DESC LIMIT $${params.length-1} OFFSET $${params.length}`, params) as Promise<any[]>;
  }
  async manualUpsert(employeeId: string, date: string, data: any, userId: string) {
    const existing = await this.sql`SELECT id FROM attendance_records WHERE employee_id=${employeeId} AND date=${date}` as any[];
    const status = data.status || "present";
    const remarks = data.remarks ?? data.notes ?? null;
    const auditReason = remarks || "Manual entry";
    if (existing.length > 0) {
      const rows = await this.sql`UPDATE attendance_records SET check_in_time=${data.checkInTime||null},check_out_time=${data.checkOutTime||null},status=${status},source='manual',remarks=${remarks},updated_at=NOW() WHERE id=${existing[0].id} RETURNING *` as any[];
      await this.logAudit(existing[0].id, "update", userId, auditReason);
      return rows[0];
    }
    const rows = await this.sql`INSERT INTO attendance_records(employee_id,date,check_in_time,check_out_time,source,status,remarks,created_by) VALUES(${employeeId},${date},${data.checkInTime||null},${data.checkOutTime||null},'manual',${status},${remarks},${userId}) RETURNING *` as any[];
    await this.logAudit(rows[0].id, "create", userId, auditReason);
    return rows[0];
  }
  async logAudit(attendanceId: string, action: string, performedBy: string|null, reason?: string, changes?: any) {
    await this.sql`INSERT INTO attendance_audit(attendance_id,action,performed_by,reason,changes) VALUES(${attendanceId},${action},${performedBy},${reason||null},${changes?JSON.stringify(changes):null})`;
  }
  async listAudit(attendanceId: string) { return this.sql`SELECT * FROM attendance_audit WHERE attendance_id=${attendanceId} ORDER BY created_at ASC` as Promise<any[]>; }

  // ── Frontend-facing: today, stats, employee records, report, record update/delete, daily-summary ──
  async getTodayWithShift(employeeId: string, today: string) {
    const rows = await this.sql`
      SELECT ar.*, s.name as shift_name, s.start_time as shift_start, s.end_time as shift_end, s.grace_minutes
      FROM attendance_records ar
      LEFT JOIN employee_shifts es ON es.employee_id = ar.employee_id AND es.effective_from <= ${today} AND (es.effective_to IS NULL OR es.effective_to >= ${today})
      LEFT JOIN shifts s ON s.id = es.shift_id AND s.is_active = true
      WHERE ar.employee_id = ${employeeId} AND ar.date = ${today} LIMIT 1
    ` as any[];
    return rows[0] ?? null;
  }
  async getStats(today: string) {
    const [presentRow] = await this.sql`SELECT count(*)::int as c FROM attendance_records WHERE date = ${today} AND status IN ('present','late')` as any[];
    const [lateRow] = await this.sql`SELECT count(*)::int as c FROM attendance_records WHERE date = ${today} AND status = 'late'` as any[];
    const [absentRow] = await this.sql`SELECT count(*)::int as c FROM employees e WHERE e.employment_status = 'active' AND e.id NOT IN (SELECT employee_id FROM attendance_records WHERE date = ${today})` as any[];
    const [totalRow] = await this.sql`SELECT count(*)::int as c FROM employees WHERE employment_status = 'active'` as any[];
    return { today, present: presentRow?.c ?? 0, late: lateRow?.c ?? 0, absent: absentRow?.c ?? 0, totalEmployees: totalRow?.c ?? 0 };
  }
  async getEmployeeRecords(employeeId: string, from: string, to: string) {
    return this.sql`
      SELECT ar.*, s.name as shift_name, s.start_time as shift_start, s.end_time as shift_end, s.grace_minutes
      FROM attendance_records ar
      LEFT JOIN employee_shifts es ON es.employee_id = ar.employee_id AND es.effective_from <= ar.date AND (es.effective_to IS NULL OR es.effective_to >= ar.date)
      LEFT JOIN shifts s ON s.id = es.shift_id
      WHERE ar.employee_id = ${employeeId} AND ar.date >= ${from} AND ar.date <= ${to}
      ORDER BY ar.date DESC
    ` as Promise<any[]>;
  }
  async getReport(from: string, to: string, department?: string) {
    let query = `
      SELECT ar.*, e.first_name, e.last_name, e.employee_id as emp_code, e.department,
        s.name as shift_name, s.start_time as shift_start, s.end_time as shift_end, s.grace_minutes
      FROM attendance_records ar
      JOIN employees e ON e.id = ar.employee_id
      LEFT JOIN employee_shifts es ON es.employee_id = ar.employee_id AND es.effective_from <= ar.date AND (es.effective_to IS NULL OR es.effective_to >= ar.date)
      LEFT JOIN shifts s ON s.id = es.shift_id
      WHERE ar.date >= $1 AND ar.date <= $2
    `;
    const params: any[] = [from, to];
    if (department) { params.push(department); query += ` AND e.department = $${params.length}`; }
    query += ` ORDER BY ar.date DESC, e.first_name`;
    const rows = await this.sql(query, params) as any[];
    const hoursWorked = (ci: string | null, co: string | null) => {
      if (!ci || !co) return 0;
      return Math.max(0, (new Date(co).getTime() - new Date(ci).getTime()) / 3600000);
    };
    const overtime = (ci: string | null, co: string | null, start: string | null, end: string | null) => {
      if (!ci || !co || !start || !end) return 0;
      const worked = hoursWorked(ci, co);
      const d = new Date(ci).toISOString().split("T")[0];
      const s = new Date(`${d}T${start}:00`).getTime();
      let e = new Date(`${d}T${end}:00`).getTime();
      if (e <= s) e += 86400000;
      const shiftH = (e - s) / 3600000;
      return Math.max(0, worked - shiftH);
    };
    return rows.map((r: any) => ({ ...r, hours_worked: hoursWorked(r.check_in_time, r.check_out_time), overtime: overtime(r.check_in_time, r.check_out_time, r.shift_start, r.shift_end) }));
  }
  async getRecordById(id: string) {
    const rows = await this.sql`SELECT * FROM attendance_records WHERE id = ${id}` as any[];
    return rows[0] ?? null;
  }
  async updateRecord(id: string, data: { checkInTime?: string | null; checkOutTime?: string | null; remarks?: string | null }, status: string, performedBy?: string | null, reason?: string, previous?: any) {
    const rows = await this.sql`
      UPDATE attendance_records SET
        check_in_time = COALESCE(${data.checkInTime ?? null}, check_in_time),
        check_out_time = COALESCE(${data.checkOutTime ?? null}, check_out_time),
        remarks = COALESCE(${data.remarks ?? null}, remarks),
        status = ${status},
        updated_at = NOW()
      WHERE id = ${id} RETURNING *
    ` as any[];
    if (rows[0] && (performedBy != null || reason != null)) await this.logAudit(id, "update", performedBy ?? null, reason ?? null, previous ? { check_in_time: [previous.check_in_time, data.checkInTime], check_out_time: [previous.check_out_time, data.checkOutTime], status: [previous.status, status] } : undefined);
    return rows[0] ?? null;
  }
  async deleteRecord(id: string) {
    await this.sql`DELETE FROM attendance_records WHERE id = ${id}`;
  }
  async getDailySummary(date: string) {
    const rows = await this.sql`
      SELECT ar.id, ar.employee_id, ar.date, ar.check_in_time, ar.check_out_time, ar.status, ar.remarks,
        e.first_name, e.last_name, e.employee_id as emp_code, e.department
      FROM attendance_records ar
      JOIN employees e ON e.id = ar.employee_id
      WHERE ar.date = ${date}
      ORDER BY e.first_name
    ` as any[];
    return rows;
  }
}
