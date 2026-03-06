import { BaseRepository } from "../../core/base/BaseRepository.js";

export class LeaveRepository extends BaseRepository {
  // ── Audit ─────────────────────────────────────────────────────────────────────
  async audit(entityType: string, entityId: string, action: string, performedBy: string|null, metadata?: any) {
    return this.sql`INSERT INTO leave_audit_log(entity_type,entity_id,action,performed_by,metadata) VALUES(${entityType},${entityId},${action},${performedBy},${metadata?JSON.stringify(metadata):null})`;
  }

  // ── Policies ──────────────────────────────────────────────────────────────────
  async listPolicies() { return this.sql`SELECT p.*,(SELECT COUNT(*)::int FROM leave_types lt WHERE lt.policy_id=p.id) as type_count FROM leave_policies p ORDER BY p.created_at DESC` as Promise<any[]>; }
  async getPolicyById(id: string) { const r = await this.sql`SELECT * FROM leave_policies WHERE id=${id}` as any[]; return r[0]??null; }
  async getPolicyTypes(policyId: string) { return this.sql`SELECT * FROM leave_types WHERE policy_id=${policyId} ORDER BY name` as Promise<any[]>; }
  async updatePolicy(id: string, u: any) { const r = await this.sql`UPDATE leave_policies SET name=COALESCE(${u.name??null},name),applicable_departments=COALESCE(${u.applicableDepartments?JSON.stringify(u.applicableDepartments):null},applicable_departments),applicable_employment_types=COALESCE(${u.applicableEmploymentTypes?JSON.stringify(u.applicableEmploymentTypes):null},applicable_employment_types),applicable_roles=COALESCE(${u.applicableRoles?JSON.stringify(u.applicableRoles):null},applicable_roles),effective_from=COALESCE(${u.effectiveFrom??null},effective_from),effective_to=COALESCE(${u.effectiveTo??null},effective_to),policy_year=COALESCE(${u.policyYear!=null?u.policyYear:null},policy_year),is_active=COALESCE(${u.isActive??null},is_active),updated_at=NOW() WHERE id=${id} RETURNING *` as any[]; return r[0]??null; }
  async deletePolicy(id: string) { await this.sql`DELETE FROM leave_policies WHERE id=${id}`; }
  async policyHasRequests(id: string) { const r = await this.sql`SELECT 1 FROM leave_requests lr INNER JOIN leave_types lt ON lt.id=lr.leave_type_id WHERE lt.policy_id=${id} LIMIT 1` as any[]; return r.length>0; }
  async getAllActivePolicies(today: string) { return this.sql`SELECT * FROM leave_policies WHERE is_active=true AND effective_from<=${today} AND (effective_to IS NULL OR effective_to>=${today}) ORDER BY created_at DESC` as Promise<any[]>; }

