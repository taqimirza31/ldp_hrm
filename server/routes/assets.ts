import { Router } from "express";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { requireAuth, requireRole } from "../middleware/auth";
import { 
  insertStockItemSchema, 
  insertAssignedSystemSchema, 
  insertProcurementItemSchema,
  insertReceivedItemSchema,
  insertInvoiceSchema,
  insertSupportTicketSchema,
  insertTicketCommentSchema
} from "../db/schema/assets";

config();
const sql = neon(process.env.DATABASE_URL!);
const router = Router();

// Helper to log audit
async function logAudit(
  entityType: string, 
  entityId: string, 
  action: string, 
  changes: any, 
  userId?: string, 
  userEmail?: string
) {
  try {
    await sql`
      INSERT INTO asset_audit_log (entity_type, entity_id, action, changes, user_id, user_email)
      VALUES (${entityType}, ${entityId}, ${action}, ${JSON.stringify(changes)}, ${userId || null}, ${userEmail || null})
    `;
  } catch (error) {
    console.error("Failed to log audit:", error);
  }
}

// Helper to generate ticket number
function generateTicketNumber() {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `TKT-${year}-${random}`;
}

// ==================== STOCK ITEMS ====================

/**
 * GET /api/assets/stock
 * List stock items with assignment info. Pagination: ?limit=&offset= (default 100, max 500).
 */
router.get("/stock", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const offset = parseInt(req.query.offset as string) || 0;
    const items = await sql`
      SELECT s.*,
        (SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id', a.id, 'asset_id', a.asset_id, 'user_id', a.user_id,
          'user_name', a.user_name, 'user_email', a.user_email,
          'assigned_date', a.assigned_date,
          'employee_id', e.employee_id, 'first_name', e.first_name, 'last_name', e.last_name
        )), '[]'::jsonb)
        FROM assigned_systems a
        LEFT JOIN employees e ON e.id = a.user_id
        WHERE a.asset_id = s.id OR a.asset_id LIKE s.id || '-%'
        ) as assignments
      FROM stock_items s
      ORDER BY s.name
      LIMIT ${limit} OFFSET ${offset}
    `;
    res.json(items);
  } catch (error) {
    console.error("Error fetching stock items:", error);
    res.status(500).json({ error: "Failed to fetch stock items" });
  }
});

/**
 * GET /api/assets/stock/:id
 * Get single stock item
 */
router.get("/stock/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const items = await sql`SELECT * FROM stock_items WHERE id = ${id}`;
    
    if (items.length === 0) {
      return res.status(404).json({ error: "Stock item not found" });
    }
    
    res.json(items[0]);
  } catch (error) {
    console.error("Error fetching stock item:", error);
    res.status(500).json({ error: "Failed to fetch stock item" });
  }
});

/**
 * POST /api/assets/stock
 * Create new stock item (Admin/HR only)
 */
router.post("/stock", requireAuth, requireRole(["admin", "hr", "it"]), async (req, res) => {
  try {
    const validated = insertStockItemSchema.parse(req.body);
    
    const result = await sql`
      INSERT INTO stock_items (name, category, product_type, quantity, available, faulty, description, min_stock, location, specs)
      VALUES (
        ${validated.name},
        ${validated.category || 'Other'},
        ${validated.productType || null},
        ${validated.quantity || 0},
        ${validated.available || 0},
        ${validated.faulty || 0},
        ${validated.description || null},
        ${validated.minStock || 5},
        ${validated.location || 'IT Storage'},
        ${validated.specs ? JSON.stringify(validated.specs) : null}
      )
      RETURNING *
    `;
    
    await logAudit("stock", result[0].id, "create", validated, req.user?.id, req.user?.email);
    res.status(201).json(result[0]);
  } catch (error: any) {
    console.error("Error creating stock item:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create stock item" });
  }
});

/**
 * PATCH /api/assets/stock/:id
 * Update stock item (Admin/HR only)
 */
