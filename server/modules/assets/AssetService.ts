import { AssetRepository } from "./AssetRepository.js";
import { NotFoundError, ValidationError, ConflictError, ForbiddenError } from "../../core/types/index.js";
import { insertStockItemSchema, insertAssignedSystemSchema, insertSupportTicketSchema, insertTicketCommentSchema, insertInvoiceSchema } from "../../db/schema/assets.js";
import { parseDataUrl, uploadFileToSharePoint, isSharePointAvatarConfigured } from "../../lib/sharepoint.js";
import crypto from "node:crypto";

function generateTicketNumber() { return "TKT-"+Date.now().toString(36).toUpperCase(); }
function getBaseUrl(host: string, protocol: string) { if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL; return `${protocol}://${host}`; }

export class AssetService {
  private readonly repo = new AssetRepository();

  // ── Public view ──────────────────────────────────────────────────────────────
  async getPublicAsset(assetId: string, host: string, protocol: string) {
    const stock = await this.repo.getPublicStock(assetId);
    if (stock) return { type:"stock", assetId:stock.asset_id, name:stock.name, category:stock.category, productType:stock.product_type, quantity:stock.quantity, available:stock.available, description:stock.description, specs:stock.specs, status:`${stock.available||0} of ${stock.quantity||0} available` };
    const a = await this.repo.getPublicAssigned(assetId);
    if (!a) throw new NotFoundError("Asset", assetId);
    const trim = (v: any) => typeof v==="string"&&v.trim()!==""?v.trim():null;
    let dept = a.employee_department??null; let loc = trim(a.emp_location)??trim(a.emp_city)??trim(a.emp_comm_city)??null;
    if (dept==null||loc==null) { const emp = await this.repo.getEmployeeForAsset(a.user_id, a.user_email); if (emp) { if (dept==null) dept=emp.department??null; if (loc==null) loc=trim(emp.location)??trim(emp.city)??trim(emp.comm_city)??null; } }
    const cat = a.stock_category||"Other"; const productType=(a.stock_product_type&&String(a.stock_product_type).trim())||null;
    const assetType = productType||(cat==="Systems"?"Laptop":cat==="Other"?"Laptop":cat);
    return { type:"assigned", assetId:a.asset_id, name:a.stock_name||"Assigned asset", category:cat, assetType, specs:a.stock_specs||{ram:a.ram,storage:a.storage,processor:a.processor,generation:a.generation}, assignedTo:{name:a.user_name,email:a.user_email,department:dept,location:loc}, notes:a.notes, status:"Assigned" };
  }

  // ── Stock ────────────────────────────────────────────────────────────────────
  async listStock(limit=100, offset=0) { return this.repo.listStock(Math.min(limit,500), offset); }
  async getStockById(id: string) { const r = await this.repo.getStockById(id); if (!r) throw new NotFoundError("Stock item",id); return r; }
  async createStock(body: any, userId?: string, userEmail?: string) {
    const v = insertStockItemSchema.parse(body);
    const assetId = v.assetId?.trim()||(await this.repo.nextStockAssetId());
    const r = await this.repo.createStock({ ...v, assetId });
    await this.repo.logAudit("stock",r.id,"create",v,userId,userEmail);
    return r;
  }
  async updateStock(id: string, body: any, userId?: string, userEmail?: string) {
    const existing = await this.repo.getStockById(id); if (!existing) throw new NotFoundError("Stock item",id);
    const r = await this.repo.updateStock(id, body);
    await this.repo.logAudit("stock",id,"update",{old:existing,new:r},userId,userEmail);
    return r;
  }
  async deleteStock(id: string, userId?: string, userEmail?: string) {
    const r = await this.repo.deleteStock(id); if (!r) throw new NotFoundError("Stock item",id);
    await this.repo.logAudit("stock",id,"delete",r,userId,userEmail);
  }
  async getStockQR(id: string, size=256, host="", protocol="https") {
    const row = await this.repo.getStockAssetId(id); if (!row?.asset_id) throw new NotFoundError("Stock item",id);
    const url = `${getBaseUrl(host,protocol)}/assets/view/${encodeURIComponent(row.asset_id)}`;
    return this.repo.generateQR(url, Math.min(Math.max(size,128),512));
  }

