import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, pgEnum, index, integer, decimal, uniqueIndex, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { employees } from "./employees";
import { users } from "./users";

// ==================== ENUMS ====================

export const jobPostingStatusEnum = pgEnum("job_posting_status", [
  "draft",
  "published",
  "paused",
  "closed",
  "archived",
]);

export const applicationStageEnum = pgEnum("application_stage", [
  "applied",
  "longlisted",
  "screening",
  "shortlisted",
  "assessment",
  "interview",
  "offer",
  "tentative",
  "hired",
  "rejected",
]);

export const offerStatusEnum = pgEnum("offer_status", [
  "draft",
  "sent",
  "accepted",
  "rejected",
  "withdrawn",
]);

// ==================== CANDIDATES TABLE ====================

export const candidates = pgTable(
  "candidates",
  {
    id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),

    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 50 }),
    linkedinUrl: text("linkedin_url"),

    currentCompany: text("current_company"),
    currentTitle: text("current_title"),
    experienceYears: integer("experience_years"),

    currentSalary: decimal("current_salary"),
    expectedSalary: decimal("expected_salary"),
    salaryCurrency: varchar("salary_currency", { length: 10 }),

    resumeUrl: text("resume_url").notNull(), // stored file path or base64 data URL
    resumeFilename: text("resume_filename"),

    source: text("source"), // "career_page", "linkedin", "referral", etc.
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailUnique: uniqueIndex("candidates_email_unique").on(table.email),
    nameIdx: index("candidates_name_idx").on(table.firstName, table.lastName),
  })
);

// ==================== JOB POSTINGS TABLE ====================

export const jobPostings = pgTable(
  "job_postings",
  {
    id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),

    title: text("title").notNull(),
    department: text("department").notNull(),
    location: text("location"),
    employmentType: varchar("employment_type", { length: 30 }), // full_time, part_time, contract, intern

    description: text("description"),
    requirements: text("requirements"),

    salaryRangeMin: decimal("salary_range_min"),
    salaryRangeMax: decimal("salary_range_max"),
    salaryCurrency: varchar("salary_currency", { length: 10 }),

    headcount: integer("headcount").notNull().default(1),

    // Legacy single hiring manager — kept for backward compat
    hiringManagerId: varchar("hiring_manager_id", { length: 255 }).references(() => employees.id, { onDelete: "set null" }),

    /**
     * Multiple hiring managers stored as JSON array of employee IDs.
     * e.g. ["uuid-1", "uuid-2"]
     * When populated, this takes precedence over hiringManagerId.
     */
    hiringManagerIds: jsonb("hiring_manager_ids"),

    status: jobPostingStatusEnum("status").notNull().default("draft"),
    publishedChannels: jsonb("published_channels"), // e.g. ["career_page","linkedin","indeed"]

    publishedAt: timestamp("published_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    statusIdx: index("job_postings_status_idx").on(table.status),
    departmentIdx: index("job_postings_department_idx").on(table.department),
  })
);

// ==================== APPLICATIONS TABLE ====================

export const applications = pgTable(
  "applications",
  {
    id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),

    candidateId: varchar("candidate_id", { length: 255 })
      .notNull()
      .references(() => candidates.id, { onDelete: "cascade" }),

    jobId: varchar("job_id", { length: 255 })
      .notNull()
      .references(() => jobPostings.id, { onDelete: "cascade" }),

    stage: applicationStageEnum("stage").notNull().default("applied"),
    stageUpdatedAt: timestamp("stage_updated_at", { withTimezone: true }),

    appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),

    coverLetter: text("cover_letter"),
    referralSource: text("referral_source"),
    rejectReason: text("reject_reason"),

    // Set after hire conversion
    employeeId: varchar("employee_id", { length: 255 }).references(() => employees.id, { onDelete: "set null" }),
    convertedAt: timestamp("converted_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    candidateJobUnique: uniqueIndex("applications_candidate_job_unique").on(table.candidateId, table.jobId),
    candidateIdx: index("applications_candidate_id_idx").on(table.candidateId),
    jobIdx: index("applications_job_id_idx").on(table.jobId),
    stageIdx: index("applications_stage_idx").on(table.stage),
  })
);

// ==================== APPLICATION STAGE HISTORY TABLE ====================
// Append-only audit trail. On every stage change: INSERT only. Never UPDATE or DELETE.

export const applicationStageHistory = pgTable(
  "application_stage_history",
  {
    id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),

    applicationId: varchar("application_id", { length: 255 })
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),

    fromStage: text("from_stage"), // null for initial "applied"
    toStage: text("to_stage").notNull(),

    notes: text("notes"),
    movedBy: varchar("moved_by", { length: 255 }).references(() => users.id, { onDelete: "set null" }),

    // Legacy text field for display
    interviewerNames: text("interviewer_names"),
    /**
     * Array of employee IDs for interviewers.
     * Stored as JSON array: ["uuid-1", "uuid-2"]
     * Replaces text-only interviewer_names for proper linkage.
     */
    interviewerIds: jsonb("interviewer_ids"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    applicationIdx: index("stage_history_application_id_idx").on(table.applicationId),
  })
);

// ==================== OFFERS TABLE ====================

