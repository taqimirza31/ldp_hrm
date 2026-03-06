import { BaseRepository } from "../../core/base/BaseRepository.js";

export class OffboardingRepository extends BaseRepository {
  async getEmployee(id: string) { const r = await this.sql`SELECT id,first_name,last_name,work_email,employment_status FROM employees WHERE id=${id}` as any[]; return r[0]??null; }
  async getActiveOffboarding(employeeId: string) { const r = await this.sql`SELECT id FROM offboarding_records WHERE employee_id=${employeeId} AND status IN('initiated','in_notice')` as any[]; return r[0]??null; }
  async getPendingOnboarding(employeeId: string) { const r = await this.sql`SELECT id FROM onboarding_records WHERE employee_id=${employeeId} AND status IN('not_started','in_progress')` as any[]; return r[0]??null; }
  async createRecord(data: any) {
    const r = await this.sql`INSERT INTO offboarding_records(employee_id,initiated_by,offboarding_type,reason,notice_required,notice_period_days,exit_date,status,remarks) VALUES(${data.employeeId},${data.initiatedBy},${data.offboardingType},${data.reason??null},${data.noticeRequired??false},${data.noticePeriodDays??null},${data.exitDate},${data.status},${data.remarks??null}) RETURNING *` as any[];
    return r[0];
  }
  async updateEmployeeExitInfo(employeeId: string, offboardingType: string, reason: string|null, exitDate: string) {
    await this.sql`UPDATE employees SET exit_type=${offboardingType},resignation_reason=${reason},exit_date=${exitDate},resignation_date=${offboardingType==="resignation"?new Date().toISOString():null},updated_at=NOW() WHERE id=${employeeId}`;
  }
  async generateDefaultTasks(offboardingId: string, employeeId: string) {
    const std = [["handover","Complete project handover documentation"],["knowledge_transfer","Knowledge transfer sessions with replacement/team"],["exit_interview","Conduct exit interview"],["final_settlement","Process final salary settlement"]];
    for (const [type,title] of std) await this.sql`INSERT INTO offboarding_tasks(offboarding_id,task_type,title) VALUES(${offboardingId},${type},${title})`;
    const assets = await this.sql`SELECT id,asset_id,processor FROM assigned_systems WHERE user_id=${employeeId}` as any[];
    for (const a of assets) await this.sql`INSERT INTO offboarding_tasks(offboarding_id,task_type,title,related_asset_id,notes) VALUES(${offboardingId},'asset_return',${"Return asset: "+a.asset_id+(a.processor?" ("+a.processor+")":"")},${a.id},${"Asset ID: "+a.asset_id})`;
  }
  async audit(offboardingId: string, action: string, performedBy: string, details: string, prevVal?: string, newVal?: string) {
    await this.sql`INSERT INTO offboarding_audit_log(offboarding_id,action,performed_by,details,previous_value,new_value) VALUES(${offboardingId},${action},${performedBy},${details},${prevVal??null},${newVal??null})`;
  }
  async completeRecord(id: string) { await this.sql`UPDATE offboarding_records SET status='completed',completed_at=NOW(),updated_at=NOW() WHERE id=${id}`; }
  async offboardEmployee(employeeId: string) { await this.sql`UPDATE employees SET employment_status='offboarded',exit_date=NOW(),updated_at=NOW() WHERE id=${employeeId}`; }
  async getById(id: string) { const r = await this.sql`SELECT * FROM offboarding_records WHERE id=${id}` as any[]; return r[0]??null; }
  async list(status?: string) {
    if (status) {
      return this.sql`
        SELECT o.*, e.first_name, e.last_name, e.department, e.employee_id as emp_id, e.job_title, e.work_email, e.avatar,
          initiator.first_name as initiator_first_name, initiator.last_name as initiator_last_name,
          (SELECT COUNT(*)::int FROM offboarding_tasks t WHERE t.offboarding_id = o.id) as total_tasks,
          (SELECT COUNT(*)::int FROM offboarding_tasks t WHERE t.offboarding_id = o.id AND t.status = 'completed') as done_tasks
        FROM offboarding_records o
        INNER JOIN employees e ON e.id = o.employee_id
        LEFT JOIN employees initiator ON initiator.id = o.initiated_by
        WHERE o.status = ${status}
        ORDER BY o.exit_date ASC
      ` as Promise<any[]>;
    }
    return this.sql`
      SELECT o.*, e.first_name, e.last_name, e.department, e.employee_id as emp_id, e.job_title, e.work_email, e.avatar,
        initiator.first_name as initiator_first_name, initiator.last_name as initiator_last_name,
        (SELECT COUNT(*)::int FROM offboarding_tasks t WHERE t.offboarding_id = o.id) as total_tasks,
        (SELECT COUNT(*)::int FROM offboarding_tasks t WHERE t.offboarding_id = o.id AND t.status = 'completed') as done_tasks
      FROM offboarding_records o
      INNER JOIN employees e ON e.id = o.employee_id
      LEFT JOIN employees initiator ON initiator.id = o.initiated_by
      ORDER BY o.created_at DESC
    ` as Promise<any[]>;
  }

