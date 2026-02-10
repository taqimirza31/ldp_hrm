import { Router } from "express";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { requireAuth, requireRole } from "../middleware/auth";

config();
const sql = neon(process.env.DATABASE_URL!);
const router = Router();

const COMPANY_WIDE_TASKS = [
  { task_name: "Company Microsoft Account", category: "Company-wide", sort_order: 0 },
  { task_name: "Laptop", category: "Company-wide", sort_order: 1 },
];

/**
 * GET /api/onboarding
 * List all onboarding records (Admin/HR only). Joins with employees for display.
 */
router.get("/", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const records = await sql`
      SELECT 
        r.id, r.employee_id, r.owner_id, r.status, r.completed_at, r.created_at, r.updated_at,
        e.first_name, e.last_name, e.work_email, e.job_title, e.department, e.join_date,
        (SELECT COUNT(*)::int FROM onboarding_tasks t WHERE t.onboarding_record_id = r.id) as task_count,
        (SELECT COUNT(*)::int FROM onboarding_tasks t WHERE t.onboarding_record_id = r.id AND t.completed = 'true') as completed_count
      FROM onboarding_records r
      INNER JOIN employees e ON e.id = r.employee_id
      ORDER BY r.status ASC, r.created_at DESC
    `;
    res.json(records);
  } catch (error) {
    console.error("Error fetching onboarding records:", error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: "Failed to fetch onboarding records" });
  }
});

/**
 * GET /api/onboarding/employee/:employeeId
 * Get onboarding record for an employee (if any)
 */
router.get("/employee/:employeeId", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const { employeeId } = req.params;
    const records = await sql`
      SELECT r.*, 
        (SELECT COUNT(*)::int FROM onboarding_tasks t WHERE t.onboarding_record_id = r.id) as task_count,
        (SELECT COUNT(*)::int FROM onboarding_tasks t WHERE t.onboarding_record_id = r.id AND t.completed = 'true') as completed_count
      FROM onboarding_records r
      WHERE r.employee_id = ${employeeId}
      ORDER BY r.created_at DESC
      LIMIT 1
    `;
    if (records.length === 0) {
      return res.status(404).json({ error: "No onboarding record for this employee" });
    }
    res.json(records[0]);
  } catch (error) {
    console.error("Error fetching onboarding by employee:", error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: "Failed to fetch onboarding" });
  }
});

/**
 * GET /api/onboarding/:id
 * Get single onboarding record with tasks
 */
router.get("/:id", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const { id } = req.params;
    const records = await sql`
      SELECT r.*, e.first_name, e.last_name, e.work_email, e.job_title, e.department, e.join_date
      FROM onboarding_records r
      INNER JOIN employees e ON e.id = r.employee_id
      WHERE r.id = ${id}
    `;
    if (records.length === 0) {
      return res.status(404).json({ error: "Onboarding record not found" });
    }

    const tasks = await sql`
      SELECT * FROM onboarding_tasks 
      WHERE onboarding_record_id = ${id} 
      ORDER BY sort_order ASC, created_at ASC
    `;

    const rec = records[0];
    res.json({
      ...rec,
      hire_name: `${rec.first_name} ${rec.last_name}`,
      hire_role: rec.job_title,
      hire_department: rec.department,
      hire_email: rec.work_email,
      start_date: rec.join_date,
      tasks,
    });
  } catch (error) {
    console.error("Error fetching onboarding record:", error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: "Failed to fetch onboarding record" });
  }
});

/**
 * POST /api/onboarding
 * Create onboarding record for an existing employee. Requires employee_id.
 * HR triggers this from Employee Profile "Start Onboarding".
 */
router.post("/", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const employeeId = req.body.employeeId ?? req.body.employee_id;
    if (!employeeId) {
      return res.status(400).json({ error: "employee_id is required. Onboarding can only start for an existing employee." });
    }

    const empCheck = await sql`SELECT id FROM employees WHERE id = ${employeeId}`;
    if (empCheck.length === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const existing = await sql`SELECT id, status FROM onboarding_records WHERE employee_id = ${employeeId}`;
    if (existing.length > 0) {
      const rec = existing[0];
      if (rec.status === "in_progress") {
        return res.status(400).json({ error: "Employee already has an active onboarding record" });
      }
      return res.status(400).json({ error: "Onboarding cannot be restarted once completed" });
    }

    const recordResult = await sql`
      INSERT INTO onboarding_records (employee_id, owner_id, status)
      VALUES (${employeeId}, ${req.user!.id}, 'in_progress')
      RETURNING *
    `;
    const record = recordResult[0];
    const recordId = record.id;

    for (let i = 0; i < COMPANY_WIDE_TASKS.length; i++) {
      const t = COMPANY_WIDE_TASKS[i];
      await sql`
        INSERT INTO onboarding_tasks (onboarding_record_id, task_name, category, sort_order)
        VALUES (${recordId}, ${t.task_name}, ${t.category}, ${t.sort_order})
      `;
    }

    const tasks = await sql`
      SELECT * FROM onboarding_tasks WHERE onboarding_record_id = ${recordId}
      ORDER BY sort_order ASC, created_at ASC
    `;

    const emp = await sql`SELECT first_name, last_name, job_title, department, work_email, join_date FROM employees WHERE id = ${employeeId}`;
    const e = emp[0];

    res.status(201).json({
      ...record,
      hire_name: `${e.first_name} ${e.last_name}`,
      hire_role: e.job_title,
      hire_department: e.department,
      hire_email: e.work_email,
      start_date: e.join_date,
      tasks,
    });
  } catch (error: unknown) {
    console.error("Error creating onboarding record:", error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: "Failed to create onboarding record" });
  }
});