router.patch("/stock/:id", requireAuth, requireRole(["admin", "hr", "it"]), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Get existing item
    const existing = await sql`SELECT * FROM stock_items WHERE id = ${id}`;
    if (existing.length === 0) {
      return res.status(404).json({ error: "Stock item not found" });
    }
    
    const result = await sql`
      UPDATE stock_items
      SET 
        name = COALESCE(${updates.name}, name),
        category = COALESCE(${updates.category}, category),
        product_type = COALESCE(${updates.productType}, product_type),
        quantity = COALESCE(${updates.quantity}, quantity),
        available = COALESCE(${updates.available}, available),
        faulty = COALESCE(${updates.faulty}, faulty),
        description = COALESCE(${updates.description}, description),
        min_stock = COALESCE(${updates.minStock}, min_stock),
        location = COALESCE(${updates.location}, location),
        specs = COALESCE(${updates.specs ? JSON.stringify(updates.specs) : null}, specs),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    
    await logAudit("stock", id, "update", { old: existing[0], new: result[0] }, req.user?.id, req.user?.email);
    res.json(result[0]);
  } catch (error) {
    console.error("Error updating stock item:", error);
    res.status(500).json({ error: "Failed to update stock item" });
  }
});

/**
 * DELETE /api/assets/stock/:id
 * Delete stock item (Admin only)
 */
router.delete("/stock/:id", requireAuth, requireRole(["admin", "it"]), async (req, res) => {
  try {
    const { id } = req.params;
    
    const existing = await sql`SELECT * FROM stock_items WHERE id = ${id}`;
    if (existing.length === 0) {
      return res.status(404).json({ error: "Stock item not found" });
    }
    
    await sql`DELETE FROM stock_items WHERE id = ${id}`;
    await logAudit("stock", id, "delete", existing[0], req.user?.id, req.user?.email);
    
    res.json({ message: "Stock item deleted" });
  } catch (error) {
    console.error("Error deleting stock item:", error);
    res.status(500).json({ error: "Failed to delete stock item" });
  }
});

// ==================== ASSIGNED SYSTEMS ====================

/**
 * GET /api/assets/systems
 * List all assigned systems (joined with employees + stock item name)
 */
router.get("/systems", requireAuth, async (req, res) => {
  try {
    const systems = await sql`
      SELECT a.*, e.employee_id, e.first_name, e.last_name, e.department,
        (SELECT s.name FROM stock_items s WHERE s.id = a.asset_id OR a.asset_id LIKE s.id || '-%' LIMIT 1) as asset_name,
        (SELECT s.category FROM stock_items s WHERE s.id = a.asset_id OR a.asset_id LIKE s.id || '-%' LIMIT 1) as asset_category
      FROM assigned_systems a
      LEFT JOIN employees e ON e.id = a.user_id
      ORDER BY a.user_name
    `;
    res.json(systems);
  } catch (error) {
    console.error("Error fetching systems:", error);
    res.status(500).json({ error: "Failed to fetch systems" });
  }
});

/**
 * GET /api/assets/systems/user/:userId
 * Get systems assigned to a specific user (joined with stock_items for asset details)
 */
router.get("/systems/user/:userId", requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const systems = await sql`
      SELECT a.*, e.employee_id, e.first_name, e.last_name,
        (SELECT s.name FROM stock_items s WHERE s.id = a.asset_id OR a.asset_id LIKE s.id || '-%' LIMIT 1) as asset_name,
        (SELECT s.category FROM stock_items s WHERE s.id = a.asset_id OR a.asset_id LIKE s.id || '-%' LIMIT 1) as asset_category
      FROM assigned_systems a
      LEFT JOIN employees e ON e.id = a.user_id
      WHERE a.user_id = ${userId}
      ORDER BY a.assigned_date DESC
    `;
    res.json(systems);
  } catch (error) {
    console.error("Error fetching user systems:", error);
    res.status(500).json({ error: "Failed to fetch user systems" });
  }
});

/**
 * GET /api/assets/systems/:id
 * Get single system (joined with employee + stock item name)
 */
router.get("/systems/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const systems = await sql`
      SELECT a.*, e.employee_id, e.first_name, e.last_name, e.department,
        (SELECT s.name FROM stock_items s WHERE s.id = a.asset_id OR a.asset_id LIKE s.id || '-%' LIMIT 1) as asset_name,
        (SELECT s.category FROM stock_items s WHERE s.id = a.asset_id OR a.asset_id LIKE s.id || '-%' LIMIT 1) as asset_category
      FROM assigned_systems a
      LEFT JOIN employees e ON e.id = a.user_id
      WHERE a.id = ${id}
    `;
    
    if (systems.length === 0) {
      return res.status(404).json({ error: "System not found" });
    }
    
    res.json(systems[0]);
  } catch (error) {
    console.error("Error fetching system:", error);
    res.status(500).json({ error: "Failed to fetch system" });
  }
});

/**
 * POST /api/assets/systems/assign-from-stock
 * Assign a stock item to an employee. Only available stock can be assigned.
 */
router.post("/systems/assign-from-stock", requireAuth, requireRole(["admin", "hr", "it"]), async (req, res) => {
  console.log("[assign-from-stock] Received request:", JSON.stringify(req.body));
  try {
    const { stockItemId, employeeId } = req.body;
    if (!stockItemId || !employeeId) {
      console.log("[assign-from-stock] Missing fields:", { stockItemId, employeeId });
      return res.status(400).json({ error: "stockItemId and employeeId are required" });
    }

    const stock = await sql`SELECT * FROM stock_items WHERE id = ${stockItemId}`;
    if (stock.length === 0) {
      return res.status(404).json({ error: "Stock item not found" });
    }
    if ((stock[0].available ?? 0) <= 0) {
      return res.status(400).json({ error: "No available units to assign" });
    }

    const emp = await sql`SELECT id, first_name, last_name, work_email, employee_id FROM employees WHERE id = ${employeeId}`;
    if (emp.length === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const e = emp[0];
    const assetId = `${stockItemId}-${Date.now()}`;
    const userName = `${e.first_name || ""} ${e.last_name || ""}`.trim() || "Unknown";

    const result = await sql`
      INSERT INTO assigned_systems (
        asset_id, user_id, user_name, user_email, ram, storage, processor,
        generation, status, assigned_date
      )
      VALUES (
        ${assetId},
        ${e.id},
        ${userName},
        ${e.work_email || null},
        ${stock[0].specs?.ram || null},
        ${stock[0].specs?.storage || null},
        ${stock[0].specs?.processor || null},
        ${stock[0].specs?.generation || null},
        'assigned',
        NOW()
      )
      RETURNING *
    `;

    await sql`
      UPDATE stock_items SET available = available - 1, updated_at = NOW()
      WHERE id = ${stockItemId}
    `;

    console.log("[assign-from-stock] SUCCESS: Created assignment", result[0].id, "for employee", employeeId);
    await logAudit("system", result[0].id, "create", { stockItemId, employeeId, assetId }, req.user?.id, req.user?.email);
    res.status(201).json(result[0]);
  } catch (error: any) {
    console.error("[assign-from-stock] ERROR:", error);
    if (error.code === "23505") {
      return res.status(400).json({ error: "Asset already assigned" });
    }
    res.status(500).json({ error: "Failed to assign" });
  }
});

/**
 * POST /api/assets/systems
 * Create/assign new system (Admin/HR only)
 */
router.post("/systems", requireAuth, requireRole(["admin", "hr", "it"]), async (req, res) => {
  try {
    const validated = insertAssignedSystemSchema.parse(req.body);
    
    const result = await sql`
      INSERT INTO assigned_systems (
        asset_id, user_id, user_name, user_email, ram, storage, processor, 
        generation, status, assigned_date, notes
      )
      VALUES (
        ${validated.assetId},
        ${validated.userId || null},
        ${validated.userName},
        ${validated.userEmail || null},
        ${validated.ram || null},
        ${validated.storage || null},
        ${validated.processor || null},
        ${validated.generation || null},
        ${validated.status || 'assigned'},
        ${validated.assignedDate || new Date()},
        ${validated.notes || null}
      )
      RETURNING *
    `;
    
    await logAudit("system", result[0].id, "create", validated, req.user?.id, req.user?.email);
    res.status(201).json(result[0]);
  } catch (error: any) {
    console.error("Error creating system:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    if (error.code === "23505") { // Unique violation
      return res.status(400).json({ error: "Asset ID already exists" });
    }
    res.status(500).json({ error: "Failed to create system" });
  }
});

/**
 * PATCH /api/assets/systems/:id
 * Update system (Admin/HR only)
 */
router.patch("/systems/:id", requireAuth, requireRole(["admin", "hr", "it"]), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const existing = await sql`SELECT * FROM assigned_systems WHERE id = ${id}`;
    if (existing.length === 0) {
      return res.status(404).json({ error: "System not found" });
    }
    
    const result = await sql`
      UPDATE assigned_systems
      SET 
        asset_id = COALESCE(${updates.assetId}, asset_id),
        user_id = COALESCE(${updates.userId}, user_id),
        user_name = COALESCE(${updates.userName}, user_name),
        user_email = COALESCE(${updates.userEmail}, user_email),
        ram = COALESCE(${updates.ram}, ram),
        storage = COALESCE(${updates.storage}, storage),
        processor = COALESCE(${updates.processor}, processor),
        generation = COALESCE(${updates.generation}, generation),
        status = COALESCE(${updates.status}, status),
        assigned_date = COALESCE(${updates.assignedDate}, assigned_date),
        notes = COALESCE(${updates.notes}, notes),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    
    await logAudit("system", id, "update", { old: existing[0], new: result[0] }, req.user?.id, req.user?.email);
    res.json(result[0]);
  } catch (error) {
    console.error("Error updating system:", error);
    res.status(500).json({ error: "Failed to update system" });
  }
});