  // ── Assigned Systems ────────────────────────────────────────────────────────
  async listSystems() { return this.repo.listSystems(); }
  async getSystemById(id: string) { const r = await this.repo.getSystemById(id); if (!r) throw new NotFoundError("System",id); return r; }
  async getSystemsByUser(userId: string) { return this.repo.getSystemsByUser(userId); }
  async getMySystems(employeeId?: string|null, email?: string) {
    let systems: any[] = [];
    if (employeeId) systems = await this.repo.getMySystemsByEmployeeId(employeeId);
    if (!systems.length && email) systems = await this.repo.getMySystemsByEmail(email);
    return systems;
  }
  async createSystem(body: any, userId?: string, userEmail?: string) {
    const v = insertAssignedSystemSchema.parse(body);
    const assetId = v.assetId?.trim()||(await this.repo.nextAssignedAssetId());
    const r = await this.repo.createSystem({ ...v, assetId });
    await this.repo.logAudit("system",r.id,"create",v,userId,userEmail);
    return r;
  }
  async updateSystem(id: string, body: any, userId?: string, userEmail?: string) {
    const existing = await this.repo.getSystemById(id); if (!existing) throw new NotFoundError("System",id);
    const r = await this.repo.updateSystem(id, body);
    await this.repo.logAudit("system",id,"update",{old:existing,new:r},userId,userEmail);
    return r;
  }
  async deleteSystem(id: string, userId?: string, userEmail?: string) {
    const r = await this.repo.deleteSystem(id); if (!r) throw new NotFoundError("System",id);
    await this.repo.logAudit("system",id,"delete",r,userId,userEmail);
  }
  async assignFromStock(body: any, userId?: string, userEmail?: string) {
    const { stockItemId, employeeId, ram, storage, processor, generation } = body;
    if (!stockItemId||!employeeId) throw new ValidationError("stockItemId and employeeId are required");
    const stock = await this.repo.getStockForAssign(stockItemId); if (!stock) throw new NotFoundError("Stock item",stockItemId);
    if ((stock.available??0)<=0) throw new ValidationError("No available units to assign");
    const emp = await this.repo.getEmployeeForAssign(employeeId); if (!emp) throw new NotFoundError("Employee",employeeId);
    const assetId = await this.repo.nextAssignedAssetId();
    const specs = stock.specs as Record<string,any>|null;
    const r = await this.repo.assignFromStock({ assetId, stockItemId, userId:emp.id, userName:`${emp.first_name||""} ${emp.last_name||""}`.trim()||"Unknown", userEmail:emp.work_email||null, ram:ram??specs?.ram??null, storage:storage??specs?.storage??null, processor:processor??specs?.processor??null, generation:generation??specs?.generation??null });
    await this.repo.logAudit("system",r.id,"create",{stockItemId,employeeId,assetId},userId,userEmail);
    return r;
  }
  async getSystemQR(id: string, size=256, host="", protocol="https") {
    const row = await this.repo.getSystemAssetId(id); if (!row?.asset_id) throw new NotFoundError("System",id);
    const url = `${getBaseUrl(host,protocol)}/assets/view/${encodeURIComponent(row.asset_id)}`;
    return this.repo.generateQR(url, Math.min(Math.max(size,128),512));
  }

