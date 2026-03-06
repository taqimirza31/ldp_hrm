import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { RecruitmentController } from "./RecruitmentController.js";

const router = Router();
const ctrl = new RecruitmentController();
const adminHR = requireRole(["admin", "hr"]);
const adminHRManager = requireRole(["admin", "hr", "manager"]);

// ── FreshTeam migrations ──────────────────────────────────────────────────────
router.post("/migrate-freshteam-jobs",        requireAuth, requireRole(["admin"]), ctrl.migrateFreshteamJobs);
router.post("/migrate-freshteam-candidates",  requireAuth, requireRole(["admin"]), ctrl.migrateFreshteamCandidates);

// ── Stats ─────────────────────────────────────────────────────────────────────
router.get("/stats",                           requireAuth, ctrl.getStats);

// ── Candidates ────────────────────────────────────────────────────────────────
router.get("/candidates",                      requireAuth, ctrl.listCandidates);
router.post("/candidates",                     ctrl.createCandidate);
router.get("/candidates/:id/resume",           requireAuth, ctrl.getCandidateResume);
router.get("/candidates/:id",                  requireAuth, ctrl.getCandidateById);
router.patch("/candidates/:id",               requireAuth, adminHR, ctrl.updateCandidate);
router.delete("/candidates/:id",              requireAuth, adminHR, ctrl.deleteCandidate);

// ── Job Postings ──────────────────────────────────────────────────────────────
router.get("/jobs/filter-options",             requireAuth, ctrl.getJobFilterOptions);
router.get("/jobs/published",                  ctrl.getPublishedJobs);
router.get("/jobs",                            requireAuth, ctrl.listJobs);
router.post("/jobs",                           requireAuth, adminHR, ctrl.createJob);
router.get("/jobs/:id",                        requireAuth, ctrl.getJobById);
router.patch("/jobs/:id",                      requireAuth, adminHR, ctrl.updateJob);
router.delete("/jobs/:id",                     requireAuth, requireRole(["admin"]), ctrl.deleteJob);

// ── Applications ──────────────────────────────────────────────────────────────
router.get("/applications",                    requireAuth, ctrl.listApplications);
router.post("/applications",                   ctrl.createApplication);
router.get("/applications/:id",                requireAuth, ctrl.getApplicationById);
router.patch("/applications/:id/stage",        requireAuth, adminHR, ctrl.updateApplicationStage);
router.delete("/applications/:id",             requireAuth, adminHR, ctrl.deleteApplication);
router.get("/applications/:id/history",        requireAuth, ctrl.getApplicationHistory);

// Application emails
router.get("/applications/:id/emails",         requireAuth, ctrl.listApplicationEmails);
router.post("/applications/:id/emails",        requireAuth, adminHR, ctrl.sendApplicationEmail);
router.delete("/applications/:id/emails/:emailId", requireAuth, adminHR, ctrl.deleteApplicationEmail);

// Hire conversion
router.post("/applications/:id/hire",          requireAuth, adminHR, ctrl.hireCandidate);

// ── Offers ────────────────────────────────────────────────────────────────────
router.get("/offers",                          requireAuth, ctrl.listOffers);
router.post("/offers",                         requireAuth, adminHR, ctrl.createOffer);
router.patch("/offers/:id/approve",            requireAuth, adminHRManager, ctrl.approveOffer);
router.patch("/offers/:id/reject",             requireAuth, adminHRManager, ctrl.rejectOffer);
router.post("/offers/:id/upload-letter",       requireAuth, adminHRManager, ctrl.uploadOfferLetter);
router.get("/offers/:id/letter",               requireAuth, adminHRManager, ctrl.getOfferLetter);
router.get("/offers/:id/link",                 requireAuth, adminHR, ctrl.getOfferLink);
router.patch("/offers/:id",                    requireAuth, adminHR, ctrl.updateOffer);

// ── Offer response (public / candidate-facing) ────────────────────────────────
router.get("/offer-response/:token",           ctrl.getOfferByToken);
router.post("/offer-response/:token",          ctrl.offerResponseDeprecated);

// ── Inbound email webhook (no auth — called by Resend) ─────────────────────────
router.post("/inbound-email",                  ctrl.handleInboundEmail);

export default router;
