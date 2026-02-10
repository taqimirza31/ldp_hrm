import { Router } from "express";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

config();

const sql = neon(process.env.DATABASE_URL!);
const router = Router();

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN = "7d"; // Token expires in 7 days
const COOKIE_NAME = "auth_token";
const SALT_ROUNDS = 10;

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

    // Find user by email
    const users = await sql`
      SELECT id, email, password_hash, role, employee_id, is_active
      FROM users 
      WHERE email = ${email.toLowerCase().trim()}
    `;

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

    // Generate JWT token
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
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

    // Return user info (without sensitive data)
    res.json({
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        employeeId: user.employee_id,
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
      employeeId: string | null;
    };

    // Fetch fresh user data
    const users = await sql`
      SELECT u.id, u.email, u.role, u.employee_id,
             e.first_name, e.last_name, e.avatar
      FROM users u
      LEFT JOIN employees e ON u.employee_id = e.id
      WHERE u.id = ${decoded.userId} AND u.is_active = 'true'
    `;

    if (users.length === 0) {
      res.clearCookie(COOKIE_NAME);
      return res.status(401).json({ error: "User not found or inactive" });
    }

    const user = users[0];
    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      employeeId: user.employee_id,
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
 * Register a new user (Admin only - for creating users with passwords)
 * In production, this would be restricted or removed
 */
router.post("/register", async (req, res) => {
  try {
    const { email, password, role = "employee", employeeId } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ 
        error: "Email and password are required" 
      });
    }

    if (password.length < 8) {
      return res.status(400).json({ 
        error: "Password must be at least 8 characters" 
      });
    }

    // Check if user already exists
    const existingUsers = await sql`
      SELECT id FROM users WHERE email = ${email.toLowerCase().trim()}
    `;

    if (existingUsers.length > 0) {
      return res.status(409).json({ error: "Email already registered" });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user
    const result = await sql`
      INSERT INTO users (email, password_hash, role, employee_id)
      VALUES (${email.toLowerCase().trim()}, ${passwordHash}, ${role}, ${employeeId || null})
      RETURNING id, email, role, employee_id
    `;

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

// Export JWT_SECRET and COOKIE_NAME for use in middleware
export { JWT_SECRET, COOKIE_NAME };
export default router;