/**
 * DELETE /api/assets/systems/:id
 * Delete system (Admin only). If asset was from stock, increment available.
 */
router.delete("/systems/:id", requireAuth, requireRole(["admin", "it"]), async (req, res) => {
  try {
    const { id } = req.params;
    
    const existing = await sql`SELECT * FROM assigned_systems WHERE id = ${id}`;
    if (existing.length === 0) {
      return res.status(404).json({ error: "System not found" });
    }
    
    const assetId = existing[0].asset_id;
    
    await sql`DELETE FROM assigned_systems WHERE id = ${id}`;
    
    const stock = await sql`
      SELECT id FROM stock_items 
      WHERE id = ${assetId} OR ${assetId} LIKE id || '-%'
      LIMIT 1
    `;
    if (stock.length > 0) {
      await sql`UPDATE stock_items SET available = available + 1, updated_at = NOW() WHERE id = ${stock[0].id}`;
    }
    
    await logAudit("system", id, "delete", existing[0], req.user?.id, req.user?.email);
    
    res.json({ message: "System deleted" });
  } catch (error) {
    console.error("Error deleting system:", error);
    res.status(500).json({ error: "Failed to delete system" });
  }
});

// ==================== PROCUREMENT ITEMS ====================

/**
 * GET /api/assets/procurement
 * List all procurement items
 */
router.get("/procurement", requireAuth, async (req, res) => {
  try {
    const items = await sql`
      SELECT * FROM procurement_items
      ORDER BY purchase_date DESC
    `;
    res.json(items);
  } catch (error) {
    console.error("Error fetching procurement items:", error);
    res.status(500).json({ error: "Failed to fetch procurement items" });
  }
});

/**
 * GET /api/assets/procurement/:id
 * Get single procurement item
 */
router.get("/procurement/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const items = await sql`SELECT * FROM procurement_items WHERE id = ${id}`;
    
    if (items.length === 0) {
      return res.status(404).json({ error: "Procurement item not found" });
    }
    
    res.json(items[0]);
  } catch (error) {
    console.error("Error fetching procurement item:", error);
    res.status(500).json({ error: "Failed to fetch procurement item" });
  }
});

/**
 * POST /api/assets/procurement
 * Create new procurement item (Admin/HR only)
 */
router.post("/procurement", requireAuth, requireRole(["admin", "hr", "it"]), async (req, res) => {
  try {
    const validated = insertProcurementItemSchema.parse(req.body);
    
    const result = await sql`
      INSERT INTO procurement_items (
        item_name, quantity, unit_price, total_price, vendor, 
        purchase_date, status, assigned_to, notes
      )
      VALUES (
        ${validated.itemName},
        ${validated.quantity || 1},
        ${validated.unitPrice || 0},
        ${validated.totalPrice || 0},
        ${validated.vendor},
        ${validated.purchaseDate},
        ${validated.status || 'pending'},
        ${validated.assignedTo || null},
        ${validated.notes || null}
      )
      RETURNING *
    `;
    
    await logAudit("procurement", result[0].id, "create", validated, req.user?.id, req.user?.email);
    res.status(201).json(result[0]);
  } catch (error: any) {
    console.error("Error creating procurement item:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create procurement item" });
  }
});

