import type { Request, Response, NextFunction } from "express";
import { NotificationService } from "./NotificationService.js";
import { ApiResponse } from "../../core/utils/apiResponse.js";
import { getRequestTz } from "../../lib/timezone.js";
import { neon } from "@neondatabase/serverless";

export class NotificationController {
  private readonly service = new NotificationService();
  constructor() { this.list = this.list.bind(this); }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sql = neon(process.env.DATABASE_URL!);
      const userTz = await getRequestTz(req, sql);
      const result = await this.service.getNotifications(
        { id: req.user!.id, role: req.user!.role, employeeId: req.user!.employeeId },
        userTz,
      );
      // Maintain backwards-compatible shape: { notifications, role }
      res.status(200).json(result);
    } catch (err) { next(err); }
  }
}
