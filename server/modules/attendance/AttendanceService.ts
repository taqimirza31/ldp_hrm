import { AttendanceRepository } from "./AttendanceRepository.js";
import { NotFoundError, ValidationError, ConflictError } from "../../core/types/index.js";
import { todayInTz } from "../../lib/timezone.js";
import { memCache } from "../../lib/perf.js";

function deriveStatus(checkIn: Date|null, checkOut: Date|null, shiftStart: string|null, shiftEnd: string|null, grace = 15, tz: string): string {
  if (!checkIn) return "absent";
  if (!shiftStart || !shiftEnd) return "present";
  const dateStr = checkIn.toISOString().split("T")[0];
  const parseLocal = (d: string, t: string) => new Date(`${d}T${t}:00`);
  let start = parseLocal(dateStr, shiftStart);
  let end = parseLocal(dateStr, shiftEnd);
  if (end <= start) end = new Date(end.getTime() + 86400000);
  const graceMs = grace * 60000;
  const lateThreshold = new Date(start.getTime() + graceMs);
  if (checkIn > lateThreshold) {
    if (checkOut && (checkOut.getTime() - checkIn.getTime()) < (end.getTime() - start.getTime()) / 2) return "half_day";
    return "late";
  }
  if (checkOut && (checkOut.getTime() - checkIn.getTime()) < (end.getTime() - start.getTime()) / 2) return "half_day";
  return "present";
}

export class AttendanceService {
  private readonly repo = new AttendanceRepository();

  // Shifts
  async listShifts() { return memCache.get<any[]>("shifts:list") ?? (async () => { const r = await this.repo.listShifts(); memCache.set("shifts:list", r, 30000); return r; })(); }
  async createShift(data: any) { if (!data.name||!data.startTime||!data.endTime) throw new ValidationError("name, startTime, endTime are required"); const r = await this.repo.createShift(data); memCache.invalidate("shifts:"); return r; }
  async updateShift(id: string, data: any) { const r = await this.repo.updateShift(id, data); if (!r) throw new NotFoundError("Shift", id); memCache.invalidate("shifts:"); return r; }
  async deleteShift(id: string) { await this.repo.deleteShift(id); memCache.invalidate("shifts:"); }

  // Employee Shifts
  async listEmployeeShifts() { return this.repo.listEmployeeShifts(); }
  async assignShift(employeeId: string, shiftId: string, effectiveFrom: string, effectiveTo?: string|null) {
    if (!employeeId||!shiftId||!effectiveFrom) throw new ValidationError("employeeId, shiftId, effectiveFrom required");
    const emp = await this.repo.getEmployeeById(employeeId);
    if (!emp) throw new NotFoundError("Employee", employeeId);
    await this.repo.endOverlappingAssignments(employeeId, effectiveFrom);
    return this.repo.createEmployeeShift(employeeId, shiftId, effectiveFrom, effectiveTo ?? null);
  }
  async removeEmployeeShift(id: string) { await this.repo.deleteEmployeeShift(id); }

  // Check-in / Check-out
  async checkIn(employeeId: string, userTz: string, userId: string) {
    const today = todayInTz(userTz);
    const [empInfo, existing, shift] = await Promise.all([this.repo.getEmployeeInfo(employeeId), this.repo.getTodayRecord(employeeId, today), this.repo.getShiftForEmployee(employeeId, today)]);
    if (!empInfo) throw new NotFoundError("Employee", employeeId);
    if (empInfo.employment_status === "offboarded") throw new ValidationError("Cannot check in after offboarding");
    if (empInfo.exit_date && today > new Date(empInfo.exit_date).toISOString().split("T")[0]) throw new ValidationError("Cannot check in after exit date");
    if (empInfo.join_date && today < new Date(empInfo.join_date).toISOString().split("T")[0]) throw new ValidationError("Cannot check in before joining date");
    if (existing?.check_in_time) throw new ConflictError("Already checked in today");
    const now = new Date();
    const status = deriveStatus(now, null, shift?.start_time, shift?.end_time, shift?.grace_minutes ?? 15, userTz);
    return this.repo.createCheckIn(employeeId, today, now, status, userId);
  }

  async checkOut(employeeId: string, userTz: string) {
    const today = todayInTz(userTz);
    const [empInfo, existing, shift] = await Promise.all([this.repo.getEmployeeInfo(employeeId), this.repo.getTodayRecord(employeeId, today), this.repo.getShiftForEmployee(employeeId, today)]);
    if (!empInfo) throw new NotFoundError("Employee", employeeId);
    if (empInfo.employment_status === "offboarded") throw new ValidationError("Cannot check out after offboarding");
    if (!existing?.check_in_time) throw new ValidationError("No check-in found for today");
    if (existing.check_out_time) throw new ConflictError("Already checked out today");
    const now = new Date();
    const status = deriveStatus(new Date(existing.check_in_time), now, shift?.start_time, shift?.end_time, shift?.grace_minutes ?? 15, userTz);
    return this.repo.updateCheckOut(existing.id, now, status);
  }

  // Records
  async listRecords(filters: any) { return this.repo.listRecords(filters); }
  async manualUpsert(employeeId: string, date: string, data: any, userId: string) {
    const shift = await this.repo.getShiftForEmployee(employeeId, date);
    let status = data.status;
    if (data.checkInTime || data.checkOutTime) {
      const ci = data.checkInTime ? new Date(data.checkInTime) : null;
      const co = data.checkOutTime ? new Date(data.checkOutTime) : null;
      status = deriveStatus(ci, co, shift?.start_time ?? null, shift?.end_time ?? null, shift?.grace_minutes ?? 15, "UTC");
    }
    return this.repo.manualUpsert(employeeId, date, { ...data, status: status || "present" }, userId);
  }
  async listAudit(attendanceId: string) { return this.repo.listAudit(attendanceId); }

  async getToday(employeeId: string, userTz: string) {
    const today = todayInTz(userTz);
    return this.repo.getTodayWithShift(employeeId, today);
  }
  async getStats(userTz: string) {
    const today = todayInTz(userTz);
    return this.repo.getStats(today);
  }
  async getEmployeeRecords(employeeId: string, from: string, to: string) {
    return this.repo.getEmployeeRecords(employeeId, from, to);
  }
  async getReport(from: string, to: string, department?: string) {
    return this.repo.getReport(from, to, department);
  }
  async updateRecord(id: string, data: { checkInTime?: string | null; checkOutTime?: string | null; remarks?: string | null }, userTz: string, userId: string) {
    const row = await this.repo.getRecordById(id);
    if (!row) return null;
    const shift = await this.repo.getShiftForEmployee(row.employee_id, row.date);
    const ci = data.checkInTime != null ? (data.checkInTime ? new Date(data.checkInTime) : null) : (row.check_in_time ? new Date(row.check_in_time) : null);
    const co = data.checkOutTime != null ? (data.checkOutTime ? new Date(data.checkOutTime) : null) : (row.check_out_time ? new Date(row.check_out_time) : null);
    const status = deriveStatus(ci, co, shift?.start_time ?? null, shift?.end_time ?? null, shift?.grace_minutes ?? 15, userTz);
    return this.repo.updateRecord(id, data, status, userId, data.remarks || "Edit from report", row);
  }
  async deleteRecord(id: string) {
    const row = await this.repo.getRecordById(id);
    if (!row) return false;
    await this.repo.deleteRecord(id);
    return true;
  }
  async getDailySummary(date: string) {
    return this.repo.getDailySummary(date);
  }
}
