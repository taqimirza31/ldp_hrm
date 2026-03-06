import { CompensationRepository } from "./CompensationRepository.js";
import { NotFoundError } from "../../core/types/index.js";

export class CompensationService {
  private readonly repo = new CompensationRepository();

  // Emergency Contacts
  async getAllEmergencyContacts() { return this.repo.getAllEmergencyContacts(); }
  async getEmergencyContacts(employeeId: string) { return this.repo.getEmergencyContacts(employeeId); }
  async getDependents(employeeId: string) { return this.repo.getDependents(employeeId); }

  // Salary
  async getSalary(employeeId: string) { return this.repo.getSalary(employeeId); }
  async createSalary(employeeId: string, data: any, updatedBy: string) { return this.repo.createSalary(employeeId, data, updatedBy); }
  async updateSalary(id: string, data: any, updatedBy: string) {
    const row = await this.repo.updateSalary(id, data, updatedBy);
    if (!row) throw new NotFoundError("Salary record", id);
    return row;
  }
  async deleteSalary(id: string) {
    const ok = await this.repo.deleteSalary(id);
    if (!ok) throw new NotFoundError("Salary record", id);
  }

  // Banking
  async getBanking(employeeId: string) { return this.repo.getBanking(employeeId); }
  async createBanking(employeeId: string, data: any, updatedBy: string) { return this.repo.createBanking(employeeId, data, updatedBy); }
  async updateBanking(id: string, data: any, updatedBy: string) {
    const row = await this.repo.updateBanking(id, data, updatedBy);
    if (!row) throw new NotFoundError("Banking record", id);
    return row;
  }
  async deleteBanking(id: string) {
    const ok = await this.repo.deleteBanking(id);
    if (!ok) throw new NotFoundError("Banking record", id);
  }

  // Bonuses
  async getBonuses(employeeId: string) { return this.repo.getBonuses(employeeId); }
  async createBonus(employeeId: string, data: any, updatedBy: string) { return this.repo.createBonus(employeeId, data, updatedBy); }
  async updateBonus(id: string, data: any, updatedBy: string) {
    const row = await this.repo.updateBonus(id, data, updatedBy);
    if (!row) throw new NotFoundError("Bonus record", id);
    return row;
  }
  async deleteBonus(id: string) {
    const ok = await this.repo.deleteBonus(id);
    if (!ok) throw new NotFoundError("Bonus record", id);
  }

  // Stock Grants
  async getStockGrants(employeeId: string) { return this.repo.getStockGrants(employeeId); }
  async createStockGrant(employeeId: string, data: any, updatedBy: string) { return this.repo.createStockGrant(employeeId, data, updatedBy); }
  async updateStockGrant(id: string, data: any, updatedBy: string) {
    const row = await this.repo.updateStockGrant(id, data, updatedBy);
    if (!row) throw new NotFoundError("Stock grant", id);
    return row;
  }
  async deleteStockGrant(id: string) {
    const ok = await this.repo.deleteStockGrant(id);
    if (!ok) throw new NotFoundError("Stock grant", id);
  }
}
