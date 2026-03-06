/**
 * DepartmentController — thin HTTP adapter between Express and DepartmentService.
 *
 * Rules:
 *  • Handle req / res / next only.
 *  • Validate incoming payloads using the module's Zod schemas.
 *  • Call a single service method per handler.
 *  • Return a standardized response via ApiResponse helpers.
 *  • Pass all errors to next(err) — the global error handler takes it from there.
 *  • No business logic, no SQL.
 */

import type { Request, Response, NextFunction } from "express";
import { DepartmentService } from "./DepartmentService.js";
import {
  CreateDepartmentSchema,
  UpdateDepartmentSchema,
} from "./Department.validators.js";
import { ApiResponse } from "../../core/utils/apiResponse.js";
import { parsePagination } from "../../core/utils/pagination.js";

export class DepartmentController {
  private readonly service: DepartmentService;

  constructor() {
    this.service = new DepartmentService();
    // Bind handlers so 'this' is correct when Express invokes them
    this.list    = this.list.bind(this);
    this.getById = this.getById.bind(this);
    this.create  = this.create.bind(this);
    this.update  = this.update.bind(this);
    this.remove  = this.remove.bind(this);
  }

  /**
   * GET /api/departments?page=1&limit=20&search=eng
   * Returns a paginated list of departments.
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const params = parsePagination(req.query as Record<string, unknown>);
      const result = await this.service.listDepartments(params);
      ApiResponse.paginated(res, result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/departments/:id
   * Returns a single department.
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dept = await this.service.getDepartment(req.params.id);
      ApiResponse.ok(res, dept);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/departments
   * Create a new department.
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = CreateDepartmentSchema.safeParse(req.body);
      if (!parsed.success) {
        const message = parsed.error.errors.map((e) => e.message).join("; ");
        ApiResponse.error(res, 400, message, "VALIDATION_ERROR");
        return;
      }
      const dept = await this.service.createDepartment(parsed.data);
      ApiResponse.created(res, dept, "Department created");
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/departments/:id
   * Partially update a department (all body fields optional).
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = UpdateDepartmentSchema.safeParse(req.body);
      if (!parsed.success) {
        const message = parsed.error.errors.map((e) => e.message).join("; ");
        ApiResponse.error(res, 400, message, "VALIDATION_ERROR");
        return;
      }
      const dept = await this.service.updateDepartment(req.params.id, parsed.data);
      ApiResponse.ok(res, dept, "Department updated");
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/departments/:id
   * Delete a department (guarded: must have no active employees).
   */
  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.service.deleteDepartment(req.params.id);
      ApiResponse.noContent(res);
    } catch (err) {
      next(err);
    }
  }
}
