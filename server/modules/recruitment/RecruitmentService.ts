import crypto from "node:crypto";
import { RecruitmentRepository } from "./RecruitmentRepository.js";
import { NotFoundError, ValidationError, ConflictError } from "../../core/types/index.js";
import { parseDataUrl, uploadFileToSharePoint, isSharePointAvatarConfigured } from "../../lib/sharepoint.js";
import { sendEmail, isResendConfigured } from "../../lib/resend.js";
import { createInterviewMeeting, isTeamsIntegrationConfigured } from "../../services/teamsGraph.js";
import { fetchResumeBuffer, downloadResumeAsDataUrl, isFreshTeamConfigured, listJobPostings, getJobPosting, listApplicantsForJob, getApplicant, getCandidate, sleep, getFreshTeamDelayMs, getFreshTeamOrigin } from "../../lib/freshteamApi.js";
import { insertCandidateSchema, insertJobPostingSchema, insertApplicationSchema, insertOfferSchema } from "../../db/schema/recruitment.js";

/** Guard against double-run of FreshTeam candidate migration. */
let freshteamCandidateMigrationInProgress = false;

function maskPlaceholderResumeUrl(url: string | null | undefined): string {
  const u = (url ?? "").trim();
  if (!u || u === "data:application/octet-stream;base64," || u === "data:application/octet-stream;base64") return "";
  if (u.startsWith("data:application/octet-stream;base64,") && u.replace(/\s/g, "").length < 60) return "";
  return u;
}

function parseHmIds(j: any): string[] {
  const raw = j.hiring_manager_ids ?? j.hiring_manager_id;
  if (Array.isArray(raw)) return raw.filter((id): id is string => typeof id === "string");
  if (j.hiring_manager_id && typeof j.hiring_manager_id === "string") return [j.hiring_manager_id];
  if (typeof raw === "string") {
    try { const p = JSON.parse(raw); return Array.isArray(p) ? p.filter((id:unknown): id is string => typeof id === "string") : []; } catch { return []; }
  }
  return [];
}

function parseMultiParam(q: string | string[] | undefined): string[] {
  if (q == null || q === "") return [];
  const s = Array.isArray(q) ? q.join(",") : String(q);
  return s.split(",").map((v) => v.trim()).filter(Boolean);
}

function htmlToPlainText(html: string | null | undefined): string | null {
  if (html == null || typeof html !== "string" || !html.trim()) return null;
  let text = html.replace(/<br\s*\/?>/gi,"\n").replace(/<\/p>/gi,"\n").replace(/<\/div>/gi,"\n").replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'");
  text = text.replace(/\n{3,}/g,"\n\n").replace(/[ \t]+/g," ").trim();
  return text || null;
}

function mapFtStageToOur(stage?: string): string {
  if (!stage) return "applied";
  const s = stage.toLowerCase();
  if (s.includes("hired") || s.includes("offer_accepted")) return "hired";
  if (s.includes("offer")) return "offer";
  if (s.includes("interview")) return "interview";
  if (s.includes("shortlist") || s.includes("shortlisted")) return "shortlisted";
  if (s.includes("screen") || s.includes("phone")) return "screening";
  if (s.includes("longlist") || s.includes("longlisted")) return "longlisted";
  if (s.includes("reject")) return "rejected";
  return "applied";
}

function deriveResumeFilenameFromUrl(url: string): string {
  try { const u = new URL(url); const parts = u.pathname.split("/"); return parts[parts.length-1] || "resume.pdf"; } catch { return "resume.pdf"; }
}

/**
 * Resumes are stored only as URLs in the DB (SharePoint). We never store base64 data URLs.
 * - If resume is a data URL and SharePoint is configured → upload to SharePoint, return URL.
 * - If resume is a data URL and SharePoint is NOT configured → reject (resume storage not available).
 * - If resume is already a URL (e.g. existing SharePoint link) or empty → return as-is.
 */
async function uploadResumeIfNeeded(resumeUrl: string, candidateId?: string | number): Promise<string> {
  const isDataUrl = typeof resumeUrl === "string" && resumeUrl.trim().startsWith("data:");
  const useSharePoint = isSharePointAvatarConfigured();

  if (!isDataUrl) return resumeUrl ?? "";

  if (!useSharePoint) {
    throw new ValidationError(
      "Resume upload is not available right now. Please save your resume and contact HR, or try again later."
    );
  }

  const parsed = parseDataUrl(resumeUrl);
  if (!parsed) throw new ValidationError("Invalid resume file format (could not parse data URL).");

  const ext = parsed.contentType.toLowerCase().includes("pdf") ? "pdf" : "png";
  const idPart = candidateId != null ? String(candidateId) : crypto.randomUUID();
  const fileName = `resume-${idPart}.${ext}`;
  try {
    const url = await uploadFileToSharePoint("Recruitment/Resumes", fileName, parsed.buffer, parsed.contentType);
    if (!url) throw new Error("No URL returned");
    return url;
  } catch (e) {
    console.error("SharePoint resume upload failed", e);
    throw new Error("Resume could not be saved to storage. Please try again or contact support. (SharePoint upload failed.)");
  }
}

type QueryParams = Record<string, string | string[] | undefined>;

function qint(v: string | string[] | undefined, fallback = 0): number {
  const n = parseInt(Array.isArray(v) ? v[0] : v ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
}

function qstr(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] : v ?? "";
}

export class RecruitmentService {
  private readonly r = new RecruitmentRepository();

