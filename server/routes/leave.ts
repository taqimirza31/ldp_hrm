import { Router, Request, Response } from "express";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { requireAuth, requireRole } from "../middleware/auth";
import { memCache } from "../lib/perf";

config();
const sql = neon(process.env.DATABASE_URL!);
const router = Router();

// ==================== HELPERS ====================

function auditLog(entityType: string, entityId: string, action: string, performedBy: string | null, metadata?: any) {
  return sql`
    INSERT INTO leave_audit_log (entity_type, entity_id, action, performed_by, metadata)
    VALUES (${entityType}, ${entityId}, ${action}, ${performedBy}, ${metadata ? JSON.stringify(metadata) : null})
  `;
}

/** Count business days between two dates (Mon-Fri). */
function countDays(startDate: string, endDate: string, dayType: string): number {
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return dayType === "half" ? count * 0.5 : count;
}

/** Resolve a raw ID (could be employee id or user id) to a valid employees.id */
async function resolveToEmployeeId(rawId: string): Promise<string | null> {
  const asEmp = await sql`SELECT id FROM employees WHERE id = ${rawId}`;
  if (asEmp.length > 0) return asEmp[0].id;
  const asUser = await sql`SELECT employee_id FROM users WHERE id = ${rawId} AND employee_id IS NOT NULL`;
  if (asUser.length > 0) return asUser[0].employee_id;
  return null;
}

// ==================== POLICY ASSIGNMENT ENGINE ====================

function policyAllowedForRole(policy: any, userRole: string): boolean {
  const roles: string[] = Array.isArray(policy.applicable_roles)
    ? policy.applicable_roles
    : (typeof policy.applicable_roles === "string" ? (policy.applicable_roles ? JSON.parse(policy.applicable_roles) : []) : []);
  return roles.length === 0 || roles.includes(userRole);
}

/**
 * Find ALL matching active policies for an employee (by department, type, role).
 * Returns them sorted by specificity (highest score first).
 * This ensures leave types from all applicable policies are visible.
 */
async function findAllMatchingPolicies(department: string, employeeType: string, userRole?: string): Promise<any[]> {
  const today = new Date().toISOString().split("T")[0];
  const policies = await sql`
    SELECT * FROM leave_policies
    WHERE is_active = true
      AND effective_from <= ${today}
      AND (effective_to IS NULL OR effective_to >= ${today})
    ORDER BY created_at DESC
  `;

  const scored: { policy: any; score: number }[] = [];

  for (const p of policies) {
    if (userRole && !policyAllowedForRole(p, userRole)) continue;

    const depts: string[] = Array.isArray(p.applicable_departments)
      ? p.applicable_departments
      : (typeof p.applicable_departments === "string" ? JSON.parse(p.applicable_departments) : []);
    const types: string[] = Array.isArray(p.applicable_employment_types)
      ? p.applicable_employment_types
      : (typeof p.applicable_employment_types === "string" ? JSON.parse(p.applicable_employment_types) : []);

    const deptMatch = depts.length === 0 || depts.includes(department);
    const typeMatch = types.length === 0 || types.includes(employeeType);
    if (!deptMatch || !typeMatch) continue;

    let score = 0;
    if (depts.length > 0) score += 2;
    if (types.length > 0) score += 1;

    scored.push({ policy: p, score });
  }

  // Sort by score descending (most specific first), then by created_at descending
  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => s.policy);
}

/** Backwards-compat: returns the single best-matching policy (used by initializeEmployeeBalances). */
async function findMatchingPolicy(department: string, employeeType: string, userRole?: string): Promise<any | null> {
  const all = await findAllMatchingPolicies(department, employeeType, userRole);
  return all.length > 0 ? all[0] : null;
}

async function initializeEmployeeBalances(employeeId: string, department: string, employeeType: string, performedBy?: string) {
  const policy = await findMatchingPolicy(department, employeeType);
  if (!policy) return;
  // Batch: fetch leave types + existing balances in parallel
  const [leaveTypes, existingBalances] = await Promise.all([
    sql`SELECT * FROM leave_types WHERE policy_id = ${policy.id}`,
    sql`SELECT leave_type_id FROM employee_leave_balances WHERE employee_id = ${employeeId}`
  ]);
  const existingSet = new Set(existingBalances.map((b: any) => b.leave_type_id));

  // Filter first, then batch-insert only new ones
  const toInsert = leaveTypes.filter((lt: any) => !existingSet.has(lt.id));
  if (toInsert.length > 0) {
    // Yearly = max_balance; monthly (Earned Leave) = 0, last_accrual_at NULL so first accrual run catches up from join month
    await Promise.all(toInsert.map(async (lt: any) => {
      const initialBalance = lt.accrual_type === "yearly" ? lt.max_balance : 0;
      const isEarnedLeave = lt.accrual_type === "monthly" && /earned|annual|^el$/i.test(String(lt.name).trim());
      if (isEarnedLeave) {
        await sql`INSERT INTO employee_leave_balances (employee_id, leave_type_id, balance, used, last_accrual_at) VALUES (${employeeId}, ${lt.id}, 0, 0, NULL)`;
      } else {
        await sql`INSERT INTO employee_leave_balances (employee_id, leave_type_id, balance, used, last_accrual_at) VALUES (${employeeId}, ${lt.id}, ${initialBalance}, 0, NOW())`;
      }
      await auditLog("balance", employeeId, "initialize", performedBy || "system", { leaveTypeId: lt.id, policyId: policy.id, initialBalance: isEarnedLeave ? 0 : initialBalance });
    }));
  }
}

// ==================== ACCRUAL ENGINE ====================

async function runMonthlyAccrual() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const balances = await sql`
    SELECT elb.*, lt.accrual_rate, lt.max_balance, lt.name as type_name
    FROM employee_leave_balances elb
    INNER JOIN leave_types lt ON lt.id = elb.leave_type_id
    WHERE lt.accrual_type = 'monthly' AND lt.accrual_rate IS NOT NULL
      AND (LOWER(lt.name) NOT LIKE '%earned%' AND LOWER(lt.name) NOT LIKE '%annual%' AND LOWER(TRIM(lt.name)) <> 'el')
      AND (elb.last_accrual_at IS NULL OR TO_CHAR(elb.last_accrual_at, 'YYYY-MM') < ${currentMonth})
  `;
  // Batch accrual updates in parallel (was sequential N+1)
  const toAccrue = balances
    .map((b: any) => {
      const rate = parseFloat(b.accrual_rate || "0");
      const cur = parseFloat(b.balance || "0");
      const max = parseInt(b.max_balance || "999");
      const nb = Math.min(cur + rate, max);
      return nb > cur ? { ...b, rate, cur, nb } : null;
    })
    .filter(Boolean) as any[];

  if (toAccrue.length > 0) {
    // Process in batches of 20 to avoid overwhelming the DB connection pool
    const BATCH_SIZE = 20;
    for (let i = 0; i < toAccrue.length; i += BATCH_SIZE) {
      const batch = toAccrue.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (b: any) => {
        await sql`UPDATE employee_leave_balances SET balance = ${b.nb}, last_accrual_at = NOW(), updated_at = NOW() WHERE id = ${b.id}`;
        await auditLog("balance", b.employee_id, "accrue", "system", { leaveTypeId: b.leave_type_id, accrued: b.rate, prev: b.cur, new: b.nb });
      }));
    }
  }
  return toAccrue.length;
}

// ==================== YEAR-END RESET (EL CARRY-FORWARD + ENCASHMENT) ====================

/** Leave type conventions: Earned (12), LWOP (unpaid), Bereavement (2). Carry forward / encash handled manually by HR via balance adjust. */

/** Resolve Earned Leave type ID (name contains Earned/Annual or exact 'EL'). */
async function findEarnedLeaveTypeId(): Promise<string | null> {
  const rows = await sql`
    SELECT id FROM leave_types
    WHERE LOWER(name) LIKE ANY(ARRAY['%earned%', '%annual%'])
       OR LOWER(TRIM(name)) = 'el'
    LIMIT 1
  `;
  return rows.length > 0 ? (rows[0] as any).id : null;
}