  /** Get the active or most recent offboarding record for an employee with employee and initiator display fields. */
  async getRecordByEmployeeId(employeeId: string) {
    const r = await this.sql`
      SELECT o.*, e.first_name, e.last_name, e.department, e.job_title, e.work_email, e.employee_id as emp_id, e.employment_status,
        initiator.first_name as initiator_first_name, initiator.last_name as initiator_last_name
      FROM offboarding_records o
      INNER JOIN employees e ON e.id = o.employee_id
      LEFT JOIN employees initiator ON initiator.id = o.initiated_by
      WHERE o.employee_id = ${employeeId}
      ORDER BY CASE WHEN o.status IN ('initiated','in_notice') THEN 0 ELSE 1 END, o.created_at DESC
      LIMIT 1
    ` as any[];
    return r[0] ?? null;
  }

  /** Tasks with assignee names for detail view. */
  async getTasksWithAssignees(offboardingId: string) {
    return this.sql`
      SELECT t.*, a.first_name as assignee_first_name, a.last_name as assignee_last_name
      FROM offboarding_tasks t
      LEFT JOIN employees a ON a.id = t.assigned_to
      WHERE t.offboarding_id = ${offboardingId}
      ORDER BY t.created_at ASC
    ` as Promise<any[]>;
  }

  /** Assigned systems for an employee (for offboarding asset list). */
  async getAssetsForEmployee(employeeId: string) {
    return this.sql`
      SELECT id, asset_id, user_name, ram, storage, processor, 'assigned' as status, created_at as assigned_date
      FROM assigned_systems
      WHERE user_id = ${employeeId}
      ORDER BY created_at ASC
    ` as Promise<any[]>;
  }
  async updateExitDate(id: string, exitDate: string, employeeId: string) {
    await this.sql`UPDATE offboarding_records SET exit_date=${exitDate},updated_at=NOW() WHERE id=${id}`;
    await this.sql`UPDATE employees SET exit_date=${exitDate},updated_at=NOW() WHERE id=${employeeId}`;
  }
  async cancelRecord(id: string, reason: string|null) {
    await this.sql`UPDATE offboarding_records SET status='cancelled',remarks=COALESCE(${reason},remarks),updated_at=NOW() WHERE id=${id}`;
  }
  async revertEmployeeExitInfo(employeeId: string) { await this.sql`UPDATE employees SET exit_date=NULL,exit_type=NULL,resignation_date=NULL,resignation_reason=NULL,updated_at=NOW() WHERE id=${employeeId}`; }
  // Tasks
  async getTask(taskId: string) { const r = await this.sql`SELECT * FROM offboarding_tasks WHERE id=${taskId}` as any[]; return r[0]??null; }
  async updateTask(taskId: string, data: any) {
    let completedAt = data._existing_completed_at ?? null;
    if (data.status === "completed" && data._prev_status !== "completed") completedAt = new Date().toISOString();
    const r = await this.sql`UPDATE offboarding_tasks SET status=COALESCE(${data.status??null},status),notes=COALESCE(${data.notes??null},notes),assigned_to=COALESCE(${data.assignedTo??null},assigned_to),completed_at=${completedAt},updated_at=NOW() WHERE id=${taskId} RETURNING *` as any[];
    return r[0]??null;
  }
  async unassignAsset(assetId: string) { await this.sql`UPDATE assigned_systems SET user_id=NULL,updated_at=NOW() WHERE id=${assetId}`; }
  async getTasks(offboardingId: string) { return this.sql`SELECT * FROM offboarding_tasks WHERE offboarding_id=${offboardingId} ORDER BY created_at ASC` as Promise<any[]>; }
  async getAuditLog(offboardingId: string) { return this.sql`SELECT * FROM offboarding_audit_log WHERE offboarding_id=${offboardingId} ORDER BY created_at ASC` as Promise<any[]>; }
}
