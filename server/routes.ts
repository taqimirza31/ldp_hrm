import type { Express } from "express";
import { createServer, type Server } from "http";
import { requireAuth, requireRole } from "./middleware/auth";

// ── New enterprise architecture modules ──────────────────────────────────────
// Fully refactored (layered architecture: routes → controller → service → repository)
import authRouter from "./modules/auth/auth.routes";
import departmentsRouter from "./modules/departments/department.routes";
import tasksRouter from "./modules/tasks/task.routes";
import onboardingRouter from "./modules/onboarding/onboarding.routes";
import changeRequestsRouter from "./modules/change-requests/change-requests.routes";
import notificationsRouter from "./modules/notifications/notification.routes";
import compensationRouter from "./modules/compensation/compensation.routes";
import attendanceRouter from "./modules/attendance/attendance.routes";
import offboardingRouter from "./modules/offboarding/offboarding.routes";
import dashboardRouter from "./modules/dashboard/dashboard.routes";
import tentativeRouter from "./modules/tentative/tentative.routes";

import employeesRouter from "./modules/employees/employees.routes";
import assetsRouter from "./modules/assets/assets.routes";
import recruitmentRouter from "./modules/recruitment/recruitment.routes";
import leaveRouter from "./modules/leave/leave.routes";

export async function registerRoutes(app: Express): Promise<Server> {
  // ── Auth ────────────────────────────────────────────────────────────────────
  app.use("/api/auth", authRouter);

  // ── Core HR ────────────────────────────────────────────────────────────────
  app.use("/api/employees",      employeesRouter);
  app.use("/api/departments",    departmentsRouter);
  app.use("/api/compensation",   compensationRouter);
  app.use("/api/change-requests", changeRequestsRouter);

  // ── Leave ──────────────────────────────────────────────────────────────────
  app.use("/api/leave", leaveRouter);

  // ── Attendance ─────────────────────────────────────────────────────────────
  app.use("/api/attendance", attendanceRouter);

  // ── Assets & IT ───────────────────────────────────────────────────────────
  app.use("/api/assets", assetsRouter);

  // ── Recruitment & Hiring flow ──────────────────────────────────────────────
  app.use("/api/recruitment", recruitmentRouter);
  app.use("/api/tentative",   tentativeRouter);

  // ── Employee lifecycle ─────────────────────────────────────────────────────
  app.use("/api/onboarding",   onboardingRouter);
  app.use("/api/offboarding",  offboardingRouter);

  // ── Productivity ───────────────────────────────────────────────────────────
  app.use("/api/tasks", tasksRouter);

  // ── Analytics & Notifications ─────────────────────────────────────────────
  app.use("/api/dashboard",      dashboardRouter);
  app.use("/api/notifications",  notificationsRouter);

  // ── Health check ───────────────────────────────────────────────────────────
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  const httpServer = createServer(app);
  return httpServer;
}