  // ── Leave Types ───────────────────────────────────────────────────────────────
  async getTypeById(id: string) { const r = await this.sql`SELECT * FROM leave_types WHERE id=${id}` as any[]; return r[0]??null; }
  async updateType(id: string, t: any) { const r = await this.sql`UPDATE leave_types SET name=COALESCE(${t.name??null},name),paid=COALESCE(${t.paid??null},paid),accrual_type=COALESCE(${t.accrualType??null},accrual_type),accrual_rate=COALESCE(${t.accrualRate??null},accrual_rate),max_balance=COALESCE(${t.maxBalance??null},max_balance),carry_forward_allowed=COALESCE(${t.carryForwardAllowed??null},carry_forward_allowed),max_carry_forward=COALESCE(${t.maxCarryForward??null},max_carry_forward),requires_document=COALESCE(${t.requiresDocument??null},requires_document),requires_approval=COALESCE(${t.requiresApproval??null},requires_approval),auto_approve_rules=COALESCE(${t.autoApproveRules?JSON.stringify(t.autoApproveRules):null},auto_approve_rules),hr_approval_required=COALESCE(${t.hrApprovalRequired??null},hr_approval_required),min_days=COALESCE(${t.minDays??null},min_days),max_days_per_request=COALESCE(${t.maxDaysPerRequest??null},max_days_per_request),blocked_during_notice=COALESCE(${t.blockedDuringNotice??null},blocked_during_notice),color=COALESCE(${t.color??null},color),updated_at=NOW() WHERE id=${id} RETURNING *` as any[]; return r[0]??null; }
  async deleteType(id: string) { await this.sql`DELETE FROM leave_types WHERE id=${id}`; }
  async typeHasRequests(id: string) { const r = await this.sql`SELECT 1 FROM leave_requests WHERE leave_type_id=${id} LIMIT 1` as any[]; return r.length>0; }
  async typeBalancesAbove(id: string, max: number) { const r = await this.sql`SELECT 1 FROM employee_leave_balances WHERE leave_type_id=${id} AND balance::numeric>${max} LIMIT 1` as any[]; return r.length>0; }
  async getTypesByPolicyIds(policyIds: string[]) { return this.sql`SELECT * FROM leave_types WHERE policy_id=ANY(${policyIds}) ORDER BY name` as Promise<any[]>; }
  async getTypeByPolicyId(policyId: string) { return this.sql`SELECT id FROM leave_types WHERE policy_id=${policyId} LIMIT 1` as Promise<any[]>; }
  async findEarnedLeaveTypeId() { const r = await this.sql`SELECT id FROM leave_types WHERE LOWER(name) LIKE ANY(ARRAY['%earned%','%annual%']) OR LOWER(TRIM(name))='el' LIMIT 1` as any[]; return r[0]?.id??null; }
  async findBereavementLeaveTypeId() { const r = await this.sql`SELECT id FROM leave_types WHERE LOWER(name) LIKE '%bereavement%' LIMIT 1` as any[]; return r[0]?.id??null; }
  async resolveLeaveTypeByName(name: string) {
    const n = name.trim().toLowerCase(); if (!n) return null;
    const rows = await this.sql`SELECT id,name FROM leave_types WHERE LOWER(TRIM(name)) LIKE ${n+"%"} OR LOWER(TRIM(name))=${n} ORDER BY LENGTH(name) ASC LIMIT 5` as any[];
    if (!rows.length) return null;
    const exact = rows.find((r:any)=>r.name.trim().toLowerCase()===n); if (exact) return exact.id;
    if (n.includes("earned")||n==="el"||n==="annual") { const r=rows.find((r:any)=>/earned|annual|^el$/i.test(String(r.name))); if (r) return r.id; }
    if (n.includes("lwop")||n.includes("unpaid")||n.includes("sick")||n.includes("casual")) { const r=rows.find((r:any)=>/lwop|unpaid|sick|casual/i.test(String(r.name))); if (r) return r.id; }
    if (n.includes("bereavement")) { const r=rows.find((r:any)=>/bereavement/i.test(String(r.name))); if (r) return r.id; }
    return rows[0]?.id??null;
  }

  // ── Holidays ──────────────────────────────────────────────────────────────────
  async listHolidays() { return this.sql`SELECT id,date,name FROM leave_holidays ORDER BY date` as Promise<any[]>; }
  async createHoliday(date: string, name: string|null) { const r = await this.sql`INSERT INTO leave_holidays(date,name) VALUES(${date},${name}) RETURNING id,date,name,created_at` as any[]; return r[0]; }
  async deleteHoliday(id: string) { const r = await this.sql`DELETE FROM leave_holidays WHERE id=${id} RETURNING id` as any[]; return r.length>0; }
  async getHolidaysBetween(start: string, end: string) { return this.sql`SELECT date FROM leave_holidays WHERE date>=${start} AND date<=${end}` as Promise<{date:string}[]>; }

