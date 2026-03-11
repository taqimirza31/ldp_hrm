import { BaseRepository } from "../../core/base/BaseRepository.js";

export class RecruitmentRepository extends BaseRepository {

  // ── Candidates ────────────────────────────────────────────────────────────────
  async listCandidates(limit: number, offset: number, search: string | null) {
    const noSearch = search === null;
    const pat = search;
    // Use a pre-aggregated JOIN instead of a per-row correlated subquery for application_count.
    // Both queries run in parallel; the GROUP BY is resolved once and joined by PK.
    const [countRows, rows] = await Promise.all([
      this.sql`SELECT COUNT(*)::int as total FROM candidates c WHERE (${noSearch} OR c.first_name ILIKE ${pat} OR c.last_name ILIKE ${pat} OR c.email ILIKE ${pat})`,
      this.sql`SELECT c.id,c.first_name,c.last_name,c.email,c.phone,c.linkedin_url,c.current_company,c.current_title,c.experience_years,c.current_salary,c.expected_salary,c.salary_currency,c.source,(c.resume_url IS NOT NULL AND LENGTH(TRIM(COALESCE(c.resume_url,'')))>50) AS has_resume,c.resume_filename,CASE WHEN c.resume_url IS NOT NULL AND c.resume_url LIKE 'http%' THEN c.resume_url ELSE NULL END AS resume_url,c.created_at,c.tags,c.city,c.state,c.country,c.date_of_birth,c.gender,COALESCE(ac.application_count,0)::int as application_count FROM candidates c LEFT JOIN (SELECT candidate_id,COUNT(*)::int AS application_count FROM applications GROUP BY candidate_id) ac ON ac.candidate_id=c.id WHERE (${noSearch} OR c.first_name ILIKE ${pat} OR c.last_name ILIKE ${pat} OR c.email ILIKE ${pat}) ORDER BY c.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
    ]);
    return { candidates: Array.isArray(rows) ? rows : [], total: (countRows[0] as any)?.total ?? 0 };
  }

  async getCandidateById(id: string) {
    const rows = await this.sql`SELECT * FROM candidates WHERE id = ${id}`;
    if (rows.length === 0) return null;
    const apps = await this.sql`SELECT a.*,j.title as job_title,j.department as job_department,j.location as job_location FROM applications a INNER JOIN job_postings j ON j.id=a.job_id WHERE a.candidate_id=${id} ORDER BY a.applied_at DESC`;
    return { ...(rows[0] as any), applications: apps };
  }

  async getCandidateResume(id: string) {
    const rows = await this.sql`SELECT id,resume_url,resume_filename FROM candidates WHERE id=${id}` as any[];
    return rows[0] ?? null;
  }

  async findCandidateByEmail(email: string) {
    const rows = await this.sql`SELECT id FROM candidates WHERE email=${email}` as any[];
    return rows[0] ?? null;
  }

  async findCandidateByEmailFull(email: string) {
    const rows = await this.sql`SELECT id,resume_url,resume_filename FROM candidates WHERE LOWER(TRIM(email))=${email}` as any[];
    return rows[0] ?? null;
  }

  async createCandidate(d: any) {
    const dob = d.dateOfBirth && String(d.dateOfBirth).trim() ? d.dateOfBirth : null;
    const pe = d.personalEmail && String(d.personalEmail).trim() ? d.personalEmail : null;
    const tags = d.tags != null ? JSON.stringify(d.tags) : null;
    const r = await this.sql`INSERT INTO candidates(first_name,middle_name,last_name,email,phone,linkedin_url,current_company,current_title,experience_years,current_salary,expected_salary,salary_currency,resume_url,resume_filename,date_of_birth,gender,marital_status,blood_group,personal_email,street,city,state,country,zip_code,source,notes,tags) VALUES(${d.firstName},${d.middleName??null},${d.lastName},${d.email},${d.phone||null},${d.linkedinUrl||null},${d.currentCompany||null},${d.currentTitle||null},${d.experienceYears??null},${d.currentSalary??null},${d.expectedSalary??null},${d.salaryCurrency||null},${d.resumeUrl||""},${d.resumeFilename||null},${dob},${d.gender||null},${d.maritalStatus||null},${d.bloodGroup||null},${pe},${d.street||null},${d.city||null},${d.state||null},${d.country||null},${d.zipCode||null},${d.source||"manual"},${d.notes||null},${tags}) RETURNING *` as any[];
    return r[0];
  }

  async updateCandidate(id: string, u: any, resumeUrl?: string) {
    const tags = u.tags != null ? JSON.stringify(u.tags) : null;
    const r = await this.sql`UPDATE candidates SET first_name=COALESCE(${u.firstName},first_name),middle_name=COALESCE(${u.middleName??null},middle_name),last_name=COALESCE(${u.lastName},last_name),phone=COALESCE(${u.phone},phone),linkedin_url=COALESCE(${u.linkedinUrl},linkedin_url),current_company=COALESCE(${u.currentCompany},current_company),current_title=COALESCE(${u.currentTitle},current_title),experience_years=COALESCE(${u.experienceYears},experience_years),current_salary=COALESCE(${u.currentSalary},current_salary),expected_salary=COALESCE(${u.expectedSalary},expected_salary),salary_currency=COALESCE(${u.salaryCurrency},salary_currency),resume_url=COALESCE(${resumeUrl??null},resume_url),resume_filename=COALESCE(${u.resumeFilename},resume_filename),date_of_birth=COALESCE(${u.dateOfBirth??null},date_of_birth),gender=COALESCE(${u.gender??null},gender),marital_status=COALESCE(${u.maritalStatus??null},marital_status),blood_group=COALESCE(${u.bloodGroup??null},blood_group),personal_email=COALESCE(${u.personalEmail??null},personal_email),street=COALESCE(${u.street??null},street),city=COALESCE(${u.city??null},city),state=COALESCE(${u.state??null},state),country=COALESCE(${u.country??null},country),zip_code=COALESCE(${u.zipCode??null},zip_code),source=COALESCE(${u.source},source),notes=COALESCE(${u.notes},notes),tags=COALESCE(${tags},tags),updated_at=NOW() WHERE id=${id} RETURNING *` as any[];
    return r[0];
  }

  async upsertCandidateFromFreshteam(email: string, data: any, existingId?: string) {
    if (existingId) {
      const r = await this.sql`UPDATE candidates SET first_name=${data.firstName},middle_name=COALESCE(${data.middleName??null},middle_name),last_name=${data.lastName},phone=COALESCE(${data.phone??null},phone),linkedin_url=COALESCE(${data.linkedinUrl??null},linkedin_url),current_company=COALESCE(${data.currentCompany??null},current_company),current_title=COALESCE(${data.currentTitle??null},current_title),current_salary=COALESCE(${data.currentSalary??null},current_salary),expected_salary=COALESCE(${data.expectedSalary??null},expected_salary),salary_currency=COALESCE(${data.salaryCurrency??null},salary_currency),city=COALESCE(${data.city??null},city),state=COALESCE(${data.state??null},state),country=COALESCE(${data.country??null},country),street=COALESCE(${data.street??null},street),zip_code=COALESCE(${data.zipCode??null},zip_code),date_of_birth=COALESCE(${data.dateOfBirth??null},date_of_birth),gender=COALESCE(${data.gender??null},gender),experience_years=COALESCE(${data.experienceYears??null},experience_years),notes=COALESCE(${data.notes??null},notes),tags=COALESCE(${data.tagsJson??null},tags),resume_url=${data.setResume?(data.resumeUrl??null):this.sql`resume_url`},resume_filename=${data.setResume?(data.resumeFilename??null):this.sql`resume_filename`},freshteam_candidate_id=${data.freshteamCandidateId??null},updated_at=NOW() WHERE id=${existingId} RETURNING id` as any[];
      return { id: r[0]?.id ?? existingId, created: false };
    }
    const r = await this.sql`INSERT INTO candidates(first_name,middle_name,last_name,email,phone,linkedin_url,current_company,current_title,current_salary,expected_salary,salary_currency,city,state,country,street,zip_code,date_of_birth,gender,experience_years,notes,tags,resume_url,resume_filename,source,freshteam_candidate_id) VALUES(${data.firstName},${data.middleName??null},${data.lastName},${email},${data.phone??null},${data.linkedinUrl??null},${data.currentCompany??null},${data.currentTitle??null},${data.currentSalary??null},${data.expectedSalary??null},${data.salaryCurrency??null},${data.city??null},${data.state??null},${data.country??null},${data.street??null},${data.zipCode??null},${data.dateOfBirth??null},${data.gender??null},${data.experienceYears??null},${data.notes??null},${data.tagsJson??null},${data.resumeUrl||""},${data.resumeFilename??null},'freshteam',${data.freshteamCandidateId??null}) RETURNING id` as any[];
    return { id: r[0]?.id, created: true };
  }

  async deleteCandidate(id: string) {
    const r = await this.sql`DELETE FROM candidates WHERE id=${id} RETURNING id` as any[];
    return r[0] ?? null;
  }

  async findCandidateByFreshteamId(ftId: string) {
    const r = await this.sql`SELECT id FROM candidates WHERE freshteam_candidate_id=${ftId}` as any[];
    return r[0] ?? null;
  }

  // ── Job Postings ──────────────────────────────────────────────────────────────
  async getJobFilterOptions() {
    const [depts, locs, empTypes] = await Promise.all([
      this.sql`SELECT DISTINCT department FROM job_postings WHERE department IS NOT NULL AND department!='' ORDER BY department`,
      this.sql`SELECT DISTINCT location FROM job_postings WHERE location IS NOT NULL AND location!='' ORDER BY location`,
      this.sql`SELECT DISTINCT employment_type FROM job_postings WHERE employment_type IS NOT NULL AND employment_type!='' ORDER BY employment_type`,
    ]);
    return { departments: (depts as any[]).map((r:any)=>r.department), locations: (locs as any[]).map((r:any)=>r.location), employmentTypes: (empTypes as any[]).map((r:any)=>r.employment_type) };
  }

  async listJobs(statuses: string[], departments: string[], locations: string[], employmentTypes: string[], limit: number, offset: number) {
    const noStatus=statuses.length===0, noDept=departments.length===0, noLoc=locations.length===0, noEmp=employmentTypes.length===0;
    const [countRows, jobs] = await Promise.all([
      this.sql`SELECT COUNT(*)::int as total FROM job_postings j WHERE (${noStatus} OR j.status=ANY(${statuses})) AND (${noDept} OR j.department=ANY(${departments})) AND (${noLoc} OR j.location=ANY(${locations})) AND (${noEmp} OR j.employment_type=ANY(${employmentTypes}))`,
      // description and requirements are large text columns — omitted from list; load in getJobById
      this.sql`SELECT j.id,j.title,j.department,j.location,j.employment_type,j.salary_range_min,j.salary_range_max,j.salary_currency,j.headcount,j.hiring_manager_id,j.hiring_manager_ids,j.status,j.published_channels,j.experience_level,j.remote,j.published_at,j.closed_at,j.created_at,j.updated_at FROM job_postings j WHERE (${noStatus} OR j.status=ANY(${statuses})) AND (${noDept} OR j.department=ANY(${departments})) AND (${noLoc} OR j.location=ANY(${locations})) AND (${noEmp} OR j.employment_type=ANY(${employmentTypes})) ORDER BY j.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
    ]);
    return { jobs: Array.isArray(jobs) ? jobs : [], total: (countRows[0] as any)?.total ?? 0 };
  }

