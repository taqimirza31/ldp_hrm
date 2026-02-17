import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, pgEnum, index, integer, decimal, uniqueIndex, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { employees } from "./employees";

// ==================== ENUMS ====================

export const stockCategoryEnum = pgEnum("stock_category", [
  "Hardware",
  "Components",
  "Storage",
  "Network",
  "Display",
  "Systems",
  "Peripherals",
  "Other"
]);

export const systemStatusEnum = pgEnum("system_status", [
  "assigned",
  "home",
  "repair",
  "available",
  "decommissioned"
]);

export const procurementStatusEnum = pgEnum("procurement_status", [
  "received",
  "pending",
  "partial",
  "cancelled"
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "pending",
  "paid",
  "overdue",
  "cancelled"
]);

export const ticketPriorityEnum = pgEnum("ticket_priority", [
  "low",
  "medium",
  "high",
  "critical"
]);

export const ticketStatusEnum = pgEnum("ticket_status", [
  "open",
  "in_progress",
  "resolved",
  "closed"
]);

// ==================== STOCK ITEMS TABLE ====================

export const stockItems = pgTable(
  "stock_items",
  {
    id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    category: stockCategoryEnum("category").notNull().default("Other"),
    productType: varchar("product_type", { length: 50 }), // Laptop, Desktop, Monitor, Keyboard, etc.
    quantity: integer("quantity").notNull().default(0),
    available: integer("available").notNull().default(0),
    faulty: integer("faulty").notNull().default(0),
    description: text("description"),
    minStock: integer("min_stock").notNull().default(5),
    location: text("location").default("IT Storage"),
    specs: jsonb("specs"), // Product-specific: { ram, storage, processor, size, resolution, etc. }
    
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    categoryIdx: index("stock_items_category_idx").on(table.category),
    nameIdx: index("stock_items_name_idx").on(table.name),
  })
);

// ==================== ASSIGNED SYSTEMS TABLE ====================

export const assignedSystems = pgTable(
  "assigned_systems",
  {
    id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
    assetId: varchar("asset_id", { length: 100 }).notNull(),
    
    // User assignment
    userId: varchar("user_id", { length: 255 }).references(() => employees.id, { onDelete: "set null" }),
    userName: text("user_name").notNull(),
    userEmail: varchar("user_email", { length: 255 }),
    
    // System specs
    ram: text("ram"),
    storage: text("storage"),
    processor: text("processor"),
    generation: text("generation"),
    
    // Status
    status: systemStatusEnum("status").notNull().default("assigned"),
    assignedDate: timestamp("assigned_date", { withTimezone: true }),
    notes: text("notes"),
    
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    assetIdUnique: uniqueIndex("assigned_systems_asset_id_unique").on(table.assetId),
    userIdIdx: index("assigned_systems_user_id_idx").on(table.userId),
    statusIdx: index("assigned_systems_status_idx").on(table.status),
  })
);

// ==================== PROCUREMENT ITEMS TABLE ====================

export const procurementItems = pgTable(
  "procurement_items",
  {
    id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
    itemName: text("item_name").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull().default("0"),
    totalPrice: decimal("total_price", { precision: 12, scale: 2 }).notNull().default("0"),
    vendor: text("vendor").notNull(),
    purchaseDate: timestamp("purchase_date", { withTimezone: true }).notNull(),
    status: procurementStatusEnum("status").notNull().default("pending"),
    assignedTo: text("assigned_to"),
    notes: text("notes"),
    
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    vendorIdx: index("procurement_items_vendor_idx").on(table.vendor),
    statusIdx: index("procurement_items_status_idx").on(table.status),
    purchaseDateIdx: index("procurement_items_purchase_date_idx").on(table.purchaseDate),
  })
);

// ==================== RECEIVED ITEMS TABLE ====================