  // ── Candidates ──────────────────────────────────────────────────────────────
  async listCandidates(query: QueryParams) {
    const limit = Math.min(qint(query.limit, 50), 500);
    const offset = qint(query.offset);
    const searchRaw = qstr(query.search).trim();
    const search = searchRaw.length > 0 ? `%${searchRaw}%` : null;
    return this.r.listCandidates(limit, offset, search);
  }

  async getCandidateById(id: string) {
    const c = await this.r.getCandidateById(id);
    if (!c) throw new NotFoundError("Candidate not found");
    return { ...c, resume_url: maskPlaceholderResumeUrl(c.resume_url) };
  }

  async getCandidateResume(id: string) {
    const row = await this.r.getCandidateResume(id);
    if (!row) throw new NotFoundError("Candidate not found");
    return row;
  }

  async createCandidate(body: any): Promise<{ candidate: any; isNew: boolean }> {
    const validated = insertCandidateSchema.parse(body);
    let resumeUrl: string = validated.resumeUrl ?? "";
    resumeUrl = await uploadResumeIfNeeded(resumeUrl);
    const emailNorm = (validated.email ?? "").trim().toLowerCase();
    const existing = emailNorm ? await this.r.findCandidateByEmailFull(emailNorm) : null;
    if (existing) {
      const updated = await this.r.updateCandidate(existing.id, { ...validated, tags: validated.tags ?? null }, resumeUrl || undefined);
      return { candidate: updated, isNew: false };
    }
    const candidate = await this.r.createCandidate({ ...validated, resumeUrl });
    return { candidate, isNew: true };
  }

  async updateCandidate(id: string, body: any) {
    const existing = await this.r.getCandidateById(id);
    if (!existing) throw new NotFoundError("Candidate not found");
    let resumeUrl: string | undefined = body.resumeUrl;
    if (resumeUrl) resumeUrl = await uploadResumeIfNeeded(resumeUrl, id);
    return this.r.updateCandidate(id, body, resumeUrl);
  }

  async deleteCandidate(id: string) {
    const r = await this.r.deleteCandidate(id);
    if (!r) throw new NotFoundError("Candidate not found");
  }

  // ── Job Postings ──────────────────────────────────────────────────────────────
  async getJobFilterOptions() { return this.r.getJobFilterOptions(); }

  async listJobs(query: QueryParams) {
    const statuses = parseMultiParam(query.status);
    const departments = parseMultiParam(query.department);
    const locations = parseMultiParam(query.location);
    const employmentTypes = parseMultiParam(query.employmentType);
    const limit = Math.min(qint(query.limit, 200), 500);
    const offset = qint(query.offset);
    const { jobs, total } = await this.r.listJobs(statuses, departments, locations, employmentTypes, limit, offset);
    if (jobs.length === 0) return { jobs: [], total };
    const jobIds = jobs.map((j:any)=>j.id);
    const countMap = await this.r.getJobApplicationCounts(jobIds);
    const allHmIds = new Set<string>();
    const enrichedBase = jobs.map((j:any) => {
      const hmIds = parseHmIds(j);
      hmIds.forEach((id:string)=>allHmIds.add(id));
      const counts = countMap.get(j.id) ?? { application_count: 0, hired_count: 0 };
      return { ...j, application_count: counts.application_count, hired_count: counts.hired_count, hm_ids: hmIds };
    });
    const nameMap = await this.r.batchResolveEmployeeNames(Array.from(allHmIds));
    const enriched = enrichedBase.map((j:any) => ({ ...j, hm_names: j.hm_ids.map((id:string)=>nameMap.get(id)||id) }));
    return { jobs: enriched, total };
  }

  async getPublishedJobs() { return this.r.getPublishedJobs(); }

  async getJobById(id: string) {
    const job = await this.r.getJobById(id);
    if (!job) throw new NotFoundError("Job posting not found");
    const hmIds = job.hiring_manager_ids ? (Array.isArray(job.hiring_manager_ids) ? job.hiring_manager_ids : JSON.parse(job.hiring_manager_ids)) : (job.hiring_manager_id ? [job.hiring_manager_id] : []);
    const [hmNames, applications] = await Promise.all([this.r.resolveEmployeeNames(hmIds), this.r.getJobApplications(id)]);
    return { ...job, hm_names: hmNames, hm_ids: hmIds, applications };
  }

  async createJob(body: any) {
    const validated = insertJobPostingSchema.parse(body);
    return this.r.createJob({ ...validated, hmIds: body.hiringManagerIds });
  }

  async updateJob(id: string, body: any) {
    const existing = await this.r.getJobById(id);
    if (!existing) throw new NotFoundError("Job posting not found");
    return this.r.updateJob(id, body);
  }

  async deleteJob(id: string) {
    const r = await this.r.deleteJob(id);
    if (!r) throw new NotFoundError("Job posting not found");
  }

  // ── Applications ──────────────────────────────────────────────────────────────
  async listApplications(query: QueryParams) {
    const jobId = qstr(query.jobId) || undefined;
    const candidateId = qstr(query.candidateId) || undefined;
    const hasFilter = !!jobId || !!candidateId;
    const defaultLimit = hasFilter ? 50 : 200;
    const limit = Math.min(qint(query.limit, defaultLimit), 500);
    const offset = qint(query.offset);
    let applications: any[];
    let totalForJob: number | null = null;
    if (jobId) {
      const result = await this.r.listApplicationsByJob(jobId, limit, offset);
      applications = result.applications; totalForJob = result.total;
    } else if (candidateId) {
      applications = await this.r.listApplicationsByCandidate(candidateId, limit, offset) as any[];
    } else {
      applications = await this.r.listApplications(limit, offset) as any[];
    }
    const withResumeUrl = applications.map((row:any)=>({ ...row, resume_url: row.resume_url??null }));
    return totalForJob !== null ? { applications: withResumeUrl, total: totalForJob } : withResumeUrl;
  }