  // ── Balances ──────────────────────────────────────────────────────────────────
  async getBalances(employeeId: string) {
    return this.sql`SELECT DISTINCT ON(lt.id) elb.id,elb.employee_id,lt.id as leave_type_id,COALESCE(elb.balance,0)::text as balance,COALESCE(elb.used,0)::text as used,lt.name as type_name,lt.paid,lt.max_balance,lt.color,lt.accrual_type,lt.accrual_rate,lt.requires_document,lp.name as policy_name FROM leave_types lt INNER JOIN leave_policies lp ON lp.id=lt.policy_id LEFT JOIN employee_leave_balances elb ON elb.leave_type_id=lt.id AND elb.employee_id=${employeeId} WHERE lp.name='Standard Leave Policy' ORDER BY lt.id,elb.updated_at DESC NULLS LAST` as Promise<any[]>;
  }
  async getBalance(employeeId: string, leaveTypeId: string) { return this.sql`SELECT id,balance,used FROM employee_leave_balances WHERE employee_id=${employeeId} AND leave_type_id=${leaveTypeId}` as Promise<any[]>; }
  async getBalancesForEmployee(employeeId: string, typeIds: string[]) { return this.sql`SELECT leave_type_id,balance,used FROM employee_leave_balances WHERE employee_id=${employeeId} AND leave_type_id=ANY(${typeIds})` as Promise<any[]>; }
  async insertBalance(employeeId: string, leaveTypeId: string, balance: number) { await this.sql`INSERT INTO employee_leave_balances(employee_id,leave_type_id,balance,used,last_accrual_at) VALUES(${employeeId},${leaveTypeId},${balance},0,NOW())`; }
  async insertBalanceWithNullAccrual(employeeId: string, leaveTypeId: string) { await this.sql`INSERT INTO employee_leave_balances(employee_id,leave_type_id,balance,used,last_accrual_at) VALUES(${employeeId},${leaveTypeId},0,0,NULL)`; }
  async deductBalance(employeeId: string, leaveTypeId: string, days: number) { return this.sql`UPDATE employee_leave_balances SET balance=balance::numeric-${days},used=used::numeric+${days},updated_at=NOW() WHERE employee_id=${employeeId} AND leave_type_id=${leaveTypeId} AND balance::numeric>=${days} RETURNING id` as Promise<any[]>; }
  async restoreBalance(employeeId: string, leaveTypeId: string, days: number) { await this.sql`UPDATE employee_leave_balances SET balance=balance::numeric+${days},used=used::numeric-${days},updated_at=NOW() WHERE employee_id=${employeeId} AND leave_type_id=${leaveTypeId}`; }
  async adjustBalance(id: string, newBalance: number) { await this.sql`UPDATE employee_leave_balances SET balance=${newBalance},updated_at=NOW() WHERE id=${id}`; }
  async addToBalance(id: string, newBalance: number) { await this.sql`UPDATE employee_leave_balances SET balance=${newBalance},updated_at=NOW() WHERE id=${id}`; }
  async getBalanceById(id: string) { const r = await this.sql`SELECT elb.*,lt.name as type_name FROM employee_leave_balances elb INNER JOIN leave_types lt ON lt.id=elb.leave_type_id WHERE elb.id=${id}` as any[]; return r[0]??null; }
  async getMonthlyAccrualBalances(currentMonth: string) { return this.sql`SELECT elb.*,lt.accrual_rate,lt.max_balance,lt.name as type_name FROM employee_leave_balances elb INNER JOIN leave_types lt ON lt.id=elb.leave_type_id WHERE lt.accrual_type='monthly' AND lt.accrual_rate IS NOT NULL AND(LOWER(lt.name) NOT LIKE '%earned%' AND LOWER(lt.name) NOT LIKE '%annual%' AND LOWER(TRIM(lt.name))<>'el') AND(elb.last_accrual_at IS NULL OR TO_CHAR(elb.last_accrual_at,'YYYY-MM')<${currentMonth})` as Promise<any[]>; }
  async updateAccrual(id: string, nb: number) { await this.sql`UPDATE employee_leave_balances SET balance=${nb},last_accrual_at=NOW(),updated_at=NOW() WHERE id=${id}`; }
  async updateEarnedLeaveAccrual(id: string, nb: number, lastAccrualAt: string) { await this.sql`UPDATE employee_leave_balances SET balance=${nb},last_accrual_at=${lastAccrualAt}::timestamptz,updated_at=NOW() WHERE id=${id}`; }
  async getEarnedLeaveBalances(elTypeId: string) { return this.sql`SELECT elb.id,elb.employee_id,elb.balance,elb.last_accrual_at,elb.leave_type_id,e.join_date FROM employee_leave_balances elb INNER JOIN employees e ON e.id=elb.employee_id WHERE elb.leave_type_id=${elTypeId} AND e.employment_status='active'` as Promise<any[]>; }
  async getActiveEmployees() { return this.sql`SELECT e.id,e.department,e.employee_type FROM employees e WHERE e.employment_status='active'` as Promise<any[]>; }
  async getExistingELBalanceEmployeeIds(elTypeId: string) { return this.sql`SELECT employee_id FROM employee_leave_balances WHERE leave_type_id=${elTypeId}` as Promise<any[]>; }

