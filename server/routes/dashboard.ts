import { Router, Request, Response } from "express";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { requireAuth, requireRole } from "../middleware/auth";
import { memCache } from "../lib/perf";
import { runProbationReminders } from "../services/probationReminders";

config();
const sql = neon(process.env.DATABASE_URL!);
const router = Router();

// ==================== HELPERS ====================

const today = () => new Date().toISOString().split("T")[0];
const startOfMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; };

// ==================== EMPLOYEE DASHBOARD ====================

async function employeeDashboard(employeeId: string) {
  const t = today();

  // Parallel queries — no N+1
  const [empRows, attendanceRows, leaveBalances, pendingLeave, upcomingTimeOffRows, assets, onboardingRows] = await Promise.all([
    // My employee record
    sql`SELECT id, first_name, last_name, employment_status, employee_id, job_title, department, avatar, join_date
        FROM employees WHERE id = ${employeeId}`,
    // Today's attendance
    sql`SELECT id, check_in_time, check_out_time, status FROM attendance_records
        WHERE employee_id = ${employeeId} AND date = ${t}`,
    // Top leave balances (all, frontend picks top 2)
    sql`SELECT elb.balance, elb.used, lt.name as type_name, lt.max_balance, lt.color
        FROM employee_leave_balances elb
        INNER JOIN leave_types lt ON lt.id = elb.leave_type_id
        WHERE elb.employee_id = ${employeeId} ORDER BY lt.name`,
    // My pending leave requests
    sql`SELECT lr.id, lr.start_date, lr.end_date, lr.total_days, lr.status, lt.name as type_name, lt.color
        FROM leave_requests lr
        INNER JOIN leave_types lt ON lt.id = lr.leave_type_id
        WHERE lr.employee_id = ${employeeId} AND lr.status = 'pending'
        ORDER BY lr.applied_at DESC LIMIT 5`,
    // My upcoming approved time off (start_date >= today)
    sql`SELECT lr.id, lr.start_date, lr.end_date, lr.total_days, lt.name as type_name, lt.color
        FROM leave_requests lr
        INNER JOIN leave_types lt ON lt.id = lr.leave_type_id
        WHERE lr.employee_id = ${employeeId} AND lr.status = 'approved' AND lr.start_date >= ${t}
        ORDER BY lr.start_date ASC LIMIT 5`,
    // My assigned assets (assigned_systems: id, asset_id, status; name/type from stock_items)
    sql`SELECT s.id, s.asset_id as serial_number, s.status,
        (SELECT st.name FROM stock_items st WHERE st.id = s.asset_id OR s.asset_id LIKE st.id || '-%' LIMIT 1) as system_name,
        (SELECT st.product_type FROM stock_items st WHERE st.id = s.asset_id OR s.asset_id LIKE st.id || '-%' LIMIT 1) as system_type
        FROM assigned_systems s WHERE s.user_id = ${employeeId} AND s.status IN ('assigned', 'home')
        ORDER BY s.assigned_date DESC NULLS LAST, s.created_at DESC LIMIT 5`,
    // My onboarding (if any)
    sql`SELECT r.id, r.status, r.created_at,
          (SELECT COUNT(*)::int FROM onboarding_tasks t WHERE t.onboarding_record_id = r.id) as task_count,
          (SELECT COUNT(*)::int FROM onboarding_tasks t WHERE t.onboarding_record_id = r.id AND t.completed = 'true') as completed_count
        FROM onboarding_records r WHERE r.employee_id = ${employeeId} AND r.status = 'in_progress'
        LIMIT 1`,
  ]);

  const emp = empRows[0] || null;
  const attendance = attendanceRows[0] || null;
  const onboarding = onboardingRows[0] || null;

  return {
    role: "employee",
    employee: emp,
    attendance: attendance
      ? { checkedIn: !!attendance.check_in_time, checkedOut: !!attendance.check_out_time, status: attendance.status, checkInTime: attendance.check_in_time, checkOutTime: attendance.check_out_time }
      : { checkedIn: false, checkedOut: false, status: null, checkInTime: null, checkOutTime: null },
    leaveBalances: leaveBalances.slice(0, 4),
    pendingLeaveRequests: pendingLeave,
    upcomingTimeOff: upcomingTimeOffRows || [],
    assets,
    onboarding: onboarding
      ? { id: onboarding.id, taskCount: onboarding.task_count, completedCount: onboarding.completed_count }
      : null,
  };
}