/**
 * PATCH /api/assets/procurement/:id
 * Update procurement item (Admin/HR only)
 */
router.patch("/procurement/:id", requireAuth, requireRole(["admin", "hr", "it"]), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const existing = await sql`SELECT * FROM procurement_items WHERE id = ${id}`;
    if (existing.length === 0) {
      return res.status(404).json({ error: "Procurement item not found" });
    }
    
    const result = await sql`
      UPDATE procurement_items
      SET 
        item_name = COALESCE(${updates.itemName}, item_name),
        quantity = COALESCE(${updates.quantity}, quantity),
        unit_price = COALESCE(${updates.unitPrice}, unit_price),
        total_price = COALESCE(${updates.totalPrice}, total_price),
        vendor = COALESCE(${updates.vendor}, vendor),
        purchase_date = COALESCE(${updates.purchaseDate}, purchase_date),
        status = COALESCE(${updates.status}, status),
        assigned_to = COALESCE(${updates.assignedTo}, assigned_to),
        notes = COALESCE(${updates.notes}, notes),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    
    await logAudit("procurement", id, "update", { old: existing[0], new: result[0] }, req.user?.id, req.user?.email);
    res.json(result[0]);
  } catch (error) {
    console.error("Error updating procurement item:", error);
    res.status(500).json({ error: "Failed to update procurement item" });
  }
});

/**
 * DELETE /api/assets/procurement/:id
 * Delete procurement item (Admin only)
 */
router.delete("/procurement/:id", requireAuth, requireRole(["admin", "it"]), async (req, res) => {
  try {
    const { id } = req.params;
    
    const existing = await sql`SELECT * FROM procurement_items WHERE id = ${id}`;
    if (existing.length === 0) {
      return res.status(404).json({ error: "Procurement item not found" });
    }
    
    await sql`DELETE FROM procurement_items WHERE id = ${id}`;
    await logAudit("procurement", id, "delete", existing[0], req.user?.id, req.user?.email);
    
    res.json({ message: "Procurement item deleted" });
  } catch (error) {
    console.error("Error deleting procurement item:", error);
    res.status(500).json({ error: "Failed to delete procurement item" });
  }
});

// ==================== RECEIVED ITEMS ====================

/**
 * GET /api/assets/received
 * List all received items
 */
router.get("/received", requireAuth, async (req, res) => {
  try {
    const items = await sql`
      SELECT * FROM received_items
      ORDER BY received_date DESC
    `;
    res.json(items);
  } catch (error) {
    console.error("Error fetching received items:", error);
    res.status(500).json({ error: "Failed to fetch received items" });
  }
});

/**
 * GET /api/assets/received/:id
 * Get single received item
 */
router.get("/received/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const items = await sql`SELECT * FROM received_items WHERE id = ${id}`;
    
    if (items.length === 0) {
      return res.status(404).json({ error: "Received item not found" });
    }
    
    res.json(items[0]);
  } catch (error) {
    console.error("Error fetching received item:", error);
    res.status(500).json({ error: "Failed to fetch received item" });
  }
});

/**
 * POST /api/assets/received
 * Create new received item (Admin/HR only)
 */
router.post("/received", requireAuth, requireRole(["admin", "hr", "it"]), async (req, res) => {
  try {
    const validated = insertReceivedItemSchema.parse(req.body);
    
    const result = await sql`
      INSERT INTO received_items (item_name, quantity, received_date, category, notes)
      VALUES (
        ${validated.itemName},
        ${validated.quantity || 1},
        ${validated.receivedDate},
        ${validated.category || null},
        ${validated.notes || null}
      )
      RETURNING *
    `;
    
    await logAudit("received", result[0].id, "create", validated, req.user?.id, req.user?.email);
    res.status(201).json(result[0]);
  } catch (error: any) {
    console.error("Error creating received item:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create received item" });
  }
});

/**
 * PATCH /api/assets/received/:id
 * Update received item (Admin/HR only)
 */
router.patch("/received/:id", requireAuth, requireRole(["admin", "hr", "it"]), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const existing = await sql`SELECT * FROM received_items WHERE id = ${id}`;
    if (existing.length === 0) {
      return res.status(404).json({ error: "Received item not found" });
    }
    
    const result = await sql`
      UPDATE received_items
      SET 
        item_name = COALESCE(${updates.itemName}, item_name),
        quantity = COALESCE(${updates.quantity}, quantity),
        received_date = COALESCE(${updates.receivedDate}, received_date),
        category = COALESCE(${updates.category}, category),
        notes = COALESCE(${updates.notes}, notes),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    
    await logAudit("received", id, "update", { old: existing[0], new: result[0] }, req.user?.id, req.user?.email);
    res.json(result[0]);
  } catch (error) {
    console.error("Error updating received item:", error);
    res.status(500).json({ error: "Failed to update received item" });
  }
});

/**
 * DELETE /api/assets/received/:id
 * Delete received item (Admin only)
 */
router.delete("/received/:id", requireAuth, requireRole(["admin", "it"]), async (req, res) => {
  try {
    const { id } = req.params;
    
    const existing = await sql`SELECT * FROM received_items WHERE id = ${id}`;
    if (existing.length === 0) {
      return res.status(404).json({ error: "Received item not found" });
    }
    
    await sql`DELETE FROM received_items WHERE id = ${id}`;
    await logAudit("received", id, "delete", existing[0], req.user?.id, req.user?.email);
    
    res.json({ message: "Received item deleted" });
  } catch (error) {
    console.error("Error deleting received item:", error);
    res.status(500).json({ error: "Failed to delete received item" });
  }
});

