import { BaseRepository } from "../../core/base/BaseRepository.js";

const DOC_TYPE_LABELS: Record<string, string> = { cnic_front:"CNIC Front", cnic_back:"CNIC Back", professional_photo:"Professional Profile Photograph", passport:"Passport", drivers_license:"Driver's License", degree_transcript:"Degree / Transcript", experience_certificate:"Experience Certificate", salary_slip:"Latest Salary Slip", resignation_acceptance:"Resignation Acceptance Letter", internship_certificate:"Internship Certificate" };

function generateDocumentChecklist(isFirstJob: boolean) {
  const docs = [{ documentType:"cnic_front",required:true,autoStatus:"pending" },{ documentType:"cnic_back",required:true,autoStatus:"pending" },{ documentType:"professional_photo",required:true,autoStatus:"pending" },{ documentType:"passport",required:false,autoStatus:"pending" },{ documentType:"drivers_license",required:false,autoStatus:"pending" },{ documentType:"degree_transcript",required:true,autoStatus:"pending" }];
  if (isFirstJob) { docs.push({ documentType:"salary_slip",required:false,autoStatus:"not_applicable" },{ documentType:"experience_certificate",required:false,autoStatus:"not_applicable" },{ documentType:"resignation_acceptance",required:false,autoStatus:"not_applicable" },{ documentType:"internship_certificate",required:false,autoStatus:"pending" }); }
  else { docs.push({ documentType:"experience_certificate",required:true,autoStatus:"pending" },{ documentType:"salary_slip",required:true,autoStatus:"pending" },{ documentType:"resignation_acceptance",required:true,autoStatus:"pending" }); }
  return docs;
}

export { DOC_TYPE_LABELS, generateDocumentChecklist };

export class TentativeRepository extends BaseRepository {
  async getApplication(id: string) { const r = await this.sql`SELECT a.*,o.status as offer_status,o.id as offer_id FROM applications a LEFT JOIN offers o ON o.application_id=a.id WHERE a.id=${id}` as any[]; return r[0]??null; }
  async getExistingTentative(applicationId: string) { const r = await this.sql`SELECT id FROM tentative_records WHERE application_id=${applicationId}` as any[]; return r[0]??null; }
  async createTentativeRecord(applicationId: string, candidateId: string, isFirstJob: boolean, initiatedBy: string) {
    const r = await this.sql`INSERT INTO tentative_records(application_id,candidate_id,status,is_first_job,initiated_by) VALUES(${applicationId},${candidateId},'pending',${isFirstJob},${initiatedBy}) RETURNING *` as any[];
    return r[0];
  }
  async insertDocument(tentativeId: string, docType: string, required: boolean, status: string) { await this.sql`INSERT INTO tentative_documents(tentative_record_id,document_type,required,status) VALUES(${tentativeId},${docType},${required},${status})`; }
  async updateApplicationStage(applicationId: string, fromStage: string, toStage: string, notes: string, movedBy: string) {
    await this.sql`UPDATE applications SET stage=${toStage},stage_updated_at=NOW(),updated_at=NOW() WHERE id=${applicationId}`;
    await this.sql`INSERT INTO application_stage_history(application_id,from_stage,to_stage,notes,moved_by) VALUES(${applicationId},${fromStage},${toStage},${notes},${movedBy})`;
  }
  async getDocuments(tentativeId: string, publicFields = false) {
    if (publicFields) return this.sql`SELECT id,document_type,required,status,file_name,rejection_reason,uploaded_at,verified_at FROM tentative_documents WHERE tentative_record_id=${tentativeId} ORDER BY created_at` as Promise<any[]>;
    return this.sql`SELECT * FROM tentative_documents WHERE tentative_record_id=${tentativeId} ORDER BY created_at` as Promise<any[]>;
  }
  async getByApplicationId(applicationId: string) { const r = await this.sql`SELECT tr.*,c.first_name,c.last_name,c.email FROM tentative_records tr JOIN candidates c ON c.id=tr.candidate_id WHERE tr.application_id=${applicationId}` as any[]; return r[0]??null; }
  async getById(tentativeId: string) { const r = await this.sql`SELECT tr.*,c.first_name,c.last_name,c.email FROM tentative_records tr JOIN candidates c ON c.id=tr.candidate_id WHERE tr.id=${tentativeId}` as any[]; return r[0]??null; }
  async getByToken(token: string) { const r = await this.sql`SELECT tr.*,c.first_name,c.last_name,c.email FROM tentative_records tr JOIN candidates c ON c.id=tr.candidate_id WHERE tr.portal_token=${token}` as any[]; return r[0]??null; }
  async listAll() { return this.sql`SELECT tr.*,c.first_name,c.last_name,c.email,j.title as job_title,j.department,(SELECT count(*)::int FROM tentative_documents td WHERE td.tentative_record_id=tr.id AND td.required=true AND td.status NOT IN('verified','not_applicable')) as pending_required,(SELECT count(*)::int FROM tentative_documents td WHERE td.tentative_record_id=tr.id AND td.required=true) as total_required FROM tentative_records tr JOIN candidates c ON c.id=tr.candidate_id JOIN applications a ON a.id=tr.application_id JOIN job_postings j ON j.id=a.job_id ORDER BY tr.created_at DESC` as Promise<any[]>; }
  async getDocument(docId: string) { const r = await this.sql`SELECT * FROM tentative_documents WHERE id=${docId}` as any[]; return r[0]??null; }
  async getDocumentFile(docId: string) { const r = await this.sql`SELECT td.file_url,td.file_name,td.document_type FROM tentative_documents td WHERE td.id=${docId}` as any[]; return r[0]??null; }
  async uploadDocument(docId: string, fileUrl: string, fileName: string|null) { const r = await this.sql`UPDATE tentative_documents SET file_url=${fileUrl},file_name=${fileName},status='uploaded',rejection_reason=NULL,uploaded_at=NOW(),updated_at=NOW() WHERE id=${docId} RETURNING *` as any[]; return r[0]; }
  async verifyDocument(docId: string, verifiedBy: string) { const r = await this.sql`UPDATE tentative_documents SET status='verified',verified_by=${verifiedBy},verified_at=NOW(),rejection_reason=NULL,updated_at=NOW() WHERE id=${docId} RETURNING *` as any[]; return r[0]; }
  async rejectDocument(docId: string, reason: string, verifiedBy: string) { const r = await this.sql`UPDATE tentative_documents SET status='rejected',rejection_reason=${reason},verified_by=${verifiedBy},updated_at=NOW() WHERE id=${docId} RETURNING *` as any[]; return r[0]; }
  async getPendingRequiredCount(tentativeId: string) { const r = await this.sql`SELECT count(*)::int as count FROM tentative_documents WHERE tentative_record_id=${tentativeId} AND required=true AND status NOT IN('verified','not_applicable')` as any[]; return r[0]?.count??0; }
  async clearRecord(tentativeId: string) { const r = await this.sql`UPDATE tentative_records SET status='cleared',cleared_at=NOW() WHERE id=${tentativeId} RETURNING *` as any[]; return r[0]; }
  async failRecord(tentativeId: string, reason: string|null) { const r = await this.sql`UPDATE tentative_records SET status='failed',failed_at=NOW(),failed_reason=${reason} WHERE id=${tentativeId} RETURNING *` as any[]; return r[0]; }
  async updateFirstJob(tentativeId: string, isFirstJob: boolean) { await this.sql`UPDATE tentative_records SET is_first_job=${isFirstJob} WHERE id=${tentativeId}`; }
  async deleteDocuments(tentativeId: string) { await this.sql`DELETE FROM tentative_documents WHERE tentative_record_id=${tentativeId}`; }