/**
 * PATCH /api/onboarding/:id
 * Update onboarding record (e.g. complete onboarding)
 */
router.patch("/:id", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const existing = await sql`SELECT * FROM onboarding_records WHERE id = ${id}`;
    if (existing.length === 0) {
      return res.status(404).json({ error: "Onboarding record not found" });
    }

    const rec = existing[0];
    const status = updates.status ?? rec.status;
    const completedAt = updates.completedAt ?? updates.completed_at ?? rec.completed_at;

    await sql`
      UPDATE onboarding_records 
      SET status = ${status}, completed_at = ${completedAt}, updated_at = NOW()
      WHERE id = ${id}
    `;

    if (status === "completed" && rec.employee_id) {
      await sql`
        UPDATE employees SET employment_status = 'active', updated_at = NOW()
        WHERE id = ${rec.employee_id}
      `;
    }

    const updated = await sql`SELECT * FROM onboarding_records WHERE id = ${id}`;
    res.json(updated[0]);
  } catch (error: unknown) {
    console.error("Error updating onboarding record:", error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: "Failed to update onboarding record" });
  }
});

/**
 * DELETE /api/onboarding/:id
 */
router.delete("/:id", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await sql`SELECT id FROM onboarding_records WHERE id = ${id}`;
    if (existing.length === 0) {
      return res.status(404).json({ error: "Onboarding record not found" });
    }
    await sql`DELETE FROM onboarding_tasks WHERE onboarding_record_id = ${id}`;
    await sql`DELETE FROM onboarding_records WHERE id = ${id}`;
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting onboarding record:", error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: "Failed to delete onboarding record" });
  }
});

/**
 * POST /api/onboarding/:id/tasks
 * Add task (additional items only; company-wide are fixed)
 */
router.post("/:id/tasks", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const { id } = req.params;
    const taskName = req.body.taskName ?? req.body.task_name;
    if (!taskName?.trim()) {
      return res.status(400).json({ error: "taskName is required" });
    }

    const maxOrder = await sql`
      SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order 
      FROM onboarding_tasks WHERE onboarding_record_id = ${id}
    `;
    const sortOrder = maxOrder[0]?.next_order ?? 0;

    const result = await sql`
      INSERT INTO onboarding_tasks (onboarding_record_id, task_name, category, sort_order)
      VALUES (${id}, ${taskName.trim()}, 'Additional Assigned Items', ${sortOrder})
      RETURNING *
    `;
    res.status(201).json(result[0]);
  } catch (error: unknown) {
    console.error("Error adding onboarding task:", error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: "Failed to add task" });
  }
});

/**
 * PATCH /api/onboarding/:id/tasks/:taskId
 * Update task: assignment_details and/or completed.
 * Rule: Task can be marked completed ONLY when assignment_details is present.
 */
router.patch("/:id/tasks/:taskId", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const { id, taskId } = req.params;
    const { completed, assignmentDetails } = req.body;

    const existing = await sql`
      SELECT * FROM onboarding_tasks 
      WHERE id = ${taskId} AND onboarding_record_id = ${id}
    `;
    if (existing.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    const t = existing[0];
    const newDetails = assignmentDetails !== undefined ? assignmentDetails : t.assignment_details;
    let newCompleted = t.completed;

    if (completed !== undefined) {
      if (completed === true && !newDetails?.trim()) {
        return res.status(400).json({ error: "Save assignment details before marking task complete" });
      }
      newCompleted = completed ? "true" : "false";
    }

    const result = await sql`
      UPDATE onboarding_tasks
      SET 
        completed = ${newCompleted},
        assignment_details = COALESCE(${newDetails ?? t.assignment_details}, assignment_details),
        completed_at = CASE WHEN ${newCompleted} = 'true' THEN NOW() ELSE NULL END,
        updated_at = NOW()
      WHERE id = ${taskId} AND onboarding_record_id = ${id}
      RETURNING *
    `;
    res.json(result[0]);
  } catch (error) {
    console.error("Error updating onboarding task:", error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: "Failed to update task" });
  }
});

/**
 * DELETE /api/onboarding/:id/tasks/:taskId
 * Only additional items; company-wide tasks cannot be deleted
 */
router.delete("/:id/tasks/:taskId", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const { id, taskId } = req.params;
    const existing = await sql`
      SELECT * FROM onboarding_tasks 
      WHERE id = ${taskId} AND onboarding_record_id = ${id}
    `;
    if (existing.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }
    if (existing[0].category === "Company-wide") {
      return res.status(400).json({ error: "Cannot delete company-wide tasks" });
    }
    await sql`DELETE FROM onboarding_tasks WHERE id = ${taskId} AND onboarding_record_id = ${id}`;
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting onboarding task:", error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: "Failed to delete task" });
  }
});

export default router;