// ==================== INVOICES ====================

/**
 * GET /api/assets/invoices
 * List all invoices
 */
router.get("/invoices", requireAuth, async (req, res) => {
  try {
    const invoices = await sql`
      SELECT 
        id, invoice_number, vendor, purchase_date, total_amount, items,
        file_name, file_type, status, notes, created_at, updated_at
      FROM invoices
      ORDER BY purchase_date DESC
    `;
    res.json(invoices);
  } catch (error) {
    console.error("Error fetching invoices:", error);
    res.status(500).json({ error: "Failed to fetch invoices" });
  }
});

/**
 * GET /api/assets/invoices/:id
 * Get single invoice (with file data)
 */
router.get("/invoices/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const invoices = await sql`SELECT * FROM invoices WHERE id = ${id}`;
    
    if (invoices.length === 0) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    
    res.json(invoices[0]);
  } catch (error) {
    console.error("Error fetching invoice:", error);
    res.status(500).json({ error: "Failed to fetch invoice" });
  }
});

/**
 * GET /api/assets/invoices/:id/download
 * Serve invoice file. ?inline=1 → display in browser (View); otherwise → download (Download).
 */
router.get("/invoices/:id/download", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const inline = req.query.inline === "1" || req.query.inline === "true";
    const invoices = await sql`
      SELECT file_name, file_type, file_data FROM invoices WHERE id = ${id}
    `;
    
    if (invoices.length === 0) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    
    const invoice = invoices[0];
    if (!invoice.file_data) {
      return res.status(404).json({ error: "No file attached to this invoice" });
    }
    
    // File data is stored as base64 data URL
    const matches = (invoice.file_data as string).match(/^data:(.+);base64,(.+)$/);
    if (!matches) {
      return res.status(500).json({ error: "Invalid file format" });
    }
    
    const [, mimeType, base64Data] = matches;
    const buffer = Buffer.from(base64Data, 'base64');
    const disposition = inline ? "inline" : "attachment";
    
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `${disposition}; filename="${(invoice.file_name || "invoice").replace(/"/g, "%22")}"`,
      'Content-Length': buffer.length,
    });
    
    res.send(buffer);
  } catch (error) {
    console.error("Error downloading invoice:", error);
    res.status(500).json({ error: "Failed to download invoice" });
  }
});

/**
 * POST /api/assets/invoices
 * Create new invoice (Admin/HR only)
 */
router.post("/invoices", requireAuth, requireRole(["admin", "hr", "it"]), async (req, res) => {
  try {
    const validated = insertInvoiceSchema.parse(req.body);
    
    const result = await sql`
      INSERT INTO invoices (
        invoice_number, vendor, purchase_date, total_amount, items,
        file_name, file_type, file_path, file_data, status, notes
      )
      VALUES (
        ${validated.invoiceNumber},
        ${validated.vendor},
        ${validated.purchaseDate},
        ${validated.totalAmount || 0},
        ${validated.items},
        ${validated.fileName || null},
        ${validated.fileType || null},
        ${validated.filePath || null},
        ${validated.fileData || null},
        ${validated.status || 'pending'},
        ${validated.notes || null}
      )
      RETURNING id, invoice_number, vendor, purchase_date, total_amount, items, file_name, file_type, status, notes, created_at
    `;
    
    await logAudit("invoice", result[0].id, "create", { ...validated, fileData: validated.fileData ? "[FILE]" : null }, req.user?.id, req.user?.email);
    res.status(201).json(result[0]);
  } catch (error: any) {
    console.error("Error creating invoice:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    if (error.code === "23505") {
      return res.status(400).json({ error: "Invoice number already exists" });
    }
    res.status(500).json({ error: "Failed to create invoice" });
  }
});

/**
 * PATCH /api/assets/invoices/:id
 * Update invoice (Admin/HR only)
 */
router.patch("/invoices/:id", requireAuth, requireRole(["admin", "hr", "it"]), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const existing = await sql`SELECT * FROM invoices WHERE id = ${id}`;
    if (existing.length === 0) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    
    const result = await sql`
      UPDATE invoices
      SET 
        invoice_number = COALESCE(${updates.invoiceNumber}, invoice_number),
        vendor = COALESCE(${updates.vendor}, vendor),
        purchase_date = COALESCE(${updates.purchaseDate}, purchase_date),
        total_amount = COALESCE(${updates.totalAmount}, total_amount),
        items = COALESCE(${updates.items}, items),
        file_name = COALESCE(${updates.fileName}, file_name),
        file_type = COALESCE(${updates.fileType}, file_type),
        file_path = COALESCE(${updates.filePath}, file_path),
        file_data = COALESCE(${updates.fileData}, file_data),
        status = COALESCE(${updates.status}, status),
        notes = COALESCE(${updates.notes}, notes),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, invoice_number, vendor, purchase_date, total_amount, items, file_name, file_type, status, notes, created_at, updated_at
    `;
    
    await logAudit("invoice", id, "update", { old: { ...existing[0], file_data: "[FILE]" }, new: { ...result[0], file_data: "[FILE]" } }, req.user?.id, req.user?.email);
    res.json(result[0]);
  } catch (error) {
    console.error("Error updating invoice:", error);
    res.status(500).json({ error: "Failed to update invoice" });
  }
});

/**
 * DELETE /api/assets/invoices/:id
 * Delete invoice (Admin only)
 */
