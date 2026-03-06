import { BaseRepository } from "../../core/base/BaseRepository.js";

export const COMPANY_WIDE_TASKS = [
  { task_name: "Company Microsoft Account", category: "Company-wide", sort_order: 0 },
  { task_name: "Laptop", category: "Company-wide", sort_order: 1 },
];

export interface OnboardingRow {
  id: string; employee_id: string; owner_id: string; status: string;
  completed_at: Date | null; created_at: Date; updated_at: Date;
  first_name?: string; last_name?: string; work_email?: string;
  job_title?: string | null; department?: string | null; join_date?: string | null;
  task_count?: number; completed_count?: number;
}
export interface OnboardingTaskRow {
  id: string; onboarding_record_id: string; task_name: string; category: string;
  completed: string; assignment_details: string | null; completed_at: Date | null;
  sort_order: number; created_at: Date; updated_at: Date;
}

export class OnboardingRepository extends BaseRepository {
  async findAll(): Promise<OnboardingRow[]> {
    return this.sql`
      SELECT r.id, r.employee_id, r.owner_id, r.status, r.completed_at, r.created_at, r.updated_at,
             e.first_name, e.last_name, e.work_email, e.job_title, e.department, e.join_date,
             (SELECT COUNT(*)::int FROM onboarding_tasks t WHERE t.onboarding_record_id = r.id) as task_count,
             (SELECT COUNT(*)::int FROM onboarding_tasks t WHERE t.onboarding_record_id = r.id AND t.completed = 'true') as completed_count
      FROM onboarding_records r INNER JOIN employees e ON e.id = r.employee_id
      ORDER BY r.status ASC, r.created_at DESC
    ` as Promise<OnboardingRow[]>;
  }

  async findById(id: string): Promise<OnboardingRow | null> {
    const rows = await this.sql`
      SELECT r.*, e.first_name, e.last_name, e.work_email, e.job_title, e.department, e.join_date
      FROM onboarding_records r INNER JOIN employees e ON e.id = r.employee_id WHERE r.id = ${id}
    ` as OnboardingRow[];
    return rows[0] ?? null;
  }

  async findByEmployeeId(employeeId: string): Promise<OnboardingRow | null> {
    const rows = await this.sql`
      SELECT r.*,
        (SELECT COUNT(*)::int FROM onboarding_tasks t WHERE t.onboarding_record_id = r.id) as task_count,
        (SELECT COUNT(*)::int FROM onboarding_tasks t WHERE t.onboarding_record_id = r.id AND t.completed = 'true') as completed_count
      FROM onboarding_records r WHERE r.employee_id = ${employeeId} ORDER BY r.created_at DESC LIMIT 1
    ` as OnboardingRow[];
    return rows[0] ?? null;
  }

  async findExistingByEmployee(employeeId: string): Promise<{ id: string; status: string } | null> {
    const rows = await this.sql`SELECT id, status FROM onboarding_records WHERE employee_id = ${employeeId}` as any[];
    return rows[0] ?? null;
  }

  async getEmployeeStatus(employeeId: string): Promise<{ id: string; employment_status: string } | null> {
    const rows = await this.sql`SELECT id, employment_status FROM employees WHERE id = ${employeeId}` as any[];
    return rows[0] ?? null;
  }

  async getEmployeeDetails(employeeId: string): Promise<any | null> {
    const rows = await this.sql`SELECT first_name, last_name, job_title, department, work_email, join_date FROM employees WHERE id = ${employeeId}` as any[];
    return rows[0] ?? null;
  }

  async getTasks(recordId: string): Promise<OnboardingTaskRow[]> {
    return this.sql`SELECT * FROM onboarding_tasks WHERE onboarding_record_id = ${recordId} ORDER BY sort_order ASC, created_at ASC` as Promise<OnboardingTaskRow[]>;
  }

  async getTaskById(taskId: string, recordId: string): Promise<OnboardingTaskRow | null> {
    const rows = await this.sql`SELECT * FROM onboarding_tasks WHERE id = ${taskId} AND onboarding_record_id = ${recordId}` as OnboardingTaskRow[];
    return rows[0] ?? null;
  }

  async create(employeeId: string, ownerId: string): Promise<OnboardingRow> {
    const rows = await this.sql`
      INSERT INTO onboarding_records (employee_id, owner_id, status) VALUES (${employeeId}, ${ownerId}, 'in_progress') RETURNING *
    ` as OnboardingRow[];
    return rows[0];
  }

  async seedDefaultTasks(recordId: string): Promise<void> {
    for (const t of COMPANY_WIDE_TASKS) {
      await this.sql`INSERT INTO onboarding_tasks (onboarding_record_id, task_name, category, sort_order) VALUES (${recordId}, ${t.task_name}, ${t.category}, ${t.sort_order})`;
    }
  }

  async update(id: string, status: string, completedAt: string | null): Promise<OnboardingRow> {
    await this.sql`UPDATE onboarding_records SET status = ${status}, completed_at = ${completedAt}, updated_at = NOW() WHERE id = ${id}`;
    if (status === "completed") {
      const rec = await this.findById(id);
      if (rec?.employee_id) {
        await this.sql`UPDATE employees SET employment_status = 'active', updated_at = NOW() WHERE id = ${rec.employee_id}`;
      }
    }
    return (await this.findById(id))!;
  }

  async delete(id: string): Promise<void> {
    await this.sql`DELETE FROM onboarding_tasks WHERE onboarding_record_id = ${id}`;
    await this.sql`DELETE FROM onboarding_records WHERE id = ${id}`;
  }

  async addTask(recordId: string, taskName: string): Promise<OnboardingTaskRow> {
    const maxOrder = await this.sql`SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM onboarding_tasks WHERE onboarding_record_id = ${recordId}` as any[];
    const sortOrder = maxOrder[0]?.next_order ?? 0;
    const rows = await this.sql`
      INSERT INTO onboarding_tasks (onboarding_record_id, task_name, category, sort_order)
      VALUES (${recordId}, ${taskName}, 'Additional Assigned Items', ${sortOrder}) RETURNING *
    ` as OnboardingTaskRow[];
    return rows[0];
  }

  async updateTask(taskId: string, recordId: string, completed: string, details: string | null): Promise<OnboardingTaskRow> {
    const rows = await this.sql`
      UPDATE onboarding_tasks SET
        completed = ${completed},
        assignment_details = COALESCE(${details}, assignment_details),
        completed_at = CASE WHEN ${completed} = 'true' THEN NOW() ELSE NULL END,
        updated_at = NOW()
      WHERE id = ${taskId} AND onboarding_record_id = ${recordId} RETURNING *
    ` as OnboardingTaskRow[];
    return rows[0];
  }

  async setEmployeeWorkEmail(employeeId: string, email: string): Promise<void> {
    await this.sql`UPDATE employees SET work_email = ${email}, updated_at = NOW() WHERE id = ${employeeId}`;
  }

  async deleteTask(taskId: string, recordId: string): Promise<void> {
    await this.sql`DELETE FROM onboarding_tasks WHERE id = ${taskId} AND onboarding_record_id = ${recordId}`;
  }
}
