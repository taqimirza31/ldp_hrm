import { BaseRepository } from "../../core/base/BaseRepository.js";
import type { CreateTaskInput, UpdateTaskInput, CreateTaskCommentInput } from "./Task.validators.js";

export interface TaskRow {
  id: string; title: string; description: string | null; category: string;
  status: string; priority: string; created_by: string; assignee_id: string | null;
  assignee_name: string | null; due_date: string | null; progress: number;
  comment_count: number; watcher_ids: string[]; related_entity_type: string | null;
  related_entity_id: string | null; completed_at: string | null;
  created_at: Date; updated_at: Date;
  assignee_first_name?: string | null; assignee_last_name?: string | null;
  assignee_avatar?: string | null; assignee_department?: string | null;
}
export interface TaskCommentRow {
  id: string; task_id: string; author_id: string; author_name: string;
  content: string; created_at: Date;
}
export interface TaskStatsRow {
  total: number; todo: number; in_progress: number; review: number;
  done: number; cancelled: number; overdue: number;
}
export interface VisibilityParams { userId: string; role: string; employeeId: string | null; }
export interface TaskFilters {
  status?: string; priority?: string; category?: string;
  assigneeId?: string; search?: string; limit?: number; offset?: number;
}

export class TaskRepository extends BaseRepository {
  async findAll(visibility: VisibilityParams, filters: TaskFilters): Promise<TaskRow[]> {
    const { userId, role, employeeId } = visibility;
    const { status, priority, category, assigneeId, search, limit = 200, offset = 0 } = filters;
    const isAdminOrHR = role === "admin" || role === "hr";

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (!isAdminOrHR) {
      const visConds: string[] = [];
      params.push(userId); visConds.push(`t.created_by = $${params.length}`);
      if (employeeId) {
        params.push(employeeId); visConds.push(`t.assignee_id = $${params.length}`);
        params.push(employeeId); visConds.push(`t.watcher_ids @> to_jsonb($${params.length}::text)`);
        if (role === "manager") {
          params.push(employeeId);
          visConds.push(`t.assignee_id IN (SELECT id FROM employees WHERE manager_id = $${params.length})`);
        }
      }
      conditions.push(`(${visConds.join(" OR ")})`);
    }

    if (status && status !== "all") { params.push(status); conditions.push(`t.status = $${params.length}`); }
    if (priority && priority !== "all") { params.push(priority); conditions.push(`t.priority = $${params.length}`); }
    if (category && category !== "all") { params.push(category); conditions.push(`t.category = $${params.length}`); }
    if (assigneeId) { params.push(assigneeId); conditions.push(`t.assignee_id = $${params.length}`); }
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      conditions.push(`(LOWER(t.title) LIKE $${params.length} OR LOWER(t.description) LIKE $${params.length})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(limit, offset);

    return this.sql(`
      SELECT t.id, t.title, t.description, t.category, t.status, t.priority,
             t.created_by, t.assignee_id, t.assignee_name, t.due_date, t.progress,
             t.comment_count, t.watcher_ids, t.related_entity_type, t.related_entity_id,
             t.completed_at, t.created_at, t.updated_at,
             e.first_name as assignee_first_name, e.last_name as assignee_last_name,
             e.avatar as assignee_avatar, e.department as assignee_department
      FROM tasks t LEFT JOIN employees e ON t.assignee_id = e.id
      ${where}
      ORDER BY CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
               t.due_date ASC NULLS LAST, t.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params) as Promise<TaskRow[]>;
  }