router.delete("/invoices/:id", requireAuth, requireRole(["admin", "it"]), async (req, res) => {
  try {
    const { id } = req.params;
    
    const existing = await sql`SELECT * FROM invoices WHERE id = ${id}`;
    if (existing.length === 0) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    
    await sql`DELETE FROM invoices WHERE id = ${id}`;
    await logAudit("invoice", id, "delete", { ...existing[0], file_data: "[FILE]" }, req.user?.id, req.user?.email);
    
    res.json({ message: "Invoice deleted" });
  } catch (error) {
    console.error("Error deleting invoice:", error);
    res.status(500).json({ error: "Failed to delete invoice" });
  }
});

// ==================== SUPPORT TICKETS ====================

/**
 * GET /api/assets/tickets
 * List all tickets (Admin/HR see all, others see their own)
 */
router.get("/tickets", requireAuth, async (req, res) => {
  try {
    const isAdminOrHR = ["admin", "hr"].includes(req.user!.role);
    
    let tickets;
    if (isAdminOrHR) {
      tickets = await sql`
        SELECT * FROM support_tickets
        ORDER BY 
          CASE priority 
            WHEN 'critical' THEN 1 
            WHEN 'high' THEN 2 
            WHEN 'medium' THEN 3 
            WHEN 'low' THEN 4 
          END,
          created_at DESC
      `;
    } else {
      tickets = await sql`
        SELECT * FROM support_tickets
        WHERE created_by_id = ${req.user!.employeeId}
        ORDER BY created_at DESC
      `;
    }
    
    res.json(tickets);
  } catch (error) {
    console.error("Error fetching tickets:", error);
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

/**
 * GET /api/assets/tickets/:id
 * Get single ticket
 */
router.get("/tickets/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const tickets = await sql`SELECT * FROM support_tickets WHERE id = ${id}`;
    
    if (tickets.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }
    
    // Non-admin can only view their own tickets
    const ticket = tickets[0];
    if (!["admin", "hr"].includes(req.user!.role) && ticket.created_by_id !== req.user!.employeeId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    res.json(ticket);
  } catch (error) {
    console.error("Error fetching ticket:", error);
    res.status(500).json({ error: "Failed to fetch ticket" });
  }
});

/**
 * POST /api/assets/tickets
 * Create new ticket (Any authenticated user)
 */
router.post("/tickets", requireAuth, async (req, res) => {
  try {
    const body = req.body;
    
    // Generate ticket number
    const ticketNumber = body.ticketNumber || generateTicketNumber();
    
    // Get employee details from database if available
    let createdByName = body.createdByName || req.user!.email;
    let createdByDepartment = body.createdByDepartment || null;
    
    if (req.user!.employeeId) {
      const employees = await sql`
        SELECT first_name, last_name, department FROM employees WHERE id = ${req.user!.employeeId}
      `;
      if (employees.length > 0) {
        createdByName = `${employees[0].first_name} ${employees[0].last_name}`;
        createdByDepartment = employees[0].department || createdByDepartment;
      }
    }
    
    const validated = insertSupportTicketSchema.parse({
      ...body,
      ticketNumber,
      createdById: req.user!.employeeId,
      createdByName,
      createdByEmail: req.user!.email,
      createdByDepartment,
    });
    
    const result = await sql`
      INSERT INTO support_tickets (
        ticket_number, asset_id, asset_name, title, description, priority, status,
        created_by_id, created_by_name, created_by_email, created_by_department,
        assigned_to_id, assigned_to_name, attachment_url, attachment_name
      )
      VALUES (
        ${validated.ticketNumber},
        ${validated.assetId || null},
        ${validated.assetName || null},
        ${validated.title},
        ${validated.description},
        ${validated.priority || 'medium'},
        ${validated.status || 'open'},
        ${validated.createdById || null},
        ${validated.createdByName},
        ${validated.createdByEmail || null},
        ${validated.createdByDepartment || null},
        ${validated.assignedToId || null},
        ${validated.assignedToName || null},
        ${validated.attachmentUrl ?? null},
        ${validated.attachmentName ?? null}
      )
      RETURNING *
    `;
    
    await logAudit("ticket", result[0].id, "create", validated, req.user?.id, req.user?.email);
    res.status(201).json(result[0]);
  } catch (error: any) {
    console.error("Error creating ticket:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create ticket" });
  }
});

/**
 * PATCH /api/assets/tickets/:id
 * Update ticket (Admin/HR can update all fields, users can only update their own ticket's description)
 */
router.patch("/tickets/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const existing = await sql`SELECT * FROM support_tickets WHERE id = ${id}`;
    if (existing.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }
    
    const ticket = existing[0];
    const isAdminOrHR = ["admin", "hr"].includes(req.user!.role);
    const isOwner = ticket.created_by_id === req.user!.employeeId;
    
    if (!isAdminOrHR && !isOwner) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    // Non-admin users can only update description
    if (!isAdminOrHR) {
      const result = await sql`
        UPDATE support_tickets
        SET 
          description = COALESCE(${updates.description}, description),
          updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `;
      return res.json(result[0]);
    }
    
    // Admin/HR can update all fields
    const result = await sql`
      UPDATE support_tickets
      SET 
        asset_id = COALESCE(${updates.assetId}, asset_id),
        asset_name = COALESCE(${updates.assetName}, asset_name),
        title = COALESCE(${updates.title}, title),
        description = COALESCE(${updates.description}, description),
        priority = COALESCE(${updates.priority}, priority),
        status = COALESCE(${updates.status}, status),
        assigned_to_id = COALESCE(${updates.assignedToId}, assigned_to_id),
        assigned_to_name = COALESCE(${updates.assignedToName}, assigned_to_name),
        resolution = COALESCE(${updates.resolution}, resolution),
        resolved_at = ${updates.status === 'resolved' || updates.status === 'closed' ? new Date() : null},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    
    await logAudit("ticket", id, "update", { old: existing[0], new: result[0] }, req.user?.id, req.user?.email);
    res.json(result[0]);
  } catch (error) {
    console.error("Error updating ticket:", error);
    res.status(500).json({ error: "Failed to update ticket" });
  }
});

/**
 * DELETE /api/assets/tickets/:id
 * Delete ticket (Admin only)
 */
router.delete("/tickets/:id", requireAuth, requireRole(["admin", "it"]), async (req, res) => {
  try {
    const { id } = req.params;
    
    const existing = await sql`SELECT * FROM support_tickets WHERE id = ${id}`;
    if (existing.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }
    
    await sql`DELETE FROM support_tickets WHERE id = ${id}`;
    await logAudit("ticket", id, "delete", existing[0], req.user?.id, req.user?.email);
    
    res.json({ message: "Ticket deleted" });
  } catch (error) {
    console.error("Error deleting ticket:", error);
    res.status(500).json({ error: "Failed to delete ticket" });
  }
});

// ==================== TICKET COMMENTS ====================

/**
 * GET /api/assets/tickets/:ticketId/comments
 * Get all comments for a ticket
 */
router.get("/tickets/:ticketId/comments", requireAuth, async (req, res) => {
  try {
    const { ticketId } = req.params;
    
    // Verify ticket exists and user has access
    const tickets = await sql`SELECT * FROM support_tickets WHERE id = ${ticketId}`;
    if (tickets.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }
    
    const ticket = tickets[0];
    const isAdminOrHR = ["admin", "hr"].includes(req.user!.role);
    const isOwner = ticket.created_by_id === req.user!.employeeId;
    
    if (!isAdminOrHR && !isOwner) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const comments = await sql`
      SELECT * FROM ticket_comments
      WHERE ticket_id = ${ticketId}
      ORDER BY created_at ASC
    `;
    
    res.json(comments);
  } catch (error) {
    console.error("Error fetching ticket comments:", error);
    res.status(500).json({ error: "Failed to fetch comments" });
  }
});

/**
 * POST /api/assets/tickets/:ticketId/comments
 * Add a comment to a ticket
 */
router.post("/tickets/:ticketId/comments", requireAuth, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const body = req.body;
    
    // Verify ticket exists and user has access
    const tickets = await sql`SELECT * FROM support_tickets WHERE id = ${ticketId}`;
    if (tickets.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }
    
    const ticket = tickets[0];
    const isAdminOrHR = ["admin", "hr"].includes(req.user!.role);
    const isOwner = ticket.created_by_id === req.user!.employeeId;
    
    if (!isAdminOrHR && !isOwner) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    // Determine author role
    const authorRole = isAdminOrHR ? "it_support" : "employee";
    
    // Get author name from employees table
    let authorName = body.authorName || req.user!.email;
    if (req.user!.employeeId) {
      const employees = await sql`SELECT first_name, last_name FROM employees WHERE id = ${req.user!.employeeId}`;
      if (employees.length > 0) {
        authorName = `${employees[0].first_name} ${employees[0].last_name}`;
      }
    }
    
    const validated = insertTicketCommentSchema.parse({
      ticketId,
      message: body.message,
      authorId: req.user!.employeeId,
      authorName,
      authorEmail: req.user!.email,
      authorRole,
      isStatusUpdate: body.isStatusUpdate || "false",
      oldStatus: body.oldStatus,
      newStatus: body.newStatus,
    });
    
    const result = await sql`
      INSERT INTO ticket_comments (
        ticket_id, message, author_id, author_name, author_email, author_role,
        is_status_update, old_status, new_status
      )
      VALUES (
        ${validated.ticketId},
        ${validated.message},
        ${validated.authorId || null},
        ${validated.authorName},
        ${validated.authorEmail || null},
        ${validated.authorRole || 'employee'},
        ${validated.isStatusUpdate || 'false'},
        ${validated.oldStatus || null},
        ${validated.newStatus || null}
      )
      RETURNING *
    `;
    
    // Update ticket's updatedAt timestamp
    await sql`UPDATE support_tickets SET updated_at = NOW() WHERE id = ${ticketId}`;
    
    // Log audit
    await logAudit("ticket_comment", result[0].id, "create", validated, req.user?.id, req.user?.email);
    
    res.status(201).json(result[0]);
  } catch (error: any) {
    console.error("Error creating comment:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create comment" });
  }
});

/**
 * PATCH /api/assets/tickets/:ticketId/status
 * Update ticket status (IT Admin only) - also creates a status change comment
 */
router.patch("/tickets/:ticketId/status", requireAuth, requireRole(["admin", "hr", "it"]), async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { status, comment } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: "Status is required" });
    }
    
    // Get current ticket
    const tickets = await sql`SELECT * FROM support_tickets WHERE id = ${ticketId}`;
    if (tickets.length === 0) {
      return res.status(404).json({ error: "Ticket not found" });
    }
    
    const ticket = tickets[0];
    const oldStatus = ticket.status;
    
    // Update ticket status
    const result = await sql`
      UPDATE support_tickets
      SET 
        status = ${status},
        resolved_at = ${status === 'resolved' || status === 'closed' ? new Date() : null},
        updated_at = NOW()
      WHERE id = ${ticketId}
      RETURNING *
    `;
    
    // Get admin name
    let authorName = req.user!.email;
    if (req.user!.employeeId) {
      const employees = await sql`SELECT first_name, last_name FROM employees WHERE id = ${req.user!.employeeId}`;
      if (employees.length > 0) {
        authorName = `${employees[0].first_name} ${employees[0].last_name}`;
      }
    }
    
    // Create status change comment
    const statusLabels: Record<string, string> = {
      open: "Open",
      in_progress: "In Progress",
      resolved: "Resolved",
      closed: "Closed"
    };
    
    const statusMessage = comment || `Status changed from ${statusLabels[oldStatus]} to ${statusLabels[status]}`;
    
    await sql`
      INSERT INTO ticket_comments (
        ticket_id, message, author_id, author_name, author_email, author_role,
        is_status_update, old_status, new_status
      )
      VALUES (
        ${ticketId},
        ${statusMessage},
        ${req.user!.employeeId || null},
        ${authorName},
        ${req.user!.email},
        'it_support',
        'true',
        ${oldStatus},
        ${status}
      )
    `;
    
    await logAudit("ticket", ticketId, "status_change", { oldStatus, newStatus: status }, req.user?.id, req.user?.email);
    
    res.json(result[0]);
  } catch (error) {
    console.error("Error updating ticket status:", error);
    res.status(500).json({ error: "Failed to update ticket status" });
  }
});

/**
 * GET /api/assets/my-tickets
 * Get tickets for the current logged-in user (employee view)
 */
router.get("/my-tickets", requireAuth, async (req, res) => {
  try {
    const tickets = await sql`
      SELECT * FROM support_tickets
      WHERE created_by_id = ${req.user!.employeeId}
      ORDER BY created_at DESC
    `;
    res.json(tickets);
  } catch (error) {
    console.error("Error fetching user tickets:", error);
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
});

/**
 * GET /api/assets/my-systems
 * Get systems assigned to the current logged-in user
 */
router.get("/my-systems", requireAuth, async (req, res) => {
  try {
    // First try to match by employee ID
    let systems = await sql`
      SELECT * FROM assigned_systems
      WHERE user_id = ${req.user!.employeeId}
      ORDER BY assigned_date DESC
    `;
    
    // If no results, try to match by email
    if (systems.length === 0 && req.user!.email) {
      systems = await sql`
        SELECT * FROM assigned_systems
        WHERE user_email = ${req.user!.email}
        ORDER BY assigned_date DESC
      `;
    }
    
    res.json(systems);
  } catch (error) {
    console.error("Error fetching user systems:", error);
    res.status(500).json({ error: "Failed to fetch systems" });
  }
});

// ==================== AUDIT LOG ====================

/**
 * GET /api/assets/audit
 * Get audit log (Admin only)
 */
router.get("/audit", requireAuth, requireRole(["admin", "it"]), async (req, res) => {
  try {
    const { entityType, entityId, limit = 100, offset = 0 } = req.query;
    
    let query;
    if (entityType && entityId) {
      query = sql`
        SELECT * FROM asset_audit_log
        WHERE entity_type = ${entityType} AND entity_id = ${entityId}
        ORDER BY created_at DESC
        LIMIT ${Number(limit)} OFFSET ${Number(offset)}
      `;
    } else if (entityType) {
      query = sql`
        SELECT * FROM asset_audit_log
        WHERE entity_type = ${entityType}
        ORDER BY created_at DESC
        LIMIT ${Number(limit)} OFFSET ${Number(offset)}
      `;
    } else {
      query = sql`
        SELECT * FROM asset_audit_log
        ORDER BY created_at DESC
        LIMIT ${Number(limit)} OFFSET ${Number(offset)}
      `;
    }
    
    const logs = await query;
    res.json(logs);
  } catch (error) {
    console.error("Error fetching audit log:", error);
    res.status(500).json({ error: "Failed to fetch audit log" });
  }
});

// ==================== DASHBOARD STATS ====================

/**
 * GET /api/assets/stats
 * Get asset management statistics
 */
router.get("/stats", requireAuth, async (req, res) => {
  try {
    const [stockStats] = await sql`
      SELECT 
        COUNT(*) as total_items,
        SUM(quantity) as total_quantity,
        SUM(available) as total_available,
        SUM(faulty) as total_faulty,
        COUNT(*) FILTER (WHERE available = 0) as out_of_stock,
        COUNT(*) FILTER (WHERE available < min_stock AND available > 0) as low_stock
      FROM stock_items
    `;
    
    const [systemStats] = await sql`
      SELECT 
        COUNT(*) as total_systems,
        COUNT(*) FILTER (WHERE status = 'assigned') as assigned,
        COUNT(*) FILTER (WHERE status = 'available') as available,
        COUNT(*) FILTER (WHERE status = 'repair') as in_repair,
        COUNT(*) FILTER (WHERE status = 'home') as at_home
      FROM assigned_systems
    `;
    
    const [procurementStats] = await sql`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'received') as received,
        COALESCE(SUM(total_price), 0) as total_spend
      FROM procurement_items
    `;
    
    const [invoiceStats] = await sql`
      SELECT 
        COUNT(*) as total_invoices,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'paid') as paid,
        COUNT(*) FILTER (WHERE status = 'overdue') as overdue,
        COALESCE(SUM(total_amount), 0) as total_value
      FROM invoices
    `;
    
    const [ticketStats] = await sql`
      SELECT 
        COUNT(*) as total_tickets,
        COUNT(*) FILTER (WHERE status = 'open') as open,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE status = 'resolved' OR status = 'closed') as resolved,
        COUNT(*) FILTER (WHERE priority = 'critical' AND status = 'open') as critical_open
      FROM support_tickets
    `;
    
    res.json({
      stock: stockStats,
      systems: systemStats,
      procurement: procurementStats,
      invoices: invoiceStats,
      tickets: ticketStats,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});

export default router;
