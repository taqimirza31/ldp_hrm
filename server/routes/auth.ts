import { Router, type Request, type Response } from "express";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { requireAuth, requireRole } from "../middleware/auth";
import { getEffectiveRole, normalizeRole } from "../lib/rbac";

config();

const sql = neon(process.env.DATABASE_URL!);
const router = Router();

/** PostgreSQL error code for undefined column */
const PG_UNDEFINED_COLUMN = "42703";

function isMissingColumnError(e: unknown): boolean {
  return (e as { code?: string })?.code === PG_UNDEFINED_COLUMN;
}

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN = "7d"; // Token expires in 7 days
const COOKIE_NAME = "auth_token";
const SALT_ROUNDS = 10;

// ==================== Microsoft Entra ID (Azure AD) SSO ====================
const MS_CLIENT_ID = process.env.MS_CLIENT_ID || "";
const MS_CLIENT_SECRET = process.env.MS_CLIENT_SECRET || "";
const MS_TENANT_ID = process.env.MS_TENANT_ID || "common";
// Redirect URI must match exactly what is registered in Azure (including path case)
const MS_REDIRECT_URI = process.env.MS_REDIRECT_URI?.trim() || "http://localhost:5000/api/auth/microsoft/callback";
const MS_AUTHORITY = `https://login.microsoftonline.com/${MS_TENANT_ID}`;
const MS_SCOPES = "openid profile email User.Read";

const MS_SSO_ENABLED = !!(MS_CLIENT_ID && MS_CLIENT_SECRET && MS_TENANT_ID);

// Cookie options for HTTP-only secure cookies
const getCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  path: "/",
});

/**
 * POST /api/auth/login
 * Authenticate user with email and password
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ 
        error: "Email and password are required" 
      });
    }

    let users: any[];
    try {
      users = await sql`
        SELECT id, email, password_hash, role, employee_id, is_active, allowed_modules
        FROM users 
        WHERE email = ${email.toLowerCase().trim()}
      `;
    } catch (e) {
      if (isMissingColumnError(e)) {
        users = await sql`
          SELECT id, email, password_hash, role, employee_id, is_active
          FROM users 
          WHERE email = ${email.toLowerCase().trim()}
        `;
      } else throw e;
    }

    if (users.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const user = users[0];

    // Check if user is active
    if (user.is_active !== "true") {
      return res.status(401).json({ error: "Account is deactivated" });
    }

    // Check if user has a password (might be SSO-only user)
    if (!user.password_hash) {
      return res.status(401).json({ 
        error: "This account uses SSO login. Please use the SSO option." 
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const rolesArray = [user.role];

    // Generate JWT token
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      roles: rolesArray,
      employeeId: user.employee_id,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { 
      expiresIn: JWT_EXPIRES_IN 
    });

    // Update last login timestamp
    await sql`
      UPDATE users 
      SET last_login_at = NOW(), updated_at = NOW() 
      WHERE id = ${user.id}
    `;

    // Set HTTP-only cookie
    res.cookie(COOKIE_NAME, token, getCookieOptions());

    const allowedModules = Array.isArray(user.allowed_modules) ? user.allowed_modules : [];

    // Resolve effective role (DB truth)
    const effRole = await getEffectiveRole({
      id: user.id as string,
      email: user.email as string,
      role: user.role as string,
      employee_id: user.employee_id as string | null,
    });

    res.json({
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email,
        role: normalizeRole(user.role as string),
        effectiveRole: effRole,
        roles: rolesArray,
        employeeId: user.employee_id,
        allowedModules,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

/**
 * POST /api/auth/logout
 * Clear the auth cookie
 */
