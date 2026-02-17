import { Router, Request, Response } from "express";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { requireAuth } from "../middleware/auth";

config();
const sql = neon(process.env.DATABASE_URL!);
const router = Router();

export interface NotificationItem {
  id: string;
  type: string;
  module: string;
  title: string;
  message: string;
  link: string;
  createdAt: string;
  roleTarget: "employee" | "manager" | "hr" | "admin" | "all";
}

/**
 * GET /api/notifications
 * Returns role-aware notifications from all modules (leave, recruitment, onboarding, offboarding, change requests, tentative).
 * Synced per role so each user sees only relevant items.
 */
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const role = String(req.user!.role || "employee").toLowerCase();
    const employeeId = req.user!.employeeId;
    const notifications: NotificationItem[] = [];
    const now = new Date().toISOString();

    // ---- EMPLOYEE: my leave, my change requests, my onboarding ----
    if (employeeId) {
      const [myLeave, myChangeRequests, myOnboarding] = await Promise.all([
        sql`
          SELECT lr.id, lr.status, lr.start_date, lr.end_date, lr.applied_at, lt.name as type_name
          FROM leave_requests lr
          INNER JOIN leave_types lt ON lt.id = lr.leave_type_id
          WHERE lr.employee_id = ${employeeId}
          ORDER BY lr.applied_at DESC
          LIMIT 5
        `,
        sql`
          SELECT id, status, created_at, category
          FROM change_requests
          WHERE requester_id = ${req.user!.id}
          ORDER BY created_at DESC
          LIMIT 5
        `,
        sql`
          SELECT r.id, r.status, r.created_at,
            (SELECT COUNT(*)::int FROM onboarding_tasks t WHERE t.onboarding_record_id = r.id AND t.completed = 'false') as pending_tasks
          FROM onboarding_records r
          WHERE r.employee_id = ${employeeId} AND r.status = 'in_progress'
          LIMIT 1
        `,
      ]);

      for (const r of myLeave as any[]) {
        const dateRange = `${r.start_date} – ${r.end_date}`;
        const createdAt = r.applied_at ? new Date(r.applied_at).toISOString() : now;
        if (r.status === "pending") {
          notifications.push({
            id: `leave-pending-${r.id}`,
            type: "leave",
            module: "Leave",
            title: "Leave pending approval",
            message: `Your ${r.type_name} (${dateRange}) is awaiting approval.`,
            link: "/leave",
            createdAt,
            roleTarget: "employee",
          });
        } else if (r.status === "approved") {
          notifications.push({
            id: `leave-approved-${r.id}`,
            type: "leave",
            module: "Leave",
            title: "Leave approved",
            message: `Your ${r.type_name} (${dateRange}) has been approved.`,
            link: "/leave",
            createdAt,
            roleTarget: "employee",
          });
        } else if (r.status === "rejected") {
          notifications.push({
            id: `leave-rejected-${r.id}`,
            type: "leave",
            module: "Leave",
            title: "Leave rejected",
            message: `Your ${r.type_name} (${dateRange}) was not approved.`,
            link: "/leave",
            createdAt,
            roleTarget: "employee",
          });
        }
      }

      for (const cr of myChangeRequests as any[]) {
        const createdAt = cr.created_at ? new Date(cr.created_at).toISOString() : now;
        if (cr.status === "pending") {
          notifications.push({
            id: `change-request-${cr.id}`,
            type: "change_request",
            module: "Profile",
            title: "Profile change pending",
            message: `Your ${cr.category || "profile"} update is with HR for approval.`,
            link: "/employees/" + employeeId,
            createdAt,
            roleTarget: "employee",
          });
        } else if (cr.status === "approved") {
          notifications.push({
            id: `change-approved-${cr.id}`,
            type: "change_request",
            module: "Profile",
            title: "Profile change approved",
            message: `Your ${cr.category || "profile"} update has been approved.`,
            link: "/employees/" + employeeId,
            createdAt,
            roleTarget: "employee",
          });
        }
      }

      const ob = (myOnboarding as any[])[0];
      if (ob && ob.pending_tasks > 0) {
        notifications.push({
          id: `onboarding-tasks-${ob.id}`,
          type: "onboarding",
          module: "Onboarding",
          title: "Onboarding tasks pending",
          message: `${ob.pending_tasks} onboarding task(s) remaining. Complete them in Onboarding.`,
          link: "/onboarding",
          createdAt: ob.created_at ? new Date(ob.created_at).toISOString() : now,
          roleTarget: "employee",
        });
      }
    }

    // ---- MANAGER: leave pending approvals assigned to me ----
    if ((role === "manager" || role === "admin" || role === "hr") && employeeId) {
      const pendingApprovals = await sql`
        SELECT la.id, la.leave_request_id, lr.start_date, lr.end_date, lr.total_days,
               lt.name as type_name, e.first_name, e.last_name, lr.applied_at
        FROM leave_approvals la
        INNER JOIN leave_requests lr ON lr.id = la.leave_request_id
        INNER JOIN leave_types lt ON lt.id = lr.leave_type_id
        INNER JOIN employees e ON e.id = lr.employee_id
        WHERE la.approver_id = ${employeeId} AND la.status = 'pending' AND lr.status = 'pending'
        ORDER BY lr.applied_at ASC
        LIMIT 15
      `;
      for (const a of pendingApprovals as any[]) {
        const name = `${a.first_name} ${a.last_name}`;
        const dateRange = `${a.start_date} – ${a.end_date}`;
        notifications.push({
          id: `leave-approval-${a.id}`,
          type: "leave",
          module: "Leave",
          title: "Leave approval needed",
          message: `${name} requested ${a.type_name} (${dateRange}, ${a.total_days} day(s)). Awaiting your approval.`,
          link: "/leave",
          createdAt: a.applied_at ? new Date(a.applied_at).toISOString() : now,
          roleTarget: role === "manager" ? "manager" : "hr",
        });
      }
    }

    // ---- HR/ADMIN: leave (all pending if not already covered), change requests, onboarding, tentative, offboarding, recruitment ----
    if (role === "hr" || role === "admin") {
      const [
        pendingChangeCount,
        onboardingInProgress,
        tentativePending,
        offboardingPending,
        newApplications,
        offersSent,
      ] = await Promise.all([
        sql`SELECT COUNT(*)::int as c FROM change_requests WHERE status = 'pending'`,
        sql`
          SELECT r.id, e.first_name, e.last_name, e.department, r.created_at
          FROM onboarding_records r
          INNER JOIN employees e ON e.id = r.employee_id
          WHERE r.status = 'in_progress'
          ORDER BY r.created_at DESC
          LIMIT 5
        `,
        sql`
          SELECT tr.id, c.first_name, c.last_name, tr.created_at
          FROM tentative_records tr
          INNER JOIN applications a ON a.id = tr.application_id
          INNER JOIN candidates c ON c.id = a.candidate_id
          WHERE tr.status = 'pending'
          ORDER BY tr.created_at ASC
          LIMIT 5
        `,
        sql`
          SELECT o.id, e.first_name, e.last_name, o.exit_date, o.status
          FROM offboarding_records o
          INNER JOIN employees e ON e.id = o.employee_id
          WHERE o.status IN ('initiated', 'in_notice')
          ORDER BY o.exit_date ASC
          LIMIT 5
        `,
        sql`
          SELECT a.id, c.first_name, c.last_name, j.title as job_title, a.stage_updated_at
          FROM applications a
          INNER JOIN candidates c ON c.id = a.candidate_id
          INNER JOIN job_postings j ON j.id = a.job_id
          WHERE a.stage IN ('applied', 'screening')
          ORDER BY a.stage_updated_at DESC
          LIMIT 5
        `,
        sql`
          SELECT a.id, c.first_name, c.last_name, j.title as job_title, a.updated_at
          FROM applications a
          INNER JOIN candidates c ON c.id = a.candidate_id
          INNER JOIN job_postings j ON j.id = a.job_id
          WHERE a.stage = 'offer'
          ORDER BY a.updated_at DESC
          LIMIT 5
        `,
      ]);

      const changeCount = (pendingChangeCount as any[])[0]?.c || 0;
      if (changeCount > 0) {
        notifications.push({
          id: "change-requests-pending-hr",
          type: "change_request",
          module: "Profile",
          title: "Profile change requests pending",
          message: `${changeCount} employee profile change request(s) need HR review.`,
          link: "/employees",
          createdAt: now,
          roleTarget: "hr",
        });
      }

      for (const r of onboardingInProgress as any[]) {
        notifications.push({
          id: `onboarding-hr-${r.id}`,
          type: "onboarding",
          module: "Onboarding",
          title: "Onboarding in progress",
          message: `${r.first_name} ${r.last_name} (${r.department}) — complete onboarding tasks.`,
          link: "/onboarding",
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : now,
          roleTarget: "hr",
        });
      }

      for (const t of tentativePending as any[]) {
        notifications.push({
          id: `tentative-${t.id}`,
          type: "tentative",
          module: "Recruitment",
          title: "Tentative hire — documents pending",
          message: `${t.first_name} ${t.last_name}: verify documents to confirm hire.`,
          link: "/recruitment",
          createdAt: t.created_at ? new Date(t.created_at).toISOString() : now,
          roleTarget: "hr",
        });
      }

      for (const o of offboardingPending as any[]) {
        const exitDate = o.exit_date ? new Date(o.exit_date).toISOString().split("T")[0] : "";
        notifications.push({
          id: `offboarding-${o.id}`,
          type: "offboarding",
          module: "Offboarding",
          title: "Offboarding in progress",
          message: `${o.first_name} ${o.last_name} — exit ${exitDate}. Complete checklist.`,
          link: "/offboarding",
          createdAt: now,
          roleTarget: "hr",
        });
      }

      for (const app of newApplications as any[]) {
        notifications.push({
          id: `application-new-${app.id}`,
          type: "recruitment",
          module: "Recruitment",
          title: "New application",
          message: `${app.first_name} ${app.last_name} applied for ${app.job_title || "open role"}.`,
          link: "/recruitment",
          createdAt: app.stage_updated_at ? new Date(app.stage_updated_at).toISOString() : now,
          roleTarget: "hr",
        });
      }

      for (const app of offersSent as any[]) {
        notifications.push({
          id: `offer-sent-${app.id}`,
          type: "recruitment",
          module: "Recruitment",
          title: "Offer sent",
          message: `Offer sent to ${app.first_name} ${app.last_name} for ${app.job_title || "role"}. Awaiting response.`,
          link: "/recruitment",
          createdAt: app.updated_at ? new Date(app.updated_at).toISOString() : now,
          roleTarget: "hr",
        });
      }

      // Probation ending soon (next 7 days) — for HR/Admin
      const probationAlerts = await sql`
        SELECT e.id, e.first_name, e.last_name, e.probation_end_date
        FROM employees e
        WHERE e.probation_end_date IS NOT NULL
          AND e.confirmation_date IS NULL
          AND e.employment_status = 'active'
          AND e.probation_end_date >= CURRENT_DATE
          AND e.probation_end_date <= CURRENT_DATE + INTERVAL '7 days'
        ORDER BY e.probation_end_date ASC
        LIMIT 10
      `;
      for (const p of probationAlerts as any[]) {
        const end = p.probation_end_date ? new Date(p.probation_end_date) : null;
        const endDate = end ? end.toISOString().split("T")[0] : "";
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const daysLeft = end
          ? Math.max(0, Math.ceil((end.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)))
          : 0;
        const name = `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Employee";
        notifications.push({
          id: `probation-alert-${p.id}`,
          type: "probation_reminder",
          module: "People",
          title: "Probation ending soon",
          message: `${name}'s probation ends in ${daysLeft} day(s) (${endDate}).`,
          link: `/employees/${p.id}`,
          createdAt: now,
          roleTarget: "hr",
        });
      }

      // Recently sent probation reminders (optional: table may not exist until migration 0018)
      try {
        const recentReminders = await sql`
          SELECT pr.id, pr.employee_id, pr.reminder_type, pr.sent_at,
                 e.first_name, e.last_name
          FROM probation_reminders pr
          INNER JOIN employees e ON e.id = pr.employee_id
          WHERE pr.sent_at >= NOW() - INTERVAL '7 days'
          ORDER BY pr.sent_at DESC
          LIMIT 15
        `;
        const daysByType: Record<string, number> = { day_7: 7, day_3: 3, day_1: 1 };
        for (const r of recentReminders as any[]) {
          const name = `${r.first_name || ""} ${r.last_name || ""}`.trim() || "Employee";
          const days = daysByType[r.reminder_type] ?? 0;
          notifications.push({
            id: `probation-sent-${r.id}`,
            type: "probation_reminder",
            module: "People",
            title: "Probation reminder sent",
            message: `${name}'s probation ends in ${days} day(s).`,
            link: `/employees/${r.employee_id}`,
            createdAt: r.sent_at ? new Date(r.sent_at).toISOString() : now,
            roleTarget: "hr",
          });
        }
      } catch {
        // probation_reminders table may not exist (migration 0018 not applied); skip
      }
    }

    // Sort by createdAt descending and cap list
    notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const capped = notifications.slice(0, 50);

    res.json({ notifications: capped, role });
  } catch (error) {
    console.error("Notifications error:", error);
    res.status(500).json({ error: "Failed to load notifications" });
  }
});

export default router;