  // ── Requests ──────────────────────────────────────────────────────────────────
  async getRequestById(id: string) { const r = await this.sql`SELECT lr.*,lt.paid FROM leave_requests lr INNER JOIN leave_types lt ON lt.id=lr.leave_type_id WHERE lr.id=${id}` as any[]; return r[0]??null; }
  async getRequestWithType(id: string) { const r = await this.sql`SELECT lr.*,lt.name as type_name,lt.color,lt.paid,lt.requires_document,e.first_name,e.last_name,e.employee_id as emp_code,e.department FROM leave_requests lr INNER JOIN leave_types lt ON lt.id=lr.leave_type_id INNER JOIN employees e ON e.id=lr.employee_id WHERE lr.id=${id}` as any[]; return r[0]??null; }
  async getMyRequests(employeeId: string, limit: number, offset: number) { return this.sql`SELECT lr.id,lr.leave_type_id,lr.start_date,lr.end_date,lr.day_type,lr.total_days,lr.reason,lr.status,lr.applied_at,lr.decided_at,lr.rejection_reason,lt.name as type_name,lt.color,lt.paid FROM leave_requests lr INNER JOIN leave_types lt ON lt.id=lr.leave_type_id WHERE lr.employee_id=${employeeId} ORDER BY lr.applied_at DESC LIMIT ${limit} OFFSET ${offset}` as Promise<any[]>; }
  async getEmployeeRequests(employeeId: string) { return this.sql`SELECT lr.id,lr.leave_type_id,lr.start_date,lr.end_date,lr.day_type,lr.total_days,lr.reason,lr.status,lr.applied_at,lr.decided_at,lr.rejection_reason,lt.name as type_name,lt.color,lt.paid FROM leave_requests lr INNER JOIN leave_types lt ON lt.id=lr.leave_type_id WHERE lr.employee_id=${employeeId} ORDER BY lr.applied_at DESC LIMIT 50` as Promise<any[]>; }
  async listRequests(params: {role:string;employeeId?:string|null;status?:string;from?:string;to?:string;limit:number;offset:number}) {
    let query = `SELECT lr.id,lr.employee_id,lr.leave_type_id,lr.start_date,lr.end_date,lr.day_type,lr.total_days,lr.reason,lr.status,lr.applied_at,lr.decided_at,lr.rejection_reason,lt.name as type_name,lt.color,lt.paid,e.first_name,e.last_name,e.employee_id as emp_code,e.department FROM leave_requests lr INNER JOIN leave_types lt ON lt.id=lr.leave_type_id INNER JOIN employees e ON e.id=lr.employee_id`;
    const conds: string[] = []; const ps: any[] = [];
    if (params.role==="manager"&&params.employeeId) { ps.push(params.employeeId); conds.push(`e.manager_id=$${ps.length}`); }
    if (params.status&&params.status!=="all") { ps.push(params.status); conds.push(`lr.status=$${ps.length}`); }
    if (params.from) { ps.push(params.from); conds.push(`lr.end_date>=$${ps.length}`); }
    if (params.to) { ps.push(params.to); conds.push(`lr.start_date<=$${ps.length}`); }
    if (conds.length) query+=" WHERE "+conds.join(" AND ");
    ps.push(params.limit, params.offset);
    query+=` ORDER BY lr.applied_at DESC LIMIT $${ps.length-1} OFFSET $${ps.length}`;
    return this.sql(query, ps) as Promise<any[]>;
  }
  async createRequest(d: any) { const r = await this.sql`INSERT INTO leave_requests(employee_id,leave_type_id,start_date,end_date,day_type,total_days,reason,attachment_url,status,policy_snapshot) VALUES(${d.employeeId},${d.leaveTypeId},${d.startDate},${d.endDate},${d.dayType||"full"},${d.totalDays},${d.reason||null},${d.attachmentUrl||null},'pending',${d.policySnapshot}::jsonb) RETURNING *` as any[]; return r[0]; }
  async createAutoApprovedRequest(d: any) { const r = await this.sql`INSERT INTO leave_requests(employee_id,leave_type_id,start_date,end_date,day_type,total_days,reason,attachment_url,status,decided_at,decided_by,policy_snapshot,attendance_sync_status) VALUES(${d.employeeId},${d.leaveTypeId},${d.startDate},${d.endDate},${d.dayType||"full"},${d.totalDays},${d.reason||null},${d.attachmentUrl||null},'approved',NOW(),'auto',${d.policySnapshot}::jsonb,'pending') RETURNING *` as any[]; return r[0]; }
  async updateRequestSyncStatus(id: string, status: string) { await this.sql`UPDATE leave_requests SET attendance_sync_status=${status} WHERE id=${id}`; }
  async cancelRequest(id: string) { return this.sql`UPDATE leave_requests SET status='cancelled',updated_at=NOW() WHERE id=${id} AND status IN('pending','approved') RETURNING id` as Promise<any[]>; }
  async approveRequest(id: string, decidedBy: string) { return this.sql`UPDATE leave_requests SET status='approved',decided_at=NOW(),decided_by=${decidedBy} WHERE id=${id} AND status='pending' RETURNING id` as Promise<any[]>; }
  async rejectRequest(id: string, decidedBy: string, reason: string) { return this.sql`UPDATE leave_requests SET status='rejected',decided_at=NOW(),decided_by=${decidedBy},rejection_reason=${reason} WHERE id=${id} AND status='pending' RETURNING id` as Promise<any[]>; }
  async checkOverlap(employeeId: string, startDate: string, endDate: string) { return this.sql`SELECT id FROM leave_requests WHERE employee_id=${employeeId} AND status IN('approved','pending') AND start_date<=${endDate} AND end_date>=${startDate}` as Promise<any[]>; }
  async getRequestsByFtId(ftId: string) { return this.sql`SELECT id,status,total_days FROM leave_requests WHERE freshteam_time_off_id=${ftId} LIMIT 1` as Promise<any[]>; }
  async createFtRequest(d: any) { await this.sql`INSERT INTO leave_requests(employee_id,leave_type_id,start_date,end_date,day_type,total_days,reason,status,applied_at,decided_at,decided_by,rejection_reason,freshteam_time_off_id) VALUES(${d.employeeId},${d.leaveTypeId},${d.startDate},${d.endDate},'full',${d.totalDays},${d.reason||null},${d.status},${d.appliedAt},${d.decidedAt},${d.decidedBy},${d.rejectionReason},${d.ftId})`; }
  async updateFtRequest(id: string, d: any) { await this.sql`UPDATE leave_requests SET employee_id=${d.employeeId},leave_type_id=${d.leaveTypeId},start_date=${d.startDate},end_date=${d.endDate},day_type='full',total_days=${d.totalDays},reason=${d.reason||null},status=${d.status},applied_at=${d.appliedAt},decided_at=${d.decidedAt},decided_by=${d.decidedBy},rejection_reason=${d.rejectionReason},updated_at=NOW() WHERE id=${id}`; }
  async updateFtBalance(employeeId: string, leaveTypeId: string, used: number) {
    const r = await this.sql`SELECT id,used FROM employee_leave_balances WHERE employee_id=${employeeId} AND leave_type_id=${leaveTypeId} LIMIT 1` as any[];
    if (r[0]) await this.sql`UPDATE employee_leave_balances SET used=${String(used)},updated_at=NOW() WHERE id=${r[0].id}`;
    else await this.sql`INSERT INTO employee_leave_balances(employee_id,leave_type_id,balance,used) VALUES(${employeeId},${leaveTypeId},0,${String(used)})`;
  }