// ==================== MANAGER DASHBOARD ====================

async function managerDashboard(employeeId: string) {
  const t = today();

  const [teamRows, teamOnLeaveRows, pendingApprovals, absentRows, inNoticeRows] = await Promise.all([
    // Team size
    sql`SELECT COUNT(*)::int as team_size FROM employees
        WHERE manager_id = ${employeeId} AND employment_status IN ('active', 'onboarding', 'on_leave')`,
    // Team on leave today
    sql`SELECT e.id, e.first_name, e.last_name, e.avatar, lt.name as type_name, lt.color
        FROM leave_requests lr
        INNER JOIN employees e ON e.id = lr.employee_id
        INNER JOIN leave_types lt ON lt.id = lr.leave_type_id
        WHERE e.manager_id = ${employeeId} AND lr.status = 'approved'
          AND lr.start_date <= ${t} AND lr.end_date >= ${t}`,
    // Pending approvals assigned to me
    sql`SELECT la.id, la.leave_request_id, la.approver_role, la.step_order,
          lr.start_date, lr.end_date, lr.total_days, lr.day_type, lr.reason,
          lt.name as type_name, lt.color,
          e.first_name, e.last_name, e.avatar, e.department
        FROM leave_approvals la
        INNER JOIN leave_requests lr ON lr.id = la.leave_request_id
        INNER JOIN leave_types lt ON lt.id = lr.leave_type_id
        INNER JOIN employees e ON e.id = lr.employee_id
        WHERE la.approver_id = ${employeeId} AND la.status = 'pending' AND lr.status = 'pending'
        ORDER BY lr.applied_at ASC LIMIT 10`,
    // Team members absent today (no check-in and not on approved leave)
    sql`SELECT e.id, e.first_name, e.last_name, e.avatar, e.department
        FROM employees e
        WHERE e.manager_id = ${employeeId} AND e.employment_status = 'active'
          AND e.id NOT IN (SELECT employee_id FROM attendance_records WHERE date = ${t})
          AND e.id NOT IN (SELECT lr.employee_id FROM leave_requests lr WHERE lr.status = 'approved' AND lr.start_date <= ${t} AND lr.end_date >= ${t})`,
    // Team members in notice
    sql`SELECT e.id, e.first_name, e.last_name, e.avatar, o.offboarding_type, o.exit_date as last_working_date
        FROM offboarding_records o
        INNER JOIN employees e ON e.id = o.employee_id
        WHERE e.manager_id = ${employeeId} AND o.status IN ('initiated', 'in_notice')
        ORDER BY o.exit_date ASC`,
  ]);

  return {
    role: "manager",
    teamSize: teamRows[0]?.team_size || 0,
    teamOnLeave: teamOnLeaveRows,
    pendingApprovals,
    absentToday: absentRows,
    inNotice: inNoticeRows,
  };
}

// ==================== HR DASHBOARD ====================