/** Earned Leave accrual: 15 days = 0.5 leave, 30 days = 1. Pro-rated in join month. Catch-up since join. Cap 12. */
async function runEarnedLeaveAccrual(): Promise<number> {
  const elTypeId = await findEarnedLeaveTypeId();
  if (!elTypeId) return 0;

  const rows = await sql`
    SELECT elb.id, elb.employee_id, elb.balance, elb.last_accrual_at, elb.leave_type_id, e.join_date
    FROM employee_leave_balances elb
    INNER JOIN employees e ON e.id = elb.employee_id
    WHERE elb.leave_type_id = ${elTypeId}
      AND e.employment_status = 'active'
  `;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const lastCompleteMonth = currentMonth === 0 ? { y: currentYear - 1, m: 11 } : { y: currentYear, m: currentMonth - 1 };
  const lastCompleteMonthStr = `${lastCompleteMonth.y}-${String(lastCompleteMonth.m + 1).padStart(2, "0")}`;

  function lastDayOfMonth(y: number, m: number): number {
    return new Date(y, m + 1, 0).getDate();
  }
  function accrualForMonth(joinDate: Date | null, year: number, month: number): number {
    if (!joinDate) return 1;
    const joinY = joinDate.getFullYear(), joinM = joinDate.getMonth();
    if (year !== joinY || month !== joinM) return 1;
    const lastDay = lastDayOfMonth(year, month);
    const joinDay = joinDate.getDate();
    const days = lastDay - joinDay + 1;
    if (days < 15) return 0;
    return Math.min(1, Math.floor(days / 15) * 0.5);
  }

  let processed = 0;
  for (const row of rows as any[]) {
    const joinDate = row.join_date ? new Date(row.join_date) : null;
    const startY = joinDate ? joinDate.getFullYear() : currentYear;
    const startM = joinDate ? joinDate.getMonth() : 0;
    const lastAccruedStr: string | null = row.last_accrual_at
      ? new Date(row.last_accrual_at).toISOString().slice(0, 7)
      : null;

    let totalAccrual = 0;
    let lastProcessedStr: string | null = null;
    for (let y = startY; y <= lastCompleteMonth.y; y++) {
      const monthStart = y === startY ? startM : 0;
      const monthEnd = y === lastCompleteMonth.y ? lastCompleteMonth.m : 11;
      for (let m = monthStart; m <= monthEnd; m++) {
        const monthStr = `${y}-${String(m + 1).padStart(2, "0")}`;
        if (lastAccruedStr && monthStr <= lastAccruedStr) continue;
        if (monthStr > lastCompleteMonthStr) continue;
        totalAccrual += accrualForMonth(joinDate, y, m);
        lastProcessedStr = monthStr;
      }
    }

    if (totalAccrual <= 0 && !lastProcessedStr) continue;

    const cur = parseFloat(row.balance || "0");
    const nb = Math.min(cur + totalAccrual, 12);
    const [yLast, mLast] = lastProcessedStr
      ? [parseInt(lastProcessedStr.slice(0, 4), 10), parseInt(lastProcessedStr.slice(5, 7), 10) - 1]
      : [currentYear, currentMonth];
    const dayLast = lastDayOfMonth(yLast, mLast);
    const lastAccrualAt = lastProcessedStr ? `${lastProcessedStr}-${String(dayLast).padStart(2, "0")}T23:59:59.999Z` : row.last_accrual_at;

    await sql`
      UPDATE employee_leave_balances
      SET balance = ${nb}, last_accrual_at = ${lastAccrualAt}::timestamptz, updated_at = NOW()
      WHERE id = ${row.id}
    `;
    await auditLog("balance", row.employee_id, "accrue", "system", {
      leaveTypeId: row.leave_type_id,
      accrued: totalAccrual,
      prev: cur,
      new: nb,
      earnedLeaveProRated: true,
    });
    processed++;
  }
  return processed;
}

/** Resolve Bereavement leave type ID (name contains 'bereavement'). */
async function findBereavementLeaveTypeId(): Promise<string | null> {
  const rows = await sql`
    SELECT id FROM leave_types WHERE LOWER(name) LIKE '%bereavement%' LIMIT 1
  `;
  return rows.length > 0 ? (rows[0] as any).id : null;
}

/**
 * Process year-end: set Earned Leave balance to 0 for everyone; Bereavement to 2.
 * No automatic carry forward or encashment — HR adds balances manually (e.g. carry forward).
 */
async function processYearEndLeaveReset(year: number, performedBy: string | null): Promise<{ processed: number; skipped: number; errors: string[] }> {
  const errors: string[] = [];
  let processed = 0;
  let skipped = 0;

  const elTypeId = await findEarnedLeaveTypeId();
  if (!elTypeId) {
    console.warn("[leave:year-end] No Earned Leave type found. Skipping EL reset.");
  } else {
    const resetDate = `${year}-01-01T00:00:00.000Z`;
    const employees = await sql`
      SELECT id, employee_id FROM employees
      WHERE employment_status = 'active'
      ORDER BY employee_id
    `;

    for (const emp of employees as any[]) {
      try {
        let balRows = await sql`
          SELECT id, employee_id, leave_type_id, balance, last_reset_at
          FROM employee_leave_balances
          WHERE employee_id = ${emp.id} AND leave_type_id = ${elTypeId}
        `;
        if (balRows.length === 0) {
          const dept = await sql`SELECT department, employee_type FROM employees WHERE id = ${emp.id}`;
          const d = (dept as any[])[0];
          if (d) await initializeEmployeeBalances(emp.id, d.department || "Other", d.employee_type || "full_time", performedBy || undefined);
          balRows = await sql`
            SELECT id, employee_id, leave_type_id, balance, last_reset_at
            FROM employee_leave_balances
            WHERE employee_id = ${emp.id} AND leave_type_id = ${elTypeId}
          `;
        }
        if (balRows.length === 0) {
          skipped++;
          continue;
        }

        const row = (balRows as any[])[0];
        const lastReset = row.last_reset_at ? new Date(row.last_reset_at).getFullYear() : null;
        if (lastReset === year) {
          skipped++;
          continue;
        }

        await sql`
          UPDATE employee_leave_balances
          SET balance = 0, last_reset_at = ${resetDate}::timestamptz, updated_at = NOW()
          WHERE id = ${row.id}
        `;
        await auditLog("balance", row.id, "YEAR_END_RESET", performedBy, { employee_id: emp.id, leave_type_id: elTypeId, year, set_balance: 0 });
        processed++;
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        errors.push(`employee ${(emp as any).employee_id}: ${msg}`);
      }
    }
  }

  const employees = await sql`SELECT id, employee_id FROM employees WHERE employment_status = 'active' ORDER BY employee_id`;
  const bereavementProcessed = await processBereavementYearEnd(year, employees as any[], performedBy);
  return { processed, skipped, errors, bereavementProcessed };
}

/** Bereavement leave: reset balance to 2 at year-end (idempotent). */
async function processBereavementYearEnd(year: number, employees: any[], performedBy: string | null): Promise<number> {
  const bereavementTypeId = await findBereavementLeaveTypeId();
  if (!bereavementTypeId) return 0;
  const resetDate = `${year}-01-01T00:00:00.000Z`;
  const BEREAVEMENT_DAYS = 2;
  let count = 0;
  for (const emp of employees) {
    try {
      let balRows = await sql`
        SELECT id, balance, last_reset_at FROM employee_leave_balances
        WHERE employee_id = ${emp.id} AND leave_type_id = ${bereavementTypeId}
      `;
      if (balRows.length === 0) {
        await sql`
          INSERT INTO employee_leave_balances (employee_id, leave_type_id, balance, used, last_reset_at, last_accrual_at)
          VALUES (${emp.id}, ${bereavementTypeId}, ${BEREAVEMENT_DAYS}, 0, ${resetDate}::timestamptz, NOW())
        `;
        await auditLog("balance", emp.id, "YEAR_END_RESET", performedBy, { leave_type_id: bereavementTypeId, year, set_balance: BEREAVEMENT_DAYS });
        count++;
        continue;
      }
      const row = (balRows as any[])[0];
      const lastReset = row.last_reset_at ? new Date(row.last_reset_at).getFullYear() : null;
      if (lastReset === year) continue;
      await sql`
        UPDATE employee_leave_balances
        SET balance = ${BEREAVEMENT_DAYS}, last_reset_at = ${resetDate}::timestamptz, updated_at = NOW()
        WHERE id = ${row.id}
      `;
      await auditLog("balance", row.id, "YEAR_END_RESET", performedBy, { employee_id: emp.id, leave_type_id: bereavementTypeId, year, set_balance: BEREAVEMENT_DAYS });
      count++;
    } catch (e: any) {
      console.error("[leave:year-end] Bereavement error for", emp.employee_id, e?.message ?? e);
    }
  }
  return count;
}

// ==================== APPROVAL ENGINE (STRICT) ====================

/**
 * Determines whether auto-approval is allowed.
 * Auto-approval is ONLY allowed when ALL of:
 *   1. leave_type.requires_approval === false, OR
 *   2. Explicit auto_approve_rules match (totalDays <= maxDays)
 * AND:
 *   3. Employee is NOT in notice period
 */
function shouldAutoApprove(leaveType: any, totalDays: number, isNoticePeriod: boolean): boolean {
  // Never auto-approve during notice period
  if (isNoticePeriod) return false;

  // If leave type does not require approval at all → auto-approve
  if (!leaveType.requires_approval) return true;

  // If explicit auto-approve rules exist and match → auto-approve
  const rules = leaveType.auto_approve_rules;
  if (rules && typeof rules === "object") {
    const maxDays = (rules as any).maxDays;
    if (maxDays != null && totalDays <= maxDays) return true;
  }

  return false;
}

/**
 * Build explicit approval chain. Returns approver steps.
 * HARD RULE: approver_id !== employeeId (no self-approval).
 * All approver IDs verified against employees table.
 */