  // ── Tickets ──────────────────────────────────────────────────────────────────
  async listTickets(isAdminHR: boolean, employeeId?: string|null) { return this.repo.listTickets(isAdminHR, employeeId); }
  async getMyTickets(employeeId?: string|null) { return this.repo.listTickets(false, employeeId); }
  async getTicketById(id: string, isAdminHR: boolean, employeeId?: string|null) {
    const t = await this.repo.getTicketById(id); if (!t) throw new NotFoundError("Ticket",id);
    if (!isAdminHR && t.created_by_id!==employeeId) throw new ForbiddenError("Access denied");
    return t;
  }
  async createTicket(body: any, user: {id:string;email:string;role:string;employeeId?:string|null}) {
    const ticketNumber = body.ticketNumber||generateTicketNumber();
    let createdByName=body.createdByName||user.email; let createdByDepartment=body.createdByDepartment||null; let createdById: string|null=null;
    if (user.employeeId) { const emp = await this.repo.getEmployeeName(user.employeeId); if (emp) { createdById=user.employeeId; createdByName=`${emp.first_name} ${emp.last_name}`; createdByDepartment=emp.department||createdByDepartment; } }
    const v = insertSupportTicketSchema.parse({ ...body, ticketNumber, createdById, createdByName, createdByEmail:user.email, createdByDepartment });
    const r = await this.repo.createTicket(v);
    await this.repo.logAudit("ticket",r.id,"create",v,user.id,user.email);
    return r;
  }
  async updateTicket(id: string, body: any, isAdminHR: boolean, employeeId?: string|null, userId?: string, userEmail?: string) {
    const existing = await this.repo.getTicketById(id); if (!existing) throw new NotFoundError("Ticket",id);
    if (!isAdminHR&&existing.created_by_id!==employeeId) throw new ForbiddenError("Access denied");
    const r = await this.repo.updateTicket(id, body, isAdminHR);
    if (isAdminHR) await this.repo.logAudit("ticket",id,"update",{old:existing,new:r},userId,userEmail);
    return r;
  }
  async deleteTicket(id: string, userId?: string, userEmail?: string) {
    const t = await this.repo.getTicketById(id); if (!t) throw new NotFoundError("Ticket",id);
    await this.repo.deleteTicket(id);
    await this.repo.logAudit("ticket",id,"delete",t,userId,userEmail);
  }
  async getTicketComments(ticketId: string, isAdminHR: boolean, employeeId?: string|null) {
    const t = await this.repo.getTicketById(ticketId); if (!t) throw new NotFoundError("Ticket",ticketId);
    if (!isAdminHR&&t.created_by_id!==employeeId) throw new ForbiddenError("Access denied");
    return this.repo.getTicketComments(ticketId);
  }
  async addComment(ticketId: string, body: any, user: {id:string;email:string;role:string;employeeId?:string|null}) {
    const t = await this.repo.getTicketById(ticketId); if (!t) throw new NotFoundError("Ticket",ticketId);
    const isAdminHR=["admin","hr","it"].includes(user.role);
    if (!isAdminHR&&t.created_by_id!==user.employeeId) throw new ForbiddenError("Access denied");
    const authorRole = isAdminHR?"it_support":"employee";
    let authorName=body.authorName||user.email;
    if (user.employeeId) { const emp = await this.repo.getEmployeeName(user.employeeId); if (emp) authorName=`${emp.first_name} ${emp.last_name}`; }
    const v = insertTicketCommentSchema.parse({ ticketId, message:body.message, authorId:user.employeeId, authorName, authorEmail:user.email, authorRole, isStatusUpdate:body.isStatusUpdate||"false", oldStatus:body.oldStatus, newStatus:body.newStatus });
    const r = await this.repo.addComment(v);
    await this.repo.logAudit("ticket_comment",r.id,"create",v,user.id,user.email);
    return r;
  }
  async updateTicketStatus(ticketId: string, status: string, comment: string|undefined, user: {id:string;email:string;role:string;employeeId?:string|null}) {
    if (!status) throw new ValidationError("Status is required");
    let authorName=user.email;
    if (user.employeeId) { const emp = await this.repo.getEmployeeName(user.employeeId); if (emp) authorName=`${emp.first_name} ${emp.last_name}`; }
    const r = await this.repo.updateTicketStatus(ticketId, status, authorName, user.email, user.employeeId||undefined, comment);
    if (!r) throw new NotFoundError("Ticket",ticketId);
    await this.repo.logAudit("ticket",ticketId,"status_change",{status},user.id,user.email);
    return r;
  }

