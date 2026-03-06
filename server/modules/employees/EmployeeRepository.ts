import { BaseRepository } from "../../core/base/BaseRepository.js";

const ALLOWED_FIELDS = ["employee_id","work_email","first_name","middle_name","last_name","avatar","job_title","department","sub_department","business_unit","primary_team","cost_center","grade","job_category","location","manager_id","manager_email","hr_email","employment_status","employee_type","shift","personal_email","work_phone","dob","gender","marital_status","blood_group","street","city","state","country","zip_code","comm_street","comm_city","comm_state","comm_country","comm_zip_code","join_date","probation_start_date","probation_end_date","confirmation_date","notice_period","resignation_date","exit_date","exit_type","resignation_reason","eligible_for_rehire","custom_field_1","custom_field_2","source"];

export { ALLOWED_FIELDS };

export class EmployeeRepository extends BaseRepository {
  private readonly LIST_COLS = "id,employee_id,work_email,first_name,middle_name,last_name,job_title,department,sub_department,business_unit,location,grade,employment_status,employee_type,join_date,manager_id,city,state,country,avatar";

  async list(includeInactive: boolean, limit: number, offset: number) {
    if (includeInactive) return this.sql(`SELECT ${this.LIST_COLS} FROM employees ORDER BY first_name,last_name LIMIT $1 OFFSET $2`, [limit, offset]) as Promise<any[]>;
    return this.sql(`SELECT ${this.LIST_COLS} FROM employees WHERE employment_status IN('active','onboarding','on_leave') ORDER BY first_name,last_name LIMIT $1 OFFSET $2`, [limit, offset]) as Promise<any[]>;
  }

  async search(q: string, department: string, status: string, includeInactive: boolean, limit: number, offset: number) {
    const conds: string[] = []; const params: any[] = [];
    const p = () => { params.push(null); return `$${params.length}`; };
    if (!includeInactive) conds.push("employment_status IN('active','onboarding','on_leave')");
    if (q) { const pat = `%${q.toLowerCase().replace(/[%_\\]/g,"\\$&")}%`; params[params.length] = pat; const n = params.length; conds.push(`(LOWER(first_name) LIKE $${n} OR LOWER(last_name) LIKE $${n} OR LOWER(work_email) LIKE $${n} OR LOWER(employee_id) LIKE $${n})`); }
    if (department) { params.push(department); conds.push(`department=$${params.length}`); }
    if (status) { params.push(status); conds.push(`employment_status=$${params.length}`); }
    const where = conds.length ? " WHERE "+conds.join(" AND ") : "";
    const [countRows, rows] = await Promise.all([
      this.sql(`SELECT COUNT(*)::int as total FROM employees${where}`, params) as Promise<any[]>,
      this.sql(`SELECT ${this.LIST_COLS} FROM employees${where} ORDER BY first_name,last_name LIMIT $${params.length+1} OFFSET $${params.length+2}`, [...params, limit, offset]) as Promise<any[]>,
    ]);
    return { data: rows, total: countRows[0]?.total ?? 0 };
  }

  async getById(id: string) { const r = await this.sql`SELECT * FROM employees WHERE id=${id}` as any[]; return r[0]??null; }

  async findByEmail(email: string, excludeId?: string) {
    if (excludeId) return this.sql`SELECT id FROM employees WHERE LOWER(work_email)=${email} AND id!=${excludeId}` as Promise<any[]>;
    return this.sql`SELECT id FROM employees WHERE LOWER(work_email)=${email}` as Promise<any[]>;
  }

  async create(data: Record<string, any>) {
    const cols = Object.keys(data).join(",");
    const placeholders = Object.keys(data).map((_,i) => `$${i+1}`).join(",");
    const r = await this.sql(`INSERT INTO employees(${cols}) VALUES(${placeholders}) RETURNING *`, Object.values(data)) as any[];
    return r[0];
  }

  async update(id: string, data: Record<string, any>, updatedBy?: string) {
    const keys = Object.keys(data); const values = Object.values(data);
    const setClause = keys.map((k,i) => `${k}=$${i+1}`).join(",");
    const r = await this.sql(`UPDATE employees SET ${setClause},updated_at=NOW() WHERE id=$${keys.length+1} RETURNING *`, [...values, id]) as any[];
    if (r[0] && updatedBy) {
      try { await this.sql(`INSERT INTO employee_profile_changes(employee_id,changed_by,changed_fields) VALUES($1,$2,$3::jsonb)`, [id, updatedBy, JSON.stringify(keys)]); } catch {}
    }
    return r[0]??null;
  }

  async delete(id: string) {
    await this.sql`DELETE FROM onboarding_records WHERE employee_id=${id}`;
    const r = await this.sql`DELETE FROM employees WHERE id=${id} RETURNING id` as any[];
    return r.length > 0;
  }

  async getDepartments() {
    const [fromTable, fromEmps] = await Promise.all([
      (async () => { try { return (await this.sql`SELECT name FROM departments ORDER BY name` as any[]).map((r:any)=>r.name); } catch { return []; } })(),
      (this.sql`SELECT DISTINCT department FROM employees WHERE department IS NOT NULL AND TRIM(department)!=''` as Promise<any[]>).then(r=>r.map((row:any)=>row.department)),
    ]);
    return [...new Set([...fromTable, ...fromEmps])].filter(Boolean).sort((a,b)=>a.localeCompare(b));
  }

  async getSuggestedId() {
    const rows = await this.sql`SELECT employee_id FROM employees ORDER BY employee_id` as any[];
    let max = 0;
    for (const r of rows) { const m = (r.employee_id||"").match(/(\d+)$/); if (m) max = Math.max(max, parseInt(m[1],10)); }
    return `EMP-${String(max+1).padStart(3,"0")}`;
  }

