import { DashboardRepository } from "./DashboardRepository.js";
import { memCache } from "../../lib/perf.js";
import { runProbationReminders } from "../../services/probationReminders.js";

export class DashboardService {
  private readonly repo = new DashboardRepository();

  async getDashboard(role: string, employeeId: string|null, todayStr: string, startOfMonthStr: string) {
    let data: any = {};
    const t = todayStr; const som = startOfMonthStr;

    const buildEmployeePanel = async (eid: string) => {
      const [empRows, attendanceRows, balances, pendingLeave, upcoming, assets, onboardingRows] = await this.repo.employeePanel(eid, t);
      const emp = empRows[0] ?? null;
      const att = attendanceRows[0] ?? null;
      const ob = onboardingRows[0] ?? null;
      return { employee: emp, attendance: att ? { checkedIn: !!att.check_in_time, checkedOut: !!att.check_out_time, status: att.status, checkInTime: att.check_in_time, checkOutTime: att.check_out_time } : { checkedIn: false, checkedOut: false, status: null, checkInTime: null, checkOutTime: null }, leaveBalances: balances.slice(0, 4), pendingLeaveRequests: pendingLeave, upcomingTimeOff: upcoming, assets, onboarding: ob ? { id: ob.id, taskCount: ob.task_count, completedCount: ob.completed_count } : null };
    };

    const buildHRPanel = async () => {
      const cached = memCache.get<any>(`dashboard:hr:${t}`);
      if (cached) return cached;
      const [headcountRow, joiners, leavers, pendingOb, tentPending, offPending, noMgr, noLeave, stuckTent, offNoAsset, interviews] = await this.repo.hrPanel(t);
      const r = { role: "hr", headcount: headcountRow[0]?.total||0, joinersToday: joiners[0]?.count||0, leaversToday: leavers[0]?.count||0, pendingOnboarding: pendingOb, tentativePending: tentPending, offboardingPending: offPending, interviewStage: interviews, risks: { noManager: noMgr[0]?.count||0, noLeavePolicy: noLeave[0]?.count||0, stuckTentative: stuckTent[0]?.count||0, offboardingNoAssetReturn: offNoAsset[0]?.count||0 } };
      memCache.set(`dashboard:hr:${t}`, r, 15000); return r;
    };

    const buildAdminPanel = async () => {
      const cached = memCache.get<any>(`dashboard:admin:${t}`);
      if (cached) return cached;
      const [hcRow, attrRow, depts, joinersM, leaversM, attRow, totalRow, assetStats, openRisks] = await this.repo.adminPanel(t, som);
      const totalActive = totalRow[0]?.total||1; const presentToday = attRow[0]?.present||0;
      const r = { role: "admin", headcount: hcRow[0]?.total||0, attritionThisMonth: attrRow[0]?.count||0, joinersThisMonth: joinersM[0]?.count||0, leaversThisMonth: leaversM[0]?.count||0, departmentBreakdown: depts, attendanceToday: { present: presentToday, total: totalActive, percentage: Math.round((presentToday/totalActive)*100) }, assets: assetStats[0]||{ assigned:0,stock_items:0,pending_return:0 }, openRisks: openRisks[0]||{ offboarding:0,tentative:0,onboarding:0 } };
      memCache.set(`dashboard:admin:${t}`, r, 15000); return r;
    };

    switch (role) {
      case "employee": case "it":
        if (!employeeId) return { role, error: "No employee profile linked. Contact HR." };
        data = { ...(await buildEmployeePanel(employeeId)), role };
        break;
      case "manager":
        if (!employeeId) return { role: "manager", error: "No employee profile linked. Contact HR." };
        const [empPanel, mgrRows] = await Promise.all([buildEmployeePanel(employeeId), this.repo.managerPanel(employeeId, t)]);
        const [teamRow, teamOnLeave, approvals, absent, inNotice] = mgrRows;
        data = { ...empPanel, role: "manager", teamSize: teamRow[0]?.team_size||0, teamOnLeave, pendingApprovals: approvals, absentToday: absent, inNotice };
        break;
      case "hr":
        const [hrData2, empData2] = await Promise.all([buildHRPanel(), employeeId ? buildEmployeePanel(employeeId) : null]);
        data = { ...hrData2, myData: empData2, role: "hr" };
        break;
      case "admin":
        const [adminData, hrData3, empData3] = await Promise.all([buildAdminPanel(), buildHRPanel(), employeeId ? buildEmployeePanel(employeeId) : null]);
        data = { ...adminData, hr: hrData3, myData: empData3, role: "admin" };
        break;
    }

    // Activity feed
    let activityEvents: any[] = [];
    try {
      if (role === "employee" && employeeId) {
        const r = await this.repo.activityEmployee(employeeId);
        activityEvents = r.map(e => ({ type: "leave", id: e.id, message: `Leave ${e.status}: ${e.detail}`, timestamp: e.timestamp, severity: e.status==="rejected"?"warning":"info", color: e.color, link: "/leave" }));
      } else if (role === "manager" && employeeId) {
        const r = await this.repo.activityManager(employeeId);
        activityEvents = r.map(e => ({ type: "leave", id: e.id, message: `${e.first_name} ${e.last_name}: leave ${e.status} (${e.detail})`, timestamp: e.timestamp, severity: e.status==="pending"?"warning":"info", color: e.color, link: "/leave" }));
      } else {
        const [hires, leave, off] = await this.repo.activityHR();
        activityEvents = [...hires.map((r: any) => ({ type:"hire", message:`${r.first_name} ${r.last_name} joined (${r.department})`, timestamp:r.timestamp, severity:"info", link:"/employees" })), ...leave.map((r: any) => ({ type:"leave", message:`${r.first_name} ${r.last_name}: leave ${r.status} (${r.detail})`, timestamp:r.timestamp, severity:r.status==="pending"?"warning":"info", color:r.color, link:"/leave" })), ...off.map((r: any) => ({ type:"offboarding", message:`${r.first_name} ${r.last_name}: ${r.offboarding_type} ${r.status}`, timestamp:r.timestamp, severity:r.status==="initiated"?"critical":"warning", link:"/offboarding" }))];
        activityEvents.sort((a,b) => new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime());
        activityEvents = activityEvents.slice(0, 10);
      }
    } catch {}
    data.activityFeed = activityEvents;

    const [bdays, anni, newHires] = await this.repo.sharedWidgets(t);
    data.birthdaysNext7 = bdays; data.anniversariesNext7 = anni; data.newHires = newHires;
    return data;
  }

  async getProbationAlerts(role: string, todayStr: string) {
    if (role !== "hr" && role !== "admin") return [];
    const rows = await this.repo.probationAlerts(todayStr) as any[];
    return rows.map(r => { const endDate = r.probation_end_date?new Date(r.probation_end_date).toISOString().split("T")[0]:null; const daysLeft = endDate?Math.max(0,Math.ceil((new Date(endDate).getTime()-new Date(todayStr).getTime())/86400000)):0; return { id:r.id, name:[r.first_name,r.last_name].filter(Boolean).join(" ").trim()||"Unknown", probation_end_date:endDate, days_left:daysLeft }; });
  }

  async runProbationReminders() { return runProbationReminders(); }
}