async function buildApprovalChain(
  employeeId: string,
  leaveType: any,
  totalDays: number,
  isNoticePeriod: boolean
): Promise<{ approverId: string; approverRole: string; stepOrder: number }[]> {
  const chain: { approverId: string; approverRole: string; stepOrder: number }[] = [];

  // Step 1: Reporting manager
  const emp = await sql`SELECT manager_id FROM employees WHERE id = ${employeeId}`;
  if (emp.length > 0 && emp[0].manager_id) {
    const mgrEmpId = await resolveToEmployeeId(emp[0].manager_id);
    // HARD RULE: skip if manager is the employee themselves
    if (mgrEmpId && mgrEmpId !== employeeId) {
      chain.push({ approverId: mgrEmpId, approverRole: "manager", stepOrder: 1 });
    }
  }

  // Step 2: HR required when policy says so, notice period, > 5 days,
  // OR when no manager was found (HR becomes the fallback approver)
  const noManagerFound = chain.length === 0;
  const needsHR = leaveType.hr_approval_required || isNoticePeriod || totalDays > 5 || noManagerFound;
  if (needsHR) {
    // Find an HR/admin user with a valid employee record, who is NOT the applicant
    // First try: strict match (employee_id linked AND exists in employees)
    let hrs = await sql`
      SELECT u.employee_id, u.id as user_id, u.role FROM users u
      INNER JOIN employees e ON e.id = u.employee_id
      WHERE u.role IN ('hr', 'admin') AND u.is_active = 'true'
        AND u.employee_id IS NOT NULL AND u.employee_id != ${employeeId}
      LIMIT 1
    `;

    // Fallback: if no HR user has employee_id linked, resolve or auto-provision
    if (hrs.length === 0) {
      console.log(`[leave] No HR/admin user with linked employee_id found. Resolving...`);
      const hrUsers = await sql`
        SELECT u.id, u.email, u.role, u.employee_id FROM users u
        WHERE u.role IN ('hr', 'admin') AND u.is_active = 'true'
        LIMIT 5
      `;

      for (const hrUser of hrUsers) {
        // If employee_id exists but wasn't joined (stale ref), verify it
        if (hrUser.employee_id) {
          const empExists = await sql`SELECT id FROM employees WHERE id = ${hrUser.employee_id}`;
          if (empExists.length > 0 && hrUser.employee_id !== employeeId) {
            hrs = [{ employee_id: hrUser.employee_id, user_id: hrUser.id, role: hrUser.role }];
            break;
          }
        }
        // Try matching by email → employee work_email or personal_email
        if (hrUser.email) {
          const empByEmail = await sql`
            SELECT id FROM employees
            WHERE (work_email = ${hrUser.email} OR personal_email = ${hrUser.email})
              AND id != ${employeeId}
            LIMIT 1
          `;
          if (empByEmail.length > 0) {
            await sql`UPDATE users SET employee_id = ${empByEmail[0].id} WHERE id = ${hrUser.id}`;
            console.log(`[leave] Auto-linked HR user ${hrUser.email} → employee ${empByEmail[0].id}`);
            hrs = [{ employee_id: empByEmail[0].id, user_id: hrUser.id, role: hrUser.role }];
            break;
          }
        }

        // Last resort: auto-create a minimal employee record for this HR/admin user
        if (hrUser.email) {
          const empCode = `SYS-${hrUser.role.toUpperCase()}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
          const emailPart = (hrUser.email || "").split("@")[0] || hrUser.role;
          const firstName = emailPart.charAt(0).toUpperCase() + emailPart.slice(1).toLowerCase();
          const lastName = hrUser.role === "admin" ? "Administrator" : "HR";
          const newEmp = await sql`
            INSERT INTO employees (employee_id, work_email, first_name, last_name, job_title, department, employment_status, join_date)
            VALUES (${empCode}, ${hrUser.email}, ${firstName}, ${lastName}, ${hrUser.role === 'admin' ? 'System Administrator' : 'HR Manager'}, 'Human Resources', 'active', NOW())
            RETURNING id
          `;
          if (newEmp.length > 0) {
            await sql`UPDATE users SET employee_id = ${newEmp[0].id} WHERE id = ${hrUser.id}`;
            console.log(`[leave] Auto-created employee record for ${hrUser.email} (${hrUser.role}) → ${newEmp[0].id}`);
            hrs = [{ employee_id: newEmp[0].id, user_id: hrUser.id, role: hrUser.role }];
            break;
          }
        }
      }
    }

    if (hrs.length > 0) {
      const alreadyInChain = chain.some(s => s.approverId === hrs[0].employee_id);
      if (!alreadyInChain) {
        chain.push({ approverId: hrs[0].employee_id, approverRole: "hr", stepOrder: chain.length + 1 });
      }
    } else {
      console.warn(`[leave] WARNING: No HR/admin user could be resolved as approver.`);
    }
  }

  // Final verify: batch-check all approver_ids in one query (fixes N+1)
  const approverIds = chain.map(s => s.approverId);
  if (approverIds.length === 0) return [];
  const existingApprovers = await sql`SELECT id FROM employees WHERE id = ANY(${approverIds})`;
  const existingSet = new Set(existingApprovers.map((r: any) => r.id));
  const verified: typeof chain = [];
  for (const step of chain) {
    if (existingSet.has(step.approverId)) verified.push(step);
    else console.warn(`[leave] Skipping approver ${step.approverId} (${step.approverRole}): not in employees`);
  }
  return verified;
}

async function isInNoticePeriod(employeeId: string): Promise<boolean> {
  const rows = await sql`SELECT id FROM offboarding_records WHERE employee_id = ${employeeId} AND status IN ('initiated', 'in_notice')`;
  return rows.length > 0;
}

// ==================== ATTENDANCE SYNC ====================

async function syncLeaveToAttendance(requestId: string) {
  const reqs = await sql`
    SELECT lr.*, lt.name as type_name FROM leave_requests lr
    INNER JOIN leave_types lt ON lt.id = lr.leave_type_id WHERE lr.id = ${requestId}
  `;
  if (reqs.length === 0) return;
  const req = reqs[0];
  const start = new Date(req.start_date + "T00:00:00");
  const end = new Date(req.end_date + "T00:00:00");
  const cur = new Date(start);
  while (cur <= end) {
    if (cur.getDay() !== 0 && cur.getDay() !== 6) {
      const dateStr = cur.toISOString().split("T")[0];
      const status = req.day_type === "half" ? "half_day" : "absent";
      const remarks = `On leave: ${req.type_name} (${req.day_type} day)`;
      const existing = await sql`SELECT id FROM attendance_records WHERE employee_id = ${req.employee_id} AND date = ${dateStr}`;
      if (existing.length > 0) {
        await sql`UPDATE attendance_records SET remarks = ${remarks}, status = ${status}, updated_at = NOW() WHERE id = ${existing[0].id}`;
      } else {
        await sql`INSERT INTO attendance_records (employee_id, date, source, status, remarks, created_by) VALUES (${req.employee_id}, ${dateStr}, 'manual', ${status}, ${remarks}, 'leave_system')`;
      }
    }
    cur.setDate(cur.getDate() + 1);
  }
}

async function reverseAttendanceSync(requestId: string) {
  const reqs = await sql`SELECT lr.* FROM leave_requests lr WHERE lr.id = ${requestId}`;
  if (reqs.length === 0) return;
  const req = reqs[0];
  const start = new Date(req.start_date + "T00:00:00");
  const end = new Date(req.end_date + "T00:00:00");
  const cur = new Date(start);
  while (cur <= end) {
    if (cur.getDay() !== 0 && cur.getDay() !== 6) {
      const dateStr = cur.toISOString().split("T")[0];
      await sql`DELETE FROM attendance_records WHERE employee_id = ${req.employee_id} AND date = ${dateStr} AND check_in_time IS NULL AND created_by = 'leave_system'`;
    }
    cur.setDate(cur.getDate() + 1);
  }
}

// ==================== POLICY CRUD (HR/Admin) ====================

router.get("/policies", requireAuth, async (_req: Request, res: Response) => {
  try {
    const cached = memCache.get<any[]>("leave:policies");
    if (cached) return res.json(cached);
    const policies = await sql`
      SELECT p.*, (SELECT COUNT(*)::int FROM leave_types lt WHERE lt.policy_id = p.id) as type_count
      FROM leave_policies p ORDER BY p.created_at DESC
    `;
    memCache.set("leave:policies", policies, 30_000); // 30s TTL — policies rarely change
    res.json(policies);
  } catch (error) { console.error("Error:", error); res.status(500).json({ error: "Failed to fetch policies" }); }
});

router.get("/policies/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const policies = await sql`SELECT * FROM leave_policies WHERE id = ${req.params.id}`;
    if (policies.length === 0) return res.status(404).json({ error: "Policy not found" });
    const types = await sql`SELECT * FROM leave_types WHERE policy_id = ${req.params.id} ORDER BY name`;
    res.json({ ...policies[0], leave_types: types });
  } catch (error) { res.status(500).json({ error: "Failed to fetch policy" }); }
});

router.post("/policies", requireAuth, requireRole(["admin", "hr"]), async (req: Request, res: Response) => {
  return res.status(403).json({
    error: "Only the standard leave policy is supported. The system uses three fixed types: Earned Leave, LWOP, and Bereavement. Run migration 0021_standard_leave_policy.sql if the policy is missing.",
  });
});

router.patch("/policies/:id", requireAuth, requireRole(["admin", "hr"]), async (req: Request, res: Response) => {
  try {
    const { id } = req.params; const u = req.body;
    const performedBy = req.user!.employeeId || req.user!.id;
    const rows = await sql`
      UPDATE leave_policies SET
        name = COALESCE(${u.name}, name),
        applicable_departments = COALESCE(${u.applicableDepartments ? JSON.stringify(u.applicableDepartments) : null}, applicable_departments),
        applicable_employment_types = COALESCE(${u.applicableEmploymentTypes ? JSON.stringify(u.applicableEmploymentTypes) : null}, applicable_employment_types),
        applicable_roles = COALESCE(${u.applicableRoles ? JSON.stringify(u.applicableRoles) : null}, applicable_roles),
        effective_from = COALESCE(${u.effectiveFrom}, effective_from),
        effective_to = COALESCE(${u.effectiveTo}, effective_to),
        is_active = COALESCE(${u.isActive}, is_active),
        updated_at = NOW()
      WHERE id = ${id} RETURNING *
    `;
    if (rows.length === 0) return res.status(404).json({ error: "Policy not found" });
    await auditLog("policy", id, "update", performedBy, u);
    memCache.invalidate("leave:policies");
    res.json(rows[0]);
  } catch (error) { res.status(500).json({ error: "Failed to update policy" }); }
});

// ==================== LEAVE TYPE CRUD (HR/Admin) ====================

router.post("/types", requireAuth, requireRole(["admin", "hr"]), async (req: Request, res: Response) => {
  return res.status(403).json({
    error: "Only three leave types are supported: Earned Leave (12, carry 6), LWOP (unpaid), and Bereavement (2). No custom types. Run migration 0021_standard_leave_policy.sql if types are missing.",
  });
});

router.patch("/types/:id", requireAuth, requireRole(["admin", "hr"]), async (req: Request, res: Response) => {
  try {
    const { id } = req.params; const t = req.body;
    const performedBy = req.user!.employeeId || req.user!.id;
    const rows = await sql`
      UPDATE leave_types SET
        name = COALESCE(${t.name}, name), paid = COALESCE(${t.paid}, paid),
        accrual_type = COALESCE(${t.accrualType}, accrual_type), accrual_rate = COALESCE(${t.accrualRate}, accrual_rate),
        max_balance = COALESCE(${t.maxBalance}, max_balance), carry_forward_allowed = COALESCE(${t.carryForwardAllowed}, carry_forward_allowed),
        max_carry_forward = COALESCE(${t.maxCarryForward}, max_carry_forward), requires_document = COALESCE(${t.requiresDocument}, requires_document),
        requires_approval = COALESCE(${t.requiresApproval}, requires_approval),
        auto_approve_rules = COALESCE(${t.autoApproveRules ? JSON.stringify(t.autoApproveRules) : null}, auto_approve_rules),
        hr_approval_required = COALESCE(${t.hrApprovalRequired}, hr_approval_required),
        min_days = COALESCE(${t.minDays}, min_days), max_days_per_request = COALESCE(${t.maxDaysPerRequest}, max_days_per_request),
        blocked_during_notice = COALESCE(${t.blockedDuringNotice}, blocked_during_notice), color = COALESCE(${t.color}, color),
        updated_at = NOW()
      WHERE id = ${id} RETURNING *
    `;
    if (rows.length === 0) return res.status(404).json({ error: "Leave type not found" });
    await auditLog("type", id, "update", performedBy, t);
    res.json(rows[0]);
  } catch (error) { res.status(500).json({ error: "Failed to update leave type" }); }
});

router.delete("/types/:id", requireAuth, requireRole(["admin"]), async (req: Request, res: Response) => {
  try { await sql`DELETE FROM leave_types WHERE id = ${req.params.id}`; res.json({ success: true }); }
  catch (error) { res.status(500).json({ error: "Failed to delete leave type" }); }
});

// ==================== BALANCE MANAGEMENT ====================

router.get("/balances/:employeeId", requireAuth, async (req: Request, res: Response) => {
  try {
    // Employees can only see their own; HR/admin/manager can see others
    if (req.user!.role !== "admin" && req.user!.role !== "hr" && req.user!.role !== "manager" && req.user!.employeeId !== req.params.employeeId) {
      return res.status(403).json({ error: "Access denied" });
    }
    // Return all three standard leave types for this employee (Earned Leave, LWOP, Bereavement).
    // LEFT JOIN so we always get 3 rows; missing balance rows show balance/used 0.
    const balances = await sql`
      SELECT
        elb.id,
        elb.employee_id,
        lt.id as leave_type_id,
        COALESCE(elb.balance, 0)::text as balance,
        COALESCE(elb.used, 0)::text as used,
        lt.name as type_name,
        lt.paid,
        lt.max_balance,
        lt.color,
        lt.accrual_type,
        lt.accrual_rate,
        lt.requires_document,
        lp.name as policy_name
      FROM leave_types lt
      INNER JOIN leave_policies lp ON lp.id = lt.policy_id
      LEFT JOIN employee_leave_balances elb ON elb.leave_type_id = lt.id AND elb.employee_id = ${req.params.employeeId}
      WHERE lp.name = 'Standard Leave Policy'
      ORDER BY CASE WHEN lt.name ILIKE '%earned%' THEN 0 WHEN LOWER(lt.name) = 'lwop' THEN 1 ELSE 2 END, lt.name
    `;
    res.json(balances);
  } catch (error) { res.status(500).json({ error: "Failed to fetch balances" }); }
});

router.post("/balances/initialize/:employeeId", requireAuth, requireRole(["admin", "hr"]), async (req: Request, res: Response) => {
  try {
    const { employeeId } = req.params;
    const emp = await sql`SELECT department, employee_type FROM employees WHERE id = ${employeeId}`;
    if (emp.length === 0) return res.status(404).json({ error: "Employee not found" });
    await initializeEmployeeBalances(employeeId, emp[0].department, emp[0].employee_type || "full_time", req.user!.id);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: "Failed to initialize balances" }); }
});

router.patch("/balances/:balanceId/adjust", requireAuth, requireRole(["admin", "hr"]), async (req: Request, res: Response) => {
  try {
    const { balanceId } = req.params;
    const { newBalance, reason } = req.body;
    if (newBalance == null) return res.status(400).json({ error: "newBalance required" });
    if (!reason) return res.status(400).json({ error: "Reason required" });
    const existing = await sql`
      SELECT elb.*, lt.name as type_name FROM employee_leave_balances elb
      INNER JOIN leave_types lt ON lt.id = elb.leave_type_id
      WHERE elb.id = ${balanceId}
    `;
    if (existing.length === 0) return res.status(404).json({ error: "Balance not found" });
    const typeName = (existing[0] as any).type_name || "";
    if (!typeName.toLowerCase().includes("earned")) return res.status(403).json({ error: "Balance adjustments are only allowed for Earned Leave." });
    const performedBy = req.user!.employeeId || req.user!.id;
    await sql`UPDATE employee_leave_balances SET balance = ${newBalance}, updated_at = NOW() WHERE id = ${balanceId}`;
    await auditLog("balance", (existing[0] as any).employee_id, "adjust", performedBy, { balanceId, previousBalance: (existing[0] as any).balance, newBalance, reason });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: "Failed to adjust balance" }); }
});

/** POST /api/leave/balances/add — HR: add days to an employee's leave balance (e.g. carry forward, manual grant). Body: { employeeId, leaveTypeId, daysToAdd, reason } */
router.post("/balances/add", requireAuth, requireRole(["admin", "hr"]), async (req: Request, res: Response) => {
  try {
    const { employeeId, leaveTypeId, daysToAdd, reason } = req.body;
    if (!employeeId || !leaveTypeId || daysToAdd == null) return res.status(400).json({ error: "employeeId, leaveTypeId, and daysToAdd required" });
    if (!reason) return res.status(400).json({ error: "Reason required" });
    const delta = parseFloat(String(daysToAdd));
    if (Number.isNaN(delta)) return res.status(400).json({ error: "daysToAdd must be a number" });

    const emp = await sql`SELECT id, department, employee_type FROM employees WHERE id = ${employeeId}`;
    if (emp.length === 0) return res.status(404).json({ error: "Employee not found" });
    const lt = await sql`SELECT id, name FROM leave_types WHERE id = ${leaveTypeId}`;
    if (lt.length === 0) return res.status(404).json({ error: "Leave type not found" });
    const typeName = (lt[0] as any).name || "";
    if (!typeName.toLowerCase().includes("earned")) return res.status(403).json({ error: "Adding days is only allowed for Earned Leave. LWOP and Bereavement balances cannot be adjusted here." });

    let balRows = await sql`SELECT id, balance FROM employee_leave_balances WHERE employee_id = ${employeeId} AND leave_type_id = ${leaveTypeId}`;
    if (balRows.length === 0) {
      await initializeEmployeeBalances(employeeId, emp[0].department || "Other", emp[0].employee_type || "full_time", req.user!.id);
      balRows = await sql`SELECT id, balance FROM employee_leave_balances WHERE employee_id = ${employeeId} AND leave_type_id = ${leaveTypeId}`;
    }
    if (balRows.length === 0) return res.status(404).json({ error: "Balance record not found after init" });

    const cur = parseFloat((balRows[0] as any).balance || "0");
    const newBalance = Math.max(0, cur + delta);
    await sql`UPDATE employee_leave_balances SET balance = ${newBalance}, updated_at = NOW() WHERE id = ${(balRows[0] as any).id}`;
    await auditLog("balance", employeeId, "add", req.user!.employeeId || req.user!.id, { leaveTypeId, daysToAdd: delta, previousBalance: cur, newBalance, reason });
    res.json({ success: true, previousBalance: cur, newBalance });
  } catch (error: any) {
    console.error("[leave:balances/add]", error?.message ?? error);
    res.status(500).json({ error: "Failed to add balance" });
  }
});

router.post("/accrue", requireAuth, requireRole(["admin", "hr"]), async (_req: Request, res: Response) => {
  try {
    const [earnedCount, otherCount] = await Promise.all([runEarnedLeaveAccrual(), runMonthlyAccrual()]);
    res.json({ success: true, accruedCount: earnedCount + otherCount, earnedLeaveAccrued: earnedCount });
  }
  catch (error) { res.status(500).json({ error: "Failed to run accrual" }); }
});

/** POST /api/leave/process-year-end — Run year-end: set Earned Leave to 0, Bereavement to 2. HR adds balances manually (e.g. carry forward). Body: { year: number }. */
router.post("/process-year-end", requireAuth, requireRole(["admin", "hr"]), async (req: Request, res: Response) => {
  try {
    const year = req.body?.year != null ? parseInt(String(req.body.year), 10) : new Date().getFullYear();
    if (Number.isNaN(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ error: "Invalid year; use 2000–2100 or omit for current year." });
    }
    const performedBy = (req as any).user?.employeeId ?? (req as any).user?.id ?? null;
    const result = await processYearEndLeaveReset(year, performedBy);
    res.json({
      success: true,
      year,
      processed: result.processed,
      skipped: result.skipped,
      bereavementProcessed: result.bereavementProcessed ?? 0,
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error: any) {
    console.error("[leave:year-end] Run failed:", error?.message ?? error);
    res.status(500).json({ error: "Failed to run year-end leave reset" });
  }
});

/** GET /api/leave/employee/:employeeId/requests — Leave requests for one employee (for profile Timeoff tab). Self, HR/admin, or manager of that employee. */
router.get("/employee/:employeeId/requests", requireAuth, async (req: Request, res: Response) => {
  try {
    const { employeeId } = req.params;
    const role = req.user!.role;
    const myEmployeeId = req.user!.employeeId;

    const allowed = role === "admin" || role === "hr"
      || myEmployeeId === employeeId
      || (role === "manager" && myEmployeeId && (await sql`SELECT id FROM employees WHERE id = ${employeeId} AND manager_id = ${myEmployeeId}`).length > 0);
    if (!allowed) return res.status(403).json({ error: "Access denied" });

    const requests = await sql`
      SELECT lr.id, lr.leave_type_id, lr.start_date, lr.end_date, lr.day_type, lr.total_days, lr.reason, lr.status, lr.applied_at, lr.decided_at, lr.rejection_reason,
        lt.name as type_name, lt.color, lt.paid
      FROM leave_requests lr
      INNER JOIN leave_types lt ON lt.id = lr.leave_type_id
      WHERE lr.employee_id = ${employeeId}
      ORDER BY lr.applied_at DESC
      LIMIT 50
    `;
    res.json(requests);
  } catch (error) {
    console.error("Error fetching employee leave requests:", error);
    res.status(500).json({ error: "Failed to fetch leave requests" });
  }
});

// ====================================================================
// LEAVE REQUEST — CREATE (Employee applies)
// ====================================================================

/** GET /api/leave/my-requests — STRICTLY the current employee's OWN requests only */
router.get("/my-requests", requireAuth, async (req: Request, res: Response) => {
  try {
    const employeeId = req.user!.employeeId;
    if (!employeeId) return res.json([]);
    // Returns ONLY this employee's requests. No approval data, no other employees.
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const rows = await sql`
      SELECT lr.id, lr.leave_type_id, lr.start_date, lr.end_date, lr.day_type,
        lr.total_days, lr.reason, lr.status, lr.applied_at, lr.decided_at, lr.rejection_reason,
        lt.name as type_name, lt.color, lt.paid
      FROM leave_requests lr
      INNER JOIN leave_types lt ON lt.id = lr.leave_type_id
      WHERE lr.employee_id = ${employeeId}
      ORDER BY lr.applied_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    res.json(rows);
  } catch (error) { res.status(500).json({ error: "Failed to fetch requests" }); }
});

/** POST /api/leave/request — Employee applies for leave (ALWAYS pending unless policy auto-approve) */
router.post("/request", requireAuth, async (req: Request, res: Response) => {
  try {
    const employeeId = req.user!.employeeId;
    if (!employeeId) return res.status(400).json({ error: "No employee profile linked" });

    const { leaveTypeId, startDate, endDate, dayType, reason, attachmentUrl } = req.body;
    if (!leaveTypeId || !startDate || !endDate) return res.status(400).json({ error: "leaveTypeId, startDate, endDate required" });
    if (endDate < startDate) return res.status(400).json({ error: "End date cannot be before start date" });

    // Validate employee + leave type in parallel (was sequential)
    const [empRows, ltRows] = await Promise.all([
      sql`SELECT id, department, employee_type, employment_status, join_date, exit_date FROM employees WHERE id = ${employeeId}`,
      sql`SELECT id, name, policy_id, paid, max_balance, accrual_type, max_days_per_request, min_days, blocked_during_notice, requires_document, requires_approval FROM leave_types WHERE id = ${leaveTypeId}`,
    ]);
    if (empRows.length === 0) return res.status(404).json({ error: "Employee not found" });
    const emp = empRows[0];
    if (ltRows.length === 0) return res.status(404).json({ error: "Leave type not found" });
    const lt = ltRows[0];

    if (emp.employment_status === "offboarded") return res.status(400).json({ error: "Offboarded employees cannot apply" });

    if (emp.join_date) {
      const joinStr = new Date(emp.join_date).toISOString().split("T")[0];
      if (startDate < joinStr) return res.status(400).json({ error: "Cannot apply before joining date" });
    }
    if (emp.exit_date) {
      const exitStr = new Date(emp.exit_date).toISOString().split("T")[0];
      if (endDate > exitStr) return res.status(400).json({ error: `Cannot take leave beyond exit date (${exitStr})` });
    }

    // Validate: leave type's policy must be active and within effective dates
    const ltPolicy = await sql`SELECT id, name, is_active, effective_from, effective_to FROM leave_policies WHERE id = ${lt.policy_id}`;
    if (ltPolicy.length === 0 || !ltPolicy[0].is_active) {
      return res.status(400).json({ error: `Leave type "${lt.name}" belongs to an inactive or missing policy` });
    }
    const today = new Date().toISOString().split("T")[0];
    if (ltPolicy[0].effective_from > today || (ltPolicy[0].effective_to && ltPolicy[0].effective_to < today)) {
      return res.status(400).json({ error: `Leave type "${lt.name}" belongs to a policy outside its effective date range` });
    }

    const inNotice = await isInNoticePeriod(employeeId);
    if (lt.blocked_during_notice && inNotice) return res.status(400).json({ error: `${lt.name} is blocked during notice period` });
    if (lt.requires_document && !attachmentUrl) return res.status(400).json({ error: `${lt.name} requires a supporting document` });

    const totalDays = countDays(startDate, endDate, dayType || "full");
    if (totalDays <= 0) return res.status(400).json({ error: "Invalid date range (no business days)" });
    if (lt.max_days_per_request && totalDays > lt.max_days_per_request) return res.status(400).json({ error: `Max ${lt.max_days_per_request} days per request` });
    if (lt.min_days && totalDays < lt.min_days) return res.status(400).json({ error: `Min ${lt.min_days} days required` });

    // Balance check (paid types only). Auto-initialize if employee has no balance row for this type.
    if (lt.paid) {
      let balRows = await sql`SELECT balance FROM employee_leave_balances WHERE employee_id = ${employeeId} AND leave_type_id = ${leaveTypeId}`;
      if (balRows.length === 0) {
        await initializeEmployeeBalances(employeeId, emp.department || "Other", emp.employee_type || "full_time", req.user!.id);
        balRows = await sql`SELECT balance FROM employee_leave_balances WHERE employee_id = ${employeeId} AND leave_type_id = ${leaveTypeId}`;
      }
      const bal = balRows.length > 0 ? parseFloat(balRows[0].balance) : 0;
      if (bal < totalDays) return res.status(400).json({ error: `Insufficient balance (${bal} available, ${totalDays} requested). Contact HR to initialize or adjust leave balances if needed.` });
    }

    // Overlap check (approved + pending)
    const overlap = await sql`
      SELECT id FROM leave_requests
      WHERE employee_id = ${employeeId} AND status IN ('approved', 'pending')
        AND start_date <= ${endDate} AND end_date >= ${startDate}
    `;
    if (overlap.length > 0) return res.status(400).json({ error: "Overlapping leave request exists for these dates" });

    // ====== DECISION: auto-approve or build approval chain ======
    const autoApprove = shouldAutoApprove(lt, totalDays, inNotice);

    if (autoApprove) {
      // Policy explicitly allows → create as approved
      const rows = await sql`
        INSERT INTO leave_requests (employee_id, leave_type_id, start_date, end_date, day_type, total_days, reason, attachment_url, status, decided_at, decided_by)
        VALUES (${employeeId}, ${leaveTypeId}, ${startDate}, ${endDate}, ${dayType || "full"}, ${totalDays}, ${reason || null}, ${attachmentUrl || null}, 'approved', NOW(), 'auto')
        RETURNING *
      `;
      if (lt.paid) {
        await sql`UPDATE employee_leave_balances SET balance = balance::numeric - ${totalDays}, used = used::numeric + ${totalDays}, updated_at = NOW() WHERE employee_id = ${employeeId} AND leave_type_id = ${leaveTypeId}`;
      }
      await syncLeaveToAttendance(rows[0].id);
      await auditLog("request", rows[0].id, "auto_approve", "system", {
        totalDays, leaveType: lt.name,
        rule: !lt.requires_approval ? "requires_approval=false" : `auto_approve_rules.maxDays matched`,
      });
      return res.status(201).json({ ...rows[0], autoApproved: true });
    }

    // ====== NOT auto-approved → create as PENDING and build chain ======
    const chain = await buildApprovalChain(employeeId, lt, totalDays, inNotice);

    if (chain.length === 0) {
      return res.status(400).json({
        error: "Leave requires approval but no valid approvers found. Ensure employee has a reporting manager and/or an HR user linked to an employee record.",
      });
    }

    const rows = await sql`
      INSERT INTO leave_requests (employee_id, leave_type_id, start_date, end_date, day_type, total_days, reason, attachment_url, status)
      VALUES (${employeeId}, ${leaveTypeId}, ${startDate}, ${endDate}, ${dayType || "full"}, ${totalDays}, ${reason || null}, ${attachmentUrl || null}, 'pending')
      RETURNING *
    `;
    const request = rows[0];

    // Create explicit approval chain records
    for (const step of chain) {
      await sql`INSERT INTO leave_approvals (leave_request_id, approver_id, approver_role, status, step_order) VALUES (${request.id}, ${step.approverId}, ${step.approverRole}, 'pending', ${step.stepOrder})`;
    }

    await auditLog("request", request.id, "create", employeeId, {
      totalDays, leaveType: lt.name,
      chain: chain.map(s => ({ role: s.approverRole, approverId: s.approverId, step: s.stepOrder })),
    });

    res.status(201).json(request);
  } catch (error: any) {
    console.error("Error creating leave request:", error);
    res.status(500).json({ error: "Failed to submit leave request" });
  }
});

/** POST /api/leave/request/:id/cancel — Employee cancels own request */
router.post("/request/:id/cancel", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const employeeId = req.user!.employeeId;
    const reqs = await sql`SELECT lr.*, lt.paid FROM leave_requests lr INNER JOIN leave_types lt ON lt.id = lr.leave_type_id WHERE lr.id = ${id}`;
    if (reqs.length === 0) return res.status(404).json({ error: "Request not found" });
    const request = reqs[0];

    // Only the applicant or HR/admin can cancel
    if (request.employee_id !== employeeId && req.user!.role !== "admin" && req.user!.role !== "hr") {
      return res.status(403).json({ error: "Can only cancel your own requests" });
    }
    if (request.status === "cancelled") return res.status(400).json({ error: "Already cancelled" });

    const wasApproved = request.status === "approved";
    await sql`UPDATE leave_requests SET status = 'cancelled', updated_at = NOW() WHERE id = ${id}`;
    await sql`UPDATE leave_approvals SET status = 'rejected', actioned_at = NOW(), remarks = 'Request cancelled' WHERE leave_request_id = ${id} AND status = 'pending'`;

    if (wasApproved && request.paid) {
      await sql`UPDATE employee_leave_balances SET balance = balance::numeric + ${request.total_days}, used = used::numeric - ${request.total_days}, updated_at = NOW() WHERE employee_id = ${request.employee_id} AND leave_type_id = ${request.leave_type_id}`;
      await reverseAttendanceSync(id);
    }
    await auditLog("request", id, "cancel", employeeId || req.user!.id, { wasApproved });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: "Failed to cancel request" }); }
});