export const offers = pgTable(
  "offers",
  {
    id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),

    applicationId: varchar("application_id", { length: 255 })
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),

    salary: decimal("salary").notNull(),
    salaryCurrency: varchar("salary_currency", { length: 10 }),

    jobTitle: text("job_title").notNull(),
    department: text("department"),
    startDate: timestamp("start_date", { withTimezone: true }),
    employmentType: varchar("employment_type", { length: 30 }),

    terms: text("terms"),

    status: offerStatusEnum("status").notNull().default("draft"),

    sentAt: timestamp("sent_at", { withTimezone: true }),
    respondedAt: timestamp("responded_at", { withTimezone: true }),

    esignStatus: text("esign_status"), // "pending", "signed", "not_required"

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    applicationUnique: uniqueIndex("offers_application_id_unique").on(table.applicationId),
    statusIdx: index("offers_status_idx").on(table.status),
  })
);

// ==================== RELATIONS ====================

export const candidatesRelations = relations(candidates, ({ many }) => ({
  applications: many(applications),
}));

export const jobPostingsRelations = relations(jobPostings, ({ one, many }) => ({
  hiringManager: one(employees, {
    fields: [jobPostings.hiringManagerId],
    references: [employees.id],
  }),
  applications: many(applications),
}));

export const applicationsRelations = relations(applications, ({ one, many }) => ({
  candidate: one(candidates, {
    fields: [applications.candidateId],
    references: [candidates.id],
  }),
  job: one(jobPostings, {
    fields: [applications.jobId],
    references: [jobPostings.id],
  }),
  employee: one(employees, {
    fields: [applications.employeeId],
    references: [employees.id],
  }),
  stageHistory: many(applicationStageHistory),
}));

export const applicationStageHistoryRelations = relations(applicationStageHistory, ({ one }) => ({
  application: one(applications, {
    fields: [applicationStageHistory.applicationId],
    references: [applications.id],
  }),
  movedByUser: one(users, {
    fields: [applicationStageHistory.movedBy],
    references: [users.id],
  }),
}));

export const offersRelations = relations(offers, ({ one }) => ({
  application: one(applications, {
    fields: [offers.applicationId],
    references: [applications.id],
  }),
}));

// ==================== ZOD SCHEMAS ====================

export const insertCandidateSchema = createInsertSchema(candidates, {
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional().nullable(),
  linkedinUrl: z.string().optional().nullable(),
  currentCompany: z.string().optional().nullable(),
  currentTitle: z.string().optional().nullable(),
  experienceYears: z.coerce.number().int().optional().nullable(),
  currentSalary: z.coerce.number().optional().nullable(),
  expectedSalary: z.coerce.number().optional().nullable(),
  salaryCurrency: z.string().optional().nullable(),
  resumeUrl: z.string().min(1, "Resume is required"),
  resumeFilename: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const insertJobPostingSchema = createInsertSchema(jobPostings, {
  title: z.string().min(1, "Title is required"),
  department: z.string().min(1, "Department is required"),
  location: z.string().optional().nullable(),
  employmentType: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  requirements: z.string().optional().nullable(),
  salaryRangeMin: z.coerce.number().optional().nullable(),
  salaryRangeMax: z.coerce.number().optional().nullable(),
  salaryCurrency: z.string().optional().nullable(),
  headcount: z.coerce.number().int().optional(),
  hiringManagerId: z.string().optional().nullable(),
  hiringManagerIds: z.any().optional().nullable(),
  status: z.enum(["draft", "published", "paused", "closed", "archived"]).optional(),
  publishedChannels: z.any().optional().nullable(),
  publishedAt: z.coerce.date().optional().nullable(),
  closedAt: z.coerce.date().optional().nullable(),
});

export const insertApplicationSchema = createInsertSchema(applications, {
  candidateId: z.string().min(1),
  jobId: z.string().min(1),
  stage: z.enum(["applied", "longlisted", "screening", "shortlisted", "assessment", "interview", "offer", "tentative", "hired", "rejected"]).optional(),
  coverLetter: z.string().optional().nullable(),
  referralSource: z.string().optional().nullable(),
});

export const insertOfferSchema = createInsertSchema(offers, {
  applicationId: z.string().min(1),
  salary: z.coerce.number().min(0, "Salary is required"),
  salaryCurrency: z.string().optional().nullable(),
  jobTitle: z.string().min(1, "Job title is required"),
  department: z.string().optional().nullable(),
  startDate: z.coerce.date().optional().nullable(),
  employmentType: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  status: z.enum(["draft", "sent", "accepted", "rejected", "withdrawn"]).optional(),
  esignStatus: z.string().optional().nullable(),
});

// ==================== TYPES ====================

export type Candidate = typeof candidates.$inferSelect;
export type InsertCandidate = z.infer<typeof insertCandidateSchema>;
export type JobPosting = typeof jobPostings.$inferSelect;
export type InsertJobPosting = z.infer<typeof insertJobPostingSchema>;
export type Application = typeof applications.$inferSelect;
export type InsertApplication = z.infer<typeof insertApplicationSchema>;
export type ApplicationStageHistory = typeof applicationStageHistory.$inferSelect;
export type Offer = typeof offers.$inferSelect;
export type InsertOffer = z.infer<typeof insertOfferSchema>;
