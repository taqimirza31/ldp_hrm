import type { Request, Response, NextFunction } from "express";
import { TentativeService } from "./TentativeService.js";
import { ApiResponse } from "../../core/utils/apiResponse.js";

export class TentativeController {
  private readonly svc = new TentativeService();
  constructor() { const b = (c: any) => { for (const k of Object.getOwnPropertyNames(Object.getPrototypeOf(c))) if (k !== "constructor" && typeof c[k] === "function") c[k] = c[k].bind(c); }; b(this); }

  async list(_: Request, res: Response, next: NextFunction) { try { ApiResponse.ok(res, await this.svc.list()); } catch (e) { next(e); } }
  async getByApplicationId(req: Request, res: Response, next: NextFunction) { try { ApiResponse.ok(res, await this.svc.getByApplicationId(req.params.applicationId)); } catch (e) { next(e); } }
  async initiate(req: Request, res: Response, next: NextFunction) { try { ApiResponse.created(res, await this.svc.initiate(req.body.applicationId, req.body.isFirstJob, req.user!.id)); } catch (e) { next(e); } }
  async updateFirstJob(req: Request, res: Response, next: NextFunction) { try { ApiResponse.ok(res, await this.svc.updateFirstJob(req.params.tentativeId, req.body.isFirstJob)); } catch (e) { next(e); } }
  async clearRecord(req: Request, res: Response, next: NextFunction) { try { ApiResponse.ok(res, await this.svc.clearRecord(req.params.tentativeId)); } catch (e) { next(e); } }
  async failRecord(req: Request, res: Response, next: NextFunction) { try { ApiResponse.ok(res, await this.svc.failRecord(req.params.tentativeId, req.body.reason, req.user!.id)); } catch (e) { next(e); } }
  async confirmHire(req: Request, res: Response, next: NextFunction) { try { ApiResponse.created(res, await this.svc.confirmHire(req.params.tentativeId, req.body.employeeId, req.body.workEmail, req.user!.id)); } catch (e) { next(e); } }
  async verifyDocument(req: Request, res: Response, next: NextFunction) { try { ApiResponse.ok(res, await this.svc.verifyDocument(req.params.docId, req.body.action, req.body.reason, req.user!.id)); } catch (e) { next(e); } }

  async getDocumentFile(req: Request, res: Response, next: NextFunction) {
    try {
      const doc = await this.svc.getDocumentFile(req.params.docId);
      if (!doc) { res.status(404).json({ error: "Document not found" }); return; }
      if (!doc.file_url) { res.status(404).json({ error: "No file uploaded" }); return; }
      if (doc.file_url.startsWith("data:")) {
        const match = doc.file_url.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) { res.status(400).json({ error: "Invalid file data" }); return; }
        const buf = Buffer.from(match[2], "base64");
        res.setHeader("Content-Type", match[1]);
        res.setHeader("Content-Disposition", `inline; filename="${(doc.file_name || "document").replace(/"/g, "%22")}"`);
        res.setHeader("Cache-Control", "private, max-age=3600");
        res.send(buf); return;
      }
      res.redirect(302, doc.file_url);
    } catch (e) { next(e); }
  }

  // Portal — public (no requireAuth)
  async getPortal(req: Request, res: Response, next: NextFunction) { try { res.json(await this.svc.getPortal(req.params.token)); } catch (e) { next(e); } }
  async uploadPortalDocument(req: Request, res: Response, next: NextFunction) {
    try { if (!req.body.fileUrl) { res.status(400).json({ error: "fileUrl is required" }); return; } res.json(await this.svc.uploadPortalDocument(req.params.token, req.params.docId, req.body.fileUrl, req.body.fileName)); } catch (e) { next(e); }
  }
}
