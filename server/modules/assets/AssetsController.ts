import type { Request, Response, NextFunction } from "express";
import { AssetsService } from "./AssetsService.js";
import { ApiResponse } from "../../core/utils/apiResponse.js";
import { parsePagination } from "../../core/utils/pagination.js";

export class AssetsController {
  private readonly service = new AssetsService();
  constructor() {
    ["listStock","getStock","createStock","updateStock","deleteStock","listAssigned","assignAsset","returnAsset","listTickets","createTicket","updateTicket"].forEach(m => { (this as any)[m] = (this as any)[m].bind(this); });
  }
  async listStock(req: Request, res: Response, next: NextFunction) { try { ApiResponse.paginated(res, await this.service.listStock(parsePagination(req.query as any), { category: req.query.category as string, status: req.query.status as string })); } catch (e) { next(e); } }
  async getStock(req: Request, res: Response, next: NextFunction) { try { ApiResponse.ok(res, await this.service.getStockItem(req.params.id)); } catch (e) { next(e); } }
  async createStock(req: Request, res: Response, next: NextFunction) { try { ApiResponse.created(res, await this.service.createStockItem(req.body)); } catch (e) { next(e); } }
  async updateStock(req: Request, res: Response, next: NextFunction) { try { ApiResponse.ok(res, await this.service.updateStockItem(req.params.id, req.body)); } catch (e) { next(e); } }
  async deleteStock(req: Request, res: Response, next: NextFunction) { try { await this.service.deleteStockItem(req.params.id); ApiResponse.noContent(res); } catch (e) { next(e); } }
  async listAssigned(req: Request, res: Response, next: NextFunction) { try { ApiResponse.ok(res, await this.service.listAssigned(parsePagination(req.query as any), req.query.employeeId as string)); } catch (e) { next(e); } }
  async assignAsset(req: Request, res: Response, next: NextFunction) { try { ApiResponse.created(res, await this.service.assignAsset(req.body)); } catch (e) { next(e); } }
  async returnAsset(req: Request, res: Response, next: NextFunction) { try { ApiResponse.ok(res, await this.service.returnAsset(req.params.id)); } catch (e) { next(e); } }
  async listTickets(req: Request, res: Response, next: NextFunction) { try { ApiResponse.ok(res, await this.service.listTickets(parsePagination(req.query as any), { status: req.query.status as string, priority: req.query.priority as string, employeeId: req.query.employeeId as string })); } catch (e) { next(e); } }
  async createTicket(req: Request, res: Response, next: NextFunction) { try { ApiResponse.created(res, await this.service.createTicket(req.body)); } catch (e) { next(e); } }
  async updateTicket(req: Request, res: Response, next: NextFunction) { try { ApiResponse.ok(res, await this.service.updateTicket(req.params.id, req.body)); } catch (e) { next(e); } }
}