// ====================================================================
// APPROVAL ACTIONS (Manager / HR / Admin — NEVER employee on own request)
// ====================================================================

/**
 * GET /api/leave/pending-approvals
 * Manager: ONLY requests where they are assigned as approver AND status=pending
 * HR/Admin: All pending HR-level approvals + their own assigned approvals
 * Employee: NEVER sees this (empty)
 */
router.get("/pending-approvals", requireAuth, async (req: Request, res: Response) => {
  try {
    const employeeId = req.user!.employeeId;
    const role = req.user!.role;
    if (!employeeId) return res.json([]);

    // Base: approvals explicitly assigned to this user
    const myApprovals = await sql`
      SELECT la.*, lr.employee_id, lr.leave_type_id, lr.start_date, lr.end_date,
        lr.day_type, lr.total_days, lr.reason, lr.status as request_status, lr.applied_at,
        lt.name as type_name, lt.color, lt.paid,
        e.first_name, e.last_name, e.employee_id as emp_code, e.department, e.avatar
      FROM leave_approvals la
      INNER JOIN leave_requests lr ON lr.id = la.leave_request_id
      INNER JOIN leave_types lt ON lt.id = lr.leave_type_id
      INNER JOIN employees e ON e.id = lr.employee_id
      WHERE la.approver_id = ${employeeId}
        AND la.status = 'pending'
        AND lr.status = 'pending'
        AND lr.employee_id != ${employeeId}
      ORDER BY la.created_at ASC
    `;

    // HR/Admin: also see all pending HR-level approvals (not just assigned to them)
    let hrApprovals: any[] = [];
    if (role === "hr" || role === "admin") {
      hrApprovals = await sql`
        SELECT la.*, lr.employee_id, lr.leave_type_id, lr.start_date, lr.end_date,
          lr.day_type, lr.total_days, lr.reason, lr.status as request_status, lr.applied_at,
          lt.name as type_name, lt.color, lt.paid,
          e.first_name, e.last_name, e.employee_id as emp_code, e.department, e.avatar
        FROM leave_approvals la
        INNER JOIN leave_requests lr ON lr.id = la.leave_request_id
        INNER JOIN leave_types lt ON lt.id = lr.leave_type_id
        INNER JOIN employees e ON e.id = lr.employee_id
        WHERE la.approver_role IN ('hr', 'admin')
          AND la.status = 'pending'
          AND lr.status = 'pending'
          AND lr.employee_id != ${employeeId}
        ORDER BY la.created_at ASC
      `;
    }

    // Deduplicate
    const seen = new Set(myApprovals.map((r: any) => r.id));
    const combined = [...myApprovals, ...hrApprovals.filter((r: any) => !seen.has(r.id))];
    res.json(combined);
  } catch (error) { console.error("Error:", error); res.status(500).json({ error: "Failed to fetch approvals" }); }
});

