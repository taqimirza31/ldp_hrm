import { TentativeRepository, DOC_TYPE_LABELS, generateDocumentChecklist } from "./TentativeRepository.js";
import { NotFoundError, ValidationError, ConflictError } from "../../core/types/index.js";
import { isSharePointAvatarConfigured, parseDataUrl, uploadFileToSharePoint } from "../../lib/sharepoint.js";

export class TentativeService {
  private readonly repo = new TentativeRepository();

  async initiate(applicationId: string, isFirstJob: boolean, initiatedBy: string) {
    if (!applicationId) throw new ValidationError("applicationId is required");
    const app = await this.repo.getApplication(applicationId);
    if (!app) throw new NotFoundError("Application", applicationId);
    if (app.stage !== "verbally_accepted") throw new ValidationError("Candidate must be verbally accepted before initiating tentative.");
    if (await this.repo.getExistingTentative(applicationId)) throw new ConflictError("Tentative record already exists for this application");
    const tentative = await this.repo.createTentativeRecord(applicationId, app.candidate_id, isFirstJob, initiatedBy);
    const docs = generateDocumentChecklist(!!isFirstJob);
    for (const d of docs) await this.repo.insertDocument(tentative.id, d.documentType, d.required, d.autoStatus);
    await this.repo.updateApplicationStage(applicationId, app.stage, "tentative", "Tentative hiring initiated — document collection started", initiatedBy);
    await this.repo.auditLog("application", applicationId, "TENTATIVE_INITIATED", initiatedBy, { tentativeId: tentative.id, isFirstJob });
    const documents = await this.repo.getDocuments(tentative.id);
    const token = tentative.portal_token ?? (tentative as any).portalToken ?? "";
    return { ...tentative, documents, portalUrl: `/tentative-portal/${token}` };
  }

  async list() { return this.repo.listAll(); }
  async getByApplicationId(applicationId: string) {
    const record = await this.repo.getByApplicationId(applicationId);
    if (!record) throw new NotFoundError("Tentative record for application", applicationId);
    const documents = await this.repo.getDocuments(record.id);
    return { ...record, documents };
  }

  // Public portal (token-based, no auth)
  async getPortal(token: string) {
    const record = await this.repo.getByToken(token);
    if (!record) throw new NotFoundError("Portal", token);
    if (record.status === "cleared") return { ...record, documents: [], message: "Your documents have been verified. The hiring process is complete." };
    const documents = (await this.repo.getDocuments(record.id, true)).map((d: any) => ({ ...d, label: DOC_TYPE_LABELS[d.document_type] || d.document_type }));
    return { ...record, documents };
  }

  async uploadPortalDocument(token: string, docId: string, fileUrl: string, fileName: string|null) {
    const tent = await this.repo.getByToken(token);
    if (!tent) throw new NotFoundError("Portal", token);
    if (tent.status === "cleared") throw new ValidationError("Portal is closed — documents already verified");
    if (tent.status === "failed") throw new ValidationError("This tentative record has been marked as failed");
    const doc = await this.repo.getDocument(docId);
    if (!doc || doc.tentative_record_id !== tent.id) throw new NotFoundError("Document", docId);
    if (doc.status === "verified") throw new ValidationError("This document is already verified");
    if (doc.status === "not_applicable") throw new ValidationError("This document is marked as not applicable");

    let fileUrlToStore = fileUrl;
    if (typeof fileUrl === "string" && fileUrl.startsWith("data:") && isSharePointAvatarConfigured()) {
      try {
        const parsed = parseDataUrl(fileUrl);
        if (parsed) {
          const safeName = (fileName || "document.pdf").replace(/[^a-zA-Z0-9._-]/g, "_");
          const url = await uploadFileToSharePoint("Recruitment/TentativeDocs", `${docId}-${safeName}`, parsed.buffer, parsed.contentType);
          if (url) fileUrlToStore = url;
        }
      } catch (e) { console.error("SharePoint tentative doc upload failed", e); }
    }

    const result = await this.repo.uploadDocument(docId, fileUrlToStore, fileName);
    return { ...result, label: DOC_TYPE_LABELS[result.document_type] };
  }

  async getDocumentFile(docId: string) { return this.repo.getDocumentFile(docId); }

  async verifyDocument(docId: string, action: "verify"|"reject", reason: string|null, verifiedBy: string) {
    if (!["verify", "reject"].includes(action)) throw new ValidationError("action must be 'verify' or 'reject'");
    const doc = await this.repo.getDocument(docId);
    if (!doc) throw new NotFoundError("Document", docId);
    if (doc.status === "not_applicable") throw new ValidationError("Cannot verify a not-applicable document");
    if (doc.status === "pending") throw new ValidationError("Document has not been uploaded yet");
    if (action === "reject" && !reason) throw new ValidationError("Rejection reason is required");
    if (action === "verify") return this.repo.verifyDocument(docId, verifiedBy);
    return this.repo.rejectDocument(docId, reason!, verifiedBy);
  }

