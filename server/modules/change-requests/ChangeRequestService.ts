import { ChangeRequestRepository } from "./ChangeRequestRepository.js";
import type { ChangeRequestRow } from "./ChangeRequestRepository.js";
import type { ChangeRequestResponseDTO, BulkApproveResultDTO } from "./ChangeRequest.dto.js";
import { NotFoundError, ValidationError, ForbiddenError } from "../../core/types/index.js";

const FIELD_CATEGORIES: Record<string, string[]> = {
  personal_details: ["dob", "gender", "marital_status", "blood_group"],
  address: ["street", "city", "state", "country", "zip_code", "comm_street", "comm_city", "comm_state", "comm_country", "comm_zip_code"],
  contact: ["personal_email", "work_phone"],
  dependents: ["dependents_data"],
  emergency_contacts: ["emergency_contacts_data"],
  bank_details: ["bank_name", "account_number", "routing_number"],
};
const EMPLOYEE_EDITABLE_FIELDS = Object.values(FIELD_CATEGORIES).flat();

export class ChangeRequestService {
  private readonly repo = new ChangeRequestRepository();

  async listRequests(opts: { isAdminOrHR: boolean; requesterId: string; status?: string; employeeId?: string; limit: number; offset: number }): Promise<ChangeRequestResponseDTO[]> {
    return (await this.repo.findAll(opts)).map(this.toDTO);
  }

  async countPending(): Promise<{ count: number }> {
    return { count: await this.repo.countPending() };
  }

  async submitRequest(requesterId: string, requestingUserEmployeeId: string | null, employeeId: string, fieldName: string, newValue: string, category?: string, isAdminOrHR = false): Promise<ChangeRequestResponseDTO> {
    if (requestingUserEmployeeId !== employeeId && !isAdminOrHR) {
      throw new ForbiddenError("You can only request changes for your own profile");
    }
    const snakeField = fieldName.replace(/([A-Z])/g, "_$1").toLowerCase();
    if (!EMPLOYEE_EDITABLE_FIELDS.includes(snakeField)) {
      throw new ValidationError(`Field '${fieldName}' cannot be changed via self-service. Contact HR.`);
    }
    const detectedCategory = category ?? Object.entries(FIELD_CATEGORIES).find(([, f]) => f.includes(snakeField))?.[0] ?? "personal_details";
    const emp = await this.repo.getEmployee(employeeId);
    if (!emp) throw new NotFoundError("Employee", employeeId);
    const oldValue = emp[snakeField]?.toString() ?? null;
    const row = await this.repo.create(requesterId, employeeId, detectedCategory, snakeField, oldValue, newValue);
    return this.toDTO(row);
  }

  async submitBulkRequest(requesterId: string, requestingUserEmployeeId: string | null, employeeId: string, category: string, changes: Record<string, string>, isAdminOrHR = false): Promise<ChangeRequestResponseDTO[]> {
    if (requestingUserEmployeeId !== employeeId && !isAdminOrHR) {
      throw new ForbiddenError("You can only request changes for your own profile");
    }
    const emp = await this.repo.getEmployee(employeeId);
    if (!emp) throw new NotFoundError("Employee", employeeId);
    const created: ChangeRequestResponseDTO[] = [];
    for (const [field, newValue] of Object.entries(changes)) {
      const snakeField = field.replace(/([A-Z])/g, "_$1").toLowerCase();
      if (!EMPLOYEE_EDITABLE_FIELDS.includes(snakeField)) continue;
      const oldValue = emp[snakeField]?.toString() ?? null;
      const row = await this.repo.create(requesterId, employeeId, category, snakeField, oldValue, String(newValue));
      created.push(this.toDTO(row));
    }
    return created;
  }

  async approveRequest(id: string, reviewedBy: string, reviewNotes?: string): Promise<ChangeRequestResponseDTO> {
    const req = await this.repo.findPendingById(id);
    if (!req) throw new NotFoundError("Pending change request", id);
    if (!EMPLOYEE_EDITABLE_FIELDS.includes(req.field_name)) throw new ValidationError("Invalid field in change request");
    await this.repo.applyChange(req.employee_id, req.field_name, req.new_value);
    const updated = await this.repo.markApproved(id, reviewedBy, reviewNotes ?? null);
    return this.toDTO(updated);
  }

  async rejectRequest(id: string, reviewedBy: string, reviewNotes: string): Promise<ChangeRequestResponseDTO> {
    if (!reviewNotes?.trim()) throw new ValidationError("Rejection reason is required");
    const updated = await this.repo.markRejected(id, reviewedBy, reviewNotes);
    if (!updated) throw new NotFoundError("Pending change request", id);
    return this.toDTO(updated);
  }

  async deleteRequest(id: string): Promise<void> {
    const deleted = await this.repo.deleteById(id);
    if (!deleted) throw new NotFoundError("Change request", id);
  }

  async bulkApprove(requestIds: string[], reviewedBy: string, reviewNotes?: string): Promise<BulkApproveResultDTO> {
    const approved: string[] = [];
    const failed: { id: string; reason: string }[] = [];
    for (const id of requestIds) {
      try {
        const req = await this.repo.findPendingById(id);
        if (!req) { failed.push({ id, reason: "Not found or already processed" }); continue; }
        if (!EMPLOYEE_EDITABLE_FIELDS.includes(req.field_name)) { failed.push({ id, reason: "Invalid field" }); continue; }
        await this.repo.applyChange(req.employee_id, req.field_name, req.new_value);
        await this.repo.markApproved(id, reviewedBy, reviewNotes ?? null);
        approved.push(id);
      } catch { failed.push({ id, reason: "Processing error" }); }
    }
    return { approved, failed };
  }

  private toDTO(r: ChangeRequestRow): ChangeRequestResponseDTO {
    return {
      id: r.id, requesterId: r.requester_id, employeeId: r.employee_id, category: r.category,
      fieldName: r.field_name, oldValue: r.old_value, newValue: r.new_value, status: r.status,
      reviewedBy: r.reviewed_by, reviewNotes: r.review_notes,
      reviewedAt: r.reviewed_at ? (r.reviewed_at instanceof Date ? r.reviewed_at.toISOString() : String(r.reviewed_at)) : null,
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
      employeeName: r.employee_name, employeeCode: r.employee_code, requesterEmail: r.requester_email,
    };
  }
}