export const receivedItems = pgTable(
  "received_items",
  {
    id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
    itemName: text("item_name").notNull(),
    quantity: integer("quantity").notNull().default(1),
    receivedDate: timestamp("received_date", { withTimezone: true }).notNull(),
    category: text("category"),
    notes: text("notes"),
    
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    categoryIdx: index("received_items_category_idx").on(table.category),
    receivedDateIdx: index("received_items_received_date_idx").on(table.receivedDate),
  })
);

// ==================== INVOICES TABLE ====================

export const invoices = pgTable(
  "invoices",
  {
    id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
    invoiceNumber: varchar("invoice_number", { length: 100 }).notNull(),
    vendor: text("vendor").notNull(),
    purchaseDate: timestamp("purchase_date", { withTimezone: true }).notNull(),
    totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    items: text("items").notNull(),
    
    // File storage
    fileName: text("file_name"),
    fileType: varchar("file_type", { length: 100 }),
    filePath: text("file_path"), // Path in file storage
    fileData: text("file_data"), // Base64 for smaller files, or reference to storage
    
    status: invoiceStatusEnum("status").notNull().default("pending"),
    notes: text("notes"),
    
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    invoiceNumberUnique: uniqueIndex("invoices_invoice_number_unique").on(table.invoiceNumber),
    vendorIdx: index("invoices_vendor_idx").on(table.vendor),
    statusIdx: index("invoices_status_idx").on(table.status),
    purchaseDateIdx: index("invoices_purchase_date_idx").on(table.purchaseDate),
  })
);

// ==================== SUPPORT TICKETS TABLE ====================

export const supportTickets = pgTable(
  "support_tickets",
  {
    id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
    ticketNumber: varchar("ticket_number", { length: 50 }).notNull(),
    
    // Asset reference
    assetId: varchar("asset_id", { length: 255 }).references(() => assignedSystems.id, { onDelete: "set null" }),
    assetName: text("asset_name"),
    
    // Ticket details
    title: text("title").notNull(),
    description: text("description").notNull(),
    priority: ticketPriorityEnum("priority").notNull().default("medium"),
    status: ticketStatusEnum("status").notNull().default("open"),
    
    // Created by
    createdById: varchar("created_by_id", { length: 255 }).references(() => employees.id, { onDelete: "set null" }),
    createdByName: text("created_by_name").notNull(),
    createdByEmail: varchar("created_by_email", { length: 255 }),
    createdByDepartment: text("created_by_department"),
    
    // Assigned to (IT admin)
    assignedToId: varchar("assigned_to_id", { length: 255 }).references(() => employees.id, { onDelete: "set null" }),
    assignedToName: text("assigned_to_name"),
    
    // Resolution
    resolution: text("resolution"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    
    // Optional attachment (e.g. screenshot, error log)
    attachmentUrl: text("attachment_url"),
    attachmentName: text("attachment_name"),
    
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    ticketNumberUnique: uniqueIndex("support_tickets_ticket_number_unique").on(table.ticketNumber),
    statusIdx: index("support_tickets_status_idx").on(table.status),
    priorityIdx: index("support_tickets_priority_idx").on(table.priority),
    createdByIdIdx: index("support_tickets_created_by_id_idx").on(table.createdById),
    assignedToIdIdx: index("support_tickets_assigned_to_id_idx").on(table.assignedToId),
  })
);

// ==================== TICKET COMMENTS TABLE ====================

export const ticketCommentAuthorRoleEnum = pgEnum("ticket_comment_author_role", [
  "employee",
  "it_support",
  "admin"
]);

