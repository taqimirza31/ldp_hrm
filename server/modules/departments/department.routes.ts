/**
 * department.routes.ts — API endpoint definitions for the Departments module.
 *
 * Rules:
 *  • Only route definitions here (path + method + middleware + controller handler).
 *  • No business logic, no SQL, no response formatting.
 *  • Auth and role guards are applied per-route.
 *
 * Mounted at: /api/departments  (see server/routes.ts)
 *
 * Endpoints:
 *   GET    /api/departments                  list (paginated, searchable)
 *   GET    /api/departments/:id              single department
 *   POST   /api/departments                  create (admin / hr)
 *   PUT    /api/departments/:id              update (admin / hr)
 *   DELETE /api/departments/:id              delete (admin / hr)
 */

import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { DepartmentController } from "./DepartmentController.js";

const router = Router();
const ctrl = new DepartmentController();

// ─── Public-to-authenticated endpoints ───────────────────────────────────────

router.get("/",    requireAuth,                              ctrl.list);
router.get("/:id", requireAuth,                              ctrl.getById);

// ─── Admin / HR only ──────────────────────────────────────────────────────────

router.post(  "/",    requireAuth, requireRole(["admin", "hr"]), ctrl.create);
router.put(   "/:id", requireAuth, requireRole(["admin", "hr"]), ctrl.update);
router.delete("/:id", requireAuth, requireRole(["admin", "hr"]), ctrl.remove);

export default router;
