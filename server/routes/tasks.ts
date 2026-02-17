import { Router } from "express";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { requireAuth, requireRole } from "../middleware/auth";
import { insertTaskSchema, insertTaskCommentSchema } from "../db/schema/tasks";

config();
const sql = neon(process.env.DATABASE_URL!);
const router = Router();

// ==================== HELPERS ====================

/** Resolve employee name from ID */
async function resolveEmployeeName(employeeId: string): Promise<string> {
  const rows = await sql`SELECT first_name, last_name FROM employees WHERE id = ${employeeId}`;
  if (rows.length === 0) return "Unknown";
  return `${rows[0].first_name} ${rows[0].last_name}`;
}

/** Resolve user display name (from linked employee or email) */
async function resolveUserName(userId: string): Promise<string> {
  const rows = await sql`
    SELECT u.email, e.first_name, e.last_name
    FROM users u LEFT JOIN employees e ON u.employee_id = e.id
    WHERE u.id = ${userId}
  `;
  if (rows.length === 0) return "Unknown";
  const u = rows[0];
  if (u.first_name && u.last_name) return `${u.first_name} ${u.last_name}`;
  return u.email as string;
}

/**
 * Determine which tasks a user can see:
 * - admin / hr: all tasks
 * - manager: tasks they created, assigned to them, assigned to their team, or they are watching
 * - employee / it: tasks they created, assigned to them, or they are watching
 */
function buildVisibilityClause(user: { id: string; role: string; employeeId: string | null }): { clause: string; params: any[] } {
  if (user.role === "admin" || user.role === "hr") {
    return { clause: "", params: [] };
  }
  // Manager, employee, it — see own tasks + tasks assigned to them + tasks they watch
  const conditions: string[] = [];
  const params: any[] = [];

  // Created by this user
  params.push(user.id);
  conditions.push(`t.created_by = $${params.length}`);

  // Assigned to this user's employee ID
  if (user.employeeId) {
    params.push(user.employeeId);
    conditions.push(`t.assignee_id = $${params.length}`);
  }

  // Watching
  if (user.employeeId) {
    params.push(user.employeeId);
    conditions.push(`t.watcher_ids @> to_jsonb($${params.length}::text)`);
  }

  // Manager: also see tasks assigned to their direct reports
  if (user.role === "manager" && user.employeeId) {
    params.push(user.employeeId);
    conditions.push(`t.assignee_id IN (SELECT id FROM employees WHERE manager_id = $${params.length})`);
  }

  return { clause: `WHERE (${conditions.join(" OR ")})`, params };
}

// ==================== ROUTES ====================

/**
 * GET /api/tasks
 * List tasks visible to the current user. Supports filters via query params.
 */
