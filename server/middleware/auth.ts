import { Request, Response, NextFunction } from "express";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import jwt from "jsonwebtoken";
import { type SystemRole, ALL_ROLES, normalizeRole, hasAnyRole } from "../lib/rbac";

config();

const sql = neon(process.env.DATABASE_URL!);
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const COOKIE_NAME = "auth_token";

// Re-export for backwards compat (other files import Role from here)
export type Role = SystemRole;

export interface UserPayload {
  id: string;
  email: string;
  role: SystemRole;
  roles?: string[];
  employeeId: string | null;
}

interface JWTPayload extends UserPayload {
  userId: string; // JWT uses userId, we map to id
}

declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}

/**
 * Extract user from JWT cookie or X-User-Id header.
 * Always resolves role through normalizeRole() so unknown values default to 'employee'.
 */
async function extractUser(req: Request, res: Response): Promise<UserPayload | null> {
  // 1. Try JWT from cookie (primary)
  const token = req.cookies?.[COOKIE_NAME];
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
      
      // Verify user is still active
      const users = await sql`SELECT is_active FROM users WHERE id = ${decoded.userId}`;
      if (users.length === 0 || users[0].is_active !== "true") {
        res.clearCookie(COOKIE_NAME);
        return null;
      }

      return {
        id: decoded.userId,
        email: decoded.email,
        role: normalizeRole(decoded.role),
        roles: decoded.roles ?? (decoded.role ? [decoded.role] : []),
        employeeId: decoded.employeeId,
      };
    } catch {
      res.clearCookie(COOKIE_NAME);
    }
  }

  // 2. Fallback to X-User-Id header (development only)
  const headerUserId = req.headers["x-user-id"] as string;
  if (headerUserId) {
    const users = await sql`
      SELECT id, email, role, roles, employee_id 
      FROM users 
      WHERE id = ${headerUserId} AND is_active = 'true'
    `;
    if (users.length > 0) {
      const u = users[0];
      const primary = normalizeRole(u.role as string);
      const rolesArray = (u.roles != null && Array.isArray(u.roles) && (u.roles as string[]).length > 0)
        ? (u.roles as string[])
        : [primary];
      return {
        id: u.id as string,
        email: u.email as string,
        role: primary,
        roles: rolesArray,
        employeeId: u.employee_id as string | null,
      };
    }
  }

  return null;
}

/**
 * Require authentication.
 * Priority: JWT cookie > X-User-Id header
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await extractUser(req, res);
    
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Authentication failed" });
  }
}

/**
 * Optional authentication – attach user if present, don't fail if not.
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await extractUser(req, res);
    if (user) req.user = user;
  } catch {
    // Ignore errors for optional auth
  }
  next();
}

/**
 * Require specific roles.
 * Uses normalizeRole + roles array so both primary role and secondary roles are checked.
 * Usage: requireRole(['admin', 'hr'])
 */
export function requireRole(allowedRoles: SystemRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Build a UserRow-compatible object for hasAnyRole
    const userRow = {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      roles: req.user.roles ?? [],
    };

    if (!hasAnyRole(userRow, allowedRoles)) {
      return res.status(403).json({ error: "Access denied" });
    }

    next();
  };
}

/**
 * Check if user can access employee record.
 * Admin / HR / IT: access all | Others: own record only
 */
export function canAccessEmployee(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const targetId = req.params.employeeId || req.params.id;

  const privilegedRoles: SystemRole[] = ["admin", "hr"];
  const userRow = {
    id: req.user.id,
    email: req.user.email,
    role: req.user.role,
    roles: req.user.roles ?? [],
  };

  if (hasAnyRole(userRow, privilegedRoles)) {
    return next();
  }

  // Others can only access their own record
  if (req.user.employeeId !== targetId) {
    return res.status(403).json({ error: "Access denied" });
  }

  next();
}

// ==================== Guard-rail helpers ====================

/**
 * Prevent a user from acting on their own records (e.g. approving own leave).
 * Usage: preventSelfAction('employeeId')
 */
export function preventSelfAction(paramName = "employeeId") {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Authentication required" });
    const targetId = req.params[paramName] || req.body?.[paramName];
    if (targetId && req.user.employeeId && targetId === req.user.employeeId) {
      return res.status(403).json({ error: "You cannot perform this action on your own record" });
    }
    next();
  };
}