  // ── Audit / Invoices / Stats ──────────────────────────────────────────────────
  async getAuditLog(entityType?: string, entityId?: string, limit=100, offset=0) { return this.repo.getAuditLog(entityType, entityId, limit, offset); }
  async listInvoices(limit=100, offset=0) { return this.repo.listInvoices(Math.min(limit,500), offset); }
  async getInvoiceById(id: string) { const r = await this.repo.getInvoiceById(id); if (!r) throw new NotFoundError("Invoice",id); return r; }
  async getInvoiceFile(id: string) { const r = await this.repo.getInvoiceFile(id); if (!r?.file_path) throw new NotFoundError("Invoice file",id); return r; }

  /** If file_path is a base64 data URL and SharePoint is configured, upload to SharePoint and return URL; otherwise return original. */
  private async ensureInvoiceFileInSharePoint(
    filePath: string | null | undefined,
    fileName: string | null | undefined,
    invoiceNumber: string,
    invoiceId?: string
  ): Promise<string | null> {
    const raw = (filePath ?? "").trim();
    if (!raw || !raw.startsWith("data:")) return raw || null;
    if (!isSharePointAvatarConfigured()) return raw;
    const parsed = parseDataUrl(raw);
    if (!parsed) return raw;
    const safeName = (fileName && /\.pdf$/i.test(fileName))
      ? String(fileName).replace(/[^a-zA-Z0-9._-]/g, "_")
      : `invoice-${(invoiceNumber || invoiceId || crypto.randomUUID()).replace(/[^a-zA-Z0-9_-]/g, "_")}-${Date.now()}.pdf`;
    try {
      const url = await uploadFileToSharePoint("AssetManagement/Invoices", safeName, parsed.buffer, parsed.contentType);
      return url ?? raw;
    } catch (e) {
      console.warn("[assets] SharePoint invoice upload failed:", (e as Error)?.message);
      return raw;
    }
  }

  async createInvoice(body: any, userId?: string, userEmail?: string) {
    let filePath = body.file_path ?? body.filePath ?? null;
    const invoiceNumber = (body.invoice_number ?? body.invoiceNumber ?? "").trim() || "INV";
    if (filePath) {
      filePath = await this.ensureInvoiceFileInSharePoint(filePath, body.file_name ?? body.fileName, invoiceNumber);
    }
    const v = insertInvoiceSchema.parse({ invoiceNumber: body.invoice_number ?? body.invoiceNumber, vendor: body.vendor, purchaseDate: body.purchase_date ?? body.purchaseDate, totalAmount: body.total_amount ?? body.totalAmount ?? 0, items: body.items, fileName: body.file_name ?? body.fileName ?? null, fileType: body.file_type ?? body.fileType ?? null, filePath, status: body.status ?? "pending", notes: body.notes ?? null });
    const r = await this.repo.createInvoice(v);
    await this.repo.logAudit("invoice", r.id, "create", v, userId, userEmail);
    return r;
  }
  async updateInvoice(id: string, body: any, userId?: string, userEmail?: string) {
    const ex = await this.repo.getInvoiceById(id); if (!ex) throw new NotFoundError("Invoice", id);
    const rawPath = body.file_path ?? body.filePath;
    let filePath = rawPath;
    if (rawPath !== undefined && rawPath && String(rawPath).trim().startsWith("data:")) {
      filePath = await this.ensureInvoiceFileInSharePoint(rawPath, body.file_name ?? body.fileName ?? ex.file_name, ex.invoice_number ?? "INV", id) ?? undefined;
    }
    const updates = filePath !== undefined ? { ...body, file_path: filePath } : body;
    const r = await this.repo.updateInvoice(id, updates);
    await this.repo.logAudit("invoice", id, "update", { old: ex, new: r }, userId, userEmail);
    return r;
  }
  async deleteInvoice(id: string, userId?: string, userEmail?: string) {
    const r = await this.repo.deleteInvoice(id); if (!r) throw new NotFoundError("Invoice",id);
    await this.repo.logAudit("invoice",id,"delete",r,userId,userEmail);
  }
  async getStats() { return this.repo.getStats(); }
}