/** POST /api/leave/approve/:approvalId */
router.post("/approve/:approvalId", requireAuth, async (req: Request, res: Response) => {
  try {
    const { approvalId } = req.params;
    const { remarks } = req.body;
    const employeeId = req.user!.employeeId;

    const apps = await sql`SELECT * FROM leave_approvals WHERE id = ${approvalId}`;
    if (apps.length === 0) return res.status(404).json({ error: "Approval not found" });
    const approval = apps[0];

    // Get the leave request to check self-approval
    const reqRows = await sql`SELECT employee_id FROM leave_requests WHERE id = ${approval.leave_request_id}`;
    if (reqRows.length === 0) return res.status(404).json({ error: "Request not found" });

    // HARD RULE: Cannot approve your own leave
    if (reqRows[0].employee_id === employeeId) {
      return res.status(403).json({ error: "Cannot approve your own leave request" });
    }

    const isAssigned = approval.approver_id === employeeId;
    const isHRAdmin = req.user!.role === "hr" || req.user!.role === "admin";
    if (!isAssigned && !isHRAdmin) return res.status(403).json({ error: "Not authorized" });
    if (approval.status !== "pending") return res.status(400).json({ error: "Already actioned" });

    // Mark step approved
    await sql`UPDATE leave_approvals SET status = 'approved', actioned_at = NOW(), remarks = ${remarks || null} WHERE id = ${approvalId}`;

    // Check remaining steps
    const pending = await sql`SELECT id FROM leave_approvals WHERE leave_request_id = ${approval.leave_request_id} AND status = 'pending'`;

    if (pending.length === 0) {
      // All steps done → approve request, deduct balance, sync attendance
      const reqDetail = await sql`SELECT lr.*, lt.paid FROM leave_requests lr INNER JOIN leave_types lt ON lt.id = lr.leave_type_id WHERE lr.id = ${approval.leave_request_id}`;
      const request = reqDetail[0];
      await sql`UPDATE leave_requests SET status = 'approved', decided_at = NOW(), decided_by = ${employeeId || req.user!.id} WHERE id = ${approval.leave_request_id}`;

      if (request.paid) {
        await sql`UPDATE employee_leave_balances SET balance = balance::numeric - ${request.total_days}, used = used::numeric + ${request.total_days}, updated_at = NOW() WHERE employee_id = ${request.employee_id} AND leave_type_id = ${request.leave_type_id}`;
      }
      await syncLeaveToAttendance(approval.leave_request_id);
      await auditLog("request", approval.leave_request_id, "approve", employeeId || req.user!.id, { finalApprover: true, totalDays: request.total_days });
    } else {
      await auditLog("approval", approvalId, "approve", employeeId || req.user!.id, { step: approval.step_order, remaining: pending.length, remarks });
    }

    res.json({ success: true, fullyApproved: pending.length === 0 });
  } catch (error) { console.error("Error:", error); res.status(500).json({ error: "Failed to approve" }); }
});