  // ── Approvals ─────────────────────────────────────────────────────────────────
  async createApproval(d: {requestId:string;approverId:string;approverRole:string;stepOrder:number}) { await this.sql`INSERT INTO leave_approvals(leave_request_id,approver_id,approver_role,status,step_order) VALUES(${d.requestId},${d.approverId},${d.approverRole},'pending',${d.stepOrder})`; }
  async getApprovalById(id: string) { const r = await this.sql`SELECT * FROM leave_approvals WHERE id=${id}` as any[]; return r[0]??null; }
  async getApprovals(requestId: string) { return this.sql`SELECT la.*,ae.first_name as approver_first_name,ae.last_name as approver_last_name FROM leave_approvals la INNER JOIN employees ae ON ae.id=la.approver_id WHERE la.leave_request_id=${requestId} ORDER BY la.step_order` as Promise<any[]>; }
  async getPendingApprovals(requestId: string) { return this.sql`SELECT id FROM leave_approvals WHERE leave_request_id=${requestId} AND status='pending'` as Promise<any[]>; }
  async setApprovalApproved(id: string, actedById: string|null, remarks?: string) { return this.sql`UPDATE leave_approvals SET status='approved',actioned_at=NOW(),remarks=${remarks||null},acted_by_id=${actedById} WHERE id=${id} AND status='pending' RETURNING id` as Promise<any[]>; }
  async setApprovalRejected(id: string, actedById: string|null, remarks?: string) { return this.sql`UPDATE leave_approvals SET status='rejected',actioned_at=NOW(),remarks=${remarks||null},acted_by_id=${actedById} WHERE id=${id} AND status='pending' RETURNING id` as Promise<any[]>; }
  async cancelPendingApprovals(requestId: string) { await this.sql`UPDATE leave_approvals SET status='rejected',actioned_at=NOW(),remarks='Request cancelled' WHERE leave_request_id=${requestId} AND status='pending'`; }
  async autoRejectRemaining(requestId: string) { await this.sql`UPDATE leave_approvals SET status='rejected',actioned_at=NOW(),remarks='Auto-rejected (prior step rejected)' WHERE leave_request_id=${requestId} AND status='pending'`; }
  async getMyApprovals(employeeId: string) {
    return this.sql`SELECT la.*,lr.employee_id,lr.leave_type_id,lr.start_date,lr.end_date,lr.day_type,lr.total_days,lr.reason,lr.status as request_status,lr.applied_at,lt.name as type_name,lt.color,lt.paid,e.first_name,e.last_name,e.employee_id as emp_code,e.department,e.avatar FROM leave_approvals la INNER JOIN leave_requests lr ON lr.id=la.leave_request_id INNER JOIN leave_types lt ON lt.id=lr.leave_type_id INNER JOIN employees e ON e.id=lr.employee_id WHERE la.approver_id=${employeeId} AND la.status='pending' AND lr.status='pending' AND lr.employee_id!=${employeeId} ORDER BY la.created_at ASC` as Promise<any[]>;
  }
  async getHrApprovals(employeeId: string) {
    return this.sql`SELECT la.*,lr.employee_id,lr.leave_type_id,lr.start_date,lr.end_date,lr.day_type,lr.total_days,lr.reason,lr.status as request_status,lr.applied_at,lt.name as type_name,lt.color,lt.paid,e.first_name,e.last_name,e.employee_id as emp_code,e.department,e.avatar FROM leave_approvals la INNER JOIN leave_requests lr ON lr.id=la.leave_request_id INNER JOIN leave_types lt ON lt.id=lr.leave_type_id INNER JOIN employees e ON e.id=lr.employee_id WHERE la.approver_role IN('hr','admin') AND la.status='pending' AND lr.status='pending' AND lr.employee_id!=${employeeId} ORDER BY la.created_at ASC` as Promise<any[]>;
  }

