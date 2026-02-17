import { sql } from "drizzle-orm";
import {
  pgTable, text, varchar, timestamp, pgEnum, index,
  integer, boolean, date, jsonb, decimal,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { employees } from "./employees";

// ==================== ENUMS ====================

export const leaveAccrualTypeEnum = pgEnum("leave_accrual_type", [
  "monthly",
  "yearly",
  "none",
]);

export const leaveRequestStatusEnum = pgEnum("leave_request_status", [
  "pending",
  "approved",
  "rejected",
  "cancelled",
]);

export const leaveDayTypeEnum = pgEnum("leave_day_type", [
  "full",
  "half",
]);

export const leaveApprovalStatusEnum = pgEnum("leave_approval_status", [
  "pending",
  "approved",
  "rejected",
]);

export const leaveApproverRoleEnum = pgEnum("leave_approver_role", [
  "manager",
  "hr",
  "admin",
]);

// ==================== LEAVE POLICIES TABLE ====================

/**
 * A policy defines who it applies to (by department and/or employment type).
 * Multiple policies can exist; assignment logic picks the best match.
 */
export const leavePolicies = pgTable(
  "leave_policies",
  {
    id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),

    name: text("name").notNull(),

    /** JSON array of department names this policy applies to. Empty = all departments. */
    applicableDepartments: jsonb("applicable_departments").notNull().default(sql`'[]'`),

    /** JSON array of employee types. Empty = all types. */
    applicableEmploymentTypes: jsonb("applicable_employment_types").notNull().default(sql`'[]'`),

    /** JSON array of user roles that can use this policy for leave. Empty = all roles (employee, manager, hr, admin). */
    applicableRoles: jsonb("applicable_roles").notNull().default(sql`'[]'`),

    effectiveFrom: date("effective_from").notNull(),
    effectiveTo: date("effective_to"), // null = no end

    isActive: boolean("is_active").notNull().default(true),

    createdBy: varchar("created_by", { length: 255 }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    activeIdx: index("leave_policies_active_idx").on(table.isActive),
  })
);

// ==================== LEAVE TYPES TABLE ====================

/**
 * Belongs to a leave_policy. Defines the rules for a specific leave category.
 * e.g. "Annual Leave", "Sick Leave", "WFH", "Unpaid Leave", etc.
 */
export const leaveTypes = pgTable(
  "leave_types",
  {
    id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),

    policyId: varchar("policy_id", { length: 255 })
      .notNull()
      .references(() => leavePolicies.id, { onDelete: "cascade" }),

    name: text("name").notNull(), // Annual, Sick, Casual, Unpaid, WFH, etc.
    paid: boolean("paid").notNull().default(true),

    accrualType: leaveAccrualTypeEnum("accrual_type").notNull().default("yearly"),
    /** Rate per accrual period. e.g. 1.75 per month = 21 per year. Null if accrual_type = none. */
    accrualRate: decimal("accrual_rate", { precision: 6, scale: 2 }),

    maxBalance: integer("max_balance").notNull().default(21),

    carryForwardAllowed: boolean("carry_forward_allowed").notNull().default(false),
    /** Max days carried forward. Null = unlimited. */
    maxCarryForward: integer("max_carry_forward"),

    requiresDocument: boolean("requires_document").notNull().default(false),
    requiresApproval: boolean("requires_approval").notNull().default(true),

    /**
     * JSON rules for auto-approval. Null = no auto-approve.
     * Example: { "maxDays": 1, "dayTypes": ["full","half"] }
     * If request matches, it auto-approves without manager step.
     */
    autoApproveRules: jsonb("auto_approve_rules"),

    /**
     * Whether HR approval is always required (in addition to manager).
     * Used for certain leave types or notice-period restrictions.
     */
    hrApprovalRequired: boolean("hr_approval_required").notNull().default(false),

    /** Min consecutive days for this leave type (e.g. 5 for annual). Null = no minimum. */
    minDays: integer("min_days"),
    /** Max consecutive days per request. Null = no max. */
    maxDaysPerRequest: integer("max_days_per_request"),

    /** Whether this leave type is blocked during notice period. */
    blockedDuringNotice: boolean("blocked_during_notice").notNull().default(false),

    color: varchar("color", { length: 20 }).default("#3b82f6"), // For calendar display

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    policyIdx: index("leave_types_policy_id_idx").on(table.policyId),
  })
);

