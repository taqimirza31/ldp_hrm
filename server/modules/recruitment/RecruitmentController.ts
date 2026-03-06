import type { Request, Response, NextFunction } from "express";
import { RecruitmentService } from "./RecruitmentService.js";
import { fetchResumeBuffer } from "../../lib/freshteamApi.js";

function maskPlaceholderResumeUrl(url: string | null | undefined): string {
  const u = (url ?? "").trim();
  if (!u || u === "data:application/octet-stream;base64," || u === "data:application/octet-stream;base64") return "";
  if (u.startsWith("data:application/octet-stream;base64,") && u.replace(/\s/g, "").length < 60) return "";
  return u;
}

export class RecruitmentController {
  private readonly svc = new RecruitmentService();
  constructor() { const b=(c:any)=>{for(const k of Object.getOwnPropertyNames(Object.getPrototypeOf(c)))if(k!=="constructor"&&typeof c[k]==="function")c[k]=c[k].bind(c)};b(this); }

  // ── Candidates ──────────────────────────────────────────────────────────────
  async listCandidates(req: Request, res: Response, next: NextFunction) { try { res.json(await this.svc.listCandidates(req.query)); } catch (e) { next(e); } }

  async getCandidateById(req: Request, res: Response, next: NextFunction) { try { res.json(await this.svc.getCandidateById(req.params.id)); } catch (e) { next(e); } }

