/**
 * Centralised RBAC helpers.
 * All role resolution goes through getEffectiveRole() so there's a single source of truth.
 */
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config();
const sql = neon(process.env.DATABASE_URL!);

// ==================== TYPES ====================

export const ALL_ROLES = ["admin", "hr", "manager", "employee", "it"] as const;
export type SystemRole = (typeof ALL_ROLES)[number];

/** Minimal user row needed for role resolution */
export interface UserRow {
  id: string;
  email: string;
  role: string | null;
  roles?: string[] | null;
  employee_id?: string | null;
}

// ==================== EFFECTIVE ROLE ====================

/**
 * Resolve the effective role for a user.
 *
 * Rules (in order):
 *  1. If user.role is a valid SystemRole → use it.
 *  2. If user has a linked employee → infer from employee data:
 *       - Employee in HR department     → 'hr'
 *       - Employee has direct reports    → 'manager'
 *       - Employee in IT department      → 'it'
 *       - Otherwise                      → 'employee'
 *  3. Fallback                            → 'employee'
 */
export async function getEffectiveRole(user: UserRow): Promise<SystemRole> {
  // 1. Explicit role
  if (user.role && (ALL_ROLES as readonly string[]).includes(user.role)) {
    return user.role as SystemRole;
  }

  // 2. Infer from linked employee
  if (user.employee_id) {
    try {
      const emps = await sql`
        SELECT department, manager_id,
               (SELECT COUNT(*)::int FROM employees sub WHERE sub.manager_id = e.id) AS direct_reports
        FROM employees e WHERE e.id = ${user.employee_id}
      `;
      if (emps.length > 0) {
        const emp = emps[0] as { department: string; manager_id: string | null; direct_reports: number };
        const dept = (emp.department || "").toLowerCase().trim();
        if (dept === "human resources" || dept === "hr") return "hr";
        if (emp.direct_reports > 0) return "manager";
        if (dept === "it" || dept === "information technology") return "it";
      }
    } catch (e) {
      console.warn("[rbac] getEffectiveRole: failed to query employee", e);
    }
  }

  // 3. Fallback
  return "employee";
}

/**
 * Synchronous version when we already know the role is valid.
 * Falls back to 'employee' for unknown strings.
 */
export function normalizeRole(raw: string | null | undefined): SystemRole {
  if (raw && (ALL_ROLES as readonly string[]).includes(raw)) return raw as SystemRole;
  if (raw) console.warn(`[rbac] Unknown role "${raw}", treating as "employee"`);
  return "employee";
}

/**
 * Check whether the user (by effectiveRole + roles array) has any of the allowedRoles.
 */
export function hasAnyRole(user: UserRow, allowedRoles: SystemRole[]): boolean {
  const primary = normalizeRole(user.role);
  if (allowedRoles.includes(primary)) return true;
  if (Array.isArray(user.roles)) {
    return allowedRoles.some((r) => user.roles!.includes(r));
  }
  return false;
}

// ==================== FRESHTEAMS MIGRATION ====================

/**
 * Map a Freshteams role label to a SystemRole.
 * Admin is never auto-assigned — returns 'employee' with a warning.
 */
export function mapFreshteamsRoleToSystemRole(freshRole: string): SystemRole {
  const normalised = (freshRole || "").trim().toLowerCase();

  const map: Record<string, SystemRole> = {
    admin: "employee", // guard: never auto-map admin
    hr: "hr",
    manager: "manager",
    employee: "employee",
    it: "it",
    "it admin": "it",
    "it desk": "it",
  };

  const mapped = map[normalised];
  if (!mapped) {
    console.warn(`[rbac] mapFreshteamsRole: unknown role "${freshRole}", defaulting to employee`);
    return "employee";
  }
  if (normalised === "admin") {
    console.warn(`[rbac] mapFreshteamsRole: "Admin" cannot be auto-assigned. Setting to employee. Promote manually.`);
  }
  return mapped;
}

/**
 * Given an employee row (from a Freshteams import), auto-link or create a user account.
 *
 * Returns the user id, or null if we couldn't create/link.
 */
export async function autoLinkUserForEmployee(employee: {
  id: string;
  work_email: string;
  freshteams_role?: string;
  domain?: string;
}): Promise<string | null> {
  const email = (employee.work_email || "").toLowerCase().trim();
  if (!email) return null;

  try {
    // Check if a user already exists with this email
    const existing = await sql`SELECT id, employee_id FROM users WHERE LOWER(email) = ${email}`;
    if (existing.length > 0) {
      const u = existing[0] as { id: string; employee_id: string | null };
      if (!u.employee_id) {
        // Link the user to the employee
        await sql`UPDATE users SET employee_id = ${employee.id}, updated_at = NOW() WHERE id = ${u.id}`;
        console.log(`[rbac] Auto-linked user ${u.id} (${email}) → employee ${employee.id}`);
      }
      return u.id;
    }

    // No user exists → create one
    const role = employee.freshteams_role
      ? mapFreshteamsRoleToSystemRole(employee.freshteams_role)
      : "employee";

    // Determine auth provider based on domain
    const authProvider = employee.domain && email.endsWith(`@${employee.domain.toLowerCase()}`)
      ? "microsoft"
      : "local";

    const created = await sql`
      INSERT INTO users (email, role, employee_id, auth_provider, is_active)
      VALUES (${email}, ${role}, ${employee.id}, ${authProvider}, 'true')
      RETURNING id
    `;
    console.log(`[rbac] Auto-created user for employee ${employee.id} (${email}) with role=${role}, provider=${authProvider}`);
    return (created[0] as { id: string }).id;
  } catch (e) {
    // Unique constraint on employee_id — already linked
    if ((e as { code?: string })?.code === "23505") {
      console.warn(`[rbac] autoLinkUser: employee ${employee.id} already linked to another user`);
      return null;
    }
    console.error("[rbac] autoLinkUser error:", e);
    return null;
  }
}
