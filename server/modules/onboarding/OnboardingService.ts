import { OnboardingRepository } from "./OnboardingRepository.js";
import type { OnboardingRow, OnboardingTaskRow } from "./OnboardingRepository.js";
import type { OnboardingResponseDTO, OnboardingTaskDTO } from "./Onboarding.dto.js";
import { NotFoundError, ConflictError, ValidationError, UnprocessableError } from "../../core/types/index.js";

export class OnboardingService {
  private readonly repo = new OnboardingRepository();

  async listAll(): Promise<OnboardingResponseDTO[]> {
    return (await this.repo.findAll()).map(r => this.toDTO(r));
  }

  async getRecord(id: string): Promise<OnboardingResponseDTO> {
    const row = await this.repo.findById(id);
    if (!row) throw new NotFoundError("Onboarding record", id);
    const tasks = await this.repo.getTasks(id);
    return { ...this.toDTO(row), tasks: tasks.map(this.toTaskDTO) };
  }

  async getByEmployee(employeeId: string): Promise<OnboardingResponseDTO> {
    const row = await this.repo.findByEmployeeId(employeeId);
    if (!row) throw new NotFoundError("Onboarding record for employee", employeeId);
    return this.toDTO(row);
  }

  async createRecord(employeeId: string, ownerId: string): Promise<OnboardingResponseDTO> {
    const emp = await this.repo.getEmployeeStatus(employeeId);
    if (!emp) throw new NotFoundError("Employee", employeeId);
    if (["offboarded", "terminated"].includes(emp.employment_status)) {
      throw new UnprocessableError("Cannot onboard an offboarded or terminated employee");
    }
    const existing = await this.repo.findExistingByEmployee(employeeId);
    if (existing) {
      if (existing.status === "in_progress") throw new ConflictError("Employee already has an active onboarding record");
      throw new ConflictError("Onboarding cannot be restarted once completed");
    }
    const record = await this.repo.create(employeeId, ownerId);
    await this.repo.seedDefaultTasks(record.id);
    const tasks = await this.repo.getTasks(record.id);
    const empDetails = await this.repo.getEmployeeDetails(employeeId);
    return { ...this.toDTO({ ...record, ...empDetails }), tasks: tasks.map(this.toTaskDTO) };
  }

  async updateRecord(id: string, status: string, completedAt?: string | null): Promise<OnboardingResponseDTO> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError("Onboarding record", id);
    const updated = await this.repo.update(id, status, completedAt ?? null);
    return this.toDTO(updated);
  }

  async deleteRecord(id: string): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError("Onboarding record", id);
    await this.repo.delete(id);
  }

  async addTask(recordId: string, taskName: string): Promise<OnboardingTaskDTO> {
    if (!taskName?.trim()) throw new ValidationError("taskName is required");
    const task = await this.repo.addTask(recordId, taskName.trim());
    return this.toTaskDTO(task);
  }

  async updateTask(recordId: string, taskId: string, completed?: boolean, assignmentDetails?: string): Promise<OnboardingTaskDTO> {
    const existing = await this.repo.getTaskById(taskId, recordId);
    if (!existing) throw new NotFoundError("Task", taskId);
    const newDetails = assignmentDetails !== undefined ? assignmentDetails : existing.assignment_details;
    let newCompleted: boolean = existing.completed === true || existing.completed === "true";
    if (completed !== undefined) {
      if (completed === true && !newDetails?.trim()) {
        throw new ValidationError("Save assignment details before marking task complete");
      }
      newCompleted = completed;
    }
    const updated = await this.repo.updateTask(taskId, recordId, newCompleted, newDetails ?? null);
    // Special: Microsoft Account completion → sync work email
    const detailsToUse = (newDetails ?? existing.assignment_details)?.trim();
    const isEmail = detailsToUse && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(detailsToUse);
    if (existing.task_name === "Company Microsoft Account" && newCompleted && isEmail) {
      const rec = await this.repo.findById(recordId);
      if (rec?.employee_id) await this.repo.setEmployeeWorkEmail(rec.employee_id, detailsToUse!);
    }
    return this.toTaskDTO(updated);
  }

  async deleteTask(recordId: string, taskId: string): Promise<void> {
    const existing = await this.repo.getTaskById(taskId, recordId);
    if (!existing) throw new NotFoundError("Task", taskId);
    if (existing.category === "Company-wide") throw new UnprocessableError("Cannot delete company-wide tasks");
    await this.repo.deleteTask(taskId, recordId);
  }

  private toDTO(r: OnboardingRow): OnboardingResponseDTO {
    return {
      id: r.id, employeeId: r.employee_id, ownerId: r.owner_id, status: r.status,
      completedAt: r.completed_at ? (r.completed_at instanceof Date ? r.completed_at.toISOString() : String(r.completed_at)) : null,
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
      firstName: r.first_name ?? "", lastName: r.last_name ?? "",
      workEmail: r.work_email ?? "", jobTitle: r.job_title ?? null,
      department: r.department ?? null, joinDate: r.join_date ?? null,
      hireName: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim(),
      hireRole: r.job_title ?? null, hireDepartment: r.department ?? null,
      hireEmail: r.work_email ?? "", startDate: r.join_date ?? null,
      taskCount: r.task_count ?? 0, completedCount: r.completed_count ?? 0,
    };
  }

  private toTaskDTO(t: OnboardingTaskRow): OnboardingTaskDTO {
    return {
      id: t.id, onboardingRecordId: t.onboarding_record_id,
      taskName: t.task_name, category: t.category, completed: t.completed === true || t.completed === "true",
      assignmentDetails: t.assignment_details, sortOrder: t.sort_order,
      completedAt: t.completed_at ? (t.completed_at instanceof Date ? t.completed_at.toISOString() : String(t.completed_at)) : null,
      createdAt: t.created_at instanceof Date ? t.created_at.toISOString() : String(t.created_at),
      updatedAt: t.updated_at instanceof Date ? t.updated_at.toISOString() : String(t.updated_at),
    };
  }
}