// ==================== EMPLOYEE LEAVE BALANCES TABLE ====================

/**
 * Auto-generated per employee per leave type.
 * Balance is updated on accrual, leave approval, cancellation, and HR override.
 */
export const employeeLeaveBalances = pgTable(
  "employee_leave_balances",
  {
    id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),

    employeeId: varchar("employee_id", { length: 255 })
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),

    leaveTypeId: varchar("leave_type_id", { length: 255 })
      .notNull()
      .references(() => leaveTypes.id, { onDelete: "cascade" }),

    balance: decimal("balance", { precision: 6, scale: 2 }).notNull().default("0"),
    used: decimal("used", { precision: 6, scale: 2 }).notNull().default("0"),

    lastAccrualAt: timestamp("last_accrual_at", { withTimezone: true }),
    /** Set when year-end reset was last run for this balance (idempotency). */
    lastResetAt: timestamp("last_reset_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    employeeIdx: index("leave_balances_employee_id_idx").on(table.employeeId),
    leaveTypeIdx: index("leave_balances_leave_type_id_idx").on(table.leaveTypeId),
    uniqueBalance: index("leave_balances_unique_idx").on(table.employeeId, table.leaveTypeId),
  })
);

// ==================== LEAVE REQUESTS TABLE ====================

/**
 * Core transactional table. One row per leave request.
 * May span multiple days. Balance is deducted on approval, restored on cancellation.
 */
export const leaveRequests = pgTable(
  "leave_requests",
  {
    id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),

    employeeId: varchar("employee_id", { length: 255 })
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),

    leaveTypeId: varchar("leave_type_id", { length: 255 })
      .notNull()
      .references(() => leaveTypes.id, { onDelete: "cascade" }),

    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    dayType: leaveDayTypeEnum("day_type").notNull().default("full"),

    /** Calculated number of leave days (half = 0.5, full = 1.0 per day) */
    totalDays: decimal("total_days", { precision: 5, scale: 1 }).notNull(),

    reason: text("reason"),
    attachmentUrl: text("attachment_url"),

    status: leaveRequestStatusEnum("status").notNull().default("pending"),

    appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decidedBy: varchar("decided_by", { length: 255 }),
    rejectionReason: text("rejection_reason"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    employeeIdx: index("leave_requests_employee_id_idx").on(table.employeeId),
    statusIdx: index("leave_requests_status_idx").on(table.status),
    dateRangeIdx: index("leave_requests_date_range_idx").on(table.startDate, table.endDate),
  })
);

// ==================== LEAVE APPROVALS TABLE ====================

/**
 * Tracks the approval chain. One row per approver per request.
 * Manager first, then HR/admin if required.
 */
export const leaveApprovals = pgTable(
  "leave_approvals",
  {
    id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),

    leaveRequestId: varchar("leave_request_id", { length: 255 })
      .notNull()
      .references(() => leaveRequests.id, { onDelete: "cascade" }),

    approverId: varchar("approver_id", { length: 255 })
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),

    approverRole: leaveApproverRoleEnum("approver_role").notNull(),

    status: leaveApprovalStatusEnum("status").notNull().default("pending"),

    actionedAt: timestamp("actioned_at", { withTimezone: true }),
    remarks: text("remarks"),

    /** Order in the approval chain (1 = first, 2 = second, etc.) */
    stepOrder: integer("step_order").notNull().default(1),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    requestIdx: index("leave_approvals_request_id_idx").on(table.leaveRequestId),
    approverIdx: index("leave_approvals_approver_id_idx").on(table.approverId),
    statusIdx: index("leave_approvals_status_idx").on(table.status),
  })
);

// ==================== LEAVE AUDIT LOG ====================

/**
 * Append-only audit trail for leave operations:
 * policy changes, balance adjustments, request actions, approval actions.
 */
export const leaveAuditLog = pgTable(
  "leave_audit_log",
  {
    id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),

    entityType: varchar("entity_type", { length: 50 }).notNull(), // policy, type, balance, request, approval
    entityId: varchar("entity_id", { length: 255 }).notNull(),
    action: varchar("action", { length: 50 }).notNull(), // create, update, approve, reject, cancel, adjust, accrue
    performedBy: varchar("performed_by", { length: 255 }),

    metadata: jsonb("metadata"), // Context-specific details

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    entityTypeIdx: index("leave_audit_entity_type_idx").on(table.entityType),
    entityIdIdx: index("leave_audit_entity_id_idx").on(table.entityId),
    actionIdx: index("leave_audit_action_idx").on(table.action),
  })
);

