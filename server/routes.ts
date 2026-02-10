import type { Express } from "express";
import { createServer, type Server } from "http";
import authRouter from "./routes/auth";
import employeesRouter from "./routes/employees";
import changeRequestsRouter from "./routes/changeRequests";
import assetsRouter from "./routes/assets";
import onboardingRouter from "./routes/onboarding";
import recruitmentRouter from "./routes/recruitment";
import attendanceRouter from "./routes/attendance";
import tentativeRouter from "./routes/tentative";
import offboardingRouter from "./routes/offboarding";

export async function registerRoutes(app: Express): Promise<Server> {
  // API Routes
  app.use("/api/auth", authRouter);
  app.use("/api/employees", employeesRouter);
  app.use("/api/change-requests", changeRequestsRouter);
  app.use("/api/assets", assetsRouter);
  app.use("/api/onboarding", onboardingRouter);
  app.use("/api/recruitment", recruitmentRouter);
  app.use("/api/attendance", attendanceRouter);
  app.use("/api/tentative", tentativeRouter);
  app.use("/api/offboarding", offboardingRouter);

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  const httpServer = createServer(app);

  return httpServer;
}