  async clearRecord(tentativeId: string) {
    const record = await this.repo.getById(tentativeId);
    if (!record) throw new NotFoundError("Tentative record", tentativeId);
    if (record.status === "cleared") throw new ValidationError("Already cleared");
    const pending = await this.repo.getPendingRequiredCount(tentativeId);
    if (pending > 0) throw new ValidationError(`Cannot clear: ${pending} required document(s) still pending or rejected`);
    const result = await this.repo.clearRecord(tentativeId);
    await this.repo.auditLog("tentative", tentativeId, "TENTATIVE_CLEARED", null, { applicationId: record.application_id });
    return result;
  }

  async failRecord(tentativeId: string, reason: string|null, movedBy: string) {
    const record = await this.repo.failRecord(tentativeId, reason);
    if (!record) throw new NotFoundError("Tentative record", tentativeId);
    const appRows = await this.repo.getApplication(record.application_id);
    const fromStage = appRows?.stage || "tentative";
    await this.repo.updateApplicationStage(record.application_id, fromStage, "rejected", reason || "Tentative failed — document verification", movedBy);
    await this.repo.auditLog("tentative", tentativeId, "TENTATIVE_FAILED", movedBy, { reason, applicationId: record.application_id });
    return record;
  }

  async confirmHire(tentativeId: string, employeeId: string, workEmail: string|undefined, movedBy: string) {
    if (!employeeId) throw new ValidationError("employeeId is required");
    const tentative = await this.repo.getById(tentativeId);
    if (!tentative) throw new NotFoundError("Tentative record", tentativeId);
    if (tentative.status !== "cleared") throw new ValidationError(`Tentative must be cleared before hire. Current: '${tentative.status}'.`);
    const app = await this.repo.getApplicationWithCandidate(tentative.application_id);
    if (!app) throw new NotFoundError("Application", tentative.application_id);
    if (app.stage === "hired") throw new ValidationError("Already hired");
    if (app.employee_id) throw new ValidationError("Already linked to employee");
    const offer = await this.repo.getOffer(tentative.application_id);
    if (!offer) throw new ValidationError("No offer found");
    if (offer.status !== "accepted") throw new ValidationError("Offer must be accepted");
    const workEmailToUse = (workEmail && String(workEmail).trim()) || app.personal_email;
    if (!workEmailToUse) throw new ValidationError("Candidate has no email on file. Add email to the candidate record and try again.");
    const employee = await this.repo.createEmployee({ employeeId, workEmail: workEmailToUse, firstName: app.first_name, lastName: app.last_name, jobTitle: offer.job_title, department: offer.department, location: app.job_location, status: "onboarding", employeeType: offer.employment_type, joinDate: offer.start_date || new Date(), personalEmail: app.personal_email, phone: app.phone });
    const verifiedDocs = await this.repo.getVerifiedDocs(tentativeId);
    for (const d of verifiedDocs) await this.repo.copyDocToEmployee(employee.id, d, DOC_TYPE_LABELS[d.document_type] || (d.document_type||"").replace(/_/g," "));
    await this.repo.updateApplicationStage(tentative.application_id, app.stage, "hired", "Confirmed hire after tentative clearance", movedBy);
    await this.repo.auditLog("application", tentative.application_id, "CANDIDATE_HIRED_VIA_TENTATIVE", movedBy, { employeeId: employee.id, tentativeId });
    return { message: "Candidate hired successfully. Start onboarding from the employee profile.", employee, tentativeId, applicationId: tentative.application_id };
  }

  async updateFirstJob(tentativeId: string, isFirstJob: boolean) {
    const record = await this.repo.getById(tentativeId);
    if (!record) throw new NotFoundError("Tentative record", tentativeId);
    if (record.status !== "pending") throw new ValidationError("Can only update first-job flag while tentative is pending");
    await this.repo.updateFirstJob(tentativeId, !!isFirstJob);
    await this.repo.deleteDocuments(tentativeId);
    const docs = generateDocumentChecklist(!!isFirstJob);
    for (const d of docs) await this.repo.insertDocument(tentativeId, d.documentType, d.required, d.autoStatus);
    const documents = await this.repo.getDocuments(tentativeId);
    return { ...record, is_first_job: !!isFirstJob, documents };
  }
}
