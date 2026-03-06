import { TaskRepository } from "./TaskRepository.js";
import type { TaskRow, TaskCommentRow, VisibilityParams, TaskFilters } from "./TaskRepository.js";
import type { TaskResponseDTO, TaskCommentDTO, TaskStatsDTO } from "./Task.dto.js";
import type { CreateTaskInput, UpdateTaskInput, CreateTaskCommentInput } from "./Task.validators.js";
import { NotFoundError, ForbiddenError } from "../../core/types/index.js";

export class TaskService {
  private readonly repo = new TaskRepository();

  async listTasks(visibility: VisibilityParams, filters: TaskFilters): Promise<TaskResponseDTO[]> {
    const rows = await this.repo.findAll(visibility, filters);
    return rows.map(this.toDTO);
  }

  async getStats(visibility: VisibilityParams): Promise<TaskStatsDTO> {
    return this.repo.getStats(visibility);
  }

  async getTask(id: string): Promise<TaskResponseDTO> {
    const row = await this.repo.findById(id);
    if (!row) throw new NotFoundError("Task", id);
    const comments = await this.repo.getComments(id);
    return { ...this.toDTO(row), comments: comments.map(this.toCommentDTO) };
  }

  async createTask(data: CreateTaskInput, createdBy: string): Promise<TaskResponseDTO> {
    const assigneeName = data.assigneeId ? await this.repo.resolveEmployeeName(data.assigneeId) : null;
    const row = await this.repo.create(data, createdBy, assigneeName);
    return this.toDTO(row);
  }

  async updateTask(id: string, data: UpdateTaskInput): Promise<TaskResponseDTO> {
    const current = await this.repo.findById(id);
    if (!current) throw new NotFoundError("Task", id);
    let assigneeName = current.assignee_name;
    if (data.assigneeId !== undefined) {
      assigneeName = data.assigneeId ? await this.repo.resolveEmployeeName(data.assigneeId) : null;
    }
    const updated = await this.repo.update(id, current, data, assigneeName);
    return this.toDTO(updated);
  }

  async deleteTask(id: string, requestingUser: { id: string; role: string }): Promise<void> {
    const task = await this.repo.findById(id);
    if (!task) throw new NotFoundError("Task", id);
    if (requestingUser.role !== "admin" && requestingUser.role !== "hr" && task.created_by !== requestingUser.id) {
      throw new ForbiddenError("You can only delete tasks you created");
    }
    await this.repo.delete(id);
  }

  async addComment(taskId: string, authorId: string, data: CreateTaskCommentInput): Promise<TaskCommentDTO> {
    const task = await this.repo.findById(taskId);
    if (!task) throw new NotFoundError("Task", taskId);
    const authorName = await this.repo.resolveUserName(authorId);
    const comment = await this.repo.addComment(taskId, authorId, authorName, data);
    return this.toCommentDTO(comment);
  }

  async deleteComment(taskId: string, commentId: string, requestingUser: { id: string; role: string }): Promise<void> {
    const comment = await this.repo.findCommentById(commentId, taskId);
    if (!comment) throw new NotFoundError("Comment", commentId);
    if (comment.author_id !== requestingUser.id && requestingUser.role !== "admin") {
      throw new ForbiddenError("You can only delete your own comments");
    }
    await this.repo.deleteComment(taskId, commentId);
  }

  private toDTO(row: TaskRow): TaskResponseDTO {
    return {
      id: row.id, title: row.title, description: row.description, category: row.category,
      status: row.status, priority: row.priority, createdBy: row.created_by,
      assigneeId: row.assignee_id, assigneeName: row.assignee_name,
      assigneeFirstName: row.assignee_first_name ?? null,
      assigneeLastName: row.assignee_last_name ?? null,
      assigneeAvatar: row.assignee_avatar ?? null,
      assigneeDepartment: row.assignee_department ?? null,
      dueDate: row.due_date, progress: row.progress, commentCount: row.comment_count,
      watcherIds: Array.isArray(row.watcher_ids) ? row.watcher_ids : [],
      relatedEntityType: row.related_entity_type, relatedEntityId: row.related_entity_id,
      completedAt: row.completed_at,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    };
  }

  private toCommentDTO(row: TaskCommentRow): TaskCommentDTO {
    return {
      id: row.id, taskId: row.task_id, authorId: row.author_id, authorName: row.author_name,
      content: row.content,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    };
  }
}
