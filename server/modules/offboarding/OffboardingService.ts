import { OffboardingRepository } from "./OffboardingRepository.js";
import { NotFoundError, ValidationError, ConflictError } from "../../core/types/index.js";
import { onOffboardingComplete } from "../../lib/offboardingHooks.js";

export class OffboardingService {
  private readonly repo = new OffboardingRepository();

  async list(status?: string) { return this.repo.list(status); }
  async getById(id: string) { const r = await this.repo.getById(id); if (!r) throw new NotFoundError("Offboarding record", id); return r; }

  async initiate(data: any, initiatedBy: string, todayStr: string) {
    const { employeeId, offboardingType, reason, noticeRequired, noticePeriodDays, exitDateOverride, remarks } = data;
    if (!employeeId || !offboardingType) throw new ValidationError("employeeId and offboardingType are required");

    const emp = await this.repo.getEmployee(employeeId);
    if (!emp) throw new NotFoundError("Employee", employeeId);
    if (emp.employment_status === "offboarded") throw new ValidationError("Employee is already offboarded");
    if (emp.employment_status === "terminated") throw new ValidationError("Employee is already terminated");

    if (exitDateOverride) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(exitDateOverride) || isNaN(Date.parse(exitDateOverride))) throw new ValidationError("Invalid exit date format. Use YYYY-MM-DD.");
    }
    if (await this.repo.getActiveOffboarding(employeeId)) throw new ConflictError("An active offboarding already exists for this employee");
    if (await this.repo.getPendingOnboarding(employeeId)) throw new ValidationError("Cannot initiate offboarding while employee is still being onboarded");

    let exitDate: string; let status: string;
    if (noticeRequired && noticePeriodDays && noticePeriodDays > 0) {
      exitDate = exitDateOverride ?? (() => { const d = new Date(todayStr + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + noticePeriodDays); return d.toISOString().slice(0, 10); })();
      status = "in_notice";
    } else { exitDate = exitDateOverride || todayStr; status = "initiated"; }

    const record = await this.repo.createRecord({ employeeId, initiatedBy, offboardingType, reason, noticeRequired, noticePeriodDays, exitDate, status, remarks });
    await this.repo.updateEmployeeExitInfo(employeeId, offboardingType, reason, exitDate);
    await this.repo.generateDefaultTasks(record.id, employeeId);
    await this.repo.audit(record.id, "initiate", initiatedBy, `Offboarding initiated. Type: ${offboardingType}. Notice: ${noticeRequired ? noticePeriodDays + " days" : "None"}. Exit date: ${exitDate}`);

    // Do not auto-complete on initiate. HR must run through checklist (tasks, asset return, etc.)
    // and explicitly click "Complete Offboarding" when exit date has been reached.
    return record;
  }

  private async _completeInternal(offboardingId: string, employeeId: string, emp: any, performedBy: string) {
    await this.repo.completeRecord(offboardingId);
    await this.repo.offboardEmployee(employeeId);
    await this.repo.audit(offboardingId, "complete", performedBy, "Offboarding completed. Employee status set to offboarded. Integration hooks fired.");
    await onOffboardingComplete(emp);
  }

  async updateExitDate(id: string, exitDate: string, reason: string|null, performedBy: string) {
    const record = await this.repo.getById(id);
    if (!record) throw new NotFoundError("Offboarding record", id);
    if (record.status === "completed" || record.status === "cancelled") throw new ValidationError(`Cannot modify a ${record.status} offboarding`);
    const prevDate = record.exit_date;
    await this.repo.updateExitDate(id, exitDate, record.employee_id);
    await this.repo.audit(id, "update_exit_date", performedBy, `Exit date changed${reason ? ". Reason: " + reason : ""}`, String(prevDate), exitDate);
    return this.repo.getById(id);
  }

  async cancel(id: string, reason: string|null, performedBy: string) {
    const record = await this.repo.getById(id);
    if (!record) throw new NotFoundError("Offboarding record", id);
    if (record.status === "completed") throw new ValidationError("Cannot cancel a completed offboarding");
    if (record.status === "cancelled") throw new ValidationError("Already cancelled");
    await this.repo.cancelRecord(id, reason);
    await this.repo.revertEmployeeExitInfo(record.employee_id);
    await this.repo.audit(id, "cancel", performedBy, `Offboarding cancelled${reason ? ". Reason: " + reason : ""}`);
    return this.repo.getById(id);
  }

  async complete(id: string, todayStr: string, performedBy: string) {
    const record = await this.repo.getById(id);
    if (!record) throw new NotFoundError("Offboarding record", id);
    if (record.status === "completed") throw new ValidationError("Already completed");
    if (record.status === "cancelled") throw new ValidationError("Cannot complete a cancelled offboarding");
    const exitDateStr = typeof record.exit_date === "string" ? record.exit_date : (record.exit_date as Date).toISOString().slice(0, 10);
    const exitDateReached = exitDateStr <= todayStr;
    if (!exitDateReached) {
      const tasks = await this.repo.getTasks(id);
      const allDone = tasks.length === 0 || tasks.every((t: any) => t.status === "completed" || t.status === "waived");
      if (!allDone) throw new ValidationError(`Cannot complete before exit date (${exitDateStr}). Complete or waive all checklist items to complete early.`);
    }
    const emp = await this.repo.getEmployee(record.employee_id);
    if (!emp) throw new NotFoundError("Employee", record.employee_id);
    await this._completeInternal(id, emp.id, emp, performedBy);
    return this.repo.getById(id);
  }

  async updateTask(taskId: string, data: any, performedBy: string) {
    const task = await this.repo.getTask(taskId);
    if (!task) throw new NotFoundError("Task", taskId);
    const update = { ...data, _existing_completed_at: task.completed_at, _prev_status: task.status };
    const updated = await this.repo.updateTask(taskId, update);
    if (data.status === "completed" && task.task_type === "asset_return" && task.related_asset_id) {
      await this.repo.unassignAsset(task.related_asset_id);
    }
    return updated;
  }

  async getTasks(offboardingId: string) { return this.repo.getTasks(offboardingId); }
  async getAuditLog(offboardingId: string) { return this.repo.getAuditLog(offboardingId); }

  /** Full details by employee id (record + tasks with assignees + assets + audit). For frontend detail dialog. */
  async getDetailsByEmployeeId(employeeId: string) {
    const record = await this.repo.getRecordByEmployeeId(employeeId);
    if (!record) throw new NotFoundError("Offboarding record for employee", employeeId);
    const [tasks, assets, auditLog] = await Promise.all([
      this.repo.getTasksWithAssignees(record.id),
      this.repo.getAssetsForEmployee(employeeId),
      this.repo.getAuditLog(record.id),
    ]);
    const totalTasks = tasks.length;
    const doneTasks = tasks.filter((t: any) => t.status === "completed").length;
    return {
      ...record,
      total_tasks: totalTasks,
      done_tasks: doneTasks,
      tasks,
      assets,
      audit_log: auditLog,
    };
  }
}
