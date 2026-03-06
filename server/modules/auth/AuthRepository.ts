import { BaseRepository } from "../../core/base/BaseRepository.js";

const PG_UNDEFINED_COLUMN = "42703";

export class AuthRepository extends BaseRepository {
  async findUserByEmail(email: string) {
    try {
      const r = await this.sql`SELECT id,email,password_hash,role,employee_id,is_active,allowed_modules FROM users WHERE email=${email}` as any[];
      return r[0]??null;
    } catch (e: any) {
      if (e.code === PG_UNDEFINED_COLUMN) {
        const r = await this.sql`SELECT id,email,password_hash,role,employee_id,is_active FROM users WHERE email=${email}` as any[];
        return r[0]??null;
      }
      throw e;
    }
  }

  async findUserById(userId: string) {
    try {
      const r = await this.sql`SELECT u.id,u.email,u.role,u.employee_id,u.allowed_modules,u.time_zone,e.first_name,e.last_name,e.avatar FROM users u LEFT JOIN employees e ON u.employee_id=e.id WHERE u.id=${userId} AND u.is_active='true'` as any[];
      return r[0]??null;
    } catch (e: any) {
      if (e.code === PG_UNDEFINED_COLUMN) {
        const r = await this.sql`SELECT u.id,u.email,u.role,u.employee_id,u.allowed_modules,e.first_name,e.last_name,e.avatar FROM users u LEFT JOIN employees e ON u.employee_id=e.id WHERE u.id=${userId} AND u.is_active='true'` as any[];
        return r[0]??null;
      }
      throw e;
    }
  }

  async updateLastLogin(userId: string) { await this.sql`UPDATE users SET last_login_at=NOW(),updated_at=NOW() WHERE id=${userId}`; }

  async createUser(email: string, passwordHash: string|null, role: string, employeeId: string|null, provider: string) {
    const r = await this.sql`INSERT INTO users(email,password_hash,role,employee_id,auth_provider) VALUES(${email},${passwordHash},${role},${employeeId},${provider}) RETURNING id,email,role,employee_id` as any[];
    return r[0];
  }

  async listUsers() {
    try {
      return this.sql`SELECT u.id,u.email,u.role,u.roles,u.employee_id,u.is_active,u.last_login_at,u.allowed_modules,e.first_name,e.last_name,e.job_title,e.department FROM users u LEFT JOIN employees e ON e.id=u.employee_id ORDER BY u.email` as Promise<any[]>;
    } catch (e: any) {
      if (e.code === PG_UNDEFINED_COLUMN) {
        return this.sql`SELECT u.id,u.email,u.role,u.roles,u.employee_id,u.is_active,u.last_login_at,e.first_name,e.last_name,e.job_title,e.department FROM users u LEFT JOIN employees e ON e.id=u.employee_id ORDER BY u.email` as Promise<any[]>;
      }
      throw e;
    }
  }

  async findExistingUser(email: string) { const r = await this.sql`SELECT id FROM users WHERE email=${email}` as any[]; return r[0]??null; }

  async updateUser(id: string, data: { role: string; employeeId: string|null; isActive: string; allowedModules: any[] }) {
    await this.sql`UPDATE users SET role=${data.role},employee_id=${data.employeeId},is_active=${data.isActive},allowed_modules=${JSON.stringify(data.allowedModules)}::jsonb,updated_at=NOW() WHERE id=${id}`;
  }

  async deleteUser(id: string) { await this.sql`DELETE FROM users WHERE id=${id}`; }
  async findUserRow(id: string) { const r = await this.sql`SELECT id,email,role,employee_id,is_active,allowed_modules FROM users WHERE id=${id}` as any[]; return r[0]??null; }
  async updateTimezone(userId: string, tz: string|null) {
    try { await this.sql`UPDATE users SET time_zone=${tz},updated_at=NOW() WHERE id=${userId}`; } catch (e: any) { if (e.code !== PG_UNDEFINED_COLUMN) throw e; }
  }
  async updatePasswordHash(userId: string, hash: string) { await this.sql`UPDATE users SET password_hash=${hash},updated_at=NOW() WHERE id=${userId}`; }
  async findPasswordHash(userId: string) { const r = await this.sql`SELECT id,password_hash FROM users WHERE id=${userId}` as any[]; return r[0]??null; }

  async findEmployeeByEmail(email: string) { const r = await this.sql`SELECT id FROM employees WHERE LOWER(TRIM(work_email))=${email} OR (personal_email IS NOT NULL AND LOWER(TRIM(personal_email))=${email}) LIMIT 1` as any[]; return r[0]??null; }
  async findUserByEmployeeId(employeeId: string) { const r = await this.sql`SELECT id,email,role,employee_id,is_active FROM users WHERE employee_id=${employeeId} LIMIT 1` as any[]; return r[0]??null; }
  async linkEmployeeToUser(userId: string, employeeId: string) { await this.sql`UPDATE users SET employee_id=${employeeId},updated_at=NOW() WHERE id=${userId}`; }
  async syncMicrosoftUser(userId: string, email: string) {
    try { await this.sql`UPDATE users SET email=${email},auth_provider='microsoft',sso_provider='microsoft',last_login_at=NOW(),updated_at=NOW() WHERE id=${userId}`; }
    catch { await this.sql`UPDATE users SET email=${email},sso_provider='microsoft',last_login_at=NOW(),updated_at=NOW() WHERE id=${userId}`; }
  }
  async createMicrosoftUser(email: string, employeeId: string|null) {
    try { const r = await this.sql`INSERT INTO users(email,role,employee_id,is_active,auth_provider,sso_provider) VALUES(${email},'employee',${employeeId},'true','microsoft','microsoft') RETURNING id,email,role,employee_id,is_active` as any[]; return r[0]; }
    catch { const r = await this.sql`INSERT INTO users(email,role,employee_id,is_active,sso_provider) VALUES(${email},'employee',${employeeId},'true','microsoft') RETURNING id,email,role,employee_id,is_active` as any[]; return r[0]; }
  }
}
