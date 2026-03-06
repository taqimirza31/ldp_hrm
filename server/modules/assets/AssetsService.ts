import { AssetsRepository } from "./AssetsRepository.js";
import { buildPaginationMeta } from "../../core/utils/pagination.js";
import type { PaginationParams } from "../../core/types/index.js";

export class AssetsService {
  private readonly repo = new AssetsRepository();

  async listStock(params: PaginationParams, filters: Record<string, string | undefined>) {
    const { rows, total } = await this.repo.findStock(params, filters);
    return { data: rows, meta: buildPaginationMeta(total, params) };
  }
  async getStockItem(id: string) { return this.repo.findStockById(id); }
  async createStockItem(data: Record<string, unknown>) { return this.repo.createStockItem(data); }
  async updateStockItem(id: string, data: Record<string, unknown>) { return this.repo.updateStockItem(id, data); }
  async deleteStockItem(id: string) { return this.repo.deleteStockItem(id); }

  async listAssigned(params: PaginationParams, employeeId?: string) { return this.repo.findAssigned(params, employeeId); }
  async assignAsset(data: Record<string, unknown>) { return this.repo.assignAsset(data); }
  async returnAsset(id: string) { return this.repo.returnAsset(id); }

  async listTickets(params: PaginationParams, filters: { status?: string; priority?: string; employeeId?: string }) { return this.repo.findTickets(params, filters); }
  async createTicket(data: Record<string, unknown>) { return this.repo.createTicket(data); }
  async updateTicket(id: string, data: Record<string, unknown>) { return this.repo.updateTicket(id, data); }
}