  async getApplicationById(id: string) {
    const app = await this.r.getApplicationById(id);
    if (!app) throw new NotFoundError("Application not found");
    const maskedApp = { ...app, resume_url: maskPlaceholderResumeUrl(app.resume_url) };
    const [history, offerRows] = await Promise.all([this.r.getApplicationStageHistory(id), this.r.getOffersByApplication(id)]);
    return { ...maskedApp, stage_history: history, offer: offerRows[0] || null };
  }

  async createApplication(body: any, userId: string | null, isAuthenticated: boolean) {
    const validated = insertApplicationSchema.parse(body);
    const [candidateCheck, jobCheck] = await Promise.all([this.r.getCandidateRow(validated.candidateId), this.r.getJobPosting(validated.jobId)]);
    if (!candidateCheck) throw new NotFoundError("Candidate not found");
    if (!jobCheck) throw new NotFoundError("Job posting not found");
    const allowedStatuses = isAuthenticated ? ["published", "paused"] : ["published"];
    if (!allowedStatuses.includes(jobCheck.status)) throw new ValidationError("This job is not currently accepting applications.");
    return this.r.createApplication(validated, userId);
  }

  async updateApplicationStage(id: string, body: any, userId: string) {
    const { stage, notes, interviewerNames, interviewerIds, scheduledAt, rejectReason, interviewType } = body;
    if (!stage) throw new ValidationError("stage is required");
    const VALID_STAGES = ["applied","longlisted","screening","shortlisted","assessment","interview","verbally_accepted","offer","rejected"];
    if (!VALID_STAGES.includes(stage)) throw new ValidationError(`Invalid stage. Must be one of: ${VALID_STAGES.join(", ")}`);
    if (stage === "hired") throw new ValidationError("Cannot move to Hired via stage change. Use the Hire action after the offer is approved.");
    if (stage === "tentative") throw new ValidationError("Cannot move to Tentative via stage change. Use the Initiate Tentative action.");
    const existing = await this.r.getApplicationById(id);
    if (!existing) throw new NotFoundError("Application not found");
    if (existing.stage === "hired") throw new ValidationError("Cannot change stage of a hired candidate");
    const fromStage = existing.stage;
    const { application, stageHistoryId } = await this.r.updateApplicationStage(id, stage, fromStage, { notes, interviewerNames, interviewerIds, scheduledAt, rejectReason, interviewType }, userId);
    // Teams integration
    const isInterviewWithSchedule = stage === "interview" && scheduledAt && interviewerIds && Array.isArray(interviewerIds) && interviewerIds.length > 0;
    if (isInterviewWithSchedule && stageHistoryId) {
      const detail = await this.r.getApplicationStageDetail(id);
      if (detail) {
        const start = new Date(scheduledAt);
        const end = new Date(start.getTime() + 60 * 60 * 1000);
        const jobTitle = detail.job_title || "Position";
        const candidateName = `${detail.first_name} ${detail.last_name}`.trim();
        const interviewerEmails = await this.r.getInterviewerEmails(interviewerIds as string[]);
        const meetingResult = await createInterviewMeeting({ start, end, subject: `Interview: ${jobTitle} – ${candidateName}`, interviewerEmails, candidateEmail: detail.candidate_email, body: `<p>Interview scheduled via HRMS.</p><p><strong>Candidate:</strong> ${candidateName}</p><p><strong>Role:</strong> ${jobTitle}</p>${interviewType ? `<p><strong>Type:</strong> ${interviewType}</p>` : ""}` });
        if (meetingResult.success && (meetingResult.joinUrl || meetingResult.eventId)) {
          await this.r.updateStageHistoryMeeting(stageHistoryId, meetingResult.joinUrl||null, meetingResult.eventId||null);
          if (detail.candidate_email && isResendConfigured()) {
            const dateStr = start.toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" });
            const html = `<p>Hello ${candidateName},</p><p>Your interview has been scheduled for <strong>${jobTitle}</strong>.</p><p><strong>Date & time:</strong> ${dateStr}</p>${interviewType ? `<p><strong>Interview type:</strong> ${interviewType}</p>` : ""}${meetingResult.joinUrl ? `<p><strong>Join Teams meeting:</strong> <a href="${meetingResult.joinUrl}">${meetingResult.joinUrl}</a></p>` : ""}<p>Please join on time.</p><p>Best regards,<br/>HR Team</p>`;
            const sendResult = await sendEmail({ to: detail.candidate_email, subject: `Interview scheduled: ${jobTitle}`, html, text: html.replace(/<[^>]+>/g,"").replace(/\s+/g," ").trim() });
            if (!sendResult.ok) console.warn("[recruitment] Interview email send failed:", (sendResult as any).message);
          }
        } else if (!meetingResult.success && isTeamsIntegrationConfigured()) {
          console.warn("[recruitment] Teams meeting creation failed:", meetingResult.error);
        }
      }
    }
    // Audit every stage change (not just verbal acceptance)
    await this.r.auditLog("application", id, "STAGE_CHANGED", userId, { fromStage, toStage: stage, notes: notes ?? null });

    // Return the full joined shape (candidate + job fields) so the frontend never
    // has to merge a partial update with stale local state.
    const full = await this.r.getApplicationById(id);
    return full ?? application;
  }

  async updateApplicationRating(id: string, rating: number | null) {
    const existing = await this.r.getApplicationById(id);
    if (!existing) throw new NotFoundError("Application not found");
    if (rating != null && (rating < 1 || rating > 5)) throw new ValidationError("Rating must be between 1 and 5");
    return this.r.updateApplicationRating(id, rating);
  }

