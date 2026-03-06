import { NotificationRepository } from "./NotificationRepository.js";
import { todayInTz } from "../../lib/timezone.js";

export interface NotificationItem {
  id: string; type: string; module: string; title: string;
  message: string; link: string; createdAt: string;
  roleTarget: "employee" | "manager" | "hr" | "admin" | "all";
}

export class NotificationService {
  private readonly repo = new NotificationRepository();

  async getNotifications(user: { id: string; role: string; employeeId: string | null }, userTz: string): Promise<{ notifications: NotificationItem[]; role: string }> {
    const role = user.role.toLowerCase();
    const { employeeId } = user;
    const notifications: NotificationItem[] = [];
    const now = new Date().toISOString();
    const todayStr = todayInTz(userTz);

    // ── Employee personal notifications ──────────────────────────────────────
    if (employeeId) {
      const [myLeave, myCR, myOb] = await Promise.all([
        this.repo.getMyLeave(employeeId),
        this.repo.getMyChangeRequests(user.id),
        this.repo.getMyOnboarding(employeeId),
      ]);
      for (const r of myLeave) {
        const range = `${r.start_date} – ${r.end_date}`;
        const createdAt = r.applied_at ? new Date(r.applied_at).toISOString() : now;
        if (r.status === "pending") notifications.push({ id: `leave-pending-${r.id}`, type: "leave", module: "Leave", title: "Leave pending approval", message: `Your ${r.type_name} (${range}) is awaiting approval.`, link: "/leave", createdAt, roleTarget: "employee" });
        else if (r.status === "approved") notifications.push({ id: `leave-approved-${r.id}`, type: "leave", module: "Leave", title: "Leave approved", message: `Your ${r.type_name} (${range}) has been approved.`, link: "/leave", createdAt, roleTarget: "employee" });
        else if (r.status === "rejected") notifications.push({ id: `leave-rejected-${r.id}`, type: "leave", module: "Leave", title: "Leave rejected", message: `Your ${r.type_name} (${range}) was not approved.`, link: "/leave", createdAt, roleTarget: "employee" });
      }
      for (const cr of myCR) {
        const createdAt = cr.created_at ? new Date(cr.created_at).toISOString() : now;
        if (cr.status === "pending") notifications.push({ id: `change-request-${cr.id}`, type: "change_request", module: "Profile", title: "Profile change pending", message: `Your ${cr.category || "profile"} update is with HR for approval.`, link: `/employees/${employeeId}`, createdAt, roleTarget: "employee" });
        else if (cr.status === "approved") notifications.push({ id: `change-approved-${cr.id}`, type: "change_request", module: "Profile", title: "Profile change approved", message: `Your ${cr.category || "profile"} update has been approved.`, link: `/employees/${employeeId}`, createdAt, roleTarget: "employee" });
      }
      const ob = myOb[0];
      if (ob?.pending_tasks > 0) notifications.push({ id: `onboarding-tasks-${ob.id}`, type: "onboarding", module: "Onboarding", title: "Onboarding tasks pending", message: `${ob.pending_tasks} onboarding task(s) remaining.`, link: "/onboarding", createdAt: ob.created_at ? new Date(ob.created_at).toISOString() : now, roleTarget: "employee" });
    }

    // ── Manager/HR: leave approvals assigned to them ──────────────────────────
    if ((role === "manager" || role === "admin" || role === "hr") && employeeId) {
      const approvals = await this.repo.getPendingApprovals(employeeId);
      for (const a of approvals) {
        notifications.push({ id: `leave-approval-${a.id}`, type: "leave", module: "Leave", title: "Leave approval needed", message: `${a.first_name} ${a.last_name} requested ${a.type_name} (${a.start_date} – ${a.end_date}, ${a.total_days} day(s)).`, link: "/leave", createdAt: a.applied_at ? new Date(a.applied_at).toISOString() : now, roleTarget: role === "manager" ? "manager" : "hr" });
      }
    }

    // ── HR/Admin: aggregated module alerts ───────────────────────────────────
    if (role === "hr" || role === "admin") {
      const [pendingCR, obInProgress, tentPending, offPending, newApps, offersSent, probationAlerts] = await Promise.all([
        this.repo.getPendingChangeCount(),
        this.repo.getOnboardingInProgress(),
        this.repo.getTentativePending(),
        this.repo.getOffboardingPending(),
        this.repo.getNewApplications(),
        this.repo.getOffersSent(),
        this.repo.getProbationAlerts(todayStr),
      ]);
      const changeCount = pendingCR[0]?.c || 0;
      if (changeCount > 0) notifications.push({ id: "change-requests-pending-hr", type: "change_request", module: "Profile", title: "Profile change requests pending", message: `${changeCount} employee profile change request(s) need HR review.`, link: "/employees", createdAt: now, roleTarget: "hr" });
      for (const r of obInProgress) notifications.push({ id: `onboarding-hr-${r.id}`, type: "onboarding", module: "Onboarding", title: "Onboarding in progress", message: `${r.first_name} ${r.last_name} (${r.department}) — complete onboarding tasks.`, link: "/onboarding", createdAt: r.created_at ? new Date(r.created_at).toISOString() : now, roleTarget: "hr" });
      for (const t of tentPending) notifications.push({ id: `tentative-${t.id}`, type: "tentative", module: "Recruitment", title: "Tentative hire — documents pending", message: `${t.first_name} ${t.last_name}: verify documents to confirm hire.`, link: "/recruitment", createdAt: t.created_at ? new Date(t.created_at).toISOString() : now, roleTarget: "hr" });
      for (const o of offPending) notifications.push({ id: `offboarding-${o.id}`, type: "offboarding", module: "Offboarding", title: "Offboarding in progress", message: `${o.first_name} ${o.last_name} — exit ${o.exit_date ? new Date(o.exit_date).toISOString().split("T")[0] : ""}. Complete checklist.`, link: "/offboarding", createdAt: now, roleTarget: "hr" });
      for (const a of newApps) notifications.push({ id: `application-new-${a.id}`, type: "recruitment", module: "Recruitment", title: "New application", message: `${a.first_name} ${a.last_name} applied for ${a.job_title || "open role"}.`, link: "/recruitment", createdAt: a.stage_updated_at ? new Date(a.stage_updated_at).toISOString() : now, roleTarget: "hr" });
      for (const a of offersSent) notifications.push({ id: `offer-sent-${a.id}`, type: "recruitment", module: "Recruitment", title: "Offer sent", message: `Offer sent to ${a.first_name} ${a.last_name} for ${a.job_title || "role"}.`, link: "/recruitment", createdAt: a.updated_at ? new Date(a.updated_at).toISOString() : now, roleTarget: "hr" });
      for (const p of probationAlerts) {
        const endDate = p.probation_end_date ? new Date(p.probation_end_date).toISOString().split("T")[0] : "";
        const daysLeft = endDate ? Math.max(0, Math.ceil((new Date(endDate).getTime() - new Date(todayStr).getTime()) / 86400000)) : 0;
        notifications.push({ id: `probation-alert-${p.id}`, type: "probation_reminder", module: "People", title: "Probation ending soon", message: `${p.first_name} ${p.last_name}'s probation ends in ${daysLeft} day(s) (${endDate}).`, link: `/employees/${p.id}`, createdAt: now, roleTarget: "hr" });
      }
    }

    notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return { notifications: notifications.slice(0, 50), role };
  }
}
