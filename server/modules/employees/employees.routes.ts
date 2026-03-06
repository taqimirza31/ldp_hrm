import { Router } from "express";
import { requireAuth, requireRole, canAccessEmployee } from "../../middleware/auth.js";
import { EmployeeController } from "./EmployeeController.js";

const router = Router();
const ctrl = new EmployeeController();
const adminHR = requireRole(["admin", "hr"]);

// Utility / bulk operations (must come before /:id routes)
router.get("/departments",                         requireAuth, ctrl.getDepartments);
router.get("/suggested-id",                        requireAuth, adminHR, ctrl.getSuggestedId);
router.post("/migrate-avatars-from-urls",           requireAuth, adminHR, ctrl.migrateAvatarsFromUrls);
router.post("/migrate-avatars-to-sharepoint",       requireAuth, adminHR, ctrl.migrateAvatarsToSharePoint);
router.post("/import-freshteam-csv",               requireAuth, adminHR, ctrl.importFreshteamCsv);
router.post("/import-freshteam-extras",            requireAuth, adminHR, ctrl.importFreshteamExtras);

// Document file serving (before /:id to avoid route conflict)
router.get("/documents/:docId/file",               requireAuth, ctrl.getDocumentFile);
router.delete("/documents/:docId",                 requireAuth, adminHR, ctrl.deleteDocument);

// CRUD
router.get("/",                                    requireAuth, ctrl.list);
router.post("/",                                   requireAuth, adminHR, ctrl.create);
router.get("/:id",                                 requireAuth, canAccessEmployee, ctrl.getById);
router.patch("/:id",                               requireAuth, adminHR, ctrl.update);
router.delete("/:id",                              requireAuth, requireRole(["admin"]), ctrl.delete);

// Per-employee sub-resources
router.get("/:id/avatar",                          requireAuth, ctrl.getAvatar);
router.get("/:id/timeline",                        requireAuth, canAccessEmployee, ctrl.getTimeline);
router.get("/:id/documents",                       requireAuth, canAccessEmployee, ctrl.listDocuments);
router.post("/:id/documents",                      requireAuth, adminHR, canAccessEmployee, ctrl.uploadDocument);
router.post("/:id/sync-tentative-documents",       requireAuth, adminHR, canAccessEmployee, ctrl.syncTentativeDocuments);

export default router;