  // ── Attendance Sync ───────────────────────────────────────────────────────────
  async getRequestForSync(requestId: string) { const r = await this.sql`SELECT lr.*,lt.name as type_name FROM leave_requests lr INNER JOIN leave_types lt ON lt.id=lr.leave_type_id WHERE lr.id=${requestId}` as any[]; return r[0]??null; }
  async getAttendanceRecord(employeeId: string, dateStr: string) { return this.sql`SELECT id FROM attendance_records WHERE employee_id=${employeeId} AND date=${dateStr}` as Promise<any[]>; }
  async upsertAttendanceLeave(employeeId: string, dateStr: string, status: string, remarks: string, existing: any[]) {
    if (existing.length>0) await this.sql`UPDATE attendance_records SET remarks=${remarks},status=${status},updated_at=NOW() WHERE id=${existing[0].id}`;
    else await this.sql`INSERT INTO attendance_records(employee_id,date,source,status,remarks,created_by) VALUES(${employeeId},${dateStr},'manual',${status},${remarks},'leave_system')`;
  }
  async deleteLeaveAttendance(employeeId: string, dateStr: string) { await this.sql`DELETE FROM attendance_records WHERE employee_id=${employeeId} AND date=${dateStr} AND check_in_time IS NULL AND created_by='leave_system'`; }

  // ── Year-end ──────────────────────────────────────────────────────────────────
  async getActiveEmployeesWithCode() { return this.sql`SELECT id,employee_id FROM employees WHERE employment_status='active' ORDER BY employee_id` as Promise<any[]>; }
  async getELBalance(employeeId: string, elTypeId: string) { return this.sql`SELECT id,employee_id,leave_type_id,balance,used,last_reset_at FROM employee_leave_balances WHERE employee_id=${employeeId} AND leave_type_id=${elTypeId}` as Promise<any[]>; }
  async getEmployeeDeptType(employeeId: string) { const r = await this.sql`SELECT department,employee_type FROM employees WHERE id=${employeeId}` as any[]; return r[0]??null; }
  async snapshotBalance(employeeId: string, leaveTypeId: string, year: number, balance: number, used: number) { await this.sql`INSERT INTO leave_year_end_snapshots(employee_id,leave_type_id,year,balance,used,snapshot_at) VALUES(${employeeId},${leaveTypeId},${year},${balance},${used},NOW())`; }
  async resetELBalance(id: string, resetDate: string) { await this.sql`UPDATE employee_leave_balances SET balance=0,last_reset_at=${resetDate}::timestamptz,updated_at=NOW() WHERE id=${id}`; }
  async resetBereavementBalance(id: string, days: number, resetDate: string) { await this.sql`UPDATE employee_leave_balances SET balance=${days},last_reset_at=${resetDate}::timestamptz,updated_at=NOW() WHERE id=${id}`; }
  async insertBereavementBalance(employeeId: string, typeId: string, days: number, resetDate: string) { await this.sql`INSERT INTO employee_leave_balances(employee_id,leave_type_id,balance,used,last_reset_at,last_accrual_at) VALUES(${employeeId},${typeId},${days},0,${resetDate}::timestamptz,NOW())`; }
  async tryInsertAccrualRun(period: string) { return this.sql`INSERT INTO leave_accrual_run(period,run_at) VALUES(${period},NOW()) ON CONFLICT(period) DO NOTHING RETURNING period` as Promise<any[]>; }

