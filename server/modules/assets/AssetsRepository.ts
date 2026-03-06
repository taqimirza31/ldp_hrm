/**
 * AssetsRepository — delegates to the battle-tested SQL in the existing assets route.
 * The architecture layer is established here; SQL is gradually migrated from routes/assets.ts.
 * Each method corresponds to a discrete operation so services can orchestrate them cleanly.
 */
import { BaseRepository } from "../../core/base/BaseRepository.js";
import type { PaginationParams } from "../../core/types/index.js";

export class AssetsRepository extends BaseRepository {
  // ── Stock items ────────────────────────────────────────────────────────────
  async findStock(params: PaginationParams, filters: Record<string, string | undefined>) {
    const { search, limit, offset } = params;
    const { category, status } = filters;
    const conditions: string[] = []; const p: unknown[] = [];
    if (search) { p.push(this.likePattern(search)); conditions.push(`(s.name ILIKE $${p.length} OR s.brand ILIKE $${p.length} OR s.model ILIKE $${p.length})`); }
    if (category) { p.push(category); conditions.push(`s.category = $${p.length}`); }
    if (status) { p.push(status); conditions.push(`s.status = $${p.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const [countRow] = await this.sql(`SELECT COUNT(*)::int as total FROM stock_items s ${where}`, p) as any[];
    p.push(limit, offset);
    const rows = await this.sql(`SELECT * FROM stock_items s ${where} ORDER BY s.name ASC LIMIT $${p.length - 1} OFFSET $${p.length}`, p) as any[];
    return { rows, total: countRow?.total ?? 0 };
  }
  async findStockById(id: string) { const r = await this.sql`SELECT * FROM stock_items WHERE id = ${id}` as any[]; return r[0] ?? null; }
  async createStockItem(data: Record<string, unknown>) { const r = await this.sql`INSERT INTO stock_items (name, category, brand, model, serial_number, status, min_stock, notes) VALUES (${data.name}, ${data.category}, ${data.brand ?? null}, ${data.model ?? null}, ${data.serialNumber ?? null}, ${data.status ?? 'available'}, ${data.minStock ?? 0}, ${data.notes ?? null}) RETURNING *` as any[]; return r[0]; }
  async updateStockItem(id: string, data: Record<string, unknown>) { const r = await this.sql`UPDATE stock_items SET name = COALESCE(${data.name ?? null}, name), category = COALESCE(${data.category ?? null}, category), brand = COALESCE(${data.brand ?? null}, brand), model = COALESCE(${data.model ?? null}, model), status = COALESCE(${data.status ?? null}, status), updated_at = NOW() WHERE id = ${id} RETURNING *` as any[]; return r[0] ?? null; }
  async deleteStockItem(id: string) { await this.sql`DELETE FROM stock_items WHERE id = ${id}`; }

  // ── Assigned systems ────────────────────────────────────────────────────────
  async findAssigned(params: PaginationParams, employeeId?: string) {
    const { limit, offset, search } = params;
    const conditions: string[] = []; const p: unknown[] = [];
    if (employeeId) { p.push(employeeId); conditions.push(`a.user_id = $${p.length}`); }
    if (search) { p.push(this.likePattern(search)); conditions.push(`(a.asset_name ILIKE $${p.length} OR a.serial_number ILIKE $${p.length})`); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    p.push(limit, offset);
    return this.sql(`SELECT a.*, e.first_name, e.last_name FROM assigned_systems a LEFT JOIN employees e ON e.id = a.user_id ${where} ORDER BY a.assigned_date DESC LIMIT $${p.length - 1} OFFSET $${p.length}`, p) as Promise<any[]>;
  }
  async assignAsset(data: Record<string, unknown>) { const r = await this.sql`INSERT INTO assigned_systems (user_id, asset_name, asset_tag, category, serial_number, assigned_date, notes) VALUES (${data.userId}, ${data.assetName}, ${data.assetTag ?? null}, ${data.category ?? null}, ${data.serialNumber ?? null}, ${data.assignedDate ?? new Date().toISOString()}, ${data.notes ?? null}) RETURNING *` as any[]; return r[0]; }
  async returnAsset(id: string) { const r = await this.sql`UPDATE assigned_systems SET return_date = NOW(), updated_at = NOW() WHERE id = ${id} RETURNING *` as any[]; return r[0] ?? null; }

  // ── Support tickets ─────────────────────────────────────────────────────────
  async findTickets(params: PaginationParams, filters: { status?: string; priority?: string; employeeId?: string }) {
    const { limit, offset, search } = params;
    const { status, priority, employeeId } = filters;
    const conditions: string[] = []; const p: unknown[] = [];
    if (status) { p.push(status); conditions.push(`t.status = $${p.length}`); }
    if (priority) { p.push(priority); conditions.push(`t.priority = $${p.length}`); }
    if (employeeId) { p.push(employeeId); conditions.push(`t.employee_id = $${p.length}`); }
    if (search) { p.push(this.likePattern(search)); conditions.push(`(t.title ILIKE $${p.length} OR t.description ILIKE $${p.length})`); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    p.push(limit, offset);
    return this.sql(`SELECT t.*, e.first_name, e.last_name FROM support_tickets t LEFT JOIN employees e ON e.id = t.employee_id ${where} ORDER BY t.created_at DESC LIMIT $${p.length - 1} OFFSET $${p.length}`, p) as Promise<any[]>;
  }
  async createTicket(data: Record<string, unknown>) { const r = await this.sql`INSERT INTO support_tickets (employee_id, title, description, priority, category) VALUES (${data.employeeId}, ${data.title}, ${data.description ?? null}, ${data.priority ?? 'medium'}, ${data.category ?? 'general'}) RETURNING *` as any[]; return r[0]; }
  async updateTicket(id: string, data: Record<string, unknown>) { const r = await this.sql`UPDATE support_tickets SET status = COALESCE(${data.status ?? null}, status), priority = COALESCE(${data.priority ?? null}, priority), assigned_to = COALESCE(${data.assignedTo ?? null}, assigned_to), resolved_at = CASE WHEN ${data.status} = 'resolved' THEN NOW() ELSE resolved_at END, updated_at = NOW() WHERE id = ${id} RETURNING *` as any[]; return r[0] ?? null; }
}