  async getJobApplicationCounts(jobIds: string[]) {
    if (jobIds.length === 0) return new Map<string, any>();
    const r = await this.sql`SELECT job_id,COUNT(*)::int as application_count,COUNT(*) FILTER(WHERE stage='hired')::int as hired_count FROM applications WHERE job_id=ANY(${jobIds}) GROUP BY job_id` as any[];
    return new Map(r.map((row:any)=>[row.job_id, { application_count: row.application_count??0, hired_count: row.hired_count??0 }]));
  }

  async getPublishedJobs() {
    return this.sql`SELECT id,title,department,location,employment_type,description,requirements,salary_range_min,salary_range_max,salary_currency,experience_level,remote,published_at FROM job_postings WHERE status='published' ORDER BY published_at DESC LIMIT 200`;
  }

  async getJobById(id: string) {
    const rows = await this.sql`SELECT j.* FROM job_postings j WHERE j.id=${id}`;
    if (rows.length === 0) return null;
    return rows[0] as any;
  }

  async getJobApplications(jobId: string) {
    return this.sql(
      `SELECT ${RecruitmentRepository.APP_COLS} FROM applications a INNER JOIN candidates c ON c.id=a.candidate_id INNER JOIN job_postings j ON j.id=a.job_id LEFT JOIN offers o ON o.application_id=a.id LEFT JOIN tentative_records tr ON tr.application_id=a.id WHERE a.job_id=$1 ORDER BY a.rating DESC NULLS LAST, a.applied_at DESC`,
      [jobId]
    ) as Promise<any[]>;
  }

