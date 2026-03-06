import type { Request, Response, NextFunction } from "express";
import { AttendanceService } from "./AttendanceService.js";
import { ApiResponse } from "../../core/utils/apiResponse.js";
import { getRequestTz } from "../../lib/timezone.js";
import { neon } from "@neondatabase/serverless";

export class AttendanceController {
  private readonly svc = new AttendanceService();
  constructor() { const b = (c: any) => { for (const k of Object.getOwnPropertyNames(Object.getPrototypeOf(c))) if (k !== "constructor" && typeof c[k] === "function") c[k] = c[k].bind(c); }; b(this); }

  async listShifts(_: Request, res: Response, next: NextFunction) { try { ApiResponse.ok(res, await this.svc.listShifts()); } catch (e) { next(e); } }
  async createShift(req: Request, res: Response, next: NextFunction) { try { ApiResponse.created(res, await this.svc.createShift(req.body)); } catch (e) { next(e); } }
  async updateShift(req: Request, res: Response, next: NextFunction) { try { ApiResponse.ok(res, await this.svc.updateShift(req.params.id, req.body)); } catch (e) { next(e); } }
  async deleteShift(req: Request, res: Response, next: NextFunction) { try { await this.svc.deleteShift(req.params.id); ApiResponse.ok(res, { success: true }); } catch (e) { next(e); } }

  async listEmployeeShifts(_: Request, res: Response, next: NextFunction) { try { ApiResponse.ok(res, await this.svc.listEmployeeShifts()); } catch (e) { next(e); } }
  async assignShift(req: Request, res: Response, next: NextFunction) { try { ApiResponse.created(res, await this.svc.assignShift(req.body.employeeId, req.body.shiftId, req.body.effectiveFrom, req.body.effectiveTo)); } catch (e) { next(e); } }
  async removeEmployeeShift(req: Request, res: Response, next: NextFunction) { try { await this.svc.removeEmployeeShift(req.params.id); ApiResponse.ok(res, { success: true }); } catch (e) { next(e); } }

  async checkIn(req: Request, res: Response, next: NextFunction) {
    try {
      const employeeId = req.user!.employeeId;
      if (!employeeId) { ApiResponse.error(res, 400, "No employee profile linked", "VALIDATION_ERROR"); return; }
      const sql = neon(process.env.DATABASE_URL!);
      const tz = await getRequestTz(req, sql);
      ApiResponse.created(res, await this.svc.checkIn(employeeId, tz, req.user!.id));
    } catch (e) { next(e); }
  }

  async checkOut(req: Request, res: Response, next: NextFunction) {
    try {
      const employeeId = req.user!.employeeId;
      if (!employeeId) { ApiResponse.error(res, 400, "No employee profile linked", "VALIDATION_ERROR"); return; }
      const sql = neon(process.env.DATABASE_URL!);
      const tz = await getRequestTz(req, sql);
      ApiResponse.ok(res, await this.svc.checkOut(employeeId, tz));
    } catch (e) { next(e); }
  }

  async listRecords(req: Request, res: Response, next: NextFunction) {
    try {
      ApiResponse.ok(res, await this.svc.listRecords({
        employeeId: req.query.employeeId as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        status: req.query.status as string,
        limit: Math.min(parseInt(req.query.limit as string) || 100, 500),
        offset: parseInt(req.query.offset as string) || 0,
      }));
    } catch (e) { next(e); }
  }

  async manualUpsert(req: Request, res: Response, next: NextFunction) {
    try {
      const { employeeId, date, ...data } = req.body;
      ApiResponse.ok(res, await this.svc.manualUpsert(employeeId, date, data, req.user!.id));
    } catch (e) { next(e); }
  }

  async listAudit(req: Request, res: Response, next: NextFunction) { try { ApiResponse.ok(res, await this.svc.listAudit(req.params.id)); } catch (e) { next(e); } }

  /** Raw JSON for frontend compatibility (Timesheets page expects unwrapped body). */
  async getToday(req: Request, res: Response, next: NextFunction) {
    try {
      const employeeId = req.user!.employeeId;
      if (!employeeId) { res.status(200).json(null); return; }
      const sql = neon(process.env.DATABASE_URL!);
      const tz = await getRequestTz(req, sql);
      const row = await this.svc.getToday(employeeId, tz);
      res.status(200).json(row);
    } catch (e) { next(e); }
  }

  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const sql = neon(process.env.DATABASE_URL!);
      const tz = await getRequestTz(req, sql);
      res.status(200).json(await this.svc.getStats(tz));
    } catch (e) { next(e); }
  }

  async getEmployeeRecords(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const role = req.user!.role;
      if (role === "employee" && req.user!.employeeId !== id) {
        res.status(403).json({ error: "You can only view your own attendance records" });
        return;
      }
      const sql = neon(process.env.DATABASE_URL!);
      const tz = await getRequestTz(req, sql);
      const { todayInTz } = await import("../../lib/timezone.js");
      const userToday = todayInTz(tz);
      const utcToday = new Date().toISOString().slice(0, 10);
      const from = (req.query.from as string) || (() => { const d = new Date(utcToday + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - 30); return d.toISOString().slice(0, 10); })();
      let to = (req.query.to as string) || userToday;
      // Frontend often sends UTC "today" as reportTo; records are stored in user's date. Ensure we include user's today.
      if (to < userToday) to = userToday;
      res.status(200).json(await this.svc.getEmployeeRecords(id, from, to));
    } catch (e) { next(e); }
  }

  async getReport(req: Request, res: Response, next: NextFunction) {
    try {
      const sql = neon(process.env.DATABASE_URL!);
      const tz = await getRequestTz(req, sql);
      const today = new Date().toISOString().slice(0, 10);
      const from = (req.query.from as string) || (() => { const d = new Date(today + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - 30); return d.toISOString().slice(0, 10); })();
      const to = (req.query.to as string) || today;
      const department = req.query.department as string | undefined;
      res.status(200).json(await this.svc.getReport(from, to, department));
    } catch (e) { next(e); }
  }

  async updateRecord(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { checkInTime, checkOutTime, remarks } = req.body;
      const sql = neon(process.env.DATABASE_URL!);
      const tz = await getRequestTz(req, sql);
      const row = await this.svc.updateRecord(id, { checkInTime, checkOutTime, remarks }, tz, req.user!.id);
      if (!row) { res.status(404).json({ error: "Attendance record not found" }); return; }
      res.status(200).json(row);
    } catch (e) { next(e); }
  }

  async deleteRecord(req: Request, res: Response, next: NextFunction) {
    try {
      const found = await this.svc.deleteRecord(req.params.id);
      if (!found) { res.status(404).json({ error: "Attendance record not found" }); return; }
      res.status(200).json({ success: true });
    } catch (e) { next(e); }
  }

  async getDailySummary(req: Request, res: Response, next: NextFunction) {
    try {
      const sql = neon(process.env.DATABASE_URL!);
      const tz = await getRequestTz(req, sql);
      const { todayInTz } = await import("../../lib/timezone.js");
      const date = (req.query.date as string) || todayInTz(tz);
      res.status(200).json({ date, records: await this.svc.getDailySummary(date) });
    } catch (e) { next(e); }
  }
}