  async deleteApplication(id: string) {
    const r = await this.r.deleteApplication(id);
    if (!r) throw new NotFoundError("Application not found");
  }

  async getApplicationHistory(id: string) { return this.r.getApplicationStageHistory(id); }

  // ── Application Emails ────────────────────────────────────────────────────────
  async listApplicationEmails(applicationId: string) {
    const appCheck = await this.r.getApplicationById(applicationId);
    if (!appCheck) throw new NotFoundError("Application not found");
    return this.r.listApplicationEmails(applicationId);
  }

  async sendApplicationEmail(applicationId: string, body: any, fromEmail: string) {
    const appRows = await this.r.getApplicationById(applicationId);
    if (!appRows) throw new NotFoundError("Application not found");
    const toEmail = (body.to && String(body.to).trim()) || appRows.candidate_email;
    if (!toEmail) throw new ValidationError("No recipient email");
    const subjectStr = body.subject != null ? String(body.subject).trim() : "";
    const bodyStr = body.body != null ? String(body.body).trim() : "";
    const MAX_ATTACHMENTS = 5, MAX_BYTES = 8 * 1024 * 1024;
    let attachments: Array<{ filename: string; content: Buffer }> | undefined;
    if (Array.isArray(body.attachments) && body.attachments.length > 0) {
      if (body.attachments.length > MAX_ATTACHMENTS) throw new ValidationError(`Maximum ${MAX_ATTACHMENTS} attachments allowed`);
      let totalBytes = 0; attachments = [];
      for (const a of body.attachments) {
        const buf = Buffer.from(typeof a?.content === "string" ? a.content : "", "base64");
        totalBytes += buf.length;
        if (totalBytes > MAX_BYTES) throw new ValidationError("Attachments exceed 8MB total");
        attachments.push({ filename: (a?.filename && String(a.filename).trim()) || "attachment", content: buf });
      }
    }
    const inserted = await this.r.insertApplicationEmail({ applicationId, fromEmail, toEmail, cc: body.cc||null, bcc: body.bcc||null, subject: subjectStr, body: bodyStr });
    let delivered = false;
    if (isResendConfigured()) {
      const fromAddress = (process.env.RESEND_FROM ?? "").trim() || "Recruitment <careers@hr.ldplogistics.com>";
      const inboundDomain = (process.env.RESEND_INBOUND_REPLY_DOMAIN ?? "").trim();
      const useCleanReplyTo = process.env.RESEND_REPLY_TO_CLEAN === "true";
      const replyToAddress = useCleanReplyTo ? fromAddress : (inboundDomain ? `reply+${applicationId}@${inboundDomain}` : fromAddress);
      const ourMessageId = inboundDomain ? `<recruitment-${inserted.id}@${inboundDomain}>` : undefined;
      let result: { ok: true; id: string } | { ok: false; message: string };
      try {
        result = await sendEmail({ to: toEmail, subject: subjectStr, text: bodyStr, html: bodyStr ? bodyStr.replace(/\n/g,"<br>") : "<p></p>", cc: body.cc??undefined, bcc: body.bcc??undefined, replyTo: replyToAddress, headers: ourMessageId ? { "Message-ID": ourMessageId } : undefined, attachments });
      } catch (e: any) { result = { ok: false, message: e?.message ?? String(e) }; }
      if (!result.ok) throw Object.assign(new Error((result as any).message), { statusCode: 502, userMessage: "Email saved but delivery failed" });
      delivered = true;
      if (inboundDomain && ourMessageId) await this.r.updateEmailMessageId(inserted.id, ourMessageId);
    }
    return { ...inserted, delivered };
  }

