import type { Request, Response, NextFunction } from "express";
import { OnboardingService } from "./OnboardingService.js";
import { ApiResponse } from "../../core/utils/apiResponse.js";

export class OnboardingController {
  private readonly service = new OnboardingService();
  constructor() {
    this.list = this.list.bind(this); this.getById = this.getById.bind(this);
    this.getByEmployee = this.getByEmployee.bind(this);
    this.create = this.create.bind(this); this.update = this.update.bind(this);
    this.remove = this.remove.bind(this); this.addTask = this.addTask.bind(this);
    this.updateTask = this.updateTask.bind(this); this.removeTask = this.removeTask.bind(this);
  }

  async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try { ApiResponse.ok(res, await this.service.listAll()); } catch (e) { next(e); }
  }
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try { ApiResponse.ok(res, await this.service.getRecord(req.params.id)); } catch (e) { next(e); }
  }
  async getByEmployee(req: Request, res: Response, next: NextFunction): Promise<void> {
    try { ApiResponse.ok(res, await this.service.getByEmployee(req.params.employeeId)); } catch (e) { next(e); }
  }
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const employeeId = req.body.employeeId ?? req.body.employee_id;
      if (!employeeId) { ApiResponse.error(res, 400, "employee_id is required", "VALIDATION_ERROR"); return; }
      ApiResponse.created(res, await this.service.createRecord(employeeId, req.user!.id));
    } catch (e) { next(e); }
  }
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = req.body.status;
      const completedAt = req.body.completedAt ?? req.body.completed_at;
      ApiResponse.ok(res, await this.service.updateRecord(req.params.id, status, completedAt));
    } catch (e) { next(e); }
  }
  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try { await this.service.deleteRecord(req.params.id); ApiResponse.noContent(res); } catch (e) { next(e); }
  }
  async addTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const taskName = req.body.taskName ?? req.body.task_name;
      ApiResponse.created(res, await this.service.addTask(req.params.id, taskName));
    } catch (e) { next(e); }
  }
  async updateTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { completed, assignmentDetails } = req.body;
      ApiResponse.ok(res, await this.service.updateTask(req.params.id, req.params.taskId, completed, assignmentDetails));
    } catch (e) { next(e); }
  }
  async removeTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    try { await this.service.deleteTask(req.params.id, req.params.taskId); ApiResponse.noContent(res); } catch (e) { next(e); }
  }
}
