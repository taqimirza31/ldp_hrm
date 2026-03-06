import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { EmployeeController } from "./EmployeeController.js";

const router = Router();
const ctrl = new EmployeeController();
const adminHR = requireRole(["admin", "hr"]);

router.get("/",                requireAuth, ctrl.list);
router.get("/suggest-id",      requireAuth, adminHR, ctrl.suggestId);
router.get("/:id",             requireAuth, ctrl.getById);
router.get("/:id/timeline",    requireAuth, ctrl.getTimeline);
router.post("/",               requireAuth, adminHR, ctrl.create);
router.patch("/:id",           requireAuth, adminHR, ctrl.update);

export default router;
