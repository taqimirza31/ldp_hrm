import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, pgEnum, uniqueIndex, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { employees } from "./employees";

// ==================== ROLE CONSTANTS ====================

/** All valid roles in the system */
export const ALL_ROLES = ["admin", "hr", "manager", "employee", "it"] as const;
export type SystemRole = (typeof ALL_ROLES)[number];

// Enum for user roles
export const userRoleEnum = pgEnum("user_role", [
  "admin",      // Full system access
  "hr",         // HR operations, approve changes
  "manager",    // View team, approve leave
  "employee",   // Self-service only
  "it",         // IT operations, asset management, support
]);

// Auth provider enum
export const authProviderEnum = pgEnum("auth_provider", [
  "local",      // Email + password
  "microsoft",  // Microsoft SSO
]);

export const users = pgTable(
  "users",
  {
    id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
    
    // Auth fields
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: text("password_hash"), // Null for SSO users
    authProvider: authProviderEnum("auth_provider").notNull().default("local"),
    
    // Profile link
    employeeId: varchar("employee_id", { length: 255 }), // Links to employees table
    
    // Role & permissions
    role: userRoleEnum("role").notNull().default("employee"),
    /** Additional roles (e.g. ["manager","hr"]). When empty, only primary role applies. */
    roles: jsonb("roles").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    /** Module keys this user can access (e.g. ["dashboard","recruitment","leave"]). Empty = use role-based access. */
    allowedModules: jsonb("allowed_modules").$type<string[]>().notNull().default(sql`'[]'::jsonb`),

    // SSO fields
    ssoProvider: varchar("sso_provider", { length: 50 }), // 'microsoft', 'google', etc.
    ssoId: varchar("sso_id", { length: 255 }), // External ID from SSO provider
    
    // Status
    isActive: text("is_active").notNull().default("true"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    
    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailUnique: uniqueIndex("users_email_unique").on(table.email),
    /** Enforce each employee links to at most one user */
    employeeUnique: uniqueIndex("users_employee_id_unique")
      .on(table.employeeId)
      .where(sql`employee_id IS NOT NULL`),
  })
);

// Relations
export const usersRelations = relations(users, ({ one }) => ({
  employee: one(employees, {
    fields: [users.employeeId],
    references: [employees.id],
  }),
}));

// Zod schemas
export const insertUserSchema = createInsertSchema(users, {
  email: z.string().email(),
  role: z.enum(ALL_ROLES).optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