export const ticketComments = pgTable(
  "ticket_comments",
  {
    id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
    
    // Link to ticket
    ticketId: varchar("ticket_id", { length: 255 }).notNull().references(() => supportTickets.id, { onDelete: "cascade" }),
    
    // Comment content
    message: text("message").notNull(),
    
    // Author info
    authorId: varchar("author_id", { length: 255 }).references(() => employees.id, { onDelete: "set null" }),
    authorName: text("author_name").notNull(),
    authorEmail: varchar("author_email", { length: 255 }),
    authorRole: ticketCommentAuthorRoleEnum("author_role").notNull().default("employee"),
    
    // For status change comments
    isStatusUpdate: text("is_status_update").default("false"),
    oldStatus: ticketStatusEnum("old_status"),
    newStatus: ticketStatusEnum("new_status"),
    
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    ticketIdIdx: index("ticket_comments_ticket_id_idx").on(table.ticketId),
    authorIdIdx: index("ticket_comments_author_id_idx").on(table.authorId),
    createdAtIdx: index("ticket_comments_created_at_idx").on(table.createdAt),
  })
);

// ==================== ASSET AUDIT LOG TABLE ====================

export const assetAuditLog = pgTable(
  "asset_audit_log",
  {
    id: varchar("id", { length: 255 }).primaryKey().default(sql`gen_random_uuid()`),
    
    // What was changed
    entityType: varchar("entity_type", { length: 50 }).notNull(), // 'stock', 'system', 'procurement', 'received', 'invoice', 'ticket'
    entityId: varchar("entity_id", { length: 255 }).notNull(),
    action: varchar("action", { length: 50 }).notNull(), // 'create', 'update', 'delete'
    
    // Change details
    changes: text("changes"), // JSON of old/new values
    
    // Who made the change
    userId: varchar("user_id", { length: 255 }),
    userEmail: varchar("user_email", { length: 255 }),
    
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    entityTypeIdx: index("asset_audit_log_entity_type_idx").on(table.entityType),
    entityIdIdx: index("asset_audit_log_entity_id_idx").on(table.entityId),
    userIdIdx: index("asset_audit_log_user_id_idx").on(table.userId),
    createdAtIdx: index("asset_audit_log_created_at_idx").on(table.createdAt),
  })
);

// ==================== RELATIONS ====================

export const assignedSystemsRelations = relations(assignedSystems, ({ one }) => ({
  user: one(employees, {
    fields: [assignedSystems.userId],
    references: [employees.id],
  }),
}));

export const supportTicketsRelations = relations(supportTickets, ({ one, many }) => ({
  asset: one(assignedSystems, {
    fields: [supportTickets.assetId],
    references: [assignedSystems.id],
  }),
  createdBy: one(employees, {
    fields: [supportTickets.createdById],
    references: [employees.id],
    relationName: "ticketCreator",
  }),
  assignedTo: one(employees, {
    fields: [supportTickets.assignedToId],
    references: [employees.id],
    relationName: "ticketAssignee",
  }),
  comments: many(ticketComments),
}));

export const ticketCommentsRelations = relations(ticketComments, ({ one }) => ({
  ticket: one(supportTickets, {
    fields: [ticketComments.ticketId],
    references: [supportTickets.id],
  }),
  author: one(employees, {
    fields: [ticketComments.authorId],
    references: [employees.id],
  }),
}));

// ==================== ZOD SCHEMAS ====================

export const insertStockItemSchema = createInsertSchema(stockItems, {
  name: z.string().min(1, "Name is required"),
  category: z.enum(["Hardware", "Components", "Storage", "Network", "Display", "Systems", "Peripherals", "Other"]).optional(),
  productType: z.string().optional().nullable(),
  quantity: z.coerce.number().int().min(0).optional(),
  available: z.coerce.number().int().min(0).optional(),
  faulty: z.coerce.number().int().min(0).optional(),
  description: z.string().optional().nullable(),
  minStock: z.coerce.number().int().min(0).optional(),
  location: z.string().optional().nullable(),
  specs: z.record(z.union([z.string(), z.number()])).optional().nullable(),
});

