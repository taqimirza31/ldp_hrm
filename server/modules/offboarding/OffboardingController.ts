import type { Request, Response, NextFunction } from "express";
import { OffboardingService } from "./OffboardingService.js";
import { ApiResponse } from "../../core/utils/apiResponse.js";
import { getRequestTz, todayInTz } from "../../lib/timezone.js";
import { neon } from "@neondatabase/serverless";

export class OffboardingController {
  private readonly svc = new OffboardingService();
  constructor() { const b = (c: any) => { for (const k of Object.getOwnPropertyNames(Object.getPrototypeOf(c))) if (k !== "constructor" && typeof c[k] === "function") c[k] = c[k].bind(c); }; b(this); }

  async list(req: Request, res: Response, next: NextFunction) { try { ApiResponse.ok(res, await this.svc.list(req.query.status as string)); } catch (e) { next(e); } }
  async getById(req: Request, res: Response, next: NextFunction) { try { ApiResponse.ok(res, await this.svc.getById(req.params.id)); } catch (e) { next(e); } }
  async getDetailsByEmployee(req: Request, res: Response, next: NextFunction) { try { ApiResponse.ok(res, await this.svc.getDetailsByEmployeeId(req.params.employeeId)); } catch (e) { next(e); } }

  async initiate(req: Request, res: Response, next: NextFunction) {
    try {
      const sql = neon(process.env.DATABASE_URL!);
      const tz = await getRequestTz(req, sql);
      const todayStr = todayInTz(tz);
      const initiatedBy = req.user!.employeeId ?? null; // must be employee id (FK); null when user has no employee (e.g. admin/HR-only)
      ApiResponse.created(res, await this.svc.initiate(req.body, initiatedBy, todayStr));
    } catch (e) { next(e); }
  }

  async updateExitDate(req: Request, res: Response, next: NextFunction) {
    try {
      const { exitDate, reason } = req.body;
      if (!exitDate) { ApiResponse.error(res, 400, "exitDate is required", "VALIDATION_ERROR"); return; }
      ApiResponse.ok(res, await this.svc.updateExitDate(req.params.id, exitDate, reason, req.user!.employeeId || req.user!.id));
    } catch (e) { next(e); }
  }

  async cancel(req: Request, res: Response, next: NextFunction) {
    try { ApiResponse.ok(res, await this.svc.cancel(req.params.id, req.body.reason, req.user!.employeeId || req.user!.id)); } catch (e) { next(e); }
  }

  async complete(req: Request, res: Response, next: NextFunction) {
    try {
      const sql = neon(process.env.DATABASE_URL!);
      const tz = await getRequestTz(req, sql);
      const todayStr = todayInTz(tz);
      ApiResponse.ok(res, await this.svc.complete(req.params.id, todayStr, req.user!.employeeId || req.user!.id));
    } catch (e) { next(e); }
  }

  async updateTask(req: Request, res: Response, next: NextFunction) {
    try { ApiResponse.ok(res, await this.svc.updateTask(req.params.taskId, req.body, req.user!.employeeId || req.user!.id)); } catch (e) { next(e); }
  }

  async getTasks(req: Request, res: Response, next: NextFunction) { try { ApiResponse.ok(res, await this.svc.getTasks(req.params.id)); } catch (e) { next(e); } }
  async getAuditLog(req: Request, res: Response, next: NextFunction) { try { ApiResponse.ok(res, await this.svc.getAuditLog(req.params.id)); } catch (e) { next(e); } }
}
