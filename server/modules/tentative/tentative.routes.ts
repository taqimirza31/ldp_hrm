import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { TentativeController } from "./TentativeController.js";

const router = Router();
const ctrl = new TentativeController();
const adminHR = requireRole(["admin", "hr"]);

// Public portal routes (no auth)
router.get("/portal/:token",                       ctrl.getPortal);
router.post("/portal/:token/upload/:docId",        ctrl.uploadPortalDocument);

// HR routes
router.get("/",                                    requireAuth, adminHR, ctrl.list);
router.get("/:applicationId",                      requireAuth, adminHR, ctrl.getByApplicationId);
router.post("/initiate",                           requireAuth, adminHR, ctrl.initiate);
router.get("/documents/:docId/file",               requireAuth, adminHR, ctrl.getDocumentFile);
router.patch("/documents/:docId/verify",           requireAuth, adminHR, ctrl.verifyDocument);
router.post("/:tentativeId/clear",                 requireAuth, adminHR, ctrl.clearRecord);
router.post("/:tentativeId/fail",                  requireAuth, adminHR, ctrl.failRecord);
router.post("/:tentativeId/confirm-hire",          requireAuth, adminHR, ctrl.confirmHire);
router.patch("/:tentativeId/first-job",            requireAuth, adminHR, ctrl.updateFirstJob);

export default router;