/** POST /api/leave/reject/:approvalId */
router.post("/reject/:approvalId", requireAuth, async (req: Request, res: Response) => {
  try {
    const { approvalId } = req.params;
    const { remarks } = req.body;
    const employeeId = req.user!.employeeId;

    const apps = await sql`SELECT * FROM leave_approvals WHERE id = ${approvalId}`;
    if (apps.length === 0) return res.status(404).json({ error: "Approval not found" });
    const approval = apps[0];

    // Self-rejection guard
    const reqRows = await sql`SELECT employee_id FROM leave_requests WHERE id = ${approval.leave_request_id}`;
    if (reqRows.length > 0 && reqRows[0].employee_id === employeeId) {
      return res.status(403).json({ error: "Cannot reject your own leave request via approval" });
    }

    const isAssigned = approval.approver_id === employeeId;
    const isHRAdmin = req.user!.role === "hr" || req.user!.role === "admin";
    if (!isAssigned && !isHRAdmin) return res.status(403).json({ error: "Not authorized" });

    // Reject step
    await sql`UPDATE leave_approvals SET status = 'rejected', actioned_at = NOW(), remarks = ${remarks || null} WHERE id = ${approvalId}`;
    // Cancel remaining pending steps
    await sql`UPDATE leave_approvals SET status = 'rejected', actioned_at = NOW(), remarks = 'Auto-rejected (prior step rejected)' WHERE leave_request_id = ${approval.leave_request_id} AND status = 'pending'`;
    // Reject the request
    await sql`UPDATE leave_requests SET status = 'rejected', decided_at = NOW(), decided_by = ${employeeId || req.user!.id}, rejection_reason = ${remarks || "Rejected"} WHERE id = ${approval.leave_request_id}`;

    await auditLog("request", approval.leave_request_id, "reject", employeeId || req.user!.id, { step: approval.step_order, remarks });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: "Failed to reject" }); }
});