router.get("/", requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const { status, priority, category, assigneeId, search } = req.query;

    const { clause: visClause, params: visParams } = buildVisibilityClause({
      id: user.id,
      role: user.role,
      employeeId: user.employeeId,
    });

    let filterClauses: string[] = [];
    const params = [...visParams];

    if (status && status !== "all") {
      params.push(status);
      filterClauses.push(`t.status = $${params.length}`);
    }
    if (priority && priority !== "all") {
      params.push(priority);
      filterClauses.push(`t.priority = $${params.length}`);
    }
    if (category && category !== "all") {
      params.push(category);
      filterClauses.push(`t.category = $${params.length}`);
    }
    if (assigneeId) {
      params.push(assigneeId);
      filterClauses.push(`t.assignee_id = $${params.length}`);
    }
    if (search) {
      params.push(`%${(search as string).toLowerCase()}%`);
      filterClauses.push(`(LOWER(t.title) LIKE $${params.length} OR LOWER(t.description) LIKE $${params.length})`);
    }

    let whereClause = visClause;
    if (filterClauses.length > 0) {
      if (whereClause) {
        // Wrap visibility and filters with AND
        whereClause = whereClause.replace("WHERE", "WHERE (") + `) AND ${filterClauses.join(" AND ")}`;
      } else {
        whereClause = `WHERE ${filterClauses.join(" AND ")}`;
      }
    }

    // Pagination with sensible defaults
    const limit = Math.min(parseInt(req.query.limit as string) || 200, 500);
    const offset = parseInt(req.query.offset as string) || 0;
    params.push(limit, offset);

    const query = `
      SELECT t.id, t.title, t.description, t.category, t.status, t.priority,
             t.created_by, t.assignee_id, t.assignee_name, t.due_date, t.progress,
             t.comment_count, t.watcher_ids, t.related_entity_type, t.related_entity_id,
             t.completed_at, t.created_at, t.updated_at,
             e.first_name as assignee_first_name, e.last_name as assignee_last_name, e.avatar as assignee_avatar,
             e.department as assignee_department
      FROM tasks t
      LEFT JOIN employees e ON t.assignee_id = e.id
      ${whereClause}
      ORDER BY
        CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
        t.due_date ASC NULLS LAST,
        t.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const tasks = await sql(query, params);
    res.json(tasks);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

/**
 * GET /api/tasks/stats
 * Task counts by status for the current user's visible tasks
 */
router.get("/stats", requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const { clause, params } = buildVisibilityClause({
      id: user.id,
      role: user.role,
      employeeId: user.employeeId,
    });

    const query = `
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE t.status = 'todo')::int as todo,
        COUNT(*) FILTER (WHERE t.status = 'in_progress')::int as in_progress,
        COUNT(*) FILTER (WHERE t.status = 'review')::int as review,
        COUNT(*) FILTER (WHERE t.status = 'done')::int as done,
        COUNT(*) FILTER (WHERE t.status = 'cancelled')::int as cancelled,
        COUNT(*) FILTER (WHERE t.due_date < NOW() AND t.status NOT IN ('done', 'cancelled'))::int as overdue
      FROM tasks t
      ${clause}
    `;
    const stats = await sql(query, params);
    res.json(stats[0]);
  } catch (error) {
    console.error("Error fetching task stats:", error);
    res.status(500).json({ error: "Failed to fetch task stats" });
  }
});

/**
 * GET /api/tasks/:id
 * Get single task with comments
 */
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const tasks = await sql`
      SELECT t.*,
             e.first_name as assignee_first_name, e.last_name as assignee_last_name,
             e.avatar as assignee_avatar, e.department as assignee_department
      FROM tasks t
      LEFT JOIN employees e ON t.assignee_id = e.id
      WHERE t.id = ${id}
    `;
    if (tasks.length === 0) return res.status(404).json({ error: "Task not found" });

    const comments = await sql`
      SELECT * FROM task_comments WHERE task_id = ${id} ORDER BY created_at ASC
    `;

    res.json({ ...tasks[0], comments });
  } catch (error) {
    console.error("Error fetching task:", error);
    res.status(500).json({ error: "Failed to fetch task" });
  }
});

/**
 * POST /api/tasks
 * Create a new task. Admin/HR can assign to anyone; Managers to their team; Employees to self.
 */
router.post("/", requireAuth, async (req, res) => {
  try {
    const validated = insertTaskSchema.parse(req.body);
    const user = req.user!;

    let assigneeName: string | null = null;
    if (validated.assigneeId) {
      assigneeName = await resolveEmployeeName(validated.assigneeId);
    }

    const result = await sql`
      INSERT INTO tasks (title, description, category, status, priority, created_by, assignee_id, assignee_name, due_date, related_entity_type, related_entity_id, watcher_ids)
      VALUES (
        ${validated.title},
        ${validated.description || null},
        ${validated.category || "general"},
        ${validated.status || "todo"},
        ${validated.priority || "medium"},
        ${user.id},
        ${validated.assigneeId || null},
        ${assigneeName},
        ${validated.dueDate ? new Date(validated.dueDate).toISOString() : null},
        ${validated.relatedEntityType || null},
        ${validated.relatedEntityId || null},
        ${JSON.stringify(validated.watcherIds || [])}::jsonb
      )
      RETURNING *
    `;

    res.status(201).json(result[0]);
  } catch (error: any) {
    if (error.name === "ZodError") return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Error creating task:", error);
    res.status(500).json({ error: "Failed to create task" });
  }
});

/**
 * PATCH /api/tasks/:id
 * Update a task (status, priority, assignee, progress, etc.)
 */
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await sql`SELECT * FROM tasks WHERE id = ${id}`;
    if (existing.length === 0) return res.status(404).json({ error: "Task not found" });

    const task = existing[0];
    const { title, description, category, status, priority, assigneeId, dueDate, progress, watcherIds } = req.body;

    const newTitle = title !== undefined ? title : task.title;
    const newDescription = description !== undefined ? description : task.description;
    const newCategory = category !== undefined ? category : task.category;
    const newStatus = status !== undefined ? status : task.status;
    const newPriority = priority !== undefined ? priority : task.priority;
    const newAssigneeId = assigneeId !== undefined ? (assigneeId || null) : task.assignee_id;
    const newDueDate = dueDate !== undefined ? (dueDate ? new Date(dueDate).toISOString() : null) : task.due_date;
    const newProgress = progress !== undefined ? Math.min(100, Math.max(0, progress)) : task.progress;
    const newWatcherIds = watcherIds !== undefined ? JSON.stringify(watcherIds) : JSON.stringify(task.watcher_ids || []);

    let assigneeName = task.assignee_name;
    if (assigneeId !== undefined && newAssigneeId && newAssigneeId !== task.assignee_id) {
      assigneeName = await resolveEmployeeName(newAssigneeId);
    } else if (assigneeId === null || assigneeId === "") {
      assigneeName = null;
    }

    // Auto-set completedAt
    const completedAt = newStatus === "done" && task.status !== "done" ? "NOW()" : (newStatus !== "done" ? null : task.completed_at);
    const autoProgress = newStatus === "done" ? 100 : newProgress;

    await sql`
      UPDATE tasks SET
        title = ${newTitle},
        description = ${newDescription},
        category = ${newCategory},
        status = ${newStatus},
        priority = ${newPriority},
        assignee_id = ${newAssigneeId},
        assignee_name = ${assigneeName},
        due_date = ${newDueDate},
        progress = ${autoProgress},
        watcher_ids = ${newWatcherIds}::jsonb,
        completed_at = ${newStatus === "done" && task.status !== "done" ? new Date().toISOString() : (newStatus !== "done" ? null : task.completed_at)},
        updated_at = NOW()
      WHERE id = ${id}
    `;

    const updated = await sql`
      SELECT t.*, e.first_name as assignee_first_name, e.last_name as assignee_last_name,
             e.avatar as assignee_avatar, e.department as assignee_department
      FROM tasks t LEFT JOIN employees e ON t.assignee_id = e.id
      WHERE t.id = ${id}
    `;
    res.json(updated[0]);
  } catch (error) {
    console.error("Error updating task:", error);
    res.status(500).json({ error: "Failed to update task" });
  }
});

/**
 * DELETE /api/tasks/:id
 * Delete a task. Admin/HR or creator only.
 */
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const existing = await sql`SELECT created_by FROM tasks WHERE id = ${id}`;
    if (existing.length === 0) return res.status(404).json({ error: "Task not found" });

    // Only admin/hr or the creator can delete
    if (user.role !== "admin" && user.role !== "hr" && existing[0].created_by !== user.id) {
      return res.status(403).json({ error: "You can only delete tasks you created" });
    }

    await sql`DELETE FROM tasks WHERE id = ${id}`;
    res.json({ message: "Task deleted" });
  } catch (error) {
    console.error("Error deleting task:", error);
    res.status(500).json({ error: "Failed to delete task" });
  }
});

// ==================== COMMENTS ====================

/**
 * POST /api/tasks/:id/comments
 * Add a comment to a task
 */
router.post("/:id/comments", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const taskCheck = await sql`SELECT id FROM tasks WHERE id = ${id}`;
    if (taskCheck.length === 0) return res.status(404).json({ error: "Task not found" });

    const { content } = insertTaskCommentSchema.parse(req.body);
    const authorName = await resolveUserName(req.user!.id);

    const result = await sql`
      INSERT INTO task_comments (task_id, author_id, author_name, content)
      VALUES (${id}, ${req.user!.id}, ${authorName}, ${content})
      RETURNING *
    `;

    // Increment comment count
    await sql`UPDATE tasks SET comment_count = comment_count + 1, updated_at = NOW() WHERE id = ${id}`;

    res.status(201).json(result[0]);
  } catch (error: any) {
    if (error.name === "ZodError") return res.status(400).json({ error: "Validation failed" });
    console.error("Error adding comment:", error);
    res.status(500).json({ error: "Failed to add comment" });
  }
});

/**
 * DELETE /api/tasks/:id/comments/:commentId
 * Delete own comment
 */
router.delete("/:id/comments/:commentId", requireAuth, async (req, res) => {
  try {
    const { id, commentId } = req.params;
    const existing = await sql`SELECT author_id FROM task_comments WHERE id = ${commentId} AND task_id = ${id}`;
    if (existing.length === 0) return res.status(404).json({ error: "Comment not found" });

    if (existing[0].author_id !== req.user!.id && req.user!.role !== "admin") {
      return res.status(403).json({ error: "You can only delete your own comments" });
    }

    await sql`DELETE FROM task_comments WHERE id = ${commentId}`;
    await sql`UPDATE tasks SET comment_count = GREATEST(comment_count - 1, 0), updated_at = NOW() WHERE id = ${id}`;
    res.json({ message: "Comment deleted" });
  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(500).json({ error: "Failed to delete comment" });
  }
});

export default router;
