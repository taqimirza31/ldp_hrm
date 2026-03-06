import { BaseRepository } from "../../core/base/BaseRepository.js";

export class NotificationRepository extends BaseRepository {
  async getMyLeave(employeeId: string) {
    return this.sql`
      SELECT lr.id, lr.status, lr.start_date, lr.end_date, lr.applied_at, lt.name as type_name
      FROM leave_requests lr INNER JOIN leave_types lt ON lt.id = lr.leave_type_id
      WHERE lr.employee_id = ${employeeId} ORDER BY lr.applied_at DESC LIMIT 5
    ` as Promise<any[]>;
  }
  async getMyChangeRequests(requesterId: string) {
    return this.sql`
      SELECT id, status, created_at, category FROM change_requests
      WHERE requester_id = ${requesterId} ORDER BY created_at DESC LIMIT 5
    ` as Promise<any[]>;
  }
  async getMyOnboarding(employeeId: string) {
    return this.sql`
      SELECT r.id, r.status, r.created_at,
        (SELECT COUNT(*)::int FROM onboarding_tasks t WHERE t.onboarding_record_id = r.id AND t.completed = 'false') as pending_tasks
      FROM onboarding_records r WHERE r.employee_id = ${employeeId} AND r.status = 'in_progress' LIMIT 1
    ` as Promise<any[]>;
  }
  async getPendingApprovals(employeeId: string) {
    return this.sql`
      SELECT la.id, la.leave_request_id, lr.start_date, lr.end_date, lr.total_days,
             lt.name as type_name, e.first_name, e.last_name, lr.applied_at
      FROM leave_approvals la
      INNER JOIN leave_requests lr ON lr.id = la.leave_request_id
      INNER JOIN leave_types lt ON lt.id = lr.leave_type_id
      INNER JOIN employees e ON e.id = lr.employee_id
      WHERE la.approver_id = ${employeeId} AND la.status = 'pending' AND lr.status = 'pending'
      ORDER BY lr.applied_at ASC LIMIT 15
    ` as Promise<any[]>;
  }
  async getPendingChangeCount() {
    return this.sql`SELECT COUNT(*)::int as c FROM change_requests WHERE status = 'pending'` as Promise<any[]>;
  }
  async getOnboardingInProgress() {
    return this.sql`
      SELECT r.id, e.first_name, e.last_name, e.department, r.created_at
      FROM onboarding_records r INNER JOIN employees e ON e.id = r.employee_id
      WHERE r.status = 'in_progress' ORDER BY r.created_at DESC LIMIT 5
    ` as Promise<any[]>;
  }
  async getTentativePending() {
    return this.sql`
      SELECT tr.id, c.first_name, c.last_name, tr.created_at
      FROM tentative_records tr
      INNER JOIN applications a ON a.id = tr.application_id
      INNER JOIN candidates c ON c.id = a.candidate_id
      WHERE tr.status = 'pending' ORDER BY tr.created_at ASC LIMIT 5
    ` as Promise<any[]>;
  }
  async getOffboardingPending() {
    return this.sql`
      SELECT o.id, e.first_name, e.last_name, o.exit_date, o.status
      FROM offboarding_records o INNER JOIN employees e ON e.id = o.employee_id
      WHERE o.status IN ('initiated', 'in_notice') ORDER BY o.exit_date ASC LIMIT 5
    ` as Promise<any[]>;
  }
  async getNewApplications() {
    return this.sql`
      SELECT a.id, c.first_name, c.last_name, j.title as job_title, a.stage_updated_at
      FROM applications a
      INNER JOIN candidates c ON c.id = a.candidate_id
      INNER JOIN job_postings j ON j.id = a.job_id
      WHERE a.stage IN ('applied', 'screening') ORDER BY a.stage_updated_at DESC LIMIT 5
    ` as Promise<any[]>;
  }
  async getOffersSent() {
    return this.sql`
      SELECT a.id, c.first_name, c.last_name, j.title as job_title, a.updated_at
      FROM applications a
      INNER JOIN candidates c ON c.id = a.candidate_id
      INNER JOIN job_postings j ON j.id = a.job_id
      WHERE a.stage = 'offer' ORDER BY a.updated_at DESC LIMIT 5
    ` as Promise<any[]>;
  }
  async getProbationAlerts(todayStr: string) {
    return this.sql`
      SELECT e.id, e.first_name, e.last_name, e.probation_end_date FROM employees e
      WHERE e.probation_end_date IS NOT NULL AND e.confirmation_date IS NULL
        AND e.employment_status = 'active'
        AND e.probation_end_date >= ${todayStr}::date
        AND e.probation_end_date <= (${todayStr}::date + INTERVAL '7 days')
      ORDER BY e.probation_end_date ASC LIMIT 10
    ` as Promise<any[]>;
  }
}