export const insertAssignedSystemSchema = createInsertSchema(assignedSystems, {
  assetId: z.string().min(1, "Asset ID is required"),
  userName: z.string().min(1, "User name is required"),
  userEmail: z.string().email().optional().nullable(),
  ram: z.string().optional().nullable(),
  storage: z.string().optional().nullable(),
  processor: z.string().optional().nullable(),
  generation: z.string().optional().nullable(),
  status: z.enum(["assigned", "home", "repair", "available", "decommissioned"]).optional(),
  assignedDate: z.coerce.date().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const insertProcurementItemSchema = createInsertSchema(procurementItems, {
  itemName: z.string().min(1, "Item name is required"),
  quantity: z.coerce.number().int().min(1).optional(),
  unitPrice: z.coerce.number().min(0).optional(),
  totalPrice: z.coerce.number().min(0).optional(),
  vendor: z.string().min(1, "Vendor is required"),
  purchaseDate: z.coerce.date(),
  status: z.enum(["received", "pending", "partial", "cancelled"]).optional(),
  assignedTo: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const insertReceivedItemSchema = createInsertSchema(receivedItems, {
  itemName: z.string().min(1, "Item name is required"),
  quantity: z.coerce.number().int().min(1).optional(),
  receivedDate: z.coerce.date(),
  category: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const insertInvoiceSchema = createInsertSchema(invoices, {
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  vendor: z.string().min(1, "Vendor is required"),
  purchaseDate: z.coerce.date(),
  totalAmount: z.coerce.number().min(0).optional(),
  items: z.string().min(1, "Items description is required"),
  fileName: z.string().optional().nullable(),
  fileType: z.string().optional().nullable(),
  filePath: z.string().optional().nullable(),
  fileData: z.string().optional().nullable(),
  status: z.enum(["pending", "paid", "overdue", "cancelled"]).optional(),
  notes: z.string().optional().nullable(),
});

export const insertSupportTicketSchema = createInsertSchema(supportTickets, {
  ticketNumber: z.string().min(1, "Ticket number is required"),
  assetId: z.string().optional().nullable(),
  assetName: z.string().optional().nullable(),
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
  createdByName: z.string().min(1, "Creator name is required"),
  createdByEmail: z.string().email().optional().nullable(),
  createdByDepartment: z.string().optional().nullable(),
  assignedToId: z.string().optional().nullable(),
  assignedToName: z.string().optional().nullable(),
  resolution: z.string().optional().nullable(),
  resolvedAt: z.coerce.date().optional().nullable(),
  attachmentUrl: z.string().optional().nullable(),
  attachmentName: z.string().optional().nullable(),
});

// ==================== TYPES ====================

export type StockItem = typeof stockItems.$inferSelect;
export type InsertStockItem = z.infer<typeof insertStockItemSchema>;

export type AssignedSystem = typeof assignedSystems.$inferSelect;
export type InsertAssignedSystem = z.infer<typeof insertAssignedSystemSchema>;

export type ProcurementItem = typeof procurementItems.$inferSelect;
export type InsertProcurementItem = z.infer<typeof insertProcurementItemSchema>;

export type ReceivedItem = typeof receivedItems.$inferSelect;
export type InsertReceivedItem = z.infer<typeof insertReceivedItemSchema>;

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;

export type SupportTicket = typeof supportTickets.$inferSelect;
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;

export const insertTicketCommentSchema = createInsertSchema(ticketComments, {
  ticketId: z.string().min(1, "Ticket ID is required"),
  message: z.string().min(1, "Message is required"),
  authorName: z.string().min(1, "Author name is required"),
  authorEmail: z.string().email().optional().nullable(),
  authorRole: z.enum(["employee", "it_support", "admin"]).optional(),
  isStatusUpdate: z.string().optional(),
  oldStatus: z.enum(["open", "in_progress", "resolved", "closed"]).optional().nullable(),
  newStatus: z.enum(["open", "in_progress", "resolved", "closed"]).optional().nullable(),
});

export type TicketComment = typeof ticketComments.$inferSelect;
export type InsertTicketComment = z.infer<typeof insertTicketCommentSchema>;

export type AssetAuditLog = typeof assetAuditLog.$inferSelect;