// ==================== RELATIONS ====================

export const leavePoliciesRelations = relations(leavePolicies, ({ many }) => ({
  leaveTypes: many(leaveTypes),
}));

export const leaveTypesRelations = relations(leaveTypes, ({ one, many }) => ({
  policy: one(leavePolicies, {
    fields: [leaveTypes.policyId],
    references: [leavePolicies.id],
  }),
  balances: many(employeeLeaveBalances),
  requests: many(leaveRequests),
}));

export const employeeLeaveBalancesRelations = relations(employeeLeaveBalances, ({ one }) => ({
  employee: one(employees, {
    fields: [employeeLeaveBalances.employeeId],
    references: [employees.id],
  }),
  leaveType: one(leaveTypes, {
    fields: [employeeLeaveBalances.leaveTypeId],
    references: [leaveTypes.id],
  }),
}));

export const leaveRequestsRelations = relations(leaveRequests, ({ one, many }) => ({
  employee: one(employees, {
    fields: [leaveRequests.employeeId],
    references: [employees.id],
  }),
  leaveType: one(leaveTypes, {
    fields: [leaveRequests.leaveTypeId],
    references: [leaveTypes.id],
  }),
  approvals: many(leaveApprovals),
}));

export const leaveApprovalsRelations = relations(leaveApprovals, ({ one }) => ({
  request: one(leaveRequests, {
    fields: [leaveApprovals.leaveRequestId],
    references: [leaveRequests.id],
  }),
  approver: one(employees, {
    fields: [leaveApprovals.approverId],
    references: [employees.id],
  }),
}));

// ==================== ZOD SCHEMAS ====================

export const insertLeavePolicySchema = createInsertSchema(leavePolicies, {
  name: z.string().min(1, "Policy name is required"),
  applicableDepartments: z.any().optional(),
  applicableEmploymentTypes: z.any().optional(),
  applicableRoles: z.any().optional(),
  effectiveFrom: z.string().min(1, "Effective from date is required"),
  effectiveTo: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const insertLeaveTypeSchema = createInsertSchema(leaveTypes, {
  policyId: z.string().min(1),
  name: z.string().min(1, "Leave type name is required"),
  paid: z.boolean(),
  accrualType: z.enum(["monthly", "yearly", "none"]),
  accrualRate: z.coerce.number().optional().nullable(),
  maxBalance: z.coerce.number().int().min(0),
  carryForwardAllowed: z.boolean().optional(),
  maxCarryForward: z.coerce.number().int().optional().nullable(),
  requiresDocument: z.boolean().optional(),
  requiresApproval: z.boolean().optional(),
  autoApproveRules: z.any().optional().nullable(),
  hrApprovalRequired: z.boolean().optional(),
  minDays: z.coerce.number().int().optional().nullable(),
  maxDaysPerRequest: z.coerce.number().int().optional().nullable(),
  blockedDuringNotice: z.boolean().optional(),
  color: z.string().optional().nullable(),
});

export const insertLeaveRequestSchema = createInsertSchema(leaveRequests, {
  employeeId: z.string().min(1),
  leaveTypeId: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  dayType: z.enum(["full", "half"]),
  totalDays: z.coerce.number().min(0.5),
  reason: z.string().optional().nullable(),
  attachmentUrl: z.string().optional().nullable(),
});

// ==================== TYPES ====================

export type LeavePolicy = typeof leavePolicies.$inferSelect;
export type InsertLeavePolicy = z.infer<typeof insertLeavePolicySchema>;
export type LeaveType = typeof leaveTypes.$inferSelect;
export type InsertLeaveType = z.infer<typeof insertLeaveTypeSchema>;
export type EmployeeLeaveBalance = typeof employeeLeaveBalances.$inferSelect;
export type LeaveRequest = typeof leaveRequests.$inferSelect;
export type InsertLeaveRequest = z.infer<typeof insertLeaveRequestSchema>;
export type LeaveApproval = typeof leaveApprovals.$inferSelect;
export type LeaveAuditLog = typeof leaveAuditLog.$inferSelect;