  async getCandidateResume(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const forceDownload = req.query.download === "1" || req.query.download === "true";
      const candidate = await this.svc.getCandidateResume(id);
      const storedUrl = candidate.resume_url?.trim() ?? "";
      const storedFilename = candidate.resume_filename?.trim() || "resume.pdf";
      const isPlaceholder = !storedUrl || storedUrl === "data:application/octet-stream;base64," || storedUrl === "data:application/octet-stream;base64" || (storedUrl.startsWith("data:application/octet-stream;base64,") && storedUrl.replace(/\s/g,"").length < 60);
      if (isPlaceholder) return res.status(404).json({ error: "No resume" });
      const disposition = forceDownload ? "attachment" : "inline";
      const dispValue = `${disposition}; filename="${storedFilename.replace(/"/g,'\\"')}"`;
      if (storedUrl.startsWith("data:")) {
        const base64Index = storedUrl.indexOf(";base64,");
        if (base64Index !== -1) {
          const contentType = storedUrl.slice(5, base64Index).trim() || "application/octet-stream";
          const buf = Buffer.from(storedUrl.slice(base64Index + 8).replace(/\s/g,""), "base64");
          if (buf.length === 0) return res.status(404).json({ error: "No resume" });
          res.setHeader("Content-Type", contentType);
          res.setHeader("Content-Disposition", dispValue);
          return res.send(buf);
        }
        return res.status(404).json({ error: "No resume" });
      }
      if (storedUrl.startsWith("http://") || storedUrl.startsWith("https://")) {
        const result = await fetchResumeBuffer(storedUrl, storedFilename);
        if (result) {
          res.setHeader("Content-Type", result.contentType);
          res.setHeader("Content-Disposition", forceDownload ? `attachment; filename="${result.filename.replace(/"/g,'\\"')}"` : `inline; filename="${result.filename.replace(/"/g,'\\"')}"`);
          return res.send(result.buffer);
        }
        return res.status(502).json({ error: "Resume link may have expired; re-run migration to store a copy." });
      }
      return res.status(400).json({ error: "Invalid resume format" });
    } catch (e) { next(e); }
  }

  async createCandidate(req: Request, res: Response, next: NextFunction) {
    try {
      const { candidate, isNew } = await this.svc.createCandidate(req.body);
      res.status(isNew ? 201 : 200).json(candidate);
    } catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ error: "Validation failed", details: e.errors });
      next(e);
    }
  }

  async updateCandidate(req: Request, res: Response, next: NextFunction) { try { res.json(await this.svc.updateCandidate(req.params.id, req.body)); } catch (e) { next(e); } }

  async deleteCandidate(req: Request, res: Response, next: NextFunction) { try { await this.svc.deleteCandidate(req.params.id); res.json({ message: "Candidate deleted" }); } catch (e) { next(e); } }

  // ── Job Postings ──────────────────────────────────────────────────────────────
  async getJobFilterOptions(_: Request, res: Response, next: NextFunction) { try { res.json(await this.svc.getJobFilterOptions()); } catch (e) { next(e); } }
  async listJobs(req: Request, res: Response, next: NextFunction) { try { res.json(await this.svc.listJobs(req.query)); } catch (e) { next(e); } }
  async getPublishedJobs(_: Request, res: Response, next: NextFunction) { try { res.json(await this.svc.getPublishedJobs()); } catch (e) { next(e); } }
  async getJobById(req: Request, res: Response, next: NextFunction) { try { res.json(await this.svc.getJobById(req.params.id)); } catch (e) { next(e); } }

  async createJob(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json(await this.svc.createJob(req.body)); }
    catch (e: any) { if (e?.name === "ZodError") return res.status(400).json({ error: "Validation failed", details: e.errors }); next(e); }
  }

  async updateJob(req: Request, res: Response, next: NextFunction) { try { res.json(await this.svc.updateJob(req.params.id, req.body)); } catch (e) { next(e); } }
  async deleteJob(req: Request, res: Response, next: NextFunction) { try { await this.svc.deleteJob(req.params.id); res.json({ message: "Job posting deleted" }); } catch (e) { next(e); } }

  // ── Applications ──────────────────────────────────────────────────────────────
  async listApplications(req: Request, res: Response, next: NextFunction) { try { res.json(await this.svc.listApplications(req.query)); } catch (e) { next(e); } }
  async getApplicationById(req: Request, res: Response, next: NextFunction) { try { res.json(await this.svc.getApplicationById(req.params.id)); } catch (e) { next(e); } }

  async createApplication(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json(await this.svc.createApplication(req.body, req.user?.id ?? null, !!req.user?.id)); }
    catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ error: "Validation failed", details: e.errors });
      if (e?.code === "23505") return res.status(400).json({ error: "Candidate has already applied to this job" });
      next(e);
    }
  }

  async updateApplicationStage(req: Request, res: Response, next: NextFunction) {
    try { res.json(await this.svc.updateApplicationStage(req.params.id, req.body, req.user!.id)); }
    catch (e: any) {
      if (e?.statusCode) return res.status(e.statusCode).json({ error: e.message });
      next(e);
    }
  }

  async deleteApplication(req: Request, res: Response, next: NextFunction) { try { await this.svc.deleteApplication(req.params.id); res.json({ message: "Application deleted" }); } catch (e) { next(e); } }
  async getApplicationHistory(req: Request, res: Response, next: NextFunction) { try { res.json(await this.svc.getApplicationHistory(req.params.id)); } catch (e) { next(e); } }

  // ── Application Emails ────────────────────────────────────────────────────────
  async listApplicationEmails(req: Request, res: Response, next: NextFunction) { try { res.json(await this.svc.listApplicationEmails(req.params.id)); } catch (e) { next(e); } }

  async sendApplicationEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const fromEmail = req.user?.email ?? "noreply@ldplogistics.com";
      const result = await this.svc.sendApplicationEmail(req.params.id, req.body, fromEmail);
      res.status(201).json(result);
    } catch (e: any) {
      if (e?.statusCode === 502) return res.status(502).json({ error: e.userMessage ?? e.message, detail: e.message });
      next(e);
    }
  }

  async handleInboundEmail(req: Request, res: Response, next: NextFunction) {
    try {
      await this.svc.handleInboundEmail(req.body);
      res.status(200).json({ ok: true });
    } catch (e: any) {
      if (e?.statusCode === 400) return res.status(400).json({ error: e.message, hint: e.hint });
      next(e);
    }
  }

  async deleteApplicationEmail(req: Request, res: Response, next: NextFunction) { try { await this.svc.deleteApplicationEmail(req.params.id, req.params.emailId); res.status(200).json({ ok: true }); } catch (e) { next(e); } }

  // ── Offers ────────────────────────────────────────────────────────────────────
  async listOffers(_: Request, res: Response, next: NextFunction) { try { res.json(await this.svc.listOffers()); } catch (e) { next(e); } }

  async createOffer(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json(await this.svc.createOffer(req.body, req.user!.id)); }
    catch (e: any) {
      if (e?.name === "ZodError") return res.status(400).json({ error: "Validation failed", details: e.errors });
      if (e?.code === "23505") return res.status(400).json({ error: "An offer already exists for this application" });
      next(e);
    }
  }

  async updateOffer(req: Request, res: Response, next: NextFunction) { try { res.json(await this.svc.updateOffer(req.params.id, req.body, req.user!.id)); } catch (e) { next(e); } }
  async approveOffer(req: Request, res: Response, next: NextFunction) { try { res.json(await this.svc.approveOffer(req.params.id, req.user!.id)); } catch (e) { next(e); } }
  async rejectOffer(req: Request, res: Response, next: NextFunction) { try { res.json(await this.svc.rejectOffer(req.params.id, req.user!.id)); } catch (e) { next(e); } }

  async uploadOfferLetter(req: Request, res: Response, next: NextFunction) {
    try { await this.svc.uploadOfferLetter(req.params.id, req.body.fileUrl, req.body.fileName); res.json({ success: true, message: "Offer letter uploaded" }); }
    catch (e) { next(e); }
  }

  async getOfferLetter(req: Request, res: Response, next: NextFunction) {
    try {
      const rows = await this.svc.getOfferLetter(req.params.id);
      const fileUrl = rows.offer_letter_url?.trim();
      const fileName = rows.offer_letter_filename?.trim() || "offer-letter.pdf";
      if (!fileUrl || typeof fileUrl !== "string") {
        return res.status(404).json({ error: "No offer letter uploaded" });
      }
      if (fileUrl.startsWith("data:")) {
        const match = fileUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) return res.status(400).json({ error: "Invalid file data" });
        const buffer = Buffer.from(match[2], "base64");
        res.setHeader("Content-Type", match[1].trim() || "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="${fileName.replace(/"/g,"%22")}"`);
        return res.send(buffer);
      }
      if (!fileUrl.startsWith("http://") && !fileUrl.startsWith("https://")) {
        return res.status(400).json({ error: "Invalid offer letter URL" });
      }
      res.redirect(302, fileUrl);
    } catch (e) { next(e); }
  }

  async getOfferByToken(req: Request, res: Response, next: NextFunction) {
    try {
      const offer = await this.svc.getOfferByToken(req.params.token);
      const candidateName = [offer.candidate_first_name, offer.candidate_last_name].filter(Boolean).join(" ").trim() || "Candidate";
      res.json({ id: offer.id, candidateName, candidateEmail: offer.candidate_email, jobTitle: offer.job_title, department: offer.department || offer.job_posting_department, jobPostingTitle: offer.job_posting_title, location: offer.job_location, salary: offer.salary, salaryCurrency: offer.salary_currency, startDate: offer.start_date, employmentType: offer.employment_type || offer.job_employment_type, terms: offer.terms, status: offer.status, sentAt: offer.sent_at, respondedAt: offer.responded_at });
    } catch (e) { next(e); }
  }

  async offerResponseDeprecated(_: Request, res: Response) { res.status(410).json({ error: "Offer letters are issued on joining date. This link is no longer used for acceptance." }); }

  async getOfferLink(req: Request, res: Response, next: NextFunction) {
    try {
      const protocol = (req.headers["x-forwarded-proto"] || req.protocol) as string;
      const host = (req.headers["x-forwarded-host"] || req.get("host")) as string;
      res.json(await this.svc.getOfferLink(req.params.id, protocol, host));
    } catch (e) { next(e); }
  }

  // ── Hire ─────────────────────────────────────────────────────────────────────
  async hireCandidate(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json(await this.svc.hireCandidate(req.params.id, req.body, req.user!.id)); }
    catch (e: any) {
      if (e?.code === "23505") return res.status(409).json({ error: "Employee ID or work email already exists" });
      next(e);
    }
  }

  // ── Stats ─────────────────────────────────────────────────────────────────────
  async getStats(_: Request, res: Response, next: NextFunction) { try { res.json(await this.svc.getStats()); } catch (e) { next(e); } }

  // ── FreshTeam ─────────────────────────────────────────────────────────────────
  async migrateFreshteamJobs(_: Request, res: Response, next: NextFunction) {
    try { res.json(await this.svc.migrateFreshteamJobs()); }
    catch (e: any) { if (e?.statusCode === 503) return res.status(503).json({ error: e.message, message: "Set FRESHTEAM_DOMAIN and FRESHTEAM_API_KEY in .env" }); next(e); }
  }

  async migrateFreshteamCandidates(_: Request, res: Response, next: NextFunction) {
    try { res.json(await this.svc.migrateFreshteamCandidates()); }
    catch (e: any) {
      if (e?.statusCode === 503) return res.status(503).json({ error: e.message });
      if (e?.statusCode === 409) return res.status(409).json({ error: e.message });
      next(e);
    }
  }
}