  // Avatar
  async getAvatar(id: string) { const r = await this.sql`SELECT avatar FROM employees WHERE id=${id}` as any[]; return r[0]??null; }

  // Documents
  async getDocumentFile(docId: string) { const r = await this.sql`SELECT ed.file_url,ed.file_name,ed.employee_id FROM employee_documents ed WHERE ed.id=${docId}` as any[]; return r[0]??null; }
  async listDocuments(employeeId: string) { return this.sql`SELECT id,display_name,document_type,file_name,source,uploaded_at,created_at FROM employee_documents WHERE employee_id=${employeeId} ORDER BY uploaded_at DESC NULLS LAST,created_at DESC` as Promise<any[]>; }
  async createDocument(employeeId: string, section: string, displayName: string, fileUrl: string, fileName: string) {
    const r = await this.sql`INSERT INTO employee_documents(employee_id,document_type,display_name,file_url,file_name,source,uploaded_at) VALUES(${employeeId},${section},${displayName},${fileUrl},${fileName},'manual',NOW()) RETURNING id,display_name,document_type,file_name,source,uploaded_at,created_at` as any[];
    return r[0];
  }
  async deleteDocument(docId: string) { const r = await this.sql`DELETE FROM employee_documents WHERE id=${docId} RETURNING id` as any[]; return r.length > 0; }

  // Timeline
  async getTimeline(employeeId: string) {
    const r = await this.sql`SELECT join_date,confirmation_date,probation_start_date,probation_end_date,resignation_date,exit_date,job_title,department FROM employees WHERE id=${employeeId}` as any[];
    if (!r[0]) return null;
    const [salary, onboarding, offboarding, docs, profileChanges] = await Promise.all([
      this.sql`SELECT start_date,reason,annual_salary,currency FROM salary_details WHERE employee_id=${employeeId} ORDER BY start_date DESC` as Promise<any[]>,
      this.sql`SELECT created_at,completed_at,status FROM onboarding_records WHERE employee_id=${employeeId} ORDER BY created_at DESC` as Promise<any[]>,
      this.sql`SELECT initiated_at,exit_date,completed_at,status FROM offboarding_records WHERE employee_id=${employeeId} ORDER BY initiated_at DESC` as Promise<any[]>,
      this.sql`SELECT uploaded_at,display_name,document_type FROM employee_documents WHERE employee_id=${employeeId} AND uploaded_at IS NOT NULL ORDER BY uploaded_at DESC LIMIT 5` as Promise<any[]>,
      (async () => { try { return await this.sql`SELECT changed_at,changed_fields FROM employee_profile_changes WHERE employee_id=${employeeId} ORDER BY changed_at DESC` as any[]; } catch { return []; } })(),
    ]);
    return { emp: r[0], salary, onboarding, offboarding, docs, profileChanges };
  }

  // Sync tentative documents
  async getHiredApplicationId(employeeId: string) { const r = await this.sql`SELECT id FROM applications WHERE employee_id=${employeeId} AND stage='hired' ORDER BY updated_at DESC LIMIT 1` as any[]; return r[0]?.id??null; }
  async getClearedTentativeId(applicationId: string) { const r = await this.sql`SELECT id FROM tentative_records WHERE application_id=${applicationId} AND status='cleared' LIMIT 1` as any[]; return r[0]?.id??null; }
  async getVerifiedTentativeDocs(tentativeId: string) { return this.sql`SELECT id,document_type,file_url,file_name,uploaded_at FROM tentative_documents WHERE tentative_record_id=${tentativeId} AND status='verified' AND file_url IS NOT NULL AND file_url!=''` as Promise<any[]>; }
  async getExistingTentativeDocIds(employeeId: string) { const r = await this.sql`SELECT tentative_document_id FROM employee_documents WHERE employee_id=${employeeId} AND tentative_document_id IS NOT NULL` as any[]; return new Set(r.map((row:any)=>row.tentative_document_id).filter(Boolean)); }
  async copyTentativeDoc(employeeId: string, doc: any, label: string) { await this.sql`INSERT INTO employee_documents(employee_id,document_type,display_name,file_url,file_name,source,tentative_document_id,uploaded_at) VALUES(${employeeId},${doc.document_type},${label},${doc.file_url},${doc.file_name||null},'tentative_verification',${doc.id},${doc.uploaded_at})`; }

  // Avatar URL migrations
  async getAvatarUrlRows() { return this.sql`SELECT id,avatar FROM employees WHERE avatar IS NOT NULL AND TRIM(avatar)!='' AND (avatar LIKE 'http://%' OR avatar LIKE 'https://%')` as Promise<any[]>; }
  async getAvatarDataUrlRows() { return this.sql`SELECT id,avatar FROM employees WHERE avatar IS NOT NULL AND TRIM(avatar)!='' AND avatar LIKE 'data:%'` as Promise<any[]>; }
  async updateAvatar(id: string, avatar: string) { await this.sql`UPDATE employees SET avatar=${avatar},updated_at=NOW() WHERE id=${id}`; }

  async resolveManagerIds() {
    await this.sql`UPDATE employees e SET manager_id=(SELECT id FROM employees m WHERE m.work_email=e.manager_email LIMIT 1),updated_at=NOW() WHERE e.manager_email IS NOT NULL AND e.manager_email!='' AND (e.manager_id IS NULL OR e.manager_id='') AND EXISTS(SELECT 1 FROM employees m WHERE m.work_email=e.manager_email)`;
  }
}