  async createJob(d: any) {
    const hmIdsJson = d.hmIds && Array.isArray(d.hmIds) && d.hmIds.length > 0 ? JSON.stringify(d.hmIds) : null;
    const singleHmId = d.hmIds && Array.isArray(d.hmIds) && d.hmIds.length > 0 ? d.hmIds[0] : (d.hiringManagerId||null);
    const r = await this.sql`INSERT INTO job_postings(title,department,location,employment_type,description,requirements,salary_range_min,salary_range_max,salary_currency,headcount,hiring_manager_id,hiring_manager_ids,status,published_channels,experience_level,remote,published_at) VALUES(${d.title},${d.department},${d.location||null},${d.employmentType||null},${d.description||null},${d.requirements||null},${d.salaryRangeMin??null},${d.salaryRangeMax??null},${d.salaryCurrency||null},${d.headcount||1},${singleHmId},${hmIdsJson},${d.status||"draft"},${d.publishedChannels?JSON.stringify(d.publishedChannels):null},${d.experienceLevel??null},${d.remote??null},${d.status==="published"?new Date():null}) RETURNING *` as any[];
    return r[0];
  }

  async updateJob(id: string, u: any) {
    const hmIdsJson = u.hiringManagerIds && Array.isArray(u.hiringManagerIds) && u.hiringManagerIds.length > 0 ? JSON.stringify(u.hiringManagerIds) : null;
    const singleHmId = u.hiringManagerIds && Array.isArray(u.hiringManagerIds) && u.hiringManagerIds.length > 0 ? u.hiringManagerIds[0] : (u.hiringManagerId??null);
    const existing = await this.sql`SELECT published_at,closed_at FROM job_postings WHERE id=${id}` as any[];
    if (!existing.length) return null;
    let publishedAt = existing[0].published_at;
    let closedAt = existing[0].closed_at;
    if (u.status === "published" && !publishedAt) publishedAt = new Date();
    if (u.status === "closed" && !closedAt) closedAt = new Date();
    const r = await this.sql`UPDATE job_postings SET title=COALESCE(${u.title},title),department=COALESCE(${u.department},department),location=COALESCE(${u.location},location),employment_type=COALESCE(${u.employmentType},employment_type),description=COALESCE(${u.description},description),requirements=COALESCE(${u.requirements},requirements),salary_range_min=COALESCE(${u.salaryRangeMin},salary_range_min),salary_range_max=COALESCE(${u.salaryRangeMax},salary_range_max),salary_currency=COALESCE(${u.salaryCurrency},salary_currency),headcount=COALESCE(${u.headcount},headcount),hiring_manager_id=COALESCE(${singleHmId},hiring_manager_id),hiring_manager_ids=COALESCE(${hmIdsJson},hiring_manager_ids),status=COALESCE(${u.status},status),published_channels=COALESCE(${u.publishedChannels?JSON.stringify(u.publishedChannels):null},published_channels),experience_level=COALESCE(${u.experienceLevel},experience_level),remote=COALESCE(${u.remote},remote),published_at=${publishedAt},closed_at=${closedAt},updated_at=NOW() WHERE id=${id} RETURNING *` as any[];
    return r[0];
  }

