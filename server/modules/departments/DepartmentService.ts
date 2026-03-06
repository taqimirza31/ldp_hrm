/**
 * DepartmentService — all business logic for the departments module.
 *
 * Rules:
 *  • Orchestrate one or more repositories; never issue SQL directly.
 *  • Throw AppError subclasses (NotFoundError, ConflictError, …) — the global error
 *    handler converts them to HTTP responses so the service stays HTTP-free.
 *  • No req / res / next anywhere in this file.
 *  • Methods are independently testable.
 */

import { DepartmentRepository } from "./DepartmentRepository.js";
import type { DepartmentRow } from "./DepartmentRepository.js";
import type { DepartmentResponseDTO } from "./Department.dto.js";
import type { CreateDepartmentInput, UpdateDepartmentInput } from "./Department.validators.js";
import type { PaginatedResult, PaginationParams } from "../../core/types/index.js";
import { buildPaginationMeta } from "../../core/utils/pagination.js";
import {
  NotFoundError,
  ConflictError,
  UnprocessableError,
} from "../../core/types/index.js";

export class DepartmentService {
  private readonly repo: DepartmentRepository;

  constructor() {
    this.repo = new DepartmentRepository();
  }

  // ─── List ──────────────────────────────────────────────────────────────────

  async listDepartments(
    params: PaginationParams,
  ): Promise<PaginatedResult<DepartmentResponseDTO>> {
    const { rows, total } = await this.repo.findAll(params);
    return {
      data: rows.map(this.toDTO),
      meta: buildPaginationMeta(total, params),
    };
  }

  // ─── Get single ────────────────────────────────────────────────────────────

  async getDepartment(id: string): Promise<DepartmentResponseDTO> {
    const row = await this.repo.findById(id);
    if (!row) throw new NotFoundError("Department", id);
    return this.toDTO(row);
  }

  // ─── Create ────────────────────────────────────────────────────────────────

  async createDepartment(data: CreateDepartmentInput): Promise<DepartmentResponseDTO> {
    // Business rule: department names must be unique (case-insensitive)
    const existing = await this.repo.findByName(data.name);
    if (existing) {
      throw new ConflictError(`A department named '${data.name}' already exists`);
    }

    const row = await this.repo.create(data);
    return this.toDTO(row);
  }

  // ─── Update ────────────────────────────────────────────────────────────────

  async updateDepartment(
    id: string,
    data: UpdateDepartmentInput,
  ): Promise<DepartmentResponseDTO> {
    // Check the target record exists
    const target = await this.repo.findById(id);
    if (!target) throw new NotFoundError("Department", id);

    // If renaming, ensure no duplicate
    if (data.name && data.name.toLowerCase() !== target.name.toLowerCase()) {
      const duplicate = await this.repo.findByName(data.name);
      if (duplicate) {
        throw new ConflictError(`A department named '${data.name}' already exists`);
      }
    }

    const updated = await this.repo.update(id, data);
    if (!updated) throw new NotFoundError("Department", id);
    return this.toDTO(updated);
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  async deleteDepartment(id: string): Promise<void> {
    const target = await this.repo.findById(id);
    if (!target) throw new NotFoundError("Department", id);

    // Business rule: cannot delete a department that still has active employees
    if ((target.employee_count ?? 0) > 0) {
      throw new UnprocessableError(
        `Cannot delete '${target.name}' — it has ${target.employee_count} active employee(s). ` +
          "Reassign or terminate them first.",
      );
    }

    await this.repo.delete(id);
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /** Map a raw DB row to the public response DTO. */
  private toDTO(row: DepartmentRow): DepartmentResponseDTO {
    return {
      id: row.id,
      name: row.name,
      freshteamId: row.freshteam_id,
      employeeCount: Number(row.employee_count ?? 0),
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : String(row.created_at),
      updatedAt:
        row.updated_at instanceof Date
          ? row.updated_at.toISOString()
          : String(row.updated_at),
    };
  }
}