  // ── Calendar / Team / Stats ───────────────────────────────────────────────────
  async getCalendar(startDate: string, endDate: string, department?: string) {
    if (department) return this.sql`SELECT lr.id,lr.employee_id,lr.start_date,lr.end_date,lr.day_type,lr.total_days,lr.status,lt.name as type_name,lt.color,e.first_name,e.last_name,e.department,e.avatar FROM leave_requests lr INNER JOIN leave_types lt ON lt.id=lr.leave_type_id INNER JOIN employees e ON e.id=lr.employee_id WHERE lr.status='approved' AND lr.start_date<=${endDate} AND lr.end_date>=${startDate} AND e.department=${department} ORDER BY lr.start_date` as Promise<any[]>;
    return this.sql`SELECT lr.id,lr.employee_id,lr.start_date,lr.end_date,lr.day_type,lr.total_days,lr.status,lt.name as type_name,lt.color,e.first_name,e.last_name,e.department,e.avatar FROM leave_requests lr INNER JOIN leave_types lt ON lt.id=lr.leave_type_id INNER JOIN employees e ON e.id=lr.employee_id WHERE lr.status='approved' AND lr.start_date<=${endDate} AND lr.end_date>=${startDate} ORDER BY lr.start_date` as Promise<any[]>;
  }
  async getTeam(managerId: string) { return this.sql`SELECT e.id,e.first_name,e.last_name,e.employee_id as emp_code,e.department,e.avatar FROM employees e WHERE e.manager_id=${managerId} AND e.employment_status='active'` as Promise<any[]>; }
  async getTeamBalances(teamIds: string[]) { return this.sql`SELECT elb.employee_id,elb.balance,elb.used,lt.name as type_name,lt.color FROM employee_leave_balances elb INNER JOIN leave_types lt ON lt.id=elb.leave_type_id WHERE elb.employee_id=ANY(${teamIds})` as Promise<any[]>; }
  async getStats(role: string, employeeId: string|null, today: string) {
    const monthStart = today.slice(0,8)+"01";
    if (role==="manager"&&employeeId) {
      const [[p],[ol],[ap],[po]] = await Promise.all([this.sql`SELECT COUNT(*)::int as count FROM leave_approvals la INNER JOIN leave_requests lr ON lr.id=la.leave_request_id WHERE la.approver_id=${employeeId} AND la.status='pending' AND lr.status='pending'` as Promise<any[]>, this.sql`SELECT COUNT(*)::int as count FROM leave_requests lr INNER JOIN employees e ON e.id=lr.employee_id WHERE lr.status='approved' AND lr.start_date<=${today} AND lr.end_date>=${today} AND e.manager_id=${employeeId}` as Promise<any[]>, this.sql`SELECT COUNT(*)::int as count FROM leave_requests lr INNER JOIN employees e ON e.id=lr.employee_id WHERE lr.status='approved' AND lr.start_date>=${monthStart} AND e.manager_id=${employeeId}` as Promise<any[]>, this.sql`SELECT COUNT(*)::int as count FROM leave_policies WHERE is_active=true` as Promise<any[]>]);
      return { pendingRequests:p.count, onLeaveToday:ol.count, approvedThisMonth:ap.count, activePolicies:po.count };
    }
    const pendingFilter = role==="employee"&&employeeId?` AND employee_id='${employeeId}'`:"";
    const approvedFilter = role==="employee"&&employeeId?` AND lr.employee_id='${employeeId}'`:"";
    const [[pc],[apc],[tc],[tpo]] = await Promise.all([this.sql(`SELECT COUNT(*)::int as count FROM leave_requests WHERE status='pending'${pendingFilter}`, []) as Promise<any[]>, this.sql(`SELECT COUNT(*)::int as count FROM leave_requests lr WHERE lr.status='approved' AND lr.start_date<='${today}' AND lr.end_date>='${today}'${approvedFilter}`, []) as Promise<any[]>, this.sql`SELECT COUNT(*)::int as count FROM leave_requests WHERE status='approved' AND start_date>=${monthStart}` as Promise<any[]>, this.sql`SELECT COUNT(*)::int as count FROM leave_policies WHERE is_active=true` as Promise<any[]>]);
    return { pendingRequests:pc.count, onLeaveToday:apc.count, approvedThisMonth:tc.count, activePolicies:tpo.count };
  }