  async deleteJob(id: string) {
    const r = await this.sql`DELETE FROM job_postings WHERE id=${id} RETURNING id` as any[];
    return r[0] ?? null;
  }

  async upsertJobFromFreshteam(data: any) {
    const existing = await this.sql`SELECT id FROM job_postings WHERE freshteam_job_id=${String(data.freshteamJobId)}` as any[];
    if (existing.length > 0) {
      const r = await this.sql`UPDATE job_postings SET title=${data.title},department=COALESCE(${data.department||null},department),description=COALESCE(${data.description||null},description),requirements=COALESCE(${data.requirements||null},requirements),status=COALESCE(${data.status||null},status),employment_type=COALESCE(${data.employmentType||null},employment_type),experience_level=COALESCE(${data.experienceLevel||null},experience_level),salary_range_min=COALESCE(${data.salaryRangeMin??null},salary_range_min),salary_range_max=COALESCE(${data.salaryRangeMax??null},salary_range_max),salary_currency=COALESCE(${data.salaryCurrency||null},salary_currency),headcount=COALESCE(${data.headcount||null},headcount),published_at=COALESCE(${data.publishedAt??null},published_at),closed_at=COALESCE(${data.closedAt??null},closed_at),hiring_manager_id=COALESCE(${data.hiringManagerId||null},hiring_manager_id),hiring_manager_ids=COALESCE(${data.hmIdsJson||null},hiring_manager_ids),updated_at=NOW() WHERE id=${existing[0].id} RETURNING id` as any[];
      return { id: r[0]?.id ?? existing[0].id, created: false };
    }
    const r = await this.sql`INSERT INTO job_postings(title,department,description,requirements,status,employment_type,experience_level,salary_range_min,salary_range_max,salary_currency,headcount,hiring_manager_id,hiring_manager_ids,published_at,closed_at,freshteam_job_id) VALUES(${data.title},${data.department||null},${data.description||null},${data.requirements||null},${data.status||"closed"},${data.employmentType||null},${data.experienceLevel||null},${data.salaryRangeMin??null},${data.salaryRangeMax??null},${data.salaryCurrency||null},${data.headcount||1},${data.hiringManagerId||null},${data.hmIdsJson||null},${data.publishedAt??null},${data.closedAt??null},${String(data.freshteamJobId)}) RETURNING id` as any[];
    return { id: r[0]?.id, created: true };
  }

  // ── Employee helpers ──────────────────────────────────────────────────────────
  async resolveEmployeeNames(ids: string[]): Promise<string[]> {
    if (!ids || ids.length === 0) return [];
    const rows = await this.sql`SELECT id,first_name,last_name FROM employees WHERE id=ANY(${ids})` as any[];
    const map = new Map(rows.map((r:any)=>[r.id, `${r.first_name} ${r.last_name}`]));
    return ids.map((id) => map.get(id) || id);
  }

  async batchResolveEmployeeNames(ids: string[]): Promise<Map<string, string>> {
    if (!ids || ids.length === 0) return new Map();
    const unique = Array.from(new Set(ids)).filter(Boolean);
    if (unique.length === 0) return new Map();
    const rows = await this.sql`SELECT id,first_name,last_name FROM employees WHERE id=ANY(${unique})` as any[];
    return new Map(rows.map((r:any)=>[r.id, `${(r.first_name||"")} ${(r.last_name||"")}`.trim()||r.id]));
  }

  async resolveHiringManagersByEmails(emails: string[]): Promise<string[]> {
    if (!emails.length) return [];
    const unique = Array.from(new Set(emails)).filter(Boolean);
    const rows = await this.sql`SELECT id FROM employees WHERE work_email=ANY(${unique})` as any[];
    return rows.map((r:any)=>r.id);
  }

  async getInterviewerEmails(ids: string[]): Promise<string[]> {
    const rows = await this.sql`SELECT work_email FROM employees WHERE id=ANY(${ids})` as any[];
    return rows.map((r:any)=>r.work_email).filter(Boolean);
  }