async function hrDashboard() {
  const cached = memCache.get<any>("dashboard:hr");
  if (cached) return cached;

  const t = today();

  const [
    headcountRow, joinersToday, leaversToday,
    pendingOnboarding, tentativePending,
    offboardingPending, noManagerRows, noLeavePolicyRows,
    stuckTentative, offboardingNoAssetReturn,
    interviewStageApps,
  ] = await Promise.all([
    // Headcount
    sql`SELECT COUNT(*)::int as total FROM employees WHERE employment_status IN ('active', 'onboarding', 'on_leave')`,
    // Joiners today
    sql`SELECT COUNT(*)::int as count FROM employees WHERE DATE(join_date) = ${t}`,
    // Leavers today (exit_date = today)
    sql`SELECT COUNT(*)::int as count FROM employees WHERE DATE(exit_date) = ${t}`,
    // Pending onboarding tasks
    sql`SELECT r.id, e.first_name, e.last_name, e.department,
          (SELECT COUNT(*)::int FROM onboarding_tasks t WHERE t.onboarding_record_id = r.id) as task_count,
          (SELECT COUNT(*)::int FROM onboarding_tasks t WHERE t.onboarding_record_id = r.id AND t.completed = 'true') as completed_count
        FROM onboarding_records r
        INNER JOIN employees e ON e.id = r.employee_id
        WHERE r.status = 'in_progress'
        ORDER BY r.created_at ASC LIMIT 10`,
    // Tentative pending verification
    sql`SELECT tr.id, tr.status, a.id as application_id, c.first_name, c.last_name, tr.created_at,
          (SELECT COUNT(*)::int FROM tentative_documents td WHERE td.tentative_record_id = tr.id) as doc_count,
          (SELECT COUNT(*)::int FROM tentative_documents td WHERE td.tentative_record_id = tr.id AND td.status = 'verified') as verified_count
        FROM tentative_records tr
        INNER JOIN applications a ON a.id = tr.application_id
        INNER JOIN candidates c ON c.id = a.candidate_id
        WHERE tr.status = 'pending'
        ORDER BY tr.created_at ASC LIMIT 10`,
    // Offboarding pending
    sql`SELECT o.id, o.employee_id, o.offboarding_type, o.status, o.exit_date as last_working_date,
          e.first_name, e.last_name, e.department
        FROM offboarding_records o
        INNER JOIN employees e ON e.id = o.employee_id
        WHERE o.status IN ('initiated', 'in_notice')
        ORDER BY o.exit_date ASC LIMIT 10`,
    // Risk: employees without manager
    sql`SELECT COUNT(*)::int as count FROM employees
        WHERE employment_status IN ('active', 'onboarding') AND (manager_id IS NULL OR manager_id = '')`,
    // Risk: employees without leave balances
    sql`SELECT COUNT(*)::int as count FROM employees e
        WHERE e.employment_status IN ('active', 'onboarding')
          AND NOT EXISTS (SELECT 1 FROM employee_leave_balances elb WHERE elb.employee_id = e.id)`,
    // Risk: tentative stuck > 7 days
    sql`SELECT COUNT(*)::int as count FROM tentative_records
        WHERE status = 'pending' AND created_at < NOW() - INTERVAL '7 days'`,
    // Risk: offboarding without asset return (assets still assigned)
    sql`SELECT COUNT(DISTINCT o.id)::int as count
        FROM offboarding_records o
        INNER JOIN assigned_systems s ON s.user_id = o.employee_id AND s.status IN ('assigned', 'home')
        WHERE o.status IN ('initiated', 'in_notice')`,
    // Interviews today (applications in interview stage with recent activity)
    sql`SELECT a.id, c.first_name, c.last_name, j.title as job_title, j.department
        FROM applications a
        INNER JOIN candidates c ON c.id = a.candidate_id
        INNER JOIN job_postings j ON j.id = a.job_id
        WHERE a.stage = 'interview'
        ORDER BY a.stage_updated_at DESC LIMIT 10`,
  ]);

  const result = {
    role: "hr",
    headcount: headcountRow[0]?.total || 0,
    joinersToday: joinersToday[0]?.count || 0,
    leaversToday: leaversToday[0]?.count || 0,
    pendingOnboarding,
    tentativePending,
    offboardingPending,
    interviewStage: interviewStageApps,
    risks: {
      noManager: noManagerRows[0]?.count || 0,
      noLeavePolicy: noLeavePolicyRows[0]?.count || 0,
      stuckTentative: stuckTentative[0]?.count || 0,
      offboardingNoAssetReturn: offboardingNoAssetReturn[0]?.count || 0,
    },
  };
  memCache.set("dashboard:hr", result, 15_000); // 15s TTL
  return result;
}

// ==================== ADMIN / EXECUTIVE DASHBOARD ====================

