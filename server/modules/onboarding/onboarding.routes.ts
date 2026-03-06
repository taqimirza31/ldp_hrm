import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { OnboardingController } from "./OnboardingController.js";

const router = Router();
const ctrl = new OnboardingController();
const adminHR = requireRole(["admin", "hr"]);

router.get("/",                             requireAuth, adminHR, ctrl.list);
router.get("/employee/:employeeId",         requireAuth, adminHR, ctrl.getByEmployee);
router.get("/:id",                          requireAuth, adminHR, ctrl.getById);
router.post("/",                            requireAuth, adminHR, ctrl.create);
router.patch("/:id",                        requireAuth, adminHR, ctrl.update);
router.delete("/:id",                       requireAuth, adminHR, ctrl.remove);
router.post("/:id/tasks",                   requireAuth, adminHR, ctrl.addTask);
router.patch("/:id/tasks/:taskId",          requireAuth, adminHR, ctrl.updateTask);
router.delete("/:id/tasks/:taskId",         requireAuth, adminHR, ctrl.removeTask);

export default router;