  // ── Applications ──────────────────────────────────────────────────────────────
  // Neon 0.10 has no sql.unsafe(); column list is inlined so only limit/offset/ids are interpolated.
  private static readonly APP_COLS =
    "a.id,a.candidate_id,a.job_id,a.stage,a.applied_at,a.stage_updated_at,a.updated_at,a.rating,c.first_name,c.last_name,c.email as candidate_email,c.current_company,c.current_title,c.experience_years,c.expected_salary,(c.resume_url IS NOT NULL AND LENGTH(TRIM(COALESCE(c.resume_url,'')))>50) AS has_resume,c.resume_filename,CASE WHEN c.resume_url IS NOT NULL AND(c.resume_url ILIKE 'http://%' OR c.resume_url ILIKE 'https://%') THEN c.resume_url ELSE NULL END AS resume_url,c.source,c.tags,TRIM(CONCAT_WS(', ',NULLIF(TRIM(COALESCE(c.city,'')),'' ),NULLIF(TRIM(COALESCE(c.country,'')),'') )) as location,j.title as job_title,j.department as job_department,o.id as offer_id,o.status as offer_status,o.approval_status as offer_approval_status,o.offer_letter_url,o.offer_letter_filename,tr.status as tentative_status";

  async listApplications(limit: number, offset: number) {
    return this.sql(
      `SELECT ${RecruitmentRepository.APP_COLS} FROM applications a INNER JOIN candidates c ON c.id=a.candidate_id INNER JOIN job_postings j ON j.id=a.job_id LEFT JOIN offers o ON o.application_id=a.id LEFT JOIN tentative_records tr ON tr.application_id=a.id ORDER BY a.rating DESC NULLS LAST, a.applied_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    ) as Promise<any[]>;
  }

  async listApplicationsByJob(jobId: string, limit: number, offset: number) {
    const [countResult, apps] = await Promise.all([
      this.sql`SELECT COUNT(*)::int as total FROM applications WHERE job_id=${jobId}`,
      this.sql(
        `SELECT ${RecruitmentRepository.APP_COLS} FROM applications a INNER JOIN candidates c ON c.id=a.candidate_id INNER JOIN job_postings j ON j.id=a.job_id LEFT JOIN offers o ON o.application_id=a.id LEFT JOIN tentative_records tr ON tr.application_id=a.id WHERE a.job_id=$1 ORDER BY a.rating DESC NULLS LAST, a.applied_at DESC LIMIT $2 OFFSET $3`,
        [jobId, limit, offset]
      ) as Promise<any[]>,
    ]);
    const rawTotal = (countResult[0] as any)?.total;
    return { applications: Array.isArray(apps) ? apps : [], total: typeof rawTotal === "number" ? rawTotal : parseInt(String(rawTotal),10)||0 };
  }

  async listApplicationsByCandidate(candidateId: string, limit: number, offset: number) {
    return this.sql(
      `SELECT ${RecruitmentRepository.APP_COLS} FROM applications a INNER JOIN candidates c ON c.id=a.candidate_id INNER JOIN job_postings j ON j.id=a.job_id LEFT JOIN offers o ON o.application_id=a.id LEFT JOIN tentative_records tr ON tr.application_id=a.id WHERE a.candidate_id=$1 ORDER BY a.rating DESC NULLS LAST, a.applied_at DESC LIMIT $2 OFFSET $3`,
      [candidateId, limit, offset]
    ) as Promise<any[]>;
  }

  async getApplicationById(id: string) {
    const rows = await this.sql`SELECT a.*,c.first_name,c.last_name,c.email as candidate_email,c.phone as candidate_phone,c.linkedin_url,c.resume_url,c.resume_filename,c.current_company,c.current_title,c.experience_years,c.current_salary,c.expected_salary,c.salary_currency,j.title as job_title,j.department as job_department,j.location as job_location FROM applications a INNER JOIN candidates c ON c.id=a.candidate_id INNER JOIN job_postings j ON j.id=a.job_id WHERE a.id=${id}` as any[];
    return rows[0] ?? null;
  }

  async createApplication(d: any, userId: string | null) {
    const r = await this.sql`INSERT INTO applications(candidate_id,job_id,stage,cover_letter,referral_source,applied_at,stage_updated_at,created_at,updated_at) VALUES(${d.candidateId},${d.jobId},'applied',${d.coverLetter||null},${d.referralSource||null},NOW(),NOW(),NOW(),NOW()) RETURNING *` as any[];
    await this.sql`INSERT INTO application_stage_history(application_id,from_stage,to_stage,notes,moved_by) VALUES(${r[0].id},NULL,'applied','Application submitted',${userId})`;
    return r[0];
  }

  async createApplicationFromFreshteam(candidateId: string, jobId: string, stage: string, appliedAt: Date, coverLetter: string | null, referralSource: string | null) {
    const r = await this.sql`INSERT INTO applications(candidate_id,job_id,stage,applied_at,cover_letter,referral_source) VALUES(${candidateId},${jobId},${stage},${appliedAt.toISOString()},${coverLetter},${referralSource}) RETURNING id` as any[];
    const applicationId = r[0]?.id;
    if (applicationId) {
      await this.sql`INSERT INTO application_stage_history(application_id,from_stage,to_stage,notes,moved_by) VALUES(${applicationId},NULL,${stage},'Imported from FreshTeam',NULL)`;
    }
  }

  async applicationExistsForJob(candidateId: string, jobId: string) {
    const r = await this.sql`SELECT id FROM applications WHERE candidate_id=${candidateId} AND job_id=${jobId}` as any[];
    return r.length > 0;
  }

  async updateApplicationStage(id: string, stage: string, fromStage: string, data: any, userId: string) {
    const verbalAt = stage === "verbally_accepted" ? new Date() : null;
    const existing = await this.sql`SELECT reject_reason FROM applications WHERE id=${id}` as any[];
    const rejectReason = stage === "rejected" ? (data.rejectReason || null) : (existing[0]?.reject_reason ?? null);
    const r = await this.sql`UPDATE applications SET stage=${stage},stage_updated_at=NOW(),verbal_acceptance_at=COALESCE(${verbalAt},verbal_acceptance_at),reject_reason=${rejectReason},updated_at=NOW() WHERE id=${id} RETURNING *` as any[];
    const idsJson = data.interviewerIds && Array.isArray(data.interviewerIds) && data.interviewerIds.length > 0 ? JSON.stringify(data.interviewerIds) : null;
    const scheduledAtVal = data.scheduledAt ? new Date(data.scheduledAt) : null;
    const interviewTypeStr = data.interviewType != null ? String(data.interviewType).trim() || null : null;
    const hist = await this.sql`INSERT INTO application_stage_history(application_id,from_stage,to_stage,notes,moved_by,interviewer_names,interviewer_ids,scheduled_at,interview_type) VALUES(${id},${fromStage},${stage},${data.notes||null},${userId},${data.interviewerNames||null},${idsJson},${scheduledAtVal},${interviewTypeStr}) RETURNING id` as any[];
    return { application: r[0], stageHistoryId: hist[0]?.id ?? null };
  }

  async updateStageHistoryMeeting(historyId: string, joinUrl: string | null, eventId: string | null) {
    await this.sql`UPDATE application_stage_history SET meeting_link=${joinUrl||null},teams_event_id=${eventId||null} WHERE id=${historyId}`;
  }

  async getApplicationStageDetail(id: string) {
    const r = await this.sql`SELECT c.email as candidate_email,c.first_name,c.last_name,j.title as job_title FROM applications a INNER JOIN candidates c ON c.id=a.candidate_id INNER JOIN job_postings j ON j.id=a.job_id WHERE a.id=${id}` as any[];
    return r[0] ?? null;
  }

  async updateApplicationRating(id: string, rating: number | null): Promise<any> {
    const r = await this.sql`UPDATE applications SET rating=${rating},updated_at=NOW() WHERE id=${id} RETURNING *` as any[];
    return r[0] ?? null;
  }

  async deleteApplication(id: string) {
    const r = await this.sql`DELETE FROM applications WHERE id=${id} RETURNING id` as any[];
    return r[0] ?? null;
  }

  async getApplicationStageHistory(applicationId: string) {
    return this.sql`SELECT h.*,u.email as moved_by_email FROM application_stage_history h LEFT JOIN users u ON u.id=h.moved_by WHERE h.application_id=${applicationId} ORDER BY h.created_at ASC`;
  }

  async getJobPosting(id: string) {
    const r = await this.sql`SELECT status FROM job_postings WHERE id=${id}` as any[];
    return r[0] ?? null;
  }

  async getCandidateRow(id: string) {
    const r = await this.sql`SELECT id FROM candidates WHERE id=${id}` as any[];
    return r[0] ?? null;
  }

  // ── Application Emails ────────────────────────────────────────────────────────
  async listApplicationEmails(applicationId: string) {
    return this.sql`SELECT id,application_id,direction,from_email,to_email,cc,bcc,subject,body_plain,body_html,sent_at,received_at,created_at FROM application_emails WHERE application_id=${applicationId} ORDER BY created_at ASC`;
  }

  async insertApplicationEmail(d: any) {
    const r = await this.sql`INSERT INTO application_emails(application_id,direction,from_email,to_email,cc,bcc,subject,body_plain,body_html,sent_at,created_at) VALUES(${d.applicationId},'sent',${d.fromEmail},${d.toEmail},${d.cc||null},${d.bcc||null},${d.subject||""},${d.body||""},${d.body||""},NOW(),NOW()) RETURNING id,application_id,direction,from_email,to_email,subject,body_plain,sent_at,created_at` as any[];
    return r[0];
  }

  async updateEmailMessageId(emailId: string, messageId: string) {
    await this.sql`UPDATE application_emails SET message_id=${messageId} WHERE id=${emailId}`;
  }

  async insertInboundEmail(d: any) {
    await this.sql`INSERT INTO application_emails(application_id,direction,from_email,to_email,subject,body_plain,body_html,message_id,received_at,created_at) VALUES(${d.applicationId},'received',${d.fromEmail},${d.toEmail},${d.subject},${d.textPlain||null},${d.textHtml||null},${d.messageId??null},NOW(),NOW())`;
  }

  async deleteApplicationEmail(emailId: string, applicationId: string) {
    const r = await this.sql`DELETE FROM application_emails WHERE id=${emailId} AND application_id=${applicationId} RETURNING id` as any[];
    return r[0] ?? null;
  }

  async matchEmailByMessageId(messageId: string) {
    const normalized = messageId.replace(/^<|>$/g, "");
    const rows = await this.sql`SELECT application_id FROM application_emails WHERE message_id=${messageId} OR message_id=${normalized} OR message_id=${`<${normalized}>`} LIMIT 1` as any[];
    return rows[0]?.application_id ?? null;
  }

  async matchEmailBySenderSubject(fromEmail: string, normalizedSubject: string) {
    const rows = await this.sql`SELECT ae.application_id FROM application_emails ae WHERE ae.direction='sent' AND (ae.to_email ILIKE ${"%" + fromEmail + "%"} OR ae.to_email=${fromEmail}) AND LOWER(TRIM(REGEXP_REPLACE(ae.subject,'^\\s*(Re:\\s*|Fwd:\\s*)+','','gi')))=${normalizedSubject} ORDER BY ae.created_at DESC LIMIT 1` as any[];
    return rows[0]?.application_id ?? null;
  }

  // ── Offers ────────────────────────────────────────────────────────────────────
  async listOffers() {
    return this.sql`SELECT o.*,a.candidate_id,a.job_id,c.first_name,c.last_name,c.email as candidate_email,j.title as job_posting_title FROM offers o INNER JOIN applications a ON a.id=o.application_id INNER JOIN candidates c ON c.id=a.candidate_id INNER JOIN job_postings j ON j.id=a.job_id ORDER BY o.created_at DESC`;
  }

  async getOffersByApplication(applicationId: string): Promise<any[]> {
    return this.sql`SELECT * FROM offers WHERE application_id=${applicationId}` as unknown as Promise<any[]>;
  }

  async getOfferById(id: string) {
    const r = await this.sql`SELECT * FROM offers WHERE id=${id}` as any[];
    return r[0] ?? null;
  }

  async createOffer(d: any) {
    const r = await this.sql`INSERT INTO offers(application_id,salary,salary_currency,job_title,department,start_date,employment_type,terms,status,esign_status,sent_at,response_token) VALUES(${d.applicationId},${d.salary},${d.salaryCurrency||null},${d.jobTitle},${d.department||null},${d.startDate||null},${d.employmentType||null},${d.terms||null},${d.status||"draft"},${d.esignStatus||null},${d.sentAt||null},${d.responseToken||null}) RETURNING *` as any[];
    return r[0];
  }

  async updateOffer(id: string, u: any) {
    const r = await this.sql`UPDATE offers SET salary=COALESCE(${u.salary},salary),salary_currency=COALESCE(${u.salaryCurrency},salary_currency),job_title=COALESCE(${u.jobTitle},job_title),department=COALESCE(${u.department},department),start_date=COALESCE(${u.startDate},start_date),employment_type=COALESCE(${u.employmentType},employment_type),terms=COALESCE(${u.terms},terms),status=COALESCE(${u.status},status),sent_at=${u.sentAt},responded_at=${u.respondedAt},response_token=${u.responseToken},esign_status=COALESCE(${u.esignStatus},esign_status),updated_at=NOW() WHERE id=${id} RETURNING *` as any[];
    return r[0];
  }

  async approveOffer(id: string, userId: string) {
    const r = await this.sql`UPDATE offers SET approval_status='approved',approved_at=NOW(),approved_by=${userId},updated_at=NOW() WHERE id=${id} RETURNING *` as any[];
    return r[0];
  }

  async rejectOffer(id: string, userId: string) {
    const r = await this.sql`UPDATE offers SET approval_status='rejected',approved_at=NOW(),approved_by=${userId},updated_at=NOW() WHERE id=${id} RETURNING *` as any[];
    return r[0];
  }

  async uploadOfferLetter(id: string, fileUrl: string, fileName: string) {
    await this.sql`UPDATE offers SET offer_letter_url=${fileUrl},offer_letter_filename=${fileName},updated_at=NOW() WHERE id=${id}`;
  }

  async getOfferLetter(id: string) {
    const r = await this.sql`SELECT offer_letter_url,offer_letter_filename FROM offers WHERE id=${id}` as any[];
    return r[0] ?? null;
  }

  async getOfferByToken(token: string) {
    const r = await this.sql`SELECT o.id,o.salary,o.salary_currency,o.job_title,o.department,o.start_date,o.employment_type,o.terms,o.status,o.sent_at,o.responded_at,c.first_name as candidate_first_name,c.last_name as candidate_last_name,c.email as candidate_email,j.title as job_posting_title,j.department as job_posting_department,j.location as job_location,j.employment_type as job_employment_type FROM offers o INNER JOIN applications a ON a.id=o.application_id INNER JOIN candidates c ON c.id=a.candidate_id INNER JOIN job_postings j ON j.id=a.job_id WHERE o.response_token=${token}` as any[];
    return r[0] ?? null;
  }

  async getOfferLink(id: string) {
    const r = await this.sql`SELECT id,status,response_token FROM offers WHERE id=${id}` as any[];
    return r[0] ?? null;
  }

  async updateOfferToken(id: string, token: string) {
    await this.sql`UPDATE offers SET response_token=${token},updated_at=NOW() WHERE id=${id}`;
  }

  async getTentativeForApplication(applicationId: string) {
    const r = await this.sql`SELECT id,status FROM tentative_records WHERE application_id=${applicationId}` as any[];
    return r[0] ?? null;
  }

  // ── Hire ──────────────────────────────────────────────────────────────────────
  async getApplicationForHire(id: string) {
    const r = await this.sql`SELECT a.*,c.first_name,c.last_name,c.email,c.phone,c.personal_email as candidate_personal_email,c.date_of_birth,c.gender,c.marital_status,c.blood_group,c.street,c.city,c.state,c.country,c.zip_code,j.location as job_location FROM applications a INNER JOIN candidates c ON c.id=a.candidate_id LEFT JOIN job_postings j ON j.id=a.job_id WHERE a.id=${id}` as any[];
    return r[0] ?? null;
  }

  async createEmployeeFromHire(d: any) {
    const r = await this.sql`INSERT INTO employees(employee_id,work_email,first_name,last_name,job_title,department,location,employment_status,employee_type,join_date,personal_email,work_phone,dob,gender,marital_status,blood_group,street,city,state,country,zip_code,source) VALUES(${d.employeeId},${d.workEmail},${d.firstName},${d.lastName},${d.jobTitle},${d.department||"Other"},${d.location||null},'onboarding',${d.employmentType||"full_time"},${d.joinDate},${d.personalEmail||null},${d.phone||null},${d.dob||null},${d.gender||null},${d.maritalStatus||null},${d.bloodGroup||null},${d.street||null},${d.city||null},${d.state||null},${d.country||null},${d.zipCode||null},'manual') RETURNING *` as any[];
    return r[0];
  }

  async markApplicationHired(id: string, employeeId: string, fromStage: string, userId: string) {
    await this.sql`UPDATE applications SET stage='hired',stage_updated_at=NOW(),employee_id=${employeeId},converted_at=NOW(),updated_at=NOW() WHERE id=${id}`;
    await this.sql`INSERT INTO application_stage_history(application_id,from_stage,to_stage,notes,moved_by) VALUES(${id},${fromStage},'hired','Candidate hired and converted to employee',${userId})`;
  }

  async rejectApplicationOnOfferReject(applicationId: string, fromStage: string, userId: string) {
    await this.sql`UPDATE applications SET stage='rejected',stage_updated_at=NOW(),reject_reason=COALESCE(reject_reason,'Offer rejected'),updated_at=NOW() WHERE id=${applicationId}`;
    await this.sql`INSERT INTO application_stage_history(application_id,from_stage,to_stage,notes,moved_by) VALUES(${applicationId},${fromStage},'rejected','Offer rejected',${userId})`;
  }

  async moveApplicationToOffer(applicationId: string, fromStage: string, userId: string) {
    await this.sql`UPDATE applications SET stage='offer',stage_updated_at=NOW(),updated_at=NOW() WHERE id=${applicationId}`;
    await this.sql`INSERT INTO application_stage_history(application_id,from_stage,to_stage,notes,moved_by) VALUES(${applicationId},${fromStage},'offer','Offer created',${userId})`;
  }

  // ── Stats ─────────────────────────────────────────────────────────────────────
  async getStats() {
    const [[jobStats], [appStats], [candidateStats], [offerStats]] = await Promise.all([
      this.sql`SELECT COUNT(*)::int as total_jobs,COUNT(*) FILTER(WHERE status='published')::int as active_jobs,COUNT(*) FILTER(WHERE status='draft')::int as draft_jobs,COUNT(*) FILTER(WHERE status='closed')::int as closed_jobs FROM job_postings WHERE status!='archived'`,
      this.sql`SELECT COUNT(*)::int as total_applications,COUNT(*) FILTER(WHERE stage='applied')::int as applied,COUNT(*) FILTER(WHERE stage='screening' OR stage='longlisted')::int as in_review,COUNT(*) FILTER(WHERE stage='interview')::int as interviewing,COUNT(*) FILTER(WHERE stage='offer')::int as offers,COUNT(*) FILTER(WHERE stage='tentative')::int as tentative,COUNT(*) FILTER(WHERE stage='hired')::int as hired,COUNT(*) FILTER(WHERE stage='rejected')::int as rejected FROM applications`,
      this.sql`SELECT COUNT(*)::int as total_candidates FROM candidates`,
      this.sql`SELECT COUNT(*)::int as total_offers,COUNT(*) FILTER(WHERE status='sent')::int as pending,COUNT(*) FILTER(WHERE status='accepted')::int as accepted,COUNT(*) FILTER(WHERE status='rejected')::int as declined FROM offers`,
    ]);
    return { jobs: jobStats, applications: appStats, candidates: candidateStats, offers: offerStats };
  }

  // auditLog is inherited from BaseRepository
}