  async getStats(visibility: VisibilityParams): Promise<TaskStatsRow> {
    const { userId, role, employeeId } = visibility;
    const isAdminOrHR = role === "admin" || role === "hr";
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (!isAdminOrHR) {
      const visConds: string[] = [];
      params.push(userId); visConds.push(`t.created_by = $${params.length}`);
      if (employeeId) {
        params.push(employeeId); visConds.push(`t.assignee_id = $${params.length}`);
        params.push(employeeId); visConds.push(`t.watcher_ids @> to_jsonb($${params.length}::text)`);
        if (role === "manager") {
          params.push(employeeId);
          visConds.push(`t.assignee_id IN (SELECT id FROM employees WHERE manager_id = $${params.length})`);
        }
      }
      conditions.push(`(${visConds.join(" OR ")})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = await this.sql(`
      SELECT COUNT(*)::int as total,
             COUNT(*) FILTER (WHERE t.status = 'todo')::int as todo,
             COUNT(*) FILTER (WHERE t.status = 'in_progress')::int as in_progress,
             COUNT(*) FILTER (WHERE t.status = 'review')::int as review,
             COUNT(*) FILTER (WHERE t.status = 'done')::int as done,
             COUNT(*) FILTER (WHERE t.status = 'cancelled')::int as cancelled,
             COUNT(*) FILTER (WHERE t.due_date < NOW() AND t.status NOT IN ('done','cancelled'))::int as overdue
      FROM tasks t ${where}
    `, params) as TaskStatsRow[];
    return rows[0];
  }

  async findById(id: string): Promise<TaskRow | null> {
    const rows = await this.sql`
      SELECT t.*, e.first_name as assignee_first_name, e.last_name as assignee_last_name,
             e.avatar as assignee_avatar, e.department as assignee_department
      FROM tasks t LEFT JOIN employees e ON t.assignee_id = e.id
      WHERE t.id = ${id}
    ` as TaskRow[];
    return rows[0] ?? null;
  }

  async getComments(taskId: string): Promise<TaskCommentRow[]> {
    return this.sql`
      SELECT * FROM task_comments WHERE task_id = ${taskId} ORDER BY created_at ASC
    ` as Promise<TaskCommentRow[]>;
  }

  async resolveEmployeeName(employeeId: string): Promise<string> {
    const rows = await this.sql`SELECT first_name, last_name FROM employees WHERE id = ${employeeId}` as any[];
    return rows[0] ? `${rows[0].first_name} ${rows[0].last_name}` : "Unknown";
  }

  async resolveUserName(userId: string): Promise<string> {
    const rows = await this.sql`
      SELECT u.email, e.first_name, e.last_name FROM users u
      LEFT JOIN employees e ON u.employee_id = e.id WHERE u.id = ${userId}
    ` as any[];
    if (!rows[0]) return "Unknown";
    return rows[0].first_name ? `${rows[0].first_name} ${rows[0].last_name}` : rows[0].email;
  }

  async create(data: CreateTaskInput, createdBy: string, assigneeName: string | null): Promise<TaskRow> {
    const rows = await this.sql`
      INSERT INTO tasks (title, description, category, status, priority, created_by, assignee_id,
        assignee_name, due_date, related_entity_type, related_entity_id, watcher_ids)
      VALUES (
        ${data.title}, ${data.description ?? null}, ${data.category ?? "general"},
        ${data.status ?? "todo"}, ${data.priority ?? "medium"}, ${createdBy},
        ${data.assigneeId ?? null}, ${assigneeName},
        ${data.dueDate ? new Date(data.dueDate).toISOString() : null},
        ${data.relatedEntityType ?? null}, ${data.relatedEntityId ?? null},
        ${JSON.stringify(data.watcherIds ?? [])}::jsonb
      ) RETURNING *
    ` as TaskRow[];
    return rows[0];
  }

  async update(id: string, current: TaskRow, data: UpdateTaskInput, assigneeName: string | null): Promise<TaskRow> {
    const newStatus = data.status ?? current.status;
    const completedAt = newStatus === "done" && current.status !== "done"
      ? new Date().toISOString()
      : (newStatus !== "done" ? null : current.completed_at);
    const autoProgress = newStatus === "done" ? 100 : (data.progress !== undefined ? Math.min(100, Math.max(0, data.progress)) : current.progress);

    await this.sql`
      UPDATE tasks SET
        title        = ${data.title ?? current.title},
        description  = ${data.description !== undefined ? data.description : current.description},
        category     = ${data.category ?? current.category},
        status       = ${newStatus},
        priority     = ${data.priority ?? current.priority},
        assignee_id  = ${data.assigneeId !== undefined ? (data.assigneeId ?? null) : current.assignee_id},
        assignee_name= ${assigneeName ?? current.assignee_name},
        due_date     = ${data.dueDate !== undefined ? (data.dueDate ? new Date(data.dueDate).toISOString() : null) : current.due_date},
        progress     = ${autoProgress},
        watcher_ids  = ${data.watcherIds !== undefined ? JSON.stringify(data.watcherIds) : JSON.stringify(current.watcher_ids)}::jsonb,
        completed_at = ${completedAt},
        updated_at   = NOW()
      WHERE id = ${id}
    `;
    return (await this.findById(id))!;
  }

  async delete(id: string): Promise<void> {
    await this.sql`DELETE FROM tasks WHERE id = ${id}`;
  }

  async addComment(taskId: string, authorId: string, authorName: string, data: CreateTaskCommentInput): Promise<TaskCommentRow> {
    const rows = await this.sql`
      INSERT INTO task_comments (task_id, author_id, author_name, content)
      VALUES (${taskId}, ${authorId}, ${authorName}, ${data.content}) RETURNING *
    ` as TaskCommentRow[];
    await this.sql`UPDATE tasks SET comment_count = comment_count + 1, updated_at = NOW() WHERE id = ${taskId}`;
    return rows[0];
  }

  async deleteComment(taskId: string, commentId: string): Promise<void> {
    await this.sql`DELETE FROM task_comments WHERE id = ${commentId}`;
    await this.sql`UPDATE tasks SET comment_count = GREATEST(comment_count - 1, 0), updated_at = NOW() WHERE id = ${taskId}`;
  }

  async findCommentById(commentId: string, taskId: string): Promise<{ id: string; author_id: string } | null> {
    const rows = await this.sql`SELECT id, author_id FROM task_comments WHERE id = ${commentId} AND task_id = ${taskId}` as any[];
    return rows[0] ?? null;
  }
}