  async handleInboundEmail(body: any) {
    const data = (body.data as Record<string, unknown>) || body;
    let applicationId = (body.applicationId ?? data.applicationId) as string | undefined;
    const toRaw = data.to ?? body.to;
    const toAddresses = Array.isArray(toRaw) ? toRaw as string[] : toRaw != null ? [String(toRaw)] : [];
    if (!applicationId && toAddresses.length > 0) {
      for (const addr of toAddresses) {
        const match = String(addr).match(/reply\+([a-f0-9-]{36})@/i) || String(addr).match(/^([a-f0-9-]{36})@/);
        if (match) { applicationId = match[1]; break; }
      }
    }
    const fromEmail = ((data.from ?? body.from ?? body.from_email) ?? "").toString().trim();
    const toEmail = toAddresses.length > 0 ? toAddresses.map((a:any)=>String(a)).join(", ") : ((data.to ?? body.to ?? body.to_email) ?? "").toString();
    const subject = ((data.subject ?? body.subject) ?? "").toString().trim();
    let textPlain = ((data.text ?? body.text ?? body.plain ?? body.body) ?? "").toString();
    let textHtml = ((data.html ?? body.html) ?? "").toString();
    const messageId = (data.message_id ?? body.message_id) as string | undefined;
    const emailId = (data.email_id ?? body.email_id) as string | undefined;
    if (!fromEmail) throw Object.assign(new ValidationError("Missing from (sender) in webhook payload."), { statusCode: 400 });
    // Try In-Reply-To matching via Resend API
    if (!applicationId && emailId) {
      const apiKey = (process.env.RESEND_API_KEY ?? "").trim();
      if (apiKey) {
        try {
          const getRes = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, { headers: { Authorization: `Bearer ${apiKey}` } });
          if (getRes.ok) {
            const received = (await getRes.json()) as any;
            if (received.text) textPlain = received.text;
            if (received.html) textHtml = received.html;
            const headers = received.headers as Record<string, string> | undefined;
            const getHeader = (name: string) => { if (!headers) return undefined; const lower = name.toLowerCase(); const key = Object.keys(headers).find((k)=>k.toLowerCase()===lower); return key ? headers[key] : undefined; };
            const inReplyTo = getHeader("in-reply-to");
            const references = getHeader("references");
            const idsToTry = [inReplyTo].filter(Boolean) as string[];
            if (references) idsToTry.push(...references.split(/\s+/).map((s:string)=>s.trim()).filter(Boolean));
            for (const idVal of idsToTry) {
              const appId = await this.r.matchEmailByMessageId(idVal);
              if (appId) { applicationId = appId; break; }
            }
          }
        } catch (e) { console.warn("[inbound-email] Resend API fetch failed:", (e as Error)?.message); }
      }
    }
    // Fallback: match by sender + subject
    if (!applicationId && fromEmail && subject) {
      const normalizedSubject = subject.replace(/^\s*(Re:\s*|Fwd:\s*)+/gi,"").trim().toLowerCase();
      if (normalizedSubject) {
        const appId = await this.r.matchEmailBySenderSubject(fromEmail, normalizedSubject);
        if (appId) {
          applicationId = appId;
          if (process.env.NODE_ENV !== "production") console.log("[inbound-email] Matched application by sender+subject fallback:", applicationId);
        }
      }
    }
    if (!applicationId) throw Object.assign(new Error("Could not determine application"), { statusCode: 400, hint: "Reply to an email that was sent from the app (Recruitment → Emails). With RESEND_REPLY_TO_CLEAN=true, matching uses sender+subject. Otherwise use reply+<id>@ in Reply-To (RESEND_REPLY_TO_CLEAN=false)." });
    const appCheck = await this.r.getApplicationById(applicationId);
    if (!appCheck) throw new NotFoundError("Application not found");
    // Fetch body if not yet retrieved
    if (emailId && !textPlain && !textHtml) {
      const apiKey = (process.env.RESEND_API_KEY ?? "").trim();
      if (apiKey) {
        try {
          const getRes = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, { headers: { Authorization: `Bearer ${apiKey}` } });
          if (getRes.ok) { const received = (await getRes.json()) as any; if (received.text) textPlain = received.text; if (received.html) textHtml = received.html; }
        } catch (e) { console.warn("[inbound-email] Resend body fetch failed:", (e as Error)?.message); }
      }
    }
    await this.r.insertInboundEmail({ applicationId, fromEmail, toEmail, subject, textPlain, textHtml, messageId });
  }

  async deleteApplicationEmail(applicationId: string, emailId: string) {
    const r = await this.r.deleteApplicationEmail(emailId, applicationId);
    if (!r) throw new NotFoundError("Email not found");
  }

  // ── Offers ────────────────────────────────────────────────────────────────────
  async listOffers() { return this.r.listOffers(); }

  async createOffer(body: any, userId: string) {
    const validated = insertOfferSchema.parse(body);
    const appCheck = await this.r.getApplicationById(validated.applicationId);
    if (!appCheck) throw new NotFoundError("Application not found");
    const tentative = await this.r.getTentativeForApplication(validated.applicationId);
    if (tentative && tentative.status !== "cleared") throw new ValidationError("Tentative must be cleared before creating offer.");
    if (appCheck.stage !== "offer" && appCheck.stage !== "hired") await this.r.moveApplicationToOffer(validated.applicationId, appCheck.stage, userId);
    const status = validated.status || "draft";
    const sentAt = status === "sent" ? new Date() : null;
    const responseToken = status === "sent" ? crypto.randomBytes(32).toString("hex") : null;
    return this.r.createOffer({ ...validated, status, sentAt, responseToken });
  }

  async updateOffer(id: string, body: any, userId: string) {
    const existing = await this.r.getOfferById(id);
    if (!existing) throw new NotFoundError("Offer not found");
    if (body.status === "sent" && existing.status === "withdrawn") throw new ValidationError("Cannot send a withdrawn offer. Create a new offer instead.");
    let sentAt = existing.sent_at;
    let respondedAt = existing.responded_at;
    let responseToken = existing.response_token;
    if (body.status === "sent" && !sentAt) { sentAt = new Date(); if (!responseToken) responseToken = crypto.randomBytes(32).toString("hex"); }
    if ((body.status === "accepted" || body.status === "rejected") && !respondedAt) respondedAt = new Date();
    const result = await this.r.updateOffer(id, { ...body, sentAt, respondedAt, responseToken });
    if (body.status === "rejected") {
      const appRows = await this.r.getApplicationById(existing.application_id);
      const fromStage = appRows?.stage || "offer";
      await this.r.rejectApplicationOnOfferReject(existing.application_id, fromStage, userId);
    }
    return result;
  }

  async approveOffer(id: string, userId: string) {
    const offer = await this.r.getOfferById(id);
    if (!offer) throw new NotFoundError("Offer not found");
    if (offer.approval_status === "approved") return offer;
    if (offer.approval_status === "rejected") throw new ValidationError("Offer was rejected and cannot be approved.");
    const result = await this.r.approveOffer(id, userId);
    await this.r.auditLog("offer", id, "OFFER_APPROVED", userId, { applicationId: offer.application_id });
    return result;
  }

  async rejectOffer(id: string, userId: string) {
    const offer = await this.r.getOfferById(id);
    if (!offer) throw new NotFoundError("Offer not found");
    if (offer.approval_status === "rejected") return offer;
    const result = await this.r.rejectOffer(id, userId);
    await this.r.auditLog("offer", id, "OFFER_REJECTED", userId, { applicationId: offer.application_id });
    return result;
  }

  async uploadOfferLetter(id: string, fileUrl: string, fileName: string) {
    const rows = await this.r.getOfferById(id);
    if (!rows) throw new NotFoundError("Offer not found");
    if (!fileUrl || typeof fileUrl !== "string") throw new ValidationError("fileUrl (data URL) is required");
    let fileUrlToStore = fileUrl;
    if (fileUrlToStore.startsWith("data:") && isSharePointAvatarConfigured()) {
      try {
        const parsed = parseDataUrl(fileUrlToStore);
        if (parsed) {
          const baseName = (fileName && String(fileName).trim()) || "offer-letter.pdf";
          const uploadName = `offer-${id}-${baseName.replace(/[^a-zA-Z0-9._-]/g,"_").slice(0,200)}`;
          const url = await uploadFileToSharePoint("Recruitment/OfferLetters", uploadName, parsed.buffer, parsed.contentType);
          if (url) fileUrlToStore = url;
        }
      } catch (e) { console.error("SharePoint offer letter upload failed", e); }
    }
    await this.r.uploadOfferLetter(id, fileUrlToStore, (fileName && String(fileName).trim()) || "offer-letter.pdf");
  }

  async getOfferLetter(id: string) {
    const rows = await this.r.getOfferLetter(id);
    if (!rows) throw new NotFoundError("Offer not found");
    if (!rows.offer_letter_url) throw new NotFoundError("No offer letter uploaded");
    return rows;
  }

  async getOfferByToken(token: string) {
    if (!token || token.length < 16) throw new ValidationError("Invalid token");
    const offer = await this.r.getOfferByToken(token);
    if (!offer) throw new NotFoundError("Offer not found or link has expired");
    return offer;
  }

  async getOfferLink(id: string, protocol: string, host: string) {
    const rows = await this.r.getOfferLink(id);
    if (!rows) throw new NotFoundError("Offer not found");
    let token = rows.response_token;
    if (!token && rows.status === "sent") { token = crypto.randomBytes(32).toString("hex"); await this.r.updateOfferToken(id, token); }
    if (!token) throw new ValidationError("No response link available. Offer must be sent first.");
    return { url: `${protocol}://${host}/offer-response/${token}`, token, status: rows.status };
  }

  // ── Hire ─────────────────────────────────────────────────────────────────────
  async hireCandidate(applicationId: string, body: any, userId: string) {
    const { employeeId, workEmail } = body;
    if (!employeeId) throw new ValidationError("employeeId is required");
    const app = await this.r.getApplicationForHire(applicationId);
    if (!app) throw new NotFoundError("Application not found");
    if (app.stage === "hired") throw new ValidationError("Already hired");
    if (app.employee_id) throw new ValidationError("Already linked to an employee");
    const offerRows = await this.r.getOffersByApplication(applicationId);
    if (offerRows.length === 0) throw new ValidationError("No offer exists");
    const offer = offerRows[0];
    if (offer.approval_status != null && offer.approval_status !== "approved") throw new ValidationError("Offer must be approved before hiring.");
    if (offer.approval_status == null && offer.status !== "accepted") throw new ValidationError(`Offer must be accepted. Current: '${offer.status}'.`);
    const tentativeCheck = await this.r.getTentativeForApplication(applicationId);
    if (tentativeCheck && tentativeCheck.status !== "cleared") throw new ValidationError("Tentative record exists but is not cleared. Use Confirm Hire from the tentative review instead.");
    const workEmailToUse = (workEmail && String(workEmail).trim()) || app.email;
    if (!workEmailToUse) throw new ValidationError("Candidate has no email on file.");
    const employee = await this.r.createEmployeeFromHire({ employeeId, workEmail: workEmailToUse, firstName: app.first_name, lastName: app.last_name, jobTitle: offer.job_title, department: offer.department, location: app.job_location, employmentType: offer.employment_type, joinDate: offer.start_date || new Date(), personalEmail: app.candidate_personal_email || app.email, phone: app.phone, dob: app.date_of_birth, gender: app.gender, maritalStatus: app.marital_status, bloodGroup: app.blood_group, street: app.street, city: app.city, state: app.state, country: app.country, zipCode: app.zip_code });
    await this.r.markApplicationHired(applicationId, employee.id, app.stage, userId);
    await this.r.auditLog("application", applicationId, "CANDIDATE_HIRED", userId, { employeeId: employee.id, fromStage: app.stage });
    return { message: "Candidate hired successfully.", employee, applicationId };
  }

  // ── Stats ─────────────────────────────────────────────────────────────────────
  async getStats() { return this.r.getStats(); }

  // ── FreshTeam migrations ──────────────────────────────────────────────────────
  async migrateFreshteamJobs() {
    if (!isFreshTeamConfigured()) throw Object.assign(new Error("FreshTeam migration not configured"), { statusCode: 503 });
    const delayMs = getFreshTeamDelayMs(), perPage = 30;
    let page = 1, totalProcessed = 0, created = 0, updated = 0;
    const errors: any[] = [];
    while (true) {
      const list = await listJobPostings(page, perPage); await sleep(delayMs);
      if (list.length === 0) break;
      for (const summary of list) {
        const ftId = (summary as any).id; if (ftId == null) continue;
        try {
          const job = await getJobPosting(ftId); await sleep(delayMs);
          const title = (job as any).title ?? "Untitled";
          const dept = (job as any).department?.name ?? (job as any).department ?? null;
          const desc = htmlToPlainText((job as any).description ?? (job as any).job_description);
          const reqs = htmlToPlainText((job as any).requirements ?? (job as any).job_requirement);
          const empType = (job as any).employment_type ?? (job as any).type ?? null;
          const expLevel = (job as any).experience_level ?? null;
          const salMin = (job as any).salary_min != null ? Number((job as any).salary_min) : null;
          const salMax = (job as any).salary_max != null ? Number((job as any).salary_max) : null;
          const currency = (job as any).salary_currency ?? null;
          const headcount = (job as any).requisitions ?? (job as any).head_count ?? 1;
          const ftStatus = ((job as any).status ?? "").toLowerCase();
          const status = ftStatus === "open" ? "published" : ftStatus === "archived" ? "archived" : "closed";
          const publishedAt = (job as any).published_on ? new Date((job as any).published_on) : null;
          const closedAt = (job as any).closed_at ? new Date((job as any).closed_at) : null;
          const recruiterEmails = [(job as any).recruiter?.email, (job as any).hiringManager?.email].filter(Boolean) as string[];
          const hmIds = await this.r.resolveHiringManagersByEmails(recruiterEmails);
          const r = await this.r.upsertJobFromFreshteam({ freshteamJobId: ftId, title, department: dept, description: desc, requirements: reqs, status, employmentType: empType, experienceLevel: expLevel, salaryRangeMin: salMin, salaryRangeMax: salMax, salaryCurrency: currency, headcount, hiringManagerId: hmIds[0]??null, hmIdsJson: hmIds.length > 0 ? JSON.stringify(hmIds) : null, publishedAt, closedAt });
          r.created ? created++ : updated++;
          totalProcessed++;
        } catch (e: any) { errors.push({ jobId: Number(ftId), error: e?.message ?? String(e) }); }
      }
      if (list.length < perPage) break;
      page++;
    }
    return { message: "FreshTeam job migration finished", totalProcessed, created, updated, errors: errors.length ? errors : undefined };
  }

  async migrateFreshteamCandidates() {
    if (!isFreshTeamConfigured()) throw Object.assign(new Error("FreshTeam migration not configured"), { statusCode: 503 });
    if (freshteamCandidateMigrationInProgress) throw Object.assign(new Error("FreshTeam candidate migration already running"), { statusCode: 409 });
    freshteamCandidateMigrationInProgress = true;
    const delayMs = getFreshTeamDelayMs(), perPage = 30;
    let applicantsProcessed = 0, candidatesCreated = 0, candidatesUpdated = 0, candidatesSkipped = 0, applicationsCreated = 0;
    const errors: any[] = [];
    const candidateCache = new Map<number, any>();
    try {
      const allJobs = await this.r.listJobs([], [], [], [], 1000, 0);
      const ourJobMap = new Map<string, string>();
      for (const j of allJobs.jobs as any[]) {
        if (j.freshteam_job_id) ourJobMap.set(String(j.freshteam_job_id), j.id);
      }
      for (const [ftJobId, ourJobId] of Array.from(ourJobMap.entries())) {
        let appPage = 1;
        do {
          const applicantList = await listApplicantsForJob(Number(ftJobId), appPage, perPage); await sleep(delayMs);
          if (!applicantList.length) break;
          for (const appSummary of applicantList) {
            applicantsProcessed++;
            const applicantId = (appSummary as any).id;
            if (applicantId == null) { candidatesSkipped++; continue; }
            // Fast path via freshteam_candidate_id
            const candidateId: number | null = (appSummary as any).candidate_id ?? (appSummary as any).candidate?.id ?? null;
            if (candidateId != null) {
              const existing = await this.r.findCandidateByFreshteamId(String(candidateId));
              if (existing) {
                const appExists = await this.r.applicationExistsForJob(existing.id, ourJobId);
                if (!appExists) {
                  const applicant = await getApplicant(Number(applicantId)); await sleep(delayMs);
                  const appliedAt = applicant.created_at ? new Date(applicant.created_at) : new Date();
                  const stage = mapFtStageToOur((applicant.stage ?? applicant.sub_stage) ?? undefined);
                  await this.r.createApplicationFromFreshteam(existing.id, ourJobId, stage, appliedAt, applicant.cover_letter ? String(applicant.cover_letter).trim()||null : null, (applicant.referral_source ?? applicant.source) ? String(applicant.referral_source ?? applicant.source).trim()||null : null);
                  applicationsCreated++;
                }
                continue;
              }
            }
            // Full fetch + create
            try {
              let applicantDetail: any = appSummary;
              let cid: number | null = candidateId;
              if (cid == null) { applicantDetail = await getApplicant(Number(applicantId)); await sleep(delayMs); cid = applicantDetail.candidate_id ?? null; }
              let candidate: any;
              if (cid != null) {
                if (!candidateCache.has(cid)) { candidateCache.set(cid, await getCandidate(cid)); await sleep(delayMs); }
                candidate = candidateCache.get(cid);
              } else {
                candidate = { first_name: "Unknown", last_name: "", email: null };
              }
              const email = ((candidate.email ?? "")).trim().toLowerCase();
              if (!email) { errors.push({ applicantId: Number(applicantId), error: "No email" }); continue; }
              // Build normalized candidate data
              const data: any = { firstName: String(candidate.first_name||"Unknown").trim()||"Unknown", middleName: candidate.middle_name ? String(candidate.middle_name).trim()||null : null, lastName: String(candidate.last_name||"").trim(), phone: candidate.mobile||candidate.phone||null, linkedinUrl: null, freshteamCandidateId: cid != null ? String(cid) : null };
              const loc = candidate.location ?? candidate.address_details;
              if (loc && typeof loc === "object") { data.city=loc.city||null; data.state=loc.state||null; data.country=loc.country_code||loc.country||null; data.street=loc.street||null; data.zipCode=loc.zip_code||loc.postal_code||null; }
              const expMonths = candidate.total_experience_in_months ?? candidate.experience_in_months;
              data.experienceYears = expMonths != null ? Math.round(Number(expMonths)/12) : (candidate.experience_years != null ? Number(candidate.experience_years) : null);
              data.currentCompany = candidate.current_company ? String(candidate.current_company).trim()||null : null;
              data.currentTitle = candidate.current_title || candidate.designation ? String(candidate.current_title||candidate.designation).trim()||null : null;
              data.notes = candidate.description ? String(candidate.description).trim()||null : null;
              const tagsArr = Array.isArray(candidate.tags) ? candidate.tags : [];
              const skillsArr = Array.isArray(candidate.skills) ? candidate.skills : [];
              const uniqueTags = Array.from(new Set([...tagsArr,...skillsArr].map((t:any)=>String(t).trim()).filter(Boolean)));
              data.tagsJson = uniqueTags.length > 0 ? JSON.stringify(uniqueTags) : null;
              data.expectedSalary = candidate.expected_salary != null ? Number(candidate.expected_salary) : null;
              data.currentSalary = candidate.current_salary != null ? Number(candidate.current_salary) : null;
              data.salaryCurrency = candidate.salary_currency ? String(candidate.salary_currency).trim()||null : null;
              data.dateOfBirth = candidate.date_of_birth && /^\d{4}-\d{2}-\d{2}/.test(String(candidate.date_of_birth)) ? String(candidate.date_of_birth).slice(0,10) : null;
              data.gender = candidate.gender ? String(candidate.gender).trim()||null : null;
              // Resume
              let resumeUrl = "", resumeFilename: string|null = null;
              const resumesList = candidate.resumes ?? candidate.documents ?? candidate.resume;
              const resumesArr = Array.isArray(resumesList) ? resumesList : (resumesList ? [resumesList] : []);
              const resumeObj = resumesArr[0] && typeof resumesArr[0] === "object" ? resumesArr[0] as any : null;
              let resumeUrlAttr = resumeObj?.url ?? resumeObj?.file_url ?? resumeObj?.document_url ?? candidate.resume_url;
              if (!resumeUrlAttr && resumeObj?.id != null && cid != null) { const origin = getFreshTeamOrigin(); if (origin) resumeUrlAttr = `${origin}/api/candidates/${cid}/resumes/${resumeObj.id}`; }
              const resumeNameAttr = resumeObj?.content_file_name ?? resumeObj?.file_name ?? resumeObj?.name;
              if (resumeUrlAttr && typeof resumeUrlAttr === "string") {
                const url = resumeUrlAttr.trim();
                const nameFromApi = resumeNameAttr ? String(resumeNameAttr).trim()||null : null;
                let downloaded = await downloadResumeAsDataUrl(url, nameFromApi ?? deriveResumeFilenameFromUrl(url), true);
                if (!downloaded && resumeObj?.id != null && cid != null && url.includes("/resumes/") && !url.includes("/download")) { const origin = getFreshTeamOrigin(); if (origin) { downloaded = await downloadResumeAsDataUrl(`${origin}/api/candidates/${cid}/resumes/${resumeObj.id}/download`, nameFromApi??"resume.pdf", true); await sleep(delayMs); } }
                if (downloaded) { resumeUrl = downloaded.dataUrl; resumeFilename = downloaded.filename; } else if (resumeUrlAttr) { console.warn("[FT migration] Resume download failed for", email); }
                await sleep(delayMs);
              }
              if (resumeUrl.startsWith("data:") && isSharePointAvatarConfigured()) resumeUrl = await uploadResumeIfNeeded(resumeUrl, cid ?? undefined);
              const existingCand = await this.r.findCandidateByEmailFull(email);
              const existingResume = existingCand?.resume_url?.trim() ?? "";
              const isPlaceholder = !existingResume || existingResume === "data:application/octet-stream;base64," || existingResume.length < 100;
              data.resumeUrl = resumeUrl; data.resumeFilename = resumeFilename;
              data.setResume = resumeUrl && (isPlaceholder || !existingResume);
              const result = await this.r.upsertCandidateFromFreshteam(email, data, existingCand?.id);
              result.created ? candidatesCreated++ : candidatesUpdated++;
              const appExists = await this.r.applicationExistsForJob(result.id, ourJobId);
              if (!appExists) {
                const appliedAt = applicantDetail.created_at ? new Date(applicantDetail.created_at) : new Date();
                const stage = mapFtStageToOur((applicantDetail.stage ?? applicantDetail.sub_stage) ?? undefined);
                await this.r.createApplicationFromFreshteam(result.id, ourJobId, stage, appliedAt, applicantDetail.cover_letter ? String(applicantDetail.cover_letter).trim()||null : null, (applicantDetail.referral_source ?? applicantDetail.source) ? String(applicantDetail.referral_source ?? applicantDetail.source).trim()||null : null);
                applicationsCreated++;
              }
            } catch (err: any) { errors.push({ applicantId: Number(applicantId), error: err?.message ?? String(err) }); }
          }
          if (applicantList.length < perPage) break;
          appPage++;
        } while (true);
      }
      return { message: "FreshTeam candidate migration finished", applicantsProcessed, candidatesCreated, candidatesUpdated, candidatesSkipped, applicationsCreated, candidatesInCache: candidateCache.size, errors: errors.length ? errors : undefined };
    } finally { freshteamCandidateMigrationInProgress = false; }
  }
}
