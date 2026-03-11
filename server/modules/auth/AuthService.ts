import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { AuthRepository } from "./AuthRepository.js";
import { getEffectiveRole, normalizeRole } from "../../lib/rbac.js";
import { ValidationError, NotFoundError, ConflictError } from "../../core/types/index.js";

export const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN = "7d";
const SALT_ROUNDS = 10;
const VALID_ROLES = ["admin", "hr", "manager", "employee", "it"];

export const MS_CLIENT_ID = process.env.MS_CLIENT_ID || "";
export const MS_CLIENT_SECRET = process.env.MS_CLIENT_SECRET || "";
export const MS_TENANT_ID = process.env.MS_TENANT_ID || "common";
export const MS_REDIRECT_URI = process.env.MS_REDIRECT_URI?.trim() || "http://localhost:5000/api/auth/microsoft/callback";
const MS_AUTHORITY = `https://login.microsoftonline.com/${MS_TENANT_ID}`;
const MS_SCOPES = "openid profile email User.Read";
export const MS_SSO_ENABLED = !!(MS_CLIENT_ID && MS_CLIENT_SECRET && MS_TENANT_ID);

export function getCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  };
}

export class AuthService {
  private readonly repo = new AuthRepository();

  async login(email: string, password: string) {
    if (!email || !password) throw new ValidationError("Email and password are required");
    const user = await this.repo.findUserByEmail(email.toLowerCase().trim());
    if (!user) throw new ValidationError("Invalid email or password", 401);
    if (user.is_active !== true && user.is_active !== "true") throw new ValidationError("Account is deactivated", 401);
    if (!user.password_hash) throw new ValidationError("This account uses SSO login. Please use the SSO option.", 401);
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new ValidationError("Invalid email or password", 401);
    await this.repo.updateLastLogin(user.id);
    const effRole = await getEffectiveRole({ id: user.id, email: user.email, role: user.role, employee_id: user.employee_id });
    const token = jwt.sign({ userId: user.id, email: user.email, role: user.role, roles: [user.role], employeeId: user.employee_id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    return {
      token,
      user: { id: user.id, email: user.email, role: normalizeRole(user.role), effectiveRole: effRole, roles: [user.role], employeeId: user.employee_id, allowedModules: Array.isArray(user.allowed_modules) ? user.allowed_modules : [] },
    };
  }

  async getMe(token: string) {
    let decoded: { userId: string };
    try { decoded = jwt.verify(token, JWT_SECRET) as any; }
    catch { throw new ValidationError("Invalid token", 401); }
    const user = await this.repo.findUserById(decoded.userId);
    if (!user) throw new ValidationError("User not found or inactive", 401);
    const effRole = await getEffectiveRole({ id: user.id, email: user.email, role: user.role, employee_id: user.employee_id });
    return { id: user.id, email: user.email, role: normalizeRole(user.role), effectiveRole: effRole, roles: [user.role], employeeId: user.employee_id, allowedModules: Array.isArray(user.allowed_modules) ? user.allowed_modules : [], firstName: user.first_name, lastName: user.last_name, avatar: user.avatar, timeZone: user.time_zone ?? null };
  }

  async updateMe(userId: string, timeZone?: string) {
    if (timeZone !== undefined) {
      const tz = typeof timeZone === "string" ? timeZone.trim() || null : null;
      await this.repo.updateTimezone(userId, tz);
    }
    return { ok: true };
  }

  async register(email: string, password: string|undefined, role = "employee", employeeId?: string, authProvider?: string) {
    if (!email) throw new ValidationError("Email is required");
    const useMicrosoft = authProvider === "microsoft";
    if (!useMicrosoft && !password) throw new ValidationError("Password is required for non-Microsoft sign-in");
    if (!useMicrosoft && password && password.length < 8) throw new ValidationError("Password must be at least 8 characters");
    if (role && !VALID_ROLES.includes(role)) throw new ValidationError(`Invalid role. Must be one of: ${VALID_ROLES.join(", ")}`);
    const existing = await this.repo.findExistingUser(email.toLowerCase().trim());
    if (existing) throw new ConflictError("Email already registered");
    const passwordHash = useMicrosoft && !password ? null : await bcrypt.hash(password!, SALT_ROUNDS);
    const user = await this.repo.createUser(email.toLowerCase().trim(), passwordHash, role, employeeId || null, useMicrosoft ? "microsoft" : "local");
    return { message: "User registered successfully", user: { id: user.id, email: user.email, role: user.role, employeeId: user.employee_id } };
  }

  async listUsers() {
    const rows = await this.repo.listUsers();
    return rows.map((r: any) => ({ id: r.id, email: r.email, role: r.role, roles: r.roles ?? [], employeeId: r.employee_id, isActive: r.is_active === true || r.is_active === "true", lastLoginAt: r.last_login_at, allowedModules: Array.isArray(r.allowed_modules) ? r.allowed_modules : [], employeeName: r.first_name && r.last_name ? `${r.first_name} ${r.last_name}` : null, jobTitle: r.job_title, department: r.department }));
  }

  async updateUser(id: string, data: { role?: string; employeeId?: string|null; isActive?: boolean; allowedModules?: any[] }, currentUserId?: string) {
    const current = await this.repo.findUserRow(id);
    if (!current) throw new NotFoundError("User", id);
    const newRole = data.role !== undefined && VALID_ROLES.includes(data.role) ? data.role : current.role;
    const newEmployeeId = data.employeeId !== undefined ? (data.employeeId === "" || data.employeeId === null ? null : data.employeeId) : current.employee_id;
    const newIsActive = typeof data.isActive === "boolean" ? data.isActive : (current.is_active === true || current.is_active === "true");
    const newAllowedModules = data.allowedModules !== undefined ? (Array.isArray(data.allowedModules) ? data.allowedModules : []) : (Array.isArray(current.allowed_modules) ? current.allowed_modules : []);
    await this.repo.updateUser(id, { role: newRole, employeeId: newEmployeeId, isActive: newIsActive, allowedModules: newAllowedModules });
    return { user: { id, email: current.email, role: newRole, employeeId: newEmployeeId, isActive: newIsActive, allowedModules: newAllowedModules } };
  }

  async deleteUser(id: string, currentUserId?: string) {
    if (currentUserId && id === currentUserId) throw new ValidationError("You cannot delete your own account");
    const existing = await this.repo.findUserRow(id);
    if (!existing) throw new NotFoundError("User", id);
    await this.repo.deleteUser(id);
  }

  async changePassword(token: string, currentPassword: string, newPassword: string) {
    if (!currentPassword || !newPassword) throw new ValidationError("Current and new password are required");
    if (newPassword.length < 8) throw new ValidationError("New password must be at least 8 characters");
    let decoded: { userId: string };
    try { decoded = jwt.verify(token, JWT_SECRET) as any; }
    catch { throw new ValidationError("Invalid token", 401); }
    const user = await this.repo.findPasswordHash(decoded.userId);
    if (!user) throw new NotFoundError("User", decoded.userId);
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) throw new ValidationError("Current password is incorrect", 401);
    await this.repo.updatePasswordHash(decoded.userId, await bcrypt.hash(newPassword, SALT_ROUNDS));
    return { message: "Password changed successfully" };
  }

  // Microsoft SSO
  getMicrosoftAuthUrl(state: string) {
    if (!MS_CLIENT_ID) throw new ValidationError("Microsoft SSO is not configured", 501);
    const params = new URLSearchParams({ client_id: MS_CLIENT_ID, response_type: "code", redirect_uri: MS_REDIRECT_URI, response_mode: "query", scope: MS_SCOPES, state, prompt: "select_account" });
    return `${MS_AUTHORITY}/oauth2/v2.0/authorize?${params.toString()}`;
  }

  async handleMicrosoftCallback(code: string) {
    const tokenResponse = await fetch(`${MS_AUTHORITY}/oauth2/v2.0/token`, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: MS_CLIENT_ID, client_secret: MS_CLIENT_SECRET, grant_type: "authorization_code", code, redirect_uri: MS_REDIRECT_URI, scope: MS_SCOPES }),
    });
    if (!tokenResponse.ok) throw new Error("Token exchange failed");
    const tokens = await tokenResponse.json();
    if (!tokens.access_token) throw new Error("No access token received");
    const profileResponse = await fetch("https://graph.microsoft.com/v1.0/me", { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    if (!profileResponse.ok) throw new Error("Failed to fetch profile");
    const msProfile = await profileResponse.json();
    const msEmail = (msProfile.mail || msProfile.userPrincipalName || "").toLowerCase().trim();
    if (!msEmail) throw new Error("No email found in Microsoft account");

    let user: any = await this.repo.findUserByEmail(msEmail);
    if (user) {
      if (user.is_active !== true && user.is_active !== "true") throw new ValidationError("Account is deactivated", 401);
      if (!user.employee_id) {
        const emp = await this.repo.findEmployeeByEmail(msEmail);
        if (emp) { await this.repo.linkEmployeeToUser(user.id, emp.id); user.employee_id = emp.id; }
      }
      await this.repo.syncMicrosoftUser(user.id, msEmail);
    } else {
      const emp = await this.repo.findEmployeeByEmail(msEmail);
      const employeeId = emp?.id ?? null;
      if (employeeId) {
        const existing = await this.repo.findUserByEmployeeId(employeeId);
        if (existing) {
          if (existing.is_active !== true && existing.is_active !== "true") throw new ValidationError("Account is deactivated", 401);
          await this.repo.syncMicrosoftUser(existing.id, msEmail);
          user = { ...existing, email: msEmail };
        } else {
          user = await this.repo.createMicrosoftUser(msEmail, employeeId);
        }
      } else {
        user = await this.repo.createMicrosoftUser(msEmail, null);
      }
    }

    const token = jwt.sign({ userId: user.id, email: user.email || msEmail, role: user.role, roles: [user.role], employeeId: user.employee_id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    return token;
  }
}