router.post("/logout", (req, res) => {
  try {
    // Clear the auth cookie
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
    });

    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Logout failed" });
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user info
 */
router.get("/me", async (req, res) => {
  try {
    // Get token from cookie
    const token = req.cookies?.[COOKIE_NAME];

    if (!token) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      email: string;
      role: string;
      roles?: string[];
      employeeId: string | null;
    };

    let users: any[];
    try {
      users = await sql`
        SELECT u.id, u.email, u.role, u.employee_id, u.allowed_modules,
               e.first_name, e.last_name, e.avatar
        FROM users u
        LEFT JOIN employees e ON u.employee_id = e.id
        WHERE u.id = ${decoded.userId} AND u.is_active = 'true'
      `;
    } catch (e) {
      if (isMissingColumnError(e)) {
        users = await sql`
          SELECT u.id, u.email, u.role, u.employee_id,
                 e.first_name, e.last_name, e.avatar
          FROM users u
          LEFT JOIN employees e ON u.employee_id = e.id
          WHERE u.id = ${decoded.userId} AND u.is_active = 'true'
        `;
      } else throw e;
    }

    if (users.length === 0) {
      res.clearCookie(COOKIE_NAME);
      return res.status(401).json({ error: "User not found or inactive" });
    }

    const user = users[0];
    const rolesArray = [user.role];
    const allowedModules = Array.isArray(user.allowed_modules) ? user.allowed_modules : [];

    // Resolve effective role from DB truth
    const effRole = await getEffectiveRole({
      id: user.id as string,
      email: user.email as string,
      role: user.role as string,
      employee_id: user.employee_id as string | null,
    });

    res.json({
      id: user.id,
      email: user.email,
      role: normalizeRole(user.role as string),
      effectiveRole: effRole,
      roles: rolesArray,
      employeeId: user.employee_id,
      allowedModules,
      firstName: user.first_name,
      lastName: user.last_name,
      avatar: user.avatar,
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.clearCookie(COOKIE_NAME);
      return res.status(401).json({ error: "Invalid token" });
    }
    console.error("Auth check error:", error);
    res.status(500).json({ error: "Authentication check failed" });
  }
});

/**
 * POST /api/auth/register
 * Register a new user (Admin only). Creates user with role and optional employee link.
 */
router.post("/register", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const { email, password, role = "employee", employeeId, authProvider } = req.body;
    const validRoles = ["admin", "hr", "manager", "employee", "it"];
    const useMicrosoft = authProvider === "microsoft";

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }
    if (!useMicrosoft && !password) {
      return res.status(400).json({ error: "Password is required for non-Microsoft sign-in" });
    }
    if (!useMicrosoft && password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(", ")}` });
    }

    const existingUsers = await sql`
      SELECT id FROM users WHERE email = ${email.toLowerCase().trim()}
    `;
    if (existingUsers.length > 0) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const passwordHash = useMicrosoft && !password
      ? null
      : await bcrypt.hash(password, SALT_ROUNDS);
    const provider = useMicrosoft ? "microsoft" : "local";

    let result: any[];
    try {
      result = await sql`
        INSERT INTO users (email, password_hash, role, employee_id, auth_provider)
        VALUES (${email.toLowerCase().trim()}, ${passwordHash}, ${role}, ${employeeId || null}, ${provider})
        RETURNING id, email, role, employee_id
      `;
    } catch (e: any) {
      // Handle unique employee_id constraint
      if (e.code === "23505" && e.constraint?.includes("employee")) {
        return res.status(409).json({ error: "This employee is already linked to another user account" });
      }
      throw e;
    }

    const user = result[0];

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        employeeId: user.employee_id,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

/**
 * GET /api/auth/users
 * List all users (Admin only). Used for assigning roles and linking employees.
 */
router.get("/users", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    let rows: any[];
    try {
      rows = await sql`
        SELECT u.id, u.email, u.role, u.roles, u.employee_id, u.is_active, u.last_login_at, u.allowed_modules,
               e.first_name, e.last_name, e.job_title, e.department
        FROM users u
        LEFT JOIN employees e ON e.id = u.employee_id
        ORDER BY u.email
      `;
    } catch (e) {
      if (isMissingColumnError(e)) {
        rows = await sql`
          SELECT u.id, u.email, u.role, u.roles, u.employee_id, u.is_active, u.last_login_at,
                 e.first_name, e.last_name, e.job_title, e.department
          FROM users u
          LEFT JOIN employees e ON e.id = u.employee_id
          ORDER BY u.email
        `;
      } else throw e;
    }
    res.json(rows.map((r: any) => ({
      id: r.id,
      email: r.email,
      role: r.role,
      roles: r.roles ?? [],
      employeeId: r.employee_id,
      isActive: r.is_active === "true",
      lastLoginAt: r.last_login_at,
      allowedModules: Array.isArray(r.allowed_modules) ? r.allowed_modules : [],
      employeeName: r.first_name && r.last_name ? `${r.first_name} ${r.last_name}` : null,
      jobTitle: r.job_title,
      department: r.department,
    })));
  } catch (error) {
    console.error("List users error:", error);
    res.status(500).json({ error: "Failed to list users" });
  }
});

/**
 * PATCH /api/auth/users/:id
 * Update a user's role, employee link, or active status (Admin only).
 */
router.patch("/users/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { role, employeeId, isActive, allowedModules } = req.body;

    let existing: any[];
    try {
      existing = await sql`SELECT id, email, role, employee_id, is_active, allowed_modules FROM users WHERE id = ${id}`;
    } catch (e) {
      if (isMissingColumnError(e)) {
        existing = await sql`SELECT id, email, role, employee_id, is_active FROM users WHERE id = ${id}`;
      } else throw e;
    }
    if (existing.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    const current = existing[0] as any;

    const newRole = role !== undefined && ["admin", "hr", "manager", "employee", "it"].includes(role) ? role : current.role;
    const newEmployeeId = employeeId !== undefined ? (employeeId === "" || employeeId === null ? null : employeeId) : current.employee_id;
    const newIsActive = typeof isActive === "boolean" ? (isActive ? "true" : "false") : current.is_active;
    const newAllowedModules = allowedModules !== undefined
      ? (Array.isArray(allowedModules) ? allowedModules : [])
      : (Array.isArray(current.allowed_modules) ? current.allowed_modules : []);

    const runUpdate = async (includeAllowedModules: boolean) => {
      if (includeAllowedModules) {
        await sql`
          UPDATE users
          SET role = ${newRole}, employee_id = ${newEmployeeId}, is_active = ${newIsActive},
              allowed_modules = ${JSON.stringify(newAllowedModules)}::jsonb, updated_at = NOW()
          WHERE id = ${id}
        `;
      } else {
        await sql`
          UPDATE users
          SET role = ${newRole}, employee_id = ${newEmployeeId}, is_active = ${newIsActive}, updated_at = NOW()
          WHERE id = ${id}
        `;
      }
    };

    try {
      await runUpdate(true);
    } catch (e: any) {
      // Handle unique employee_id constraint
      if (e.code === "23505" && (e.constraint?.includes("employee") || e.detail?.includes("employee_id"))) {
        return res.status(409).json({ error: "This employee is already linked to another user account" });
      }
      // Self-heal: DB enum missing 'it' — add it and retry (no manual migration needed)
      if ((e.code === "22P02" || e.message?.includes("invalid input value for enum")) && newRole === "it") {
        try {
          await sql`ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'it'`;
          await runUpdate(true);
        } catch (retryE: any) {
          if (isMissingColumnError(retryE)) {
            await runUpdate(false);
          } else if (retryE.code === "23505" && (retryE.constraint?.includes("employee") || retryE.detail?.includes("employee_id"))) {
            return res.status(409).json({ error: "This employee is already linked to another user account" });
          } else {
            console.error("Add 'it' role / retry update error:", retryE);
            return res.status(500).json({
              error: "Database does not support the 'it' role yet. Run in SQL: ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'it';",
            });
          }
        }
      } else if (isMissingColumnError(e)) {
        try {
          await runUpdate(false);
        } catch (e2: any) {
          if (e2.code === "23505" && (e2.constraint?.includes("employee") || e2.detail?.includes("employee_id"))) {
            return res.status(409).json({ error: "This employee is already linked to another user account" });
          }
          throw e2;
        }
      } else {
        throw e;
      }
    }

    res.json({
      user: {
        id,
        email: current.email,
        role: newRole,
        employeeId: newEmployeeId,
        isActive: newIsActive === "true",
        allowedModules: newAllowedModules,
      },
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

/**
 * POST /api/auth/change-password
 * Change password for authenticated user
 */
router.post("/change-password", async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const token = req.cookies?.[COOKIE_NAME];

    if (!token) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        error: "Current and new password are required" 
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ 
        error: "New password must be at least 8 characters" 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

    // Get user with password hash
    const users = await sql`
      SELECT id, password_hash FROM users WHERE id = ${decoded.userId}
    `;

    if (users.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = users[0];

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update password
    await sql`
      UPDATE users 
      SET password_hash = ${newPasswordHash}, updated_at = NOW() 
      WHERE id = ${decoded.userId}
    `;

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: "Invalid token" });
    }
    console.error("Change password error:", error);
    res.status(500).json({ error: "Password change failed" });
  }
});

// ==================== Microsoft SSO Routes ====================

/**
 * GET /api/auth/microsoft/config
 * Returns whether SSO is configured (so frontend can show/hide the button)
 */
router.get("/microsoft/config", (req, res) => {
  res.json({
    enabled: MS_SSO_ENABLED,
    tenantId: MS_TENANT_ID,
  });
});

/**
 * GET /api/auth/microsoft/login
 * Redirects user to Microsoft login page (Authorization Code flow)
 */
router.get("/microsoft/login", (req, res) => {
  if (!MS_CLIENT_ID) {
    return res.status(501).json({ error: "Microsoft SSO is not configured" });
  }

  // Generate state parameter for CSRF protection
  const state = crypto.randomBytes(16).toString("hex");

  // Store state in a short-lived cookie so we can verify it in callback
  res.cookie("ms_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60 * 1000, // 10 minutes
    path: "/",
  });

  const params = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    response_type: "code",
    redirect_uri: MS_REDIRECT_URI,
    response_mode: "query",
    scope: MS_SCOPES,
    state,
    prompt: "select_account",
  });

  const authUrl = `${MS_AUTHORITY}/oauth2/v2.0/authorize?${params.toString()}`;
  res.redirect(authUrl);
});

/** Shared handler for Microsoft OAuth callback (supports both /microsoft/callback and /Microsoft/callback for Azure redirect URI case) */
async function handleMicrosoftCallback(req: Request, res: Response) {
  try {
    const { code, state, error, error_description } = req.query;

    // Handle errors from Microsoft
    if (error) {
      console.error("Microsoft SSO error:", error, error_description);
      return res.redirect(`/login?error=${encodeURIComponent(String(error_description || error))}`);
    }

    if (!code || typeof code !== "string") {
      return res.redirect("/login?error=No+authorization+code+received");
    }

    // Verify state parameter
    const savedState = req.cookies?.ms_oauth_state;
    if (!savedState || savedState !== state) {
      return res.redirect("/login?error=Invalid+state+parameter");
    }
    res.clearCookie("ms_oauth_state", { path: "/" });

    // Exchange authorization code for tokens
    const tokenResponse = await fetch(`${MS_AUTHORITY}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: MS_CLIENT_ID,
        client_secret: MS_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: MS_REDIRECT_URI,
        scope: MS_SCOPES,
      }),
    });

    if (!tokenResponse.ok) {
      const errBody = await tokenResponse.text();
      console.error("Token exchange failed:", errBody);
      return res.redirect("/login?error=Token+exchange+failed");
    }

    const tokens = await tokenResponse.json();
    const accessToken = tokens.access_token;

    if (!accessToken) {
      return res.redirect("/login?error=No+access+token+received");
    }

    // Fetch user profile from Microsoft Graph
    const profileResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!profileResponse.ok) {
      console.error("Graph API profile fetch failed:", await profileResponse.text());
      return res.redirect("/login?error=Failed+to+fetch+profile");
    }

    const msProfile = await profileResponse.json();
    const msEmail = (msProfile.mail || msProfile.userPrincipalName || "").toLowerCase().trim();
    const msFirstName = msProfile.givenName || "";
    const msLastName = msProfile.surname || "";
    const msDisplayName = msProfile.displayName || `${msFirstName} ${msLastName}`.trim();
    const msId = msProfile.id; // Microsoft Object ID

    if (!msEmail) {
      return res.redirect("/login?error=No+email+found+in+Microsoft+account");
    }

    // 1) Find user by login email (exact match, case already normalized)
    let users = await sql`
      SELECT id, email, role, employee_id, is_active
      FROM users
      WHERE LOWER(TRIM(email)) = ${msEmail}
    `;

    let user: any;

    if (users.length > 0) {
      // Existing user matched by email
      user = users[0];

      if (user.is_active !== "true") {
        return res.redirect("/login?error=Account+is+deactivated");
      }

      // Keep user email in sync with Microsoft and mark auth_provider
      try {
        await sql`
          UPDATE users SET email = ${msEmail}, auth_provider = 'microsoft', sso_provider = 'microsoft',
                           last_login_at = NOW(), updated_at = NOW() WHERE id = ${user.id}
        `;
      } catch {
        // auth_provider column may not exist yet (pre-migration)
        await sql`
          UPDATE users SET email = ${msEmail}, sso_provider = 'microsoft',
                           last_login_at = NOW(), updated_at = NOW() WHERE id = ${user.id}
        `;
      }
      user.email = msEmail;
    } else {
      // 2) No user with this email — match by employee work_email / personal_email (Microsoft SSO = work identity)
      const empMatch = await sql`
        SELECT id FROM employees
        WHERE LOWER(TRIM(work_email)) = ${msEmail}
           OR (personal_email IS NOT NULL AND LOWER(TRIM(personal_email)) = ${msEmail})
        LIMIT 1
      `;
      const employeeId = empMatch.length > 0 ? empMatch[0].id : null;

      if (employeeId) {
        // Check if a user already exists for this employee (e.g. old email on user record)
        const userByEmployee = await sql`
          SELECT id, email, role, employee_id, is_active
          FROM users
          WHERE employee_id = ${employeeId}
          LIMIT 1
        `;
        if (userByEmployee.length > 0) {
          // Sync user email to Microsoft/work email and use this user
          user = userByEmployee[0];
          if (user.is_active !== "true") {
            return res.redirect("/login?error=Account+is+deactivated");
          }
          try {
            await sql`
              UPDATE users SET email = ${msEmail}, auth_provider = 'microsoft', sso_provider = 'microsoft',
                               last_login_at = NOW(), updated_at = NOW() WHERE id = ${user.id}
            `;
          } catch {
            await sql`
              UPDATE users SET email = ${msEmail}, sso_provider = 'microsoft',
                               last_login_at = NOW(), updated_at = NOW() WHERE id = ${user.id}
            `;
          }
          user.email = msEmail;
          console.log(`Microsoft SSO: synced user email to work email for employee ${employeeId}`);
        } else {
          // Create new user linked to this employee
          let newUser: any[];
          try {
            newUser = await sql`
              INSERT INTO users (email, role, employee_id, is_active, auth_provider, sso_provider)
              VALUES (${msEmail}, 'employee', ${employeeId}, 'true', 'microsoft', 'microsoft')
              RETURNING id, email, role, employee_id, is_active
            `;
          } catch {
            newUser = await sql`
              INSERT INTO users (email, role, employee_id, is_active, sso_provider)
              VALUES (${msEmail}, 'employee', ${employeeId}, 'true', 'microsoft')
              RETURNING id, email, role, employee_id, is_active
            `;
          }
          user = newUser[0];
          console.log(`Microsoft SSO: created user for employee ${employeeId} (work email ${msEmail})`);
        }
      } else {
        // No matching employee — create user with no employee link (e.g. external or not yet in HRIS)
        let newUser: any[];
        try {
          newUser = await sql`
            INSERT INTO users (email, role, employee_id, is_active, auth_provider, sso_provider)
            VALUES (${msEmail}, 'employee', null, 'true', 'microsoft', 'microsoft')
            RETURNING id, email, role, employee_id, is_active
          `;
        } catch {
          newUser = await sql`
            INSERT INTO users (email, role, employee_id, is_active, sso_provider)
            VALUES (${msEmail}, 'employee', null, 'true', 'microsoft')
            RETURNING id, email, role, employee_id, is_active
          `;
        }
        user = newUser[0];
        console.log(`Microsoft SSO: created user ${msEmail} (no employee match)`);
      }
    }

    // Generate our JWT token
    const rolesArray = [user.role];
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      roles: rolesArray,
      employeeId: user.employee_id,
    };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // Set auth cookie
    res.cookie(COOKIE_NAME, token, getCookieOptions());

    // Redirect to dashboard
    res.redirect("/dashboard");
  } catch (error) {
    console.error("Microsoft SSO callback error:", error);
    res.redirect("/login?error=SSO+authentication+failed");
  }
}

// Register callback for both path casings (Azure redirect URI may use /Microsoft/callback)
router.get("/microsoft/callback", handleMicrosoftCallback);
router.get("/Microsoft/callback", handleMicrosoftCallback);

// Export JWT_SECRET and COOKIE_NAME for use in middleware
export { JWT_SECRET, COOKIE_NAME };
export default router;
