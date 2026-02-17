import { Router } from "express";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { requireAuth, requireRole } from "../middleware/auth";

config();
const sql = neon(process.env.DATABASE_URL!);
const router = Router();

// Define which fields belong to which category
const FIELD_CATEGORIES: Record<string, string[]> = {
  personal_details: ["dob", "gender", "marital_status", "blood_group"],
  address: ["street", "city", "state", "country", "zip_code", "comm_street", "comm_city", "comm_state", "comm_country", "comm_zip_code"],
  contact: ["personal_email", "work_phone"],
  dependents: ["dependents_data"], // JSON field
  emergency_contacts: ["emergency_contacts_data"], // JSON field
  bank_details: ["bank_name", "account_number", "routing_number"], // Future fields
};

// Fields that employees can request changes to (self-service)
const EMPLOYEE_EDITABLE_FIELDS = [
  ...FIELD_CATEGORIES.personal_details,
  ...FIELD_CATEGORIES.address,
  ...FIELD_CATEGORIES.contact,
  ...FIELD_CATEGORIES.dependents,
  ...FIELD_CATEGORIES.emergency_contacts,
];

/**
 * GET /api/change-requests
 * List change requests (Admin/HR sees all, Employee sees their own). Pagination: ?limit=&offset= (default limit 100, max 500).
 */