  // Confirm hire
  async getApplicationWithCandidate(applicationId: string) { const r = await this.sql`SELECT a.*,c.first_name,c.last_name,c.email as personal_email,c.phone,j.location as job_location FROM applications a JOIN candidates c ON c.id=a.candidate_id LEFT JOIN job_postings j ON j.id=a.job_id WHERE a.id=${applicationId}` as any[]; return r[0]??null; }
  async getOffer(applicationId: string) { const r = await this.sql`SELECT * FROM offers WHERE application_id=${applicationId}` as any[]; return r[0]??null; }
  async createEmployee(data: any) { const r = await this.sql`INSERT INTO employees(employee_id,work_email,first_name,last_name,job_title,department,location,employment_status,employee_type,join_date,personal_email,work_phone,source) VALUES(${data.employeeId},${data.workEmail},${data.firstName},${data.lastName},${data.jobTitle},${data.department||"Other"},${data.location},${data.status},${data.employeeType||"full_time"},${data.joinDate},${data.personalEmail||null},${data.phone||null},'manual') RETURNING *` as any[]; return r[0]; }
  async getVerifiedDocs(tentativeId: string) { return this.sql`SELECT id,document_type,file_url,file_name,uploaded_at FROM tentative_documents WHERE tentative_record_id=${tentativeId} AND status='verified' AND file_url IS NOT NULL AND file_url!=''` as Promise<any[]>; }
  async copyDocToEmployee(employeeId: string, doc: any, label: string) { await this.sql`INSERT INTO employee_documents(employee_id,display_name,document_type,file_url,file_name,source,tentative_document_id,uploaded_at) VALUES(${employeeId},${label},${doc.document_type},${doc.file_url},${doc.file_name||null},'tentative_verification',${doc.id},${doc.uploaded_at})`; }
}