async function adminDashboard() {
  const cached = memCache.get<any>("dashboard:admin");
  if (cached) return cached;

  const t = today();
  const som = startOfMonth();

  const [
    headcountRow, attritionRow, departmentBreakdown,
    joinersThisMonth, leaversThisMonth,
    attendanceTodayRow, totalActiveRow,
    assetStats, openRisks,
  ] = await Promise.all([
    // Total headcount (active)
    sql`SELECT COUNT(*)::int as total FROM employees WHERE employment_status IN ('active', 'onboarding', 'on_leave')`,
    // Attrition this month
    sql`SELECT COUNT(*)::int as count FROM employees
        WHERE employment_status IN ('terminated', 'resigned', 'offboarded') AND DATE(exit_date) >= ${som}`,
    // Department breakdown
    sql`SELECT department, COUNT(*)::int as count FROM employees
        WHERE employment_status IN ('active', 'onboarding', 'on_leave')
        GROUP BY department ORDER BY count DESC`,
    // Joiners this month
    sql`SELECT COUNT(*)::int as count FROM employees WHERE DATE(join_date) >= ${som} AND DATE(join_date) <= ${t}`,
    // Leavers this month
    sql`SELECT COUNT(*)::int as count FROM employees
        WHERE employment_status IN ('terminated', 'resigned', 'offboarded') AND DATE(exit_date) >= ${som} AND DATE(exit_date) <= ${t}`,
    // Attendance today
    sql`SELECT COUNT(*)::int as present FROM attendance_records WHERE date = ${t}`,
    // Total active employees (for attendance %)
    sql`SELECT COUNT(*)::int as total FROM employees WHERE employment_status = 'active'`,
    // Asset utilization
    sql`SELECT
          (SELECT COUNT(*)::int FROM assigned_systems WHERE status IN ('assigned', 'home')) as assigned,
          (SELECT COUNT(*)::int FROM stock_items WHERE quantity > 0) as stock_items,
          (SELECT COUNT(*)::int FROM assigned_systems WHERE status = 'repair') as pending_return`,
    // Open risks
    sql`SELECT
          (SELECT COUNT(*)::int FROM offboarding_records WHERE status IN ('initiated', 'in_notice')) as offboarding,
          (SELECT COUNT(*)::int FROM tentative_records WHERE status = 'pending') as tentative,
          (SELECT COUNT(*)::int FROM onboarding_records WHERE status = 'in_progress') as onboarding`,
  ]);

  const totalActive = totalActiveRow[0]?.total || 1;
  const presentToday = attendanceTodayRow[0]?.present || 0;

  const result = {
    role: "admin",
    headcount: headcountRow[0]?.total || 0,
    attritionThisMonth: attritionRow[0]?.count || 0,
    joinersThisMonth: joinersThisMonth[0]?.count || 0,
    leaversThisMonth: leaversThisMonth[0]?.count || 0,
    departmentBreakdown,
    attendanceToday: { present: presentToday, total: totalActive, percentage: Math.round((presentToday / totalActive) * 100) },
    assets: assetStats[0] || { assigned: 0, stock_items: 0, pending_return: 0 },
    openRisks: openRisks[0] || { offboarding: 0, tentative: 0, onboarding: 0 },
  };
  memCache.set("dashboard:admin", result, 15_000); // 15s TTL
  return result;
}

// ==================== ACTIVITY FEED ====================

