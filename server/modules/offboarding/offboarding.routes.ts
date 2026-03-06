import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { OffboardingController } from "./OffboardingController.js";

const router = Router();
const ctrl = new OffboardingController();
const adminHR = requireRole(["admin", "hr"]);

router.get("/",                                          requireAuth, adminHR, ctrl.list);
router.get("/employee/:employeeId/details",               requireAuth, adminHR, ctrl.getDetailsByEmployee);
router.get("/:id",                                       requireAuth, adminHR, ctrl.getById);
router.post("/initiate",                 requireAuth, adminHR, ctrl.initiate);
router.patch("/:id/exit-date",           requireAuth, adminHR, ctrl.updateExitDate);
router.post("/:id/cancel",               requireAuth, adminHR, ctrl.cancel);
router.post("/:id/complete",             requireAuth, adminHR, ctrl.complete);
router.get("/:id/tasks",                 requireAuth, adminHR, ctrl.getTasks);
router.patch("/tasks/:taskId",           requireAuth, adminHR, ctrl.updateTask);
router.get("/:id/audit",                 requireAuth, adminHR, ctrl.getAuditLog);

export default router;