router.get("/", requireAuth, async (req, res) => {
  try {
    const { status, employeeId } = req.query;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const offset = parseInt(req.query.offset as string) || 0;
    const isAdminOrHR = ["admin", "hr"].includes(req.user!.role);

    let requests: any[];

    if (isAdminOrHR && employeeId && typeof employeeId === "string") {
      if (status && typeof status === "string") {
        requests = await sql`
          SELECT cr.*,
            e.first_name || ' ' || e.last_name as employee_name,
            e.employee_id as employee_code,
            u.email as requester_email
          FROM change_requests cr
          JOIN employees e ON cr.employee_id = e.id
          JOIN users u ON cr.requester_id = u.id
          WHERE cr.employee_id = ${employeeId} AND cr.status = ${status}
          ORDER BY cr.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
      } else {
        requests = await sql`
          SELECT cr.*,
            e.first_name || ' ' || e.last_name as employee_name,
            e.employee_id as employee_code,
            u.email as requester_email
          FROM change_requests cr
          JOIN employees e ON cr.employee_id = e.id
          JOIN users u ON cr.requester_id = u.id
          WHERE cr.employee_id = ${employeeId}
          ORDER BY cr.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
      }
    } else if (isAdminOrHR && status && typeof status === "string") {
      requests = await sql`
        SELECT cr.*,
          e.first_name || ' ' || e.last_name as employee_name,
          e.employee_id as employee_code,
          u.email as requester_email
        FROM change_requests cr
        JOIN employees e ON cr.employee_id = e.id
        JOIN users u ON cr.requester_id = u.id
        WHERE cr.status = ${status}
        ORDER BY cr.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (isAdminOrHR) {
      requests = await sql`
        SELECT cr.*,
          e.first_name || ' ' || e.last_name as employee_name,
          e.employee_id as employee_code,
          u.email as requester_email
        FROM change_requests cr
        JOIN employees e ON cr.employee_id = e.id
        JOIN users u ON cr.requester_id = u.id
        ORDER BY cr.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      requests = await sql`
        SELECT cr.*,
          e.first_name || ' ' || e.last_name as employee_name,
          e.employee_id as employee_code,
          u.email as requester_email
        FROM change_requests cr
        JOIN employees e ON cr.employee_id = e.id
        JOIN users u ON cr.requester_id = u.id
        WHERE cr.requester_id = ${req.user!.id}
        ORDER BY cr.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }

    res.json(requests);
  } catch (error) {
    console.error("Error fetching change requests:", error);
    res.status(500).json({ error: "Failed to fetch change requests" });
  }
});

/**
 * GET /api/change-requests/pending/count
 * Get count of pending requests (for admin dashboard)
 */
router.get("/pending/count", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const result = await sql`
      SELECT COUNT(*)::int as count FROM change_requests WHERE status = 'pending'
    `;
    res.json({ count: result[0].count });
  } catch (error) {
    console.error("Error counting pending requests:", error);
    res.status(500).json({ error: "Failed to count pending requests" });
  }
});

/**
 * POST /api/employees/:employeeId/change-requests
 * Employee submits a change request for their own profile
 */
router.post("/employees/:employeeId/change-requests", requireAuth, async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { fieldName, newValue, category } = req.body;

    // Verify employee can only request changes for themselves
    if (req.user!.employeeId !== employeeId && !["admin", "hr"].includes(req.user!.role)) {
      return res.status(403).json({ error: "You can only request changes for your own profile" });
    }

    // Validate field is editable by employee
    const snakeFieldName = fieldName.replace(/([A-Z])/g, "_$1").toLowerCase();
    if (!EMPLOYEE_EDITABLE_FIELDS.includes(snakeFieldName)) {
      return res.status(400).json({ 
        error: "This field cannot be changed via self-service",
        field: fieldName,
        hint: "Contact HR for changes to this field"
      });
    }

    // Determine category if not provided
    let fieldCategory = category;
    if (!fieldCategory) {
      for (const [cat, fields] of Object.entries(FIELD_CATEGORIES)) {
        if (fields.includes(snakeFieldName)) {
          fieldCategory = cat;
          break;
        }
      }
    }

    // Get current value
    const employee = await sql`
      SELECT * FROM employees WHERE id = ${employeeId}
    `;
    
    if (employee.length === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const oldValue = employee[0][snakeFieldName] || null;

    // Create change request
    const result = await sql`
      INSERT INTO change_requests (
        requester_id, employee_id, category, field_name, old_value, new_value
      )
      VALUES (
        ${req.user!.id}, ${employeeId}, ${fieldCategory}, ${snakeFieldName}, 
        ${oldValue?.toString() || null}, ${newValue}
      )
      RETURNING *
    `;

    res.status(201).json({
      message: "Change request submitted successfully",
      request: result[0],
      note: "Your request has been sent to HR for approval"
    });
  } catch (error) {
    console.error("Error creating change request:", error);
    res.status(500).json({ error: "Failed to submit change request" });
  }
});

/**
 * POST /api/employees/:employeeId/change-requests/bulk
 * Submit multiple field changes at once (e.g., entire address)
 */
router.post("/employees/:employeeId/change-requests/bulk", requireAuth, async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { category, changes } = req.body; // changes = { field1: newVal1, field2: newVal2 }

    if (req.user!.employeeId !== employeeId && !["admin", "hr"].includes(req.user!.role)) {
      return res.status(403).json({ error: "You can only request changes for your own profile" });
    }

    // Get current employee data
    const employee = await sql`SELECT * FROM employees WHERE id = ${employeeId}`;
    if (employee.length === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    // Create individual requests for each field
    const createdRequests = [];
    for (const [fieldName, newValue] of Object.entries(changes)) {
      const snakeFieldName = fieldName.replace(/([A-Z])/g, "_$1").toLowerCase();
      
      if (!EMPLOYEE_EDITABLE_FIELDS.includes(snakeFieldName)) {
        continue; // Skip non-editable fields
      }

      const oldValue = employee[0][snakeFieldName] || null;
      
      const result = await sql`
        INSERT INTO change_requests (
          requester_id, employee_id, category, field_name, old_value, new_value
        )
        VALUES (
          ${req.user!.id}, ${employeeId}, ${category}, ${snakeFieldName}, 
          ${oldValue?.toString() || null}, ${newValue as string}
        )
        RETURNING *
      `;
      createdRequests.push(result[0]);
    }

    res.status(201).json({
      message: `${createdRequests.length} change request(s) submitted`,
      requests: createdRequests,
      note: "Your requests have been sent to HR for approval"
    });
  } catch (error) {
    console.error("Error creating bulk change requests:", error);
    res.status(500).json({ error: "Failed to submit change requests" });
  }
});

/**
 * PATCH /api/change-requests/:id/approve
 * Admin/HR approves a change request and applies it
 */
router.patch("/:id/approve", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewNotes } = req.body;

    // Get the change request
    const requests = await sql`
      SELECT * FROM change_requests WHERE id = ${id} AND status = 'pending'
    `;

    if (requests.length === 0) {
      return res.status(404).json({ error: "Pending change request not found" });
    }

    const request = requests[0];

    // Apply the change to employee record
    const fieldName = request.field_name;
    const newValue = request.new_value;
    
    await sql.query(
      `UPDATE employees SET ${fieldName} = $1, updated_at = NOW() WHERE id = $2`,
      [newValue, request.employee_id]
    );

    // Update change request status
    const result = await sql`
      UPDATE change_requests 
      SET 
        status = 'approved',
        reviewed_by = ${req.user!.id},
        reviewed_at = NOW(),
        review_notes = ${reviewNotes || null},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    res.json({
      message: "Change request approved and applied",
      request: result[0]
    });
  } catch (error) {
    console.error("Error approving change request:", error);
    res.status(500).json({ error: "Failed to approve change request" });
  }
});

/**
 * PATCH /api/change-requests/:id/reject
 * Admin/HR rejects a change request
 */
router.patch("/:id/reject", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewNotes } = req.body;

    if (!reviewNotes) {
      return res.status(400).json({ error: "Rejection reason is required" });
    }

    const result = await sql`
      UPDATE change_requests 
      SET 
        status = 'rejected',
        reviewed_by = ${req.user!.id},
        reviewed_at = NOW(),
        review_notes = ${reviewNotes},
        updated_at = NOW()
      WHERE id = ${id} AND status = 'pending'
      RETURNING *
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: "Pending change request not found" });
    }

    res.json({
      message: "Change request rejected",
      request: result[0]
    });
  } catch (error) {
    console.error("Error rejecting change request:", error);
    res.status(500).json({ error: "Failed to reject change request" });
  }
});

/**
 * PATCH /api/change-requests/bulk/approve
 * Approve multiple change requests at once
 */
router.patch("/bulk/approve", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const { requestIds, reviewNotes } = req.body;

    if (!Array.isArray(requestIds) || requestIds.length === 0) {
      return res.status(400).json({ error: "requestIds array is required" });
    }

    const approved = [];
    const failed = [];

    for (const id of requestIds) {
      try {
        const requests = await sql`
          SELECT * FROM change_requests WHERE id = ${id} AND status = 'pending'
        `;

        if (requests.length === 0) {
          failed.push({ id, reason: "Not found or already processed" });
          continue;
        }

        const request = requests[0];

        // Apply change
        await sql.query(
          `UPDATE employees SET ${request.field_name} = $1, updated_at = NOW() WHERE id = $2`,
          [request.new_value, request.employee_id]
        );

        // Update status
        await sql`
          UPDATE change_requests 
          SET status = 'approved', reviewed_by = ${req.user!.id}, reviewed_at = NOW(), 
              review_notes = ${reviewNotes || null}, updated_at = NOW()
          WHERE id = ${id}
        `;

        approved.push(id);
      } catch (err) {
        failed.push({ id, reason: "Processing error" });
      }
    }

    res.json({
      message: `${approved.length} approved, ${failed.length} failed`,
      approved,
      failed
    });
  } catch (error) {
    console.error("Error bulk approving:", error);
    res.status(500).json({ error: "Failed to process bulk approval" });
  }
});

export default router;