async function activityFeed(role: string, employeeId: string | null): Promise<any[]> {
  const events: any[] = [];
  const t = today();

  try {
    if (role === "employee" && employeeId) {
      // My own recent events
      const myLeave = await sql`
        SELECT 'leave' as type, lr.id, lr.status, lr.applied_at as timestamp, lt.name as detail, lt.color
        FROM leave_requests lr INNER JOIN leave_types lt ON lt.id = lr.leave_type_id
        WHERE lr.employee_id = ${employeeId}
        ORDER BY lr.applied_at DESC LIMIT 5
      `;
      for (const r of myLeave) {
        events.push({ type: "leave", id: r.id, message: `Leave ${r.status}: ${r.detail}`, timestamp: r.timestamp, severity: r.status === "rejected" ? "warning" : "info", color: r.color, link: "/leave" });
      }
    } else if (role === "manager" && employeeId) {
      // Team events
      const teamLeave = await sql`
        SELECT 'leave' as type, lr.id, lr.status, lr.applied_at as timestamp, lt.name as detail, lt.color,
          e.first_name, e.last_name
        FROM leave_requests lr
        INNER JOIN leave_types lt ON lt.id = lr.leave_type_id
        INNER JOIN employees e ON e.id = lr.employee_id
        WHERE e.manager_id = ${employeeId} AND lr.applied_at >= NOW() - INTERVAL '7 days'
        ORDER BY lr.applied_at DESC LIMIT 8
      `;
      for (const r of teamLeave) {
        events.push({ type: "leave", id: r.id, message: `${r.first_name} ${r.last_name}: leave ${r.status} (${r.detail})`, timestamp: r.timestamp, severity: r.status === "pending" ? "warning" : "info", color: r.color, link: "/leave" });
      }
    } else {
      // HR / Admin — org-wide recent events
      const [recentHires, recentLeave, recentOffboarding] = await Promise.all([
        sql`SELECT e.first_name, e.last_name, e.join_date as timestamp, e.department
            FROM employees e WHERE e.join_date >= NOW() - INTERVAL '14 days'
            ORDER BY e.join_date DESC LIMIT 5`,
        sql`SELECT lr.status, lr.applied_at as timestamp, lt.name as detail, lt.color,
              e.first_name, e.last_name
            FROM leave_requests lr
            INNER JOIN leave_types lt ON lt.id = lr.leave_type_id
            INNER JOIN employees e ON e.id = lr.employee_id
            WHERE lr.applied_at >= NOW() - INTERVAL '7 days'
            ORDER BY lr.applied_at DESC LIMIT 5`,
        sql`SELECT o.status, o.created_at as timestamp, o.offboarding_type, e.first_name, e.last_name
            FROM offboarding_records o INNER JOIN employees e ON e.id = o.employee_id
            WHERE o.created_at >= NOW() - INTERVAL '14 days'
            ORDER BY o.created_at DESC LIMIT 5`,
      ]);
      for (const r of recentHires) {
        events.push({ type: "hire", message: `${r.first_name} ${r.last_name} joined (${r.department})`, timestamp: r.timestamp, severity: "info", link: "/employees" });
      }
      for (const r of recentLeave) {
        events.push({ type: "leave", message: `${r.first_name} ${r.last_name}: leave ${r.status} (${r.detail})`, timestamp: r.timestamp, severity: r.status === "pending" ? "warning" : "info", color: r.color, link: "/leave" });
      }
      for (const r of recentOffboarding) {
        events.push({ type: "offboarding", message: `${r.first_name} ${r.last_name}: ${r.offboarding_type} ${r.status}`, timestamp: r.timestamp, severity: r.status === "initiated" ? "critical" : "warning", link: "/offboarding" });
      }
    }
  } catch (err) {
    console.error("[dashboard] Activity feed error:", err);
  }

  // Sort by timestamp desc
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return events.slice(0, 10);
}

// ==================== PROBATION ALERTS ====================

/**
 * GET /api/dashboard/probation-alerts
 * Employees whose probation ends within the next 7 days (Day -7 → Day 0).
 * Visible to HR/Admin for dashboard widget. Excludes: no probation end date, already confirmed, offboarded/terminated.
 */
router.get("/probation-alerts", requireAuth, async (req: Request, res: Response) => {
  try {
    const role = String(req.user!.role || "").toLowerCase();
    if (role !== "hr" && role !== "admin") {
      return res.json([]);
    }
    const rows = await sql`
      SELECT id, first_name, last_name, probation_end_date
      FROM employees
      WHERE probation_end_date IS NOT NULL
        AND (confirmation_date IS NULL)
        AND employment_status = 'active'
        AND probation_end_date >= CURRENT_DATE
        AND probation_end_date <= CURRENT_DATE + INTERVAL '7 days'
      ORDER BY probation_end_date ASC
    `;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const alerts = (rows as any[]).map((r: any) => {
      const endDate = r.probation_end_date ? new Date(r.probation_end_date) : null;
      const endDateOnly = endDate ? new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()) : null;
      const daysLeft = endDateOnly ? Math.max(0, Math.ceil((endDateOnly.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))) : 0;
      return {
        id: r.id,
        name: [r.first_name, r.last_name].filter(Boolean).join(" ").trim() || "Unknown",
        probation_end_date: endDate ? endDate.toISOString().split("T")[0] : null,
        days_left: daysLeft,
      };
    });
    res.json(alerts);
  } catch (error) {
    console.error("[dashboard] Probation alerts error:", error?.message ?? String(error));
    res.status(500).json({ error: "Failed to load probation alerts" });
  }
});

/**
 * POST /api/dashboard/run-probation-reminders
 * Manual trigger for probation reminders (day_7, day_3, day_1). Admin only.
 * Can be called by cron/scheduler with an authenticated admin session.
 */