  // ── Employee helpers ──────────────────────────────────────────────────────────
  async getEmployeeDetails(employeeId: string) { const r = await this.sql`SELECT id,department,employee_type,employment_status,join_date,exit_date FROM employees WHERE id=${employeeId}` as any[]; return r[0]??null; }
  async getEmployeeById(id: string) { const r = await this.sql`SELECT id FROM employees WHERE id=${id}` as any[]; return r[0]??null; }
  async getUserEmployeeId(userId: string) { const r = await this.sql`SELECT employee_id FROM users WHERE id=${userId} AND employee_id IS NOT NULL` as any[]; return r[0]?.employee_id??null; }
  async getEmployeeManager(employeeId: string) { const r = await this.sql`SELECT manager_id FROM employees WHERE id=${employeeId}` as any[]; return r[0]??null; }
  async getHrAdminUsers(excludeEmployeeId: string) { return this.sql`SELECT u.employee_id,u.id as user_id,u.role FROM users u INNER JOIN employees e ON e.id=u.employee_id WHERE u.role IN('hr','admin') AND u.is_active='true' AND u.employee_id IS NOT NULL AND u.employee_id!=${excludeEmployeeId} LIMIT 1` as Promise<any[]>; }
  async getHrUsers() { return this.sql`SELECT u.id,u.email,u.role,u.employee_id FROM users u WHERE u.role IN('hr','admin') AND u.is_active='true' LIMIT 5` as Promise<any[]>; }
  async verifyEmployee(id: string) { const r = await this.sql`SELECT id FROM employees WHERE id=${id}` as any[]; return r[0]??null; }
  async verifyEmployees(ids: string[]) { return this.sql`SELECT id FROM employees WHERE id=ANY(${ids})` as Promise<any[]>; }
  async getEmployeeByEmail(email: string) { const r = await this.sql`SELECT id FROM employees WHERE (work_email=${email} OR personal_email=${email}) AND id!=${email} LIMIT 1` as any[]; return r[0]??null; }
  async updateUserEmployeeId(userId: string, employeeId: string) { await this.sql`UPDATE users SET employee_id=${employeeId} WHERE id=${userId}`; }
  async createSystemEmployee(email: string, role: string) {
    const empCode=`SYS-${role.toUpperCase()}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
    const emailPart=(email||"").split("@")[0]||role; const firstName=emailPart.charAt(0).toUpperCase()+emailPart.slice(1).toLowerCase();
    const r = await this.sql`INSERT INTO employees(employee_id,work_email,first_name,last_name,job_title,department,employment_status,join_date) VALUES(${empCode},${email},${firstName},${role==="admin"?"Administrator":"HR"},${role==="admin"?"System Administrator":"HR Manager"},'Human Resources','active',NOW()) RETURNING id` as any[];
    return r[0]??null;
  }
  async checkManagerIsEmployee(employeeId: string) { const r = await this.sql`SELECT manager_id FROM employees WHERE id=${employeeId}` as any[]; return r[0]??null; }
  async isInNoticePeriod(employeeId: string) { const r = await this.sql`SELECT id FROM offboarding_records WHERE employee_id=${employeeId} AND status IN('initiated','in_notice')` as any[]; return r.length>0; }
  async isManagerOf(managerId: string, employeeId: string) { const r = await this.sql`SELECT id FROM employees WHERE id=${employeeId} AND manager_id=${managerId}` as any[]; return r.length>0; }
  async getEmployeesByEmail(email: string) { return this.sql`SELECT id FROM employees WHERE LOWER(work_email)=${email} LIMIT 1` as Promise<any[]>; }

  // ── FreshTeam sync ─────────────────────────────────────────────────────────────
  async syncFtBalance(employeeId: string, leaveTypeId: string, balance: number, used: number) {
    const r = await this.sql`SELECT id FROM employee_leave_balances WHERE employee_id=${employeeId} AND leave_type_id=${leaveTypeId} LIMIT 1` as any[];
    if (r[0]) await this.sql`UPDATE employee_leave_balances SET balance=${String(balance)},used=${String(used)},updated_at=NOW() WHERE id=${r[0].id}`;
    else await this.sql`INSERT INTO employee_leave_balances(employee_id,leave_type_id,balance,used) VALUES(${employeeId},${leaveTypeId},${String(balance)},${String(used)})`;
  }
}