// ====================================================================
// QUERIES — STRICT VISIBILITY
// ====================================================================

/**
 * GET /api/leave/requests
 * HR/Admin: ALL requests
 * Manager: ONLY requests from their direct reports (employees where manager_id = me)
 * Employee: BLOCKED (use /my-requests instead)
 */
router.get("/requests", requireAuth, async (req: Request, res: Response) => {
  try {
    const role = req.user!.role;
    const employeeId = req.user!.employeeId;
    const { status, from, to } = req.query;

    // Employees should not call this endpoint — /my-requests is for them
    if (role === "employee") return res.json([]);

    let query = `
      SELECT lr.*, lt.name as type_name, lt.color, lt.paid,
        e.first_name, e.last_name, e.employee_id as emp_code, e.department, e.avatar
      FROM leave_requests lr
      INNER JOIN leave_types lt ON lt.id = lr.leave_type_id
      INNER JOIN employees e ON e.id = lr.employee_id
    `;
    const conditions: string[] = [];
    const params: any[] = [];

    // Manager: only their direct reports (NOT including their own requests)
    if (role === "manager" && employeeId) {
      params.push(employeeId);
      conditions.push(`e.manager_id = $${params.length}`);
    }

    if (status && status !== "all") { params.push(status); conditions.push(`lr.status = $${params.length}`); }
    if (from) { params.push(from); conditions.push(`lr.end_date >= $${params.length}`); }
    if (to) { params.push(to); conditions.push(`lr.start_date <= $${params.length}`); }

    const limit = Math.min(parseInt(req.query.limit as string) || 200, 500);
    const offset = parseInt(req.query.offset as string) || 0;
    params.push(limit, offset);

    if (conditions.length > 0) query += " WHERE " + conditions.join(" AND ");
    query += ` ORDER BY lr.applied_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const rows = await sql(query, params);
    res.json(rows);
  } catch (error) { console.error("Error:", error); res.status(500).json({ error: "Failed to fetch requests" }); }
});

/** GET /api/leave/request/:id — Full detail */
router.get("/request/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const reqs = await sql`
      SELECT lr.*, lt.name as type_name, lt.color, lt.paid, lt.requires_document,
        e.first_name, e.last_name, e.employee_id as emp_code, e.department
      FROM leave_requests lr
      INNER JOIN leave_types lt ON lt.id = lr.leave_type_id
      INNER JOIN employees e ON e.id = lr.employee_id
      WHERE lr.id = ${req.params.id}
    `;
    if (reqs.length === 0) return res.status(404).json({ error: "Not found" });

    // Visibility: employee can only see their own; manager can see their reports; HR/admin can see all
    const role = req.user!.role;
    const empId = req.user!.employeeId;
    if (role === "employee" && reqs[0].employee_id !== empId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const approvals = await sql`
      SELECT la.*, ae.first_name as approver_first_name, ae.last_name as approver_last_name
      FROM leave_approvals la
      INNER JOIN employees ae ON ae.id = la.approver_id
      WHERE la.leave_request_id = ${req.params.id}
      ORDER BY la.step_order
    `;

    // Employees should NOT see approval chain details
    if (role === "employee") {
      res.json(reqs[0]); // no approvals
    } else {
      res.json({ ...reqs[0], approvals });
    }
  } catch (error) { res.status(500).json({ error: "Failed to fetch request details" }); }
});

/** GET /api/leave/calendar — Approved leave for all employees in date range (for calendar view). Synced with leave system. */
router.get("/calendar", requireAuth, async (req: Request, res: Response) => {
  try {
    const { from, to, department } = req.query;
    const startDate = (from as string) || new Date().toISOString().slice(0, 8) + "01";
    const endDate = (to as string) || (() => { const d = new Date(); d.setMonth(d.getMonth() + 1, 0); return d.toISOString().split("T")[0]; })();
    if (department && typeof department === "string") {
      const rows = await sql`
        SELECT lr.id, lr.employee_id, lr.start_date, lr.end_date, lr.day_type, lr.total_days, lr.status,
          lt.name as type_name, lt.color, e.first_name, e.last_name, e.department, e.avatar
        FROM leave_requests lr
        INNER JOIN leave_types lt ON lt.id = lr.leave_type_id
        INNER JOIN employees e ON e.id = lr.employee_id
        WHERE lr.status = 'approved' AND lr.start_date <= ${endDate} AND lr.end_date >= ${startDate} AND e.department = ${department}
        ORDER BY lr.start_date
      `;
      return res.json(rows);
    }
    const rows = await sql`
      SELECT lr.id, lr.employee_id, lr.start_date, lr.end_date, lr.day_type, lr.total_days, lr.status,
        lt.name as type_name, lt.color, e.first_name, e.last_name, e.department, e.avatar
      FROM leave_requests lr
      INNER JOIN leave_types lt ON lt.id = lr.leave_type_id
      INNER JOIN employees e ON e.id = lr.employee_id
      WHERE lr.status = 'approved' AND lr.start_date <= ${endDate} AND lr.end_date >= ${startDate}
      ORDER BY lr.start_date
    `;
    res.json(rows);
  } catch (error) {
    console.error("Leave calendar error:", error);
    res.status(500).json({ error: "Failed to fetch calendar" });
  }
});

/** GET /api/leave/team/:managerId — Batch query (no N+1) */
router.get("/team/:managerId", requireAuth, async (req: Request, res: Response) => {
  try {
    const { managerId } = req.params;
    const team = await sql`SELECT e.id, e.first_name, e.last_name, e.employee_id as emp_code, e.department, e.avatar FROM employees e WHERE e.manager_id = ${managerId} AND e.employment_status = 'active'`;
    if (team.length === 0) return res.json([]);
    // Batch-fetch all balances for the whole team in ONE query
    const teamIds = team.map((m: any) => m.id);
    const allBalances = await sql`
      SELECT elb.employee_id, elb.balance, elb.used, lt.name as type_name, lt.color
      FROM employee_leave_balances elb
      INNER JOIN leave_types lt ON lt.id = elb.leave_type_id
      WHERE elb.employee_id = ANY(${teamIds})
    `;
    // Group balances by employee
    const balanceMap = new Map<string, any[]>();
    for (const b of allBalances) {
      if (!balanceMap.has(b.employee_id)) balanceMap.set(b.employee_id, []);
      balanceMap.get(b.employee_id)!.push({ balance: b.balance, used: b.used, type_name: b.type_name, color: b.color });
    }
    const result = team.map((m: any) => ({ ...m, balances: balanceMap.get(m.id) || [] }));
    res.json(result);
  } catch (error) { res.status(500).json({ error: "Failed to fetch team data" }); }
});

/** GET /api/leave/stats */
router.get("/stats", requireAuth, async (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const role = req.user!.role;
    const employeeId = req.user!.employeeId;

    // HR/Admin: org-wide stats; Manager: team stats; Employee: personal stats
    let pendingFilter = "";
    let approvedFilter = "";
    const pendingParams: any[] = [];
    const approvedParams: any[] = [today, today];

    if (role === "employee" && employeeId) {
      pendingParams.push(employeeId);
      pendingFilter = ` AND employee_id = $${pendingParams.length}`;
      approvedParams.push(employeeId);
      approvedFilter = ` AND lr.employee_id = $${approvedParams.length}`;
    } else if (role === "manager" && employeeId) {
      // Parallelize all 4 independent queries
      const [[myPending], [onLeave], [approved], [pols]] = await Promise.all([
        sql`SELECT COUNT(*)::int as count FROM leave_approvals la INNER JOIN leave_requests lr ON lr.id = la.leave_request_id WHERE la.approver_id = ${employeeId} AND la.status = 'pending' AND lr.status = 'pending'`,
        sql`SELECT COUNT(*)::int as count FROM leave_requests lr INNER JOIN employees e ON e.id = lr.employee_id WHERE lr.status = 'approved' AND lr.start_date <= ${today} AND lr.end_date >= ${today} AND e.manager_id = ${employeeId}`,
        sql`SELECT COUNT(*)::int as count FROM leave_requests lr INNER JOIN employees e ON e.id = lr.employee_id WHERE lr.status = 'approved' AND lr.start_date >= ${today.slice(0, 8) + "01"} AND e.manager_id = ${employeeId}`,
        sql`SELECT COUNT(*)::int as count FROM leave_policies WHERE is_active = true`,
      ]);
      return res.json({ pendingRequests: myPending.count, onLeaveToday: onLeave.count, approvedThisMonth: approved.count, activePolicies: pols.count });
    }

    const [pendingCount] = await sql(`SELECT COUNT(*)::int as count FROM leave_requests WHERE status = 'pending'` + pendingFilter, pendingParams);
    const [approvedToday] = await sql(`SELECT COUNT(*)::int as count FROM leave_requests lr WHERE lr.status = 'approved' AND lr.start_date <= $1 AND lr.end_date >= $2` + approvedFilter, approvedParams);
    const monthStart = today.slice(0, 8) + "01";
    const [totalMonth] = await sql`SELECT COUNT(*)::int as count FROM leave_requests WHERE status = 'approved' AND start_date >= ${monthStart}`;
    const [totalPolicies] = await sql`SELECT COUNT(*)::int as count FROM leave_policies WHERE is_active = true`;

    res.json({
      pendingRequests: pendingCount.count,
      onLeaveToday: approvedToday.count,
      approvedThisMonth: totalMonth.count,
      activePolicies: totalPolicies.count,
    });
  } catch (error) { console.error("Error:", error); res.status(500).json({ error: "Failed to fetch stats" }); }
});

/**
 * GET /api/leave/types-for-employee/:employeeId
 * Returns ALL leave types from ALL matching policies for this employee.
 * Includes policyId, policyName per type, initialized balances, and diagnostic metadata.
 */
router.get("/types-for-employee/:employeeId", requireAuth, async (req: Request, res: Response) => {
  try {
    const { employeeId } = req.params;
    const userRole = req.user!.role;
    const emp = await sql`SELECT department, employee_type FROM employees WHERE id = ${employeeId}`;
    if (emp.length === 0) return res.status(404).json({ error: "Employee not found" });

    const department = emp[0].department;
    const employeeType = emp[0].employee_type || "full_time";

    // Find ALL applicable policies (not just the best one)
    let policies = await findAllMatchingPolicies(department, employeeType, userRole);

    // Fallback: if no policies match by dept/type, try any active policy that allows the role
    if (policies.length === 0) {
      const today = new Date().toISOString().split("T")[0];
      const fallbackPolicies = await sql`
        SELECT p.* FROM leave_policies p
        WHERE p.is_active = true AND p.effective_from <= ${today}
          AND (p.effective_to IS NULL OR p.effective_to >= ${today})
        ORDER BY p.created_at DESC
      `;
      for (const p of fallbackPolicies) {
        if (!policyAllowedForRole(p, userRole)) continue;
        const tc = await sql`SELECT id FROM leave_types WHERE policy_id = ${p.id} LIMIT 1`;
        if (tc.length > 0) { policies.push(p); break; }
      }
    }

    // Diagnostic log
    console.log(`[leave:types-for-employee] employee=${employeeId} dept=${department} type=${employeeType} role=${userRole} matchedPolicies=${policies.length} policyIds=[${policies.map((p: any) => p.id).join(",")}]`);

    if (policies.length === 0) {
      console.warn(`[leave:types-for-employee] No matching policy for employee=${employeeId}. Check leave_policies configuration.`);
      return res.json([]);
    }

    if (policies.length > 1) {
      console.log(`[leave:types-for-employee] Multiple policies matched: ${policies.map((p: any) => `${p.name} (${p.id})`).join(", ")}. Aggregating leave types from all.`);
    }

    // Batch-fetch ALL leave types across all matched policies in ONE query (no N+1)
    const policyIds = policies.map((p: any) => p.id);
    const allRawTypes = await sql`SELECT * FROM leave_types WHERE policy_id = ANY(${policyIds}) ORDER BY name`;

    // Build a policy lookup for attaching policy_name
    const policyLookup = new Map(policies.map((p: any) => [p.id, p.name]));

    // Dedup by leave type name (higher-priority policy first)
    const seenTypeNames = new Set<string>();
    const allTypes: any[] = [];
    // policies are priority-sorted so iterate by that order
    for (const policy of policies) {
      for (const lt of allRawTypes.filter((t: any) => t.policy_id === policy.id)) {
        if (seenTypeNames.has(lt.name.toLowerCase())) continue;
        seenTypeNames.add(lt.name.toLowerCase());
        allTypes.push({ ...lt, policy_id: policy.id, policy_name: policyLookup.get(policy.id) });
      }
    }

    // Batch-fetch existing balances in ONE query
    const typeIds = allTypes.map((lt: any) => lt.id);
    const existingBalances = await sql`
      SELECT leave_type_id, balance, used FROM employee_leave_balances
      WHERE employee_id = ${employeeId} AND leave_type_id = ANY(${typeIds})
    `;
    const balMap = new Map(existingBalances.map((b: any) => [b.leave_type_id, b]));

    // Initialize missing balances (batch: only the ones that don't exist)
    const missing = allTypes.filter((lt: any) => !balMap.has(lt.id));
    if (missing.length > 0) {
      for (const lt of missing) {
        const init = lt.accrual_type === "yearly" ? lt.max_balance : 0;
        await sql`INSERT INTO employee_leave_balances (employee_id, leave_type_id, balance, used, last_accrual_at) VALUES (${employeeId}, ${lt.id}, ${init}, 0, NOW())`;
        balMap.set(lt.id, { balance: init, used: 0 });
      }
      console.log(`[leave:types-for-employee] Initialized ${missing.length} missing balance records for employee=${employeeId}`);
    }

    // Attach balances
    const result = allTypes.map((lt: any) => {
      const bal = balMap.get(lt.id);
      return { ...lt, balance: bal?.balance ?? 0, used: bal?.used ?? 0 };
    });

    res.json(result);
  } catch (error) { console.error("[leave:types-for-employee] Error:", error); res.status(500).json({ error: "Failed to fetch leave types" }); }
});

export default router;