router.post("/run-probation-reminders", requireAuth, requireRole(["admin"]), async (req: Request, res: Response) => {
  try {
    const result = await runProbationReminders();
    res.json({ message: "Probation reminders run complete.", sent: result.sent, details: result.details });
  } catch (error) {
    console.error("[dashboard] run-probation-reminders error:", error?.message ?? String(error));
    res.status(500).json({ error: "Failed to run probation reminders" });
  }
});

// ==================== MAIN ENDPOINT ====================

/**
 * GET /api/dashboard
 * Returns role-specific dashboard data. Single call, server-side aggregation.
 */
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const role = String(req.user!.role || "employee").toLowerCase();
    const employeeId = req.user!.employeeId;

    if (process.env.NODE_ENV !== "production") {
      console.log(`[dashboard] Fetching for role=${role}, employeeId=${employeeId || "null"}`);
    }

    let data: any = {};

    switch (role) {
      case "employee":
      case "it": {
        // IT gets same dashboard as employee (my attendance, leave, assets, onboarding)
        if (!employeeId) return res.json({ role: role as string, error: "No employee profile linked. Contact HR." });
        data = await employeeDashboard(employeeId);
        data.role = role;
        break;
      }
      case "manager": {
        if (!employeeId) return res.json({ role: "manager", error: "No employee profile linked. Contact HR." });
        // Manager gets their own employee data PLUS manager view
        const [empData, mgrData] = await Promise.all([
          employeeDashboard(employeeId),
          managerDashboard(employeeId),
        ]);
        data = { ...empData, ...mgrData, role: "manager" };
        break;
      }
      case "hr": {
        const [hrData, empData] = await Promise.all([
          hrDashboard(),
          employeeId ? employeeDashboard(employeeId) : Promise.resolve(null),
        ]);
        data = { ...hrData, myData: empData, role: "hr" };
        break;
      }
      case "admin": {
        const [adminData, hrData, empData] = await Promise.all([
          adminDashboard(),
          hrDashboard(),
          employeeId ? employeeDashboard(employeeId) : Promise.resolve(null),
        ]);
        data = { ...adminData, hr: hrData, myData: empData, role: "admin" };
        break;
      }
      default:
        return res.status(403).json({ error: "Unknown role" });
    }

    // Activity feed (role-filtered)
    data.activityFeed = await activityFeed(role, employeeId);

    // Shared portal widgets for all roles: birthdays, anniversaries, new hires (next 7 days handles year boundary)
    const [birthdaysNext7, anniversariesNext7, newHiresRows] = await Promise.all([
      sql`
        SELECT e.id, e.first_name, e.last_name, e.job_title, e.department, e.avatar, e.dob
        FROM employees e
        WHERE e.employment_status IN ('active','onboarding','on_leave') AND e.dob IS NOT NULL
          AND (EXTRACT(MONTH FROM e.dob), EXTRACT(DAY FROM e.dob)) IN (
            SELECT EXTRACT(MONTH FROM d)::int, EXTRACT(DAY FROM d)::int
            FROM generate_series(current_date, current_date + interval '6 days', '1 day') AS d
          )
        ORDER BY EXTRACT(MONTH FROM e.dob), EXTRACT(DAY FROM e.dob) LIMIT 10`,
      sql`
        SELECT e.id, e.first_name, e.last_name, e.job_title, e.department, e.avatar, e.join_date
        FROM employees e
        WHERE e.employment_status IN ('active','onboarding','on_leave')
          AND (EXTRACT(MONTH FROM e.join_date), EXTRACT(DAY FROM e.join_date)) IN (
            SELECT EXTRACT(MONTH FROM d)::int, EXTRACT(DAY FROM d)::int
            FROM generate_series(current_date, current_date + interval '6 days', '1 day') AS d
          )
        ORDER BY e.join_date LIMIT 10`,
      sql`
        SELECT e.id, e.first_name, e.last_name, e.job_title, e.department, e.avatar, e.join_date
        FROM employees e
        WHERE e.employment_status IN ('active','onboarding','on_leave') AND e.join_date >= current_date - interval '7 days'
        ORDER BY e.join_date DESC LIMIT 10`,
    ]);
    data.birthdaysNext7 = birthdaysNext7;
    data.anniversariesNext7 = anniversariesNext7;
    data.newHires = newHiresRows;

    res.json(data);
  } catch (error) {
    console.error("[dashboard] Error:", error);
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});

export default router;
