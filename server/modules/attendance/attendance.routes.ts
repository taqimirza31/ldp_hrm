import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { AttendanceController } from "./AttendanceController.js";

const router = Router();
const ctrl = new AttendanceController();
const adminHR = requireRole(["admin", "hr"]);

router.get("/shifts",                    requireAuth, ctrl.listShifts);
router.post("/shifts",                   requireAuth, adminHR, ctrl.createShift);
router.patch("/shifts/:id",              requireAuth, adminHR, ctrl.updateShift);
router.delete("/shifts/:id",             requireAuth, requireRole(["admin"]), ctrl.deleteShift);

router.get("/employee-shifts",           requireAuth, ctrl.listEmployeeShifts);
router.post("/employee-shifts",          requireAuth, adminHR, ctrl.assignShift);
router.delete("/employee-shifts/:id",    requireAuth, adminHR, ctrl.removeEmployeeShift);

router.post("/check-in",                 requireAuth, ctrl.checkIn);
router.post("/check-out",                requireAuth, ctrl.checkOut);
router.get("/today",                     requireAuth, ctrl.getToday);
router.get("/stats",                     requireAuth, ctrl.getStats);
router.get("/employee/:id",              requireAuth, ctrl.getEmployeeRecords);
router.get("/report",                    requireAuth, requireRole(["admin", "hr", "manager"]), ctrl.getReport);
router.get("/records",                   requireAuth, ctrl.listRecords);
router.post("/manual",                   requireAuth, adminHR, ctrl.manualUpsert);
router.patch("/record/:id",              requireAuth, adminHR, ctrl.updateRecord);
router.delete("/record/:id",             requireAuth, adminHR, ctrl.deleteRecord);
router.get("/daily-summary",             requireAuth, adminHR, ctrl.getDailySummary);
router.get("/records/:id/audit",         requireAuth, adminHR, ctrl.listAudit);

export default router;
