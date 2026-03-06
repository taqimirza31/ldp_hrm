import type { Request, Response, NextFunction } from "express";
import { ChangeRequestService } from "./ChangeRequestService.js";
import { ApiResponse } from "../../core/utils/apiResponse.js";

export class ChangeRequestController {
  private readonly service = new ChangeRequestService();
  constructor() {
    this.list = this.list.bind(this); this.pendingCount = this.pendingCount.bind(this);
    this.submit = this.submit.bind(this); this.submitBulk = this.submitBulk.bind(this);
    this.approve = this.approve.bind(this); this.reject = this.reject.bind(this);
    this.bulkApprove = this.bulkApprove.bind(this); this.remove = this.remove.bind(this);
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user!;
      const isAdminOrHR = ["admin", "hr"].includes(user.role);
      const data = await this.service.listRequests({
        isAdminOrHR, requesterId: user.id,
        status: req.query.status as string,
        employeeId: req.query.employeeId as string,
        limit: Math.min(parseInt(req.query.limit as string) || 100, 500),
        offset: parseInt(req.query.offset as string) || 0,
      });
      ApiResponse.ok(res, data);
    } catch (e) { next(e); }
  }

  async pendingCount(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try { ApiResponse.ok(res, await this.service.countPending()); } catch (e) { next(e); }
  }

  async submit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { employeeId } = req.params;
      const { fieldName, newValue, category } = req.body;
      const user = req.user!;
      const data = await this.service.submitRequest(user.id, user.employeeId, employeeId, fieldName, newValue, category, ["admin","hr"].includes(user.role));
      ApiResponse.created(res, { message: "Change request submitted successfully", request: data, note: "Your request has been sent to HR for approval" });
    } catch (e) { next(e); }
  }

  async submitBulk(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { employeeId } = req.params;
      const { category, changes } = req.body;
      const user = req.user!;
      const requests = await this.service.submitBulkRequest(user.id, user.employeeId, employeeId, category, changes, ["admin","hr"].includes(user.role));
      ApiResponse.created(res, { message: `${requests.length} change request(s) submitted`, requests, note: "Sent to HR for approval" });
    } catch (e) { next(e); }
  }

  async approve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await this.service.approveRequest(req.params.id, req.user!.id, req.body.reviewNotes);
      ApiResponse.ok(res, { message: "Change request approved and applied", request: data });
    } catch (e) { next(e); }
  }

  async reject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await this.service.rejectRequest(req.params.id, req.user!.id, req.body.reviewNotes);
      ApiResponse.ok(res, { message: "Change request rejected", request: data });
    } catch (e) { next(e); }
  }

  async bulkApprove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { requestIds, reviewNotes } = req.body;
      if (!Array.isArray(requestIds) || requestIds.length === 0) {
        ApiResponse.error(res, 400, "requestIds array is required", "VALIDATION_ERROR"); return;
      }
      const result = await this.service.bulkApprove(requestIds, req.user!.id, reviewNotes);
      ApiResponse.ok(res, { message: `${result.approved.length} approved, ${result.failed.length} failed`, ...result });
    } catch (e) { next(e); }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.service.deleteRequest(req.params.id);
      ApiResponse.noContent(res);
    } catch (e) { next(e); }
  }
}
