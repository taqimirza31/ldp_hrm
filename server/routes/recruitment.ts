import { Router } from "express";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import crypto from "crypto";
import { requireAuth, requireRole } from "../middleware/auth";
import { memCache } from "../lib/perf";
import {
  insertCandidateSchema,
  insertJobPostingSchema,
  insertApplicationSchema,
  insertOfferSchema,
} from "../db/schema/recruitment";

config();
const sql = neon(process.env.DATABASE_URL!);
const router = Router();

// ==================== HELPERS ====================

/**
 * Resolve an array of employee IDs to "FirstName LastName" strings.
 * Used for displaying hiring managers / interviewers.
 */
async function resolveEmployeeNames(ids: string[]): Promise<string[]> {
  if (!ids || ids.length === 0) return [];
  const rows = await sql`
    SELECT id, first_name, last_name FROM employees WHERE id = ANY(${ids})
  `;
  const map = new Map(rows.map((r: any) => [r.id, `${r.first_name} ${r.last_name}`]));
  return ids.map((id) => map.get(id) || id);
}

/** Batch resolve many job hiring-manager IDs in one query; returns Map<employeeId, displayName>. */
async function batchResolveEmployeeNames(ids: string[]): Promise<Map<string, string>> {
  if (!ids || ids.length === 0) return new Map();
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return new Map();
  const rows = await sql`
    SELECT id, first_name, last_name FROM employees WHERE id = ANY(${unique})
  `;
  return new Map(rows.map((r: any) => [r.id, `${r.first_name || ""} ${r.last_name || ""}`.trim() || r.id]));
}

/** Recruitment audit log (VERBAL_ACCEPTANCE_MARKED, OFFER_APPROVED, OFFER_REJECTED). */
async function recruitmentAuditLog(
  entityType: string,
  entityId: string,
  action: string,
  performedBy: string | null,
  metadata?: Record<string, unknown>
) {
  try {
    await sql`
      INSERT INTO recruitment_audit_log (entity_type, entity_id, action, performed_by, metadata)
      VALUES (${entityType}, ${entityId}, ${action}, ${performedBy}, ${metadata ? JSON.stringify(metadata) : null})
    `;
  } catch (e) {
    console.error("Recruitment audit log failed:", e?.message ?? String(e));
  }
}

/** Parse hiring_manager_ids from DB (JSONB array or string); never throws. */
function parseHmIds(j: any): string[] {
  const raw = j.hiring_manager_ids ?? j.hiring_manager_id;
  if (Array.isArray(raw)) return raw.filter((id): id is string => typeof id === "string");
  if (j.hiring_manager_id && typeof j.hiring_manager_id === "string") return [j.hiring_manager_id];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((id: unknown): id is string => typeof id === "string") : [];
    } catch {
      return [];
    }
  }
  return [];
}

// ==================== CANDIDATES ====================

router.get("/candidates", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 200, 500);
    const offset = parseInt(req.query.offset as string) || 0;
    const candidates = await sql`
      SELECT c.id, c.first_name, c.last_name, c.email, c.phone, c.linkedin_url,
        c.current_company, c.current_title, c.experience_years, c.current_salary,
        c.expected_salary, c.salary_currency, c.source, c.created_at,
        (SELECT COUNT(*)::int FROM applications a WHERE a.candidate_id = c.id) as application_count
      FROM candidates c
      ORDER BY c.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    res.json(candidates);
  } catch (error) {
    console.error("Error fetching candidates:", error?.message ?? String(error));
    res.status(500).json({ error: "Failed to fetch candidates" });
  }
});

router.get("/candidates/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const candidates = await sql`SELECT * FROM candidates WHERE id = ${id}`;
    if (candidates.length === 0) return res.status(404).json({ error: "Candidate not found" });

    const applications = await sql`
      SELECT a.*, j.title as job_title, j.department as job_department, j.location as job_location
      FROM applications a
      INNER JOIN job_postings j ON j.id = a.job_id
      WHERE a.candidate_id = ${id}
      ORDER BY a.applied_at DESC
    `;

    res.json({ ...candidates[0], applications });
  } catch (error) {
    console.error("Error fetching candidate:", error?.message ?? String(error));
    res.status(500).json({ error: "Failed to fetch candidate" });
  }
});

router.post("/candidates", async (req, res) => {
  try {
    const validated = insertCandidateSchema.parse(req.body);
    const existing = await sql`SELECT id FROM candidates WHERE email = ${validated.email}`;

    let candidate;
    const personalEmail = validated.personalEmail && String(validated.personalEmail).trim() ? validated.personalEmail : null;
    const dob = validated.dateOfBirth && String(validated.dateOfBirth).trim() ? validated.dateOfBirth : null;
    if (existing.length > 0) {
      const result = await sql`
        UPDATE candidates SET
          first_name = ${validated.firstName}, last_name = ${validated.lastName},
          phone = ${validated.phone || null}, linkedin_url = ${validated.linkedinUrl || null},
          current_company = ${validated.currentCompany || null}, current_title = ${validated.currentTitle || null},
          experience_years = ${validated.experienceYears ?? null},
          current_salary = ${validated.currentSalary ?? null}, expected_salary = ${validated.expectedSalary ?? null},
          salary_currency = ${validated.salaryCurrency || null},
          resume_url = ${validated.resumeUrl ?? ""}, resume_filename = ${validated.resumeFilename || null},
          date_of_birth = ${dob}, gender = ${validated.gender || null}, marital_status = ${validated.maritalStatus || null},
          blood_group = ${validated.bloodGroup || null}, personal_email = ${personalEmail},
          street = ${validated.street || null}, city = ${validated.city || null}, state = ${validated.state || null},
          country = ${validated.country || null}, zip_code = ${validated.zipCode || null},
          source = COALESCE(${validated.source || null}, source), updated_at = NOW()
        WHERE id = ${existing[0].id} RETURNING *
      `;
      candidate = result[0];
    } else {
      const result = await sql`
        INSERT INTO candidates (
          first_name, last_name, email, phone, linkedin_url,
          current_company, current_title, experience_years,
          current_salary, expected_salary, salary_currency,
          resume_url, resume_filename,
          date_of_birth, gender, marital_status, blood_group, personal_email,
          street, city, state, country, zip_code,
          source, notes
        ) VALUES (
          ${validated.firstName}, ${validated.lastName}, ${validated.email},
          ${validated.phone || null}, ${validated.linkedinUrl || null},
          ${validated.currentCompany || null}, ${validated.currentTitle || null},
          ${validated.experienceYears ?? null},
          ${validated.currentSalary ?? null}, ${validated.expectedSalary ?? null},
          ${validated.salaryCurrency || null},
          ${validated.resumeUrl ?? ""}, ${validated.resumeFilename || null},
          ${dob}, ${validated.gender || null}, ${validated.maritalStatus || null},
          ${validated.bloodGroup || null}, ${personalEmail},
          ${validated.street || null}, ${validated.city || null}, ${validated.state || null},
          ${validated.country || null}, ${validated.zipCode || null},
          ${validated.source || "manual"}, ${validated.notes || null}
        ) RETURNING *
      `;
      candidate = result[0];
    }

    res.status(201).json(candidate);
  } catch (error: any) {
    const errMsg = error?.message ?? String(error);
    console.error("Error creating candidate:", errMsg);
    if (error?.name === "ZodError") return res.status(400).json({ error: "Validation failed", details: error.errors });
    res.status(500).json({ error: "Failed to create candidate" });
  }
});

router.patch("/candidates/:id", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const { id } = req.params;
    const u = req.body;
    const existing = await sql`SELECT * FROM candidates WHERE id = ${id}`;
    if (existing.length === 0) return res.status(404).json({ error: "Candidate not found" });

    const result = await sql`
      UPDATE candidates SET
        first_name = COALESCE(${u.firstName}, first_name), last_name = COALESCE(${u.lastName}, last_name),
        phone = COALESCE(${u.phone}, phone), linkedin_url = COALESCE(${u.linkedinUrl}, linkedin_url),
        current_company = COALESCE(${u.currentCompany}, current_company),
        current_title = COALESCE(${u.currentTitle}, current_title),
        experience_years = COALESCE(${u.experienceYears}, experience_years),
        current_salary = COALESCE(${u.currentSalary}, current_salary),
        expected_salary = COALESCE(${u.expectedSalary}, expected_salary),
        salary_currency = COALESCE(${u.salaryCurrency}, salary_currency),
        resume_url = COALESCE(${u.resumeUrl}, resume_url),
        resume_filename = COALESCE(${u.resumeFilename}, resume_filename),
        date_of_birth = COALESCE(${u.dateOfBirth ?? null}, date_of_birth),
        gender = COALESCE(${u.gender ?? null}, gender),
        marital_status = COALESCE(${u.maritalStatus ?? null}, marital_status),
        blood_group = COALESCE(${u.bloodGroup ?? null}, blood_group),
        personal_email = COALESCE(${u.personalEmail ?? null}, personal_email),
        street = COALESCE(${u.street ?? null}, street), city = COALESCE(${u.city ?? null}, city),
        state = COALESCE(${u.state ?? null}, state), country = COALESCE(${u.country ?? null}, country),
        zip_code = COALESCE(${u.zipCode ?? null}, zip_code),
        source = COALESCE(${u.source}, source), notes = COALESCE(${u.notes}, notes),
        updated_at = NOW()
      WHERE id = ${id} RETURNING *
    `;
    res.json(result[0]);
  } catch (error) {
    console.error("Error updating candidate:", error?.message ?? String(error));
    res.status(500).json({ error: "Failed to update candidate" });
  }
});

router.delete("/candidates/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const result = await sql`DELETE FROM candidates WHERE id = ${req.params.id} RETURNING id`;
    if (result.length === 0) return res.status(404).json({ error: "Candidate not found" });
    res.json({ message: "Candidate deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete candidate" });
  }
});

// ==================== JOB POSTINGS ====================

/**
 * GET /api/recruitment/jobs/filter-options
 * Returns distinct departments, locations, and employment types for filter dropdowns.
 */
router.get("/jobs/filter-options", requireAuth, async (_req, res) => {
  try {
    const [deptRows, locRows, empRows] = await Promise.all([
      sql`SELECT DISTINCT department FROM job_postings WHERE department IS NOT NULL AND department != '' ORDER BY department`,
      sql`SELECT DISTINCT location FROM job_postings WHERE location IS NOT NULL AND location != '' ORDER BY location`,
      sql`SELECT DISTINCT employment_type FROM job_postings WHERE employment_type IS NOT NULL AND employment_type != '' ORDER BY employment_type`,
    ]);
    res.json({
      departments: (deptRows as any[]).map((r) => r.department),
      locations: (locRows as any[]).map((r) => r.location),
      employmentTypes: (empRows as any[]).map((r) => r.employment_type),
    });
  } catch (error) {
    console.error("Error fetching job filter options:", error?.message ?? String(error));
    res.status(500).json({ error: "Failed to fetch filter options" });
  }
});

router.get("/jobs", requireAuth, async (req, res) => {
  try {
    const status = (req.query.status as string) || "all";
    const department = req.query.department as string;
    const location = req.query.location as string;
    const employmentType = req.query.employmentType as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 200, 500);
    const offset = parseInt(req.query.offset as string) || 0;

    const conditions: string[] = ["1=1"];
    const params: any[] = [];
    if (status && status !== "all") {
      params.push(status);
      conditions.push(`j.status = $${params.length}`);
    }
    if (department && department.trim() !== "") {
      params.push(department.trim());
      conditions.push(`j.department = $${params.length}`);
    }
    if (location && location.trim() !== "") {
      params.push(location.trim());
      conditions.push(`j.location = $${params.length}`);
    }
    if (employmentType && employmentType.trim() !== "") {
      params.push(employmentType.trim());
      conditions.push(`j.employment_type = $${params.length}`);
    }
    params.push(limit, offset);
    const whereClause = conditions.join(" AND ");
    const query = `
      SELECT j.id, j.title, j.department, j.location, j.employment_type,
             j.description, j.requirements, j.salary_range_min, j.salary_range_max,
             j.salary_currency, j.headcount, j.hiring_manager_id, j.hiring_manager_ids,
             j.status, j.published_channels, j.published_at, j.closed_at,
             j.created_at, j.updated_at
      FROM job_postings j
      WHERE ${whereClause}
      ORDER BY j.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;
    const jobs = await (sql as any)(query, params);

    if ((jobs as any[]).length === 0) {
      return res.json([]);
    }

    const jobIds = (jobs as any[]).map((j: any) => j.id);
    const countByJobId = new Map<string, { application_count: number; hired_count: number }>();

    // 2) Single aggregated query for application counts (replaces 2*N correlated subqueries)
    if (jobIds.length > 0) {
      const countsRows = await sql`
        SELECT job_id, COUNT(*)::int as application_count,
               COUNT(*) FILTER (WHERE stage = 'hired')::int as hired_count
        FROM applications
        WHERE job_id = ANY(${jobIds})
        GROUP BY job_id
      `;
      (countsRows as any[]).forEach((r: any) => {
        countByJobId.set(r.job_id, { application_count: r.application_count ?? 0, hired_count: r.hired_count ?? 0 });
      });
    }

    // 3) Batch-resolve hiring manager names (one query)
    const allHmIds = new Set<string>();
    const jobHmMap = (jobs as any[]).map((j: any) => {
      const hmIds = parseHmIds(j);
      hmIds.forEach((id) => allHmIds.add(id));
      const counts = countByJobId.get(j.id) ?? { application_count: 0, hired_count: 0 };
      return { ...j, application_count: counts.application_count, hired_count: counts.hired_count, hm_ids: hmIds };
    });
    const nameMap = await batchResolveEmployeeNames([...allHmIds]);
    const enriched = jobHmMap.map((j: any) => ({
      ...j,
      hm_names: j.hm_ids.map((id: string) => nameMap.get(id) || id),
    }));
    const list = Array.isArray(enriched) ? enriched : [];
    res.json(list);
  } catch (error) {
    console.error("Error fetching jobs:", error?.message ?? String(error));
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

router.get("/jobs/published", async (req, res) => {
  try {
    const jobs = await sql`
      SELECT id, title, department, location, employment_type, description, requirements,
             salary_range_min, salary_range_max, salary_currency, published_at
      FROM job_postings WHERE status = 'published' ORDER BY published_at DESC
    `;
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

router.get("/jobs/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const jobs = await sql`SELECT j.* FROM job_postings j WHERE j.id = ${id}`;
    if (jobs.length === 0) return res.status(404).json({ error: "Job posting not found" });

    const job = jobs[0];
    const hmIds: string[] = job.hiring_manager_ids
      ? (Array.isArray(job.hiring_manager_ids) ? job.hiring_manager_ids : JSON.parse(job.hiring_manager_ids))
      : (job.hiring_manager_id ? [job.hiring_manager_id] : []);

    // Parallelise: hiring manager names + applications (independent queries)
    const [hmNames, applications] = await Promise.all([
      resolveEmployeeNames(hmIds),
      sql`
        SELECT a.*, c.id as candidate_id, c.first_name, c.last_name, c.email as candidate_email,
               c.current_company, c.experience_years, c.expected_salary, c.resume_url, c.resume_filename
        FROM applications a
        INNER JOIN candidates c ON c.id = a.candidate_id
        WHERE a.job_id = ${id}
        ORDER BY a.applied_at DESC
      `
    ]);

    res.json({ ...job, hm_names: hmNames, hm_ids: hmIds, applications });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch job" });
  }
});

router.post("/jobs", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const validated = insertJobPostingSchema.parse(req.body);

    // Handle multi hiring manager IDs
    const hmIds = req.body.hiringManagerIds;
    const hmIdsJson = hmIds && Array.isArray(hmIds) && hmIds.length > 0 ? JSON.stringify(hmIds) : null;
    // Legacy single ID: use first from array or the single field
    const singleHmId = hmIds && Array.isArray(hmIds) && hmIds.length > 0
      ? hmIds[0]
      : (validated.hiringManagerId || null);

    const result = await sql`
      INSERT INTO job_postings (
        title, department, location, employment_type,
        description, requirements,
        salary_range_min, salary_range_max, salary_currency,
        headcount, hiring_manager_id, hiring_manager_ids,
        status, published_channels, published_at
      ) VALUES (
        ${validated.title}, ${validated.department},
        ${validated.location || null}, ${validated.employmentType || null},
        ${validated.description || null}, ${validated.requirements || null},
        ${validated.salaryRangeMin ?? null}, ${validated.salaryRangeMax ?? null},
        ${validated.salaryCurrency || null},
        ${validated.headcount || 1}, ${singleHmId}, ${hmIdsJson},
        ${validated.status || "draft"},
        ${validated.publishedChannels ? JSON.stringify(validated.publishedChannels) : null},
        ${validated.status === "published" ? new Date() : null}
      ) RETURNING *
    `;
    res.status(201).json(result[0]);
  } catch (error: any) {
    console.error("Error creating job:", error?.message ?? String(error));
    if (error.name === "ZodError") return res.status(400).json({ error: "Validation failed", details: error.errors });
    res.status(500).json({ error: "Failed to create job" });
  }
});

router.patch("/jobs/:id", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const { id } = req.params;
    const u = req.body;
    const existing = await sql`SELECT * FROM job_postings WHERE id = ${id}`;
    if (existing.length === 0) return res.status(404).json({ error: "Job posting not found" });

    let publishedAt = existing[0].published_at;
    let closedAt = existing[0].closed_at;
    if (u.status === "published" && !publishedAt) publishedAt = new Date();
    if (u.status === "closed" && !closedAt) closedAt = new Date();

    // Handle multi hiring manager IDs
    const hmIds = u.hiringManagerIds;
    const hmIdsJson = hmIds && Array.isArray(hmIds) && hmIds.length > 0 ? JSON.stringify(hmIds) : null;
    const singleHmId = hmIds && Array.isArray(hmIds) && hmIds.length > 0
      ? hmIds[0]
      : (u.hiringManagerId ?? null);

    const result = await sql`
      UPDATE job_postings SET
        title = COALESCE(${u.title}, title),
        department = COALESCE(${u.department}, department),
        location = COALESCE(${u.location}, location),
        employment_type = COALESCE(${u.employmentType}, employment_type),
        description = COALESCE(${u.description}, description),
        requirements = COALESCE(${u.requirements}, requirements),
        salary_range_min = COALESCE(${u.salaryRangeMin}, salary_range_min),
        salary_range_max = COALESCE(${u.salaryRangeMax}, salary_range_max),
        salary_currency = COALESCE(${u.salaryCurrency}, salary_currency),
        headcount = COALESCE(${u.headcount}, headcount),
        hiring_manager_id = COALESCE(${singleHmId}, hiring_manager_id),
        hiring_manager_ids = COALESCE(${hmIdsJson}, hiring_manager_ids),
        status = COALESCE(${u.status}, status),
        published_channels = COALESCE(${u.publishedChannels ? JSON.stringify(u.publishedChannels) : null}, published_channels),
        published_at = ${publishedAt},
        closed_at = ${closedAt},
        updated_at = NOW()
      WHERE id = ${id} RETURNING *
    `;
    res.json(result[0]);
  } catch (error) {
    res.status(500).json({ error: "Failed to update job" });
  }
});

router.delete("/jobs/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const result = await sql`DELETE FROM job_postings WHERE id = ${req.params.id} RETURNING id`;
    if (result.length === 0) return res.status(404).json({ error: "Job posting not found" });
    res.json({ message: "Job posting deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete job" });
  }
});

// ==================== APPLICATIONS ====================

router.get("/applications", requireAuth, async (req, res) => {
  try {
    const { jobId, candidateId } = req.query;
    const limit = Math.min(parseInt(req.query.limit as string) || 300, 500);
    const offset = parseInt(req.query.offset as string) || 0;

    let applications: any[];
    if (jobId && typeof jobId === "string") {
      applications = await sql`
        SELECT a.id, a.candidate_id, a.job_id, a.stage, a.applied_at, a.stage_updated_at, a.updated_at,
               c.first_name, c.last_name, c.email as candidate_email,
               c.current_company, c.experience_years, c.expected_salary, c.resume_url,
               j.title as job_title, j.department as job_department,
               o.id as offer_id, o.status as offer_status, o.approval_status as offer_approval_status,
               o.offer_letter_url, o.offer_letter_filename,
               tr.status as tentative_status
        FROM applications a
        INNER JOIN candidates c ON c.id = a.candidate_id
        INNER JOIN job_postings j ON j.id = a.job_id
        LEFT JOIN offers o ON o.application_id = a.id
        LEFT JOIN tentative_records tr ON tr.application_id = a.id
        WHERE a.job_id = ${jobId}
        ORDER BY a.applied_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (candidateId && typeof candidateId === "string") {
      applications = await sql`
        SELECT a.id, a.candidate_id, a.job_id, a.stage, a.applied_at, a.stage_updated_at, a.updated_at,
               c.first_name, c.last_name, c.email as candidate_email,
               c.current_company, c.experience_years, c.expected_salary, c.resume_url,
               j.title as job_title, j.department as job_department,
               o.id as offer_id, o.status as offer_status, o.approval_status as offer_approval_status,
               o.offer_letter_url, o.offer_letter_filename,
               tr.status as tentative_status
        FROM applications a
        INNER JOIN candidates c ON c.id = a.candidate_id
        INNER JOIN job_postings j ON j.id = a.job_id
        LEFT JOIN offers o ON o.application_id = a.id
        LEFT JOIN tentative_records tr ON tr.application_id = a.id
        WHERE a.candidate_id = ${candidateId}
        ORDER BY a.applied_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      applications = await sql`
        SELECT a.id, a.candidate_id, a.job_id, a.stage, a.applied_at, a.stage_updated_at, a.updated_at,
               c.first_name, c.last_name, c.email as candidate_email,
               c.current_company, c.experience_years, c.expected_salary, c.resume_url,
               j.title as job_title, j.department as job_department,
               o.id as offer_id, o.status as offer_status, o.approval_status as offer_approval_status,
               o.offer_letter_url, o.offer_letter_filename,
               tr.status as tentative_status
        FROM applications a
        INNER JOIN candidates c ON c.id = a.candidate_id
        INNER JOIN job_postings j ON j.id = a.job_id
        LEFT JOIN offers o ON o.application_id = a.id
        LEFT JOIN tentative_records tr ON tr.application_id = a.id
        ORDER BY a.applied_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }
    const list = Array.isArray(applications) ? applications : (applications?.rows ?? []);
    res.json(Array.isArray(list) ? list : []);
  } catch (error: any) {
    const msg = error?.message ?? String(error);
    console.error("Error fetching applications:", msg);
    res.status(500).json({
      error: "Failed to fetch applications",
      ...(process.env.NODE_ENV !== "production" && msg ? { detail: msg } : {}),
    });
  }
});

router.get("/applications/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const apps = await sql`
      SELECT a.*, c.first_name, c.last_name, c.email as candidate_email,
             c.phone as candidate_phone, c.linkedin_url, c.resume_url, c.resume_filename,
             c.current_company, c.current_title, c.experience_years,
             c.current_salary, c.expected_salary, c.salary_currency,
             j.title as job_title, j.department as job_department, j.location as job_location
      FROM applications a
      INNER JOIN candidates c ON c.id = a.candidate_id
      INNER JOIN job_postings j ON j.id = a.job_id
      WHERE a.id = ${id}
    `;
    if (apps.length === 0) return res.status(404).json({ error: "Application not found" });

    // Parallelise: history + offer are independent
    const [history, offerRows] = await Promise.all([
      sql`
        SELECT h.*, u.email as moved_by_email
        FROM application_stage_history h
        LEFT JOIN users u ON u.id = h.moved_by
        WHERE h.application_id = ${id}
        ORDER BY h.created_at ASC
      `,
      sql`SELECT * FROM offers WHERE application_id = ${id}`
    ]);
    res.json({ ...apps[0], stage_history: history, offer: offerRows[0] || null });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch application" });
  }
});

router.post("/applications", async (req, res) => {
  try {
    const validated = insertApplicationSchema.parse(req.body);
    const isAuthenticated = !!(req as any).user?.id;
    // Parallelise: candidate + job existence checks are independent
    const [candidateCheck, jobCheck] = await Promise.all([
      sql`SELECT id FROM candidates WHERE id = ${validated.candidateId}`,
      sql`SELECT id, status FROM job_postings WHERE id = ${validated.jobId}`
    ]);
    if (candidateCheck.length === 0) return res.status(404).json({ error: "Candidate not found" });
    if (jobCheck.length === 0) return res.status(404).json({ error: "Job posting not found" });
    const jobStatus = (jobCheck[0] as any).status;
    const allowedStatuses = isAuthenticated ? ["published", "paused"] : ["published"];
    if (!allowedStatuses.includes(jobStatus)) return res.status(400).json({ error: "This job is not currently accepting applications. Publish or pause the job to allow applications." });

    const result = await sql`
      INSERT INTO applications (candidate_id, job_id, stage, cover_letter, referral_source, applied_at, stage_updated_at)
      VALUES (${validated.candidateId}, ${validated.jobId}, 'applied', ${validated.coverLetter || null}, ${validated.referralSource || null}, NOW(), NOW())
      RETURNING *
    `;

    const userId = (req as any).user?.id || null;
    await sql`
      INSERT INTO application_stage_history (application_id, from_stage, to_stage, notes, moved_by)
      VALUES (${result[0].id}, NULL, 'applied', 'Application submitted', ${userId})
    `;
    res.status(201).json(result[0]);
  } catch (error: any) {
    if (error.name === "ZodError") return res.status(400).json({ error: "Validation failed", details: error.errors });
    if (error.code === "23505") return res.status(400).json({ error: "Candidate has already applied to this job" });
    res.status(500).json({ error: "Failed to create application" });
  }
});

/**
 * PATCH /api/recruitment/applications/:id/stage
 * Move application to any stage (skippable). Append-only stage history.
 * "hired" and "tentative" are blocked — use dedicated endpoints.
 * interviewerIds is stored as JSONB array alongside legacy interviewerNames.
 */
router.patch("/applications/:id/stage", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { stage, notes, interviewerNames, interviewerIds, scheduledAt, rejectReason } = req.body;

    if (!stage) return res.status(400).json({ error: "stage is required" });
    const VALID_STAGES = ["applied", "longlisted", "screening", "shortlisted", "assessment", "interview", "verbally_accepted", "offer", "rejected"];
    if (!VALID_STAGES.includes(stage)) return res.status(400).json({ error: `Invalid stage. Must be one of: ${VALID_STAGES.join(", ")}` });
    if (stage === "hired") return res.status(400).json({ error: "Cannot move to Hired via stage change. Use the Hire action after the offer is approved." });
    if (stage === "tentative") return res.status(400).json({ error: "Cannot move to Tentative via stage change. Use the Initiate Tentative action (after marking verbal acceptance)." });

    const existing = await sql`SELECT * FROM applications WHERE id = ${id}`;
    if (existing.length === 0) return res.status(404).json({ error: "Application not found" });

    const fromStage = existing[0].stage;
    if (fromStage === "hired") return res.status(400).json({ error: "Cannot change stage of a hired candidate" });

    const verbalAcceptanceAt = stage === "verbally_accepted" ? new Date() : null;
    const result = await sql`
      UPDATE applications SET
        stage = ${stage}, stage_updated_at = NOW(),
        verbal_acceptance_at = COALESCE(${verbalAcceptanceAt}, verbal_acceptance_at),
        reject_reason = ${stage === "rejected" ? (rejectReason || null) : existing[0].reject_reason},
        updated_at = NOW()
      WHERE id = ${id} RETURNING *
    `;

    // Store both legacy names and proper IDs
    const idsJson = interviewerIds && Array.isArray(interviewerIds) && interviewerIds.length > 0
      ? JSON.stringify(interviewerIds) : null;

    await sql`
      INSERT INTO application_stage_history (application_id, from_stage, to_stage, notes, moved_by, interviewer_names, interviewer_ids, scheduled_at)
      VALUES (${id}, ${fromStage}, ${stage}, ${notes || null}, ${req.user!.id}, ${interviewerNames || null}, ${idsJson}, ${scheduledAt || null})
    `;

    if (stage === "verbally_accepted") {
      await recruitmentAuditLog("application", id, "VERBAL_ACCEPTANCE_MARKED", req.user!.id, { fromStage });
    }

    res.json(result[0]);
  } catch (error) {
    res.status(500).json({ error: "Failed to update stage" });
  }
});

router.delete("/applications/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const result = await sql`DELETE FROM applications WHERE id = ${req.params.id} RETURNING id`;
    if (result.length === 0) return res.status(404).json({ error: "Application not found" });
    res.json({ message: "Application deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete application" });
  }
});

// ==================== OFFERS ====================

router.get("/offers", requireAuth, async (req, res) => {
  try {
    const offerRows = await sql`
      SELECT o.*, a.candidate_id, a.job_id,
             c.first_name, c.last_name, c.email as candidate_email,
             j.title as job_posting_title
      FROM offers o
      INNER JOIN applications a ON a.id = o.application_id
      INNER JOIN candidates c ON c.id = a.candidate_id
      INNER JOIN job_postings j ON j.id = a.job_id
      ORDER BY o.created_at DESC
    `;
    res.json(offerRows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch offers" });
  }
});

router.post("/offers", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const validated = insertOfferSchema.parse(req.body);
    const appCheck = await sql`SELECT * FROM applications WHERE id = ${validated.applicationId}`;
    if (appCheck.length === 0) return res.status(404).json({ error: "Application not found" });

    const tentativeRows = await sql`
      SELECT id, status FROM tentative_records WHERE application_id = ${validated.applicationId}
    `;
    if (tentativeRows.length > 0 && tentativeRows[0].status !== "cleared") {
      return res.status(400).json({ error: "Tentative must be cleared before creating offer." });
    }

    if (appCheck[0].stage !== "offer" && appCheck[0].stage !== "hired") {
      const fromStage = appCheck[0].stage;
      await sql`UPDATE applications SET stage = 'offer', stage_updated_at = NOW(), updated_at = NOW() WHERE id = ${validated.applicationId}`;
      await sql`
        INSERT INTO application_stage_history (application_id, from_stage, to_stage, notes, moved_by)
        VALUES (${validated.applicationId}, ${fromStage}, 'offer', 'Offer created', ${req.user!.id})
      `;
    }

    const status = validated.status || "draft";
    const sentAt = status === "sent" ? new Date() : null;
    const responseToken = status === "sent" ? crypto.randomBytes(32).toString("hex") : null;

    const result = await sql`
      INSERT INTO offers (
        application_id, salary, salary_currency,
        job_title, department, start_date, employment_type,
        terms, status, esign_status, sent_at, response_token
      ) VALUES (
        ${validated.applicationId}, ${validated.salary}, ${validated.salaryCurrency || null},
        ${validated.jobTitle}, ${validated.department || null},
        ${validated.startDate || null}, ${validated.employmentType || null},
        ${validated.terms || null}, ${status}, ${validated.esignStatus || null},
        ${sentAt}, ${responseToken}
      ) RETURNING *
    `;
    res.status(201).json(result[0]);
  } catch (error: any) {
    if (error.name === "ZodError") return res.status(400).json({ error: "Validation failed", details: error.errors });
    if (error.code === "23505") return res.status(400).json({ error: "An offer already exists for this application" });
    res.status(500).json({ error: "Failed to create offer" });
  }
});

router.patch("/offers/:id", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const { id } = req.params;
    const u = req.body;
    const existing = await sql`SELECT * FROM offers WHERE id = ${id}`;
    if (existing.length === 0) return res.status(404).json({ error: "Offer not found" });

    let sentAt = existing[0].sent_at;
    let respondedAt = existing[0].responded_at;
    let responseToken = existing[0].response_token;
    if (u.status === "sent" && !sentAt) {
      sentAt = new Date();
      if (!responseToken) responseToken = crypto.randomBytes(32).toString("hex");
    }
    if ((u.status === "accepted" || u.status === "rejected") && !respondedAt) respondedAt = new Date();

    // Guard: cannot re-send a withdrawn offer
    if (u.status === "sent" && existing[0].status === "withdrawn") {
      return res.status(400).json({ error: "Cannot send a withdrawn offer. Create a new offer instead." });
    }

    const result = await sql`
      UPDATE offers SET
        salary = COALESCE(${u.salary}, salary), salary_currency = COALESCE(${u.salaryCurrency}, salary_currency),
        job_title = COALESCE(${u.jobTitle}, job_title), department = COALESCE(${u.department}, department),
        start_date = COALESCE(${u.startDate}, start_date), employment_type = COALESCE(${u.employmentType}, employment_type),
        terms = COALESCE(${u.terms}, terms), status = COALESCE(${u.status}, status),
        sent_at = ${sentAt}, responded_at = ${respondedAt},
        response_token = ${responseToken},
        esign_status = COALESCE(${u.esignStatus}, esign_status), updated_at = NOW()
      WHERE id = ${id} RETURNING *
    `;

    if (u.status === "rejected") {
      const appId = existing[0].application_id;
      const appRows = await sql`SELECT stage FROM applications WHERE id = ${appId}`;
      const fromStage = appRows[0]?.stage || "offer";
      await sql`
        UPDATE applications SET stage = 'rejected', stage_updated_at = NOW(),
          reject_reason = COALESCE(reject_reason, 'Offer rejected'), updated_at = NOW()
        WHERE id = ${appId}
      `;
      await sql`
        INSERT INTO application_stage_history (application_id, from_stage, to_stage, notes, moved_by)
        VALUES (${appId}, ${fromStage}, 'rejected', 'Offer rejected', ${req.user!.id})
      `;
    }
    res.json(result[0]);
  } catch (error) {
    res.status(500).json({ error: "Failed to update offer" });
  }
});

/** PATCH /api/recruitment/offers/:id/approve — HR/Admin/Manager approve offer (required before hire). */
router.patch("/offers/:id/approve", requireAuth, requireRole(["admin", "hr", "manager"]), async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await sql`SELECT * FROM offers WHERE id = ${id}`;
    if (rows.length === 0) return res.status(404).json({ error: "Offer not found" });
    const offer = rows[0];
    if (offer.approval_status === "approved") return res.json(offer);
    if (offer.approval_status === "rejected") return res.status(400).json({ error: "Offer was rejected and cannot be approved." });

    const result = await sql`
      UPDATE offers SET approval_status = 'approved', approved_at = NOW(), approved_by = ${req.user!.id}, updated_at = NOW()
      WHERE id = ${id} RETURNING *
    `;
    await recruitmentAuditLog("offer", id, "OFFER_APPROVED", req.user!.id, { applicationId: offer.application_id });
    res.json(result[0]);
  } catch (error) {
    res.status(500).json({ error: "Failed to approve offer" });
  }
});

/** PATCH /api/recruitment/offers/:id/reject — HR/Admin/Manager reject offer. */
router.patch("/offers/:id/reject", requireAuth, requireRole(["admin", "hr", "manager"]), async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await sql`SELECT * FROM offers WHERE id = ${id}`;
    if (rows.length === 0) return res.status(404).json({ error: "Offer not found" });
    const offer = rows[0];
    if (offer.approval_status === "rejected") return res.json(offer);

    const result = await sql`
      UPDATE offers SET approval_status = 'rejected', approved_at = NOW(), approved_by = ${req.user!.id}, updated_at = NOW()
      WHERE id = ${id} RETURNING *
    `;
    await recruitmentAuditLog("offer", id, "OFFER_REJECTED", req.user!.id, { applicationId: offer.application_id });
    res.json(result[0]);
  } catch (error) {
    res.status(500).json({ error: "Failed to reject offer" });
  }
});

// ==================== HIRE CONVERSION ====================

router.post("/applications/:id/hire", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { employeeId, workEmail } = req.body;
    if (!employeeId) return res.status(400).json({ error: "employeeId is required" });

    const apps = await sql`
      SELECT a.*, c.first_name, c.last_name, c.email, c.phone,
        c.personal_email as candidate_personal_email, c.date_of_birth, c.gender, c.marital_status, c.blood_group,
        c.street, c.city, c.state, c.country, c.zip_code,
        j.location as job_location
      FROM applications a
      INNER JOIN candidates c ON c.id = a.candidate_id
      LEFT JOIN job_postings j ON j.id = a.job_id
      WHERE a.id = ${id}
    `;
    if (apps.length === 0) return res.status(404).json({ error: "Application not found" });
    const app = apps[0];
    if (app.stage === "hired") return res.status(400).json({ error: "Already hired" });
    if (app.employee_id) return res.status(400).json({ error: "Already linked to an employee" });

    const offerRows = await sql`SELECT * FROM offers WHERE application_id = ${id}`;
    if (offerRows.length === 0) return res.status(400).json({ error: "No offer exists" });
    const offer = offerRows[0];
    const approvalStatus = offer.approval_status ?? null;
    if (approvalStatus != null && approvalStatus !== "approved") {
      return res.status(400).json({ error: "Offer must be approved before hiring." });
    }
    if (approvalStatus == null && offer.status !== "accepted") {
      return res.status(400).json({ error: `Offer must be accepted. Current: '${offer.status}'.` });
    }

    // If tentative record exists, must be cleared
    const tentativeCheck = await sql`SELECT id, status FROM tentative_records WHERE application_id = ${id}`;
    if (tentativeCheck.length > 0 && tentativeCheck[0].status !== "cleared") {
      return res.status(400).json({ error: "Tentative record exists but is not cleared. Use Confirm Hire from the tentative review instead." });
    }

    // Work email (Microsoft) is provisioned during onboarding. Use candidate email as placeholder until then.
    const workEmailToUse = (workEmail && String(workEmail).trim()) || app.email;
    if (!workEmailToUse) return res.status(400).json({ error: "Candidate has no email on file. Add email to the candidate record and try again." });

    // Personal details and address from candidate (collected at application) prefill employee profile
    const personalEmailToUse = app.candidate_personal_email || app.email || null;
    const dob = app.date_of_birth || null;
    const gender = app.gender || null;
    const maritalStatus = app.marital_status || null;
    const bloodGroup = app.blood_group || null;
    const street = app.street || null;
    const city = app.city || null;
    const state = app.state || null;
    const country = app.country || null;
    const zipCode = app.zip_code || null;

    // Create employee from candidate + offer + job (name, email, phone, job title, department, location, personal details, address)
    const joinDate = offer.start_date || new Date();
    const jobLocation = app.job_location || null;
    const empResult = await sql`
      INSERT INTO employees (
        employee_id, work_email, first_name, last_name,
        job_title, department, location, employment_status, employee_type,
        join_date, personal_email, work_phone,
        dob, gender, marital_status, blood_group,
        street, city, state, country, zip_code,
        source
      ) VALUES (
        ${employeeId}, ${workEmailToUse}, ${app.first_name}, ${app.last_name},
        ${offer.job_title}, ${offer.department || "Other"}, ${jobLocation},
        'onboarding', ${offer.employment_type || "full_time"},
        ${joinDate}, ${personalEmailToUse}, ${app.phone || null},
        ${dob}, ${gender}, ${maritalStatus}, ${bloodGroup},
        ${street}, ${city}, ${state}, ${country}, ${zipCode},
        'manual'
      ) RETURNING *
    `;
    const employee = empResult[0];

    const fromStage = app.stage;
    await sql`
      UPDATE applications SET stage = 'hired', stage_updated_at = NOW(),
        employee_id = ${employee.id}, converted_at = NOW(), updated_at = NOW()
      WHERE id = ${id}
    `;
    await sql`
      INSERT INTO application_stage_history (application_id, from_stage, to_stage, notes, moved_by)
      VALUES (${id}, ${fromStage}, 'hired', 'Candidate hired and converted to employee', ${req.user!.id})
    `;

    res.status(201).json({ message: "Candidate hired successfully.", employee, applicationId: id });
  } catch (error: any) {
    if (error.code === "23505") return res.status(409).json({ error: "Employee ID or work email already exists" });
    res.status(500).json({ error: "Failed to hire candidate" });
  }
});

// ==================== STAGE HISTORY ====================

router.get("/applications/:id/history", requireAuth, async (req, res) => {
  try {
    const history = await sql`
      SELECT h.*, u.email as moved_by_email
      FROM application_stage_history h
      LEFT JOIN users u ON u.id = h.moved_by
      WHERE h.application_id = ${req.params.id}
      ORDER BY h.created_at ASC
    `;
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stage history" });
  }
});

// ==================== STATS ====================

router.get("/stats", requireAuth, async (req, res) => {
  try {
    const [jobStats] = await sql`
      SELECT COUNT(*)::int as total_jobs,
        COUNT(*) FILTER (WHERE status = 'published')::int as active_jobs,
        COUNT(*) FILTER (WHERE status = 'draft')::int as draft_jobs,
        COUNT(*) FILTER (WHERE status = 'closed')::int as closed_jobs
      FROM job_postings WHERE status != 'archived'
    `;
    const [appStats] = await sql`
      SELECT COUNT(*)::int as total_applications,
        COUNT(*) FILTER (WHERE stage = 'applied')::int as applied,
        COUNT(*) FILTER (WHERE stage = 'screening' OR stage = 'longlisted')::int as in_review,
        COUNT(*) FILTER (WHERE stage = 'interview')::int as interviewing,
        COUNT(*) FILTER (WHERE stage = 'offer')::int as offers,
        COUNT(*) FILTER (WHERE stage = 'tentative')::int as tentative,
        COUNT(*) FILTER (WHERE stage = 'hired')::int as hired,
        COUNT(*) FILTER (WHERE stage = 'rejected')::int as rejected
      FROM applications
    `;
    const [candidateStats] = await sql`SELECT COUNT(*)::int as total_candidates FROM candidates`;
    const [offerStats] = await sql`
      SELECT COUNT(*)::int as total_offers,
        COUNT(*) FILTER (WHERE status = 'sent')::int as pending,
        COUNT(*) FILTER (WHERE status = 'accepted')::int as accepted,
        COUNT(*) FILTER (WHERE status = 'rejected')::int as declined
      FROM offers
    `;
    res.json({ jobs: jobStats, applications: appStats, candidates: candidateStats, offers: offerStats });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// ==================== CANDIDATE OFFER RESPONSE (Public) ====================

/**
 * GET /api/recruitment/offer-response/:token
 * Public endpoint: Candidate views offer details via token link.
 * No authentication required.
 */
router.get("/offer-response/:token", async (req, res) => {
  try {
    const { token } = req.params;
    if (!token || token.length < 16) return res.status(400).json({ error: "Invalid token" });

    const rows = await sql`
      SELECT o.id, o.salary, o.salary_currency, o.job_title, o.department,
             o.start_date, o.employment_type, o.terms, o.status, o.sent_at, o.responded_at,
             c.first_name as candidate_first_name, c.last_name as candidate_last_name, c.email as candidate_email,
             j.title as job_posting_title, j.department as job_posting_department,
             j.location as job_location, j.employment_type as job_employment_type
      FROM offers o
      INNER JOIN applications a ON a.id = o.application_id
      INNER JOIN candidates c ON c.id = a.candidate_id
      INNER JOIN job_postings j ON j.id = a.job_id
      WHERE o.response_token = ${token}
    `;
    if (rows.length === 0) return res.status(404).json({ error: "Offer not found or link has expired" });

    const offer = rows[0];

    // Don't expose internal fields; return what the candidate needs to see
    res.json({
      id: offer.id,
      candidateName: `${offer.candidate_first_name} ${offer.candidate_last_name}`,
      candidateEmail: offer.candidate_email,
      jobTitle: offer.job_title,
      department: offer.department || offer.job_posting_department,
      jobPostingTitle: offer.job_posting_title,
      location: offer.job_location,
      salary: offer.salary,
      salaryCurrency: offer.salary_currency,
      startDate: offer.start_date,
      employmentType: offer.employment_type || offer.job_employment_type,
      terms: offer.terms,
      status: offer.status,
      sentAt: offer.sent_at,
      respondedAt: offer.responded_at,
    });
  } catch (error) {
    console.error("Error fetching offer by token:", error?.message ?? String(error));
    res.status(500).json({ error: "Failed to fetch offer" });
  }
});

/**
 * POST /api/recruitment/offer-response/:token
 * Verbal-first flow: offer letters are issued near DOJ, not for candidate accept/reject.
 * Returns 410 Gone so existing links do not break the app.
 */
router.post("/offer-response/:token", async (_req, res) => {
  res.status(410).json({ error: "Offer letters are issued on joining date. This link is no longer used for acceptance." });
});

/**
 * POST /api/recruitment/offers/:id/upload-letter
 * HR/Admin/Manager: Upload offer letter PDF (base64 data URL). Call after offer is approved.
 */
router.post("/offers/:id/upload-letter", requireAuth, requireRole(["admin", "hr", "manager"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { fileUrl, fileName } = req.body;
    if (!fileUrl || typeof fileUrl !== "string") return res.status(400).json({ error: "fileUrl (data URL) is required" });
    const rows = await sql`SELECT id FROM offers WHERE id = ${id}`;
    if (rows.length === 0) return res.status(404).json({ error: "Offer not found" });

    const name = (fileName && String(fileName).trim()) || "offer-letter.pdf";
    await sql`
      UPDATE offers SET offer_letter_url = ${fileUrl}, offer_letter_filename = ${name}, updated_at = NOW()
      WHERE id = ${id}
    `;
    res.json({ success: true, message: "Offer letter uploaded" });
  } catch (error: any) {
    const msg = error?.message ?? String(error);
    console.error("Error uploading offer letter:", msg);
    res.status(500).json({
      error: "Failed to upload offer letter",
      ...(process.env.NODE_ENV !== "production" && msg ? { detail: msg } : {}),
    });
  }
});

/**
 * GET /api/recruitment/offers/:id/letter
 * Serve the uploaded offer letter PDF. Auth: admin/hr/manager.
 */
router.get("/offers/:id/letter", requireAuth, requireRole(["admin", "hr", "manager"]), async (req, res) => {
  try {
    const rows = await sql`SELECT offer_letter_url, offer_letter_filename FROM offers WHERE id = ${req.params.id}`;
    if (rows.length === 0) return res.status(404).json({ error: "Offer not found" });
    const fileUrl = rows[0].offer_letter_url;
    const fileName = rows[0].offer_letter_filename || "offer-letter.pdf";
    if (!fileUrl || typeof fileUrl !== "string") return res.status(404).json({ error: "No offer letter uploaded" });

    if (fileUrl.startsWith("data:")) {
      const match = fileUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) return res.status(400).json({ error: "Invalid file data" });
      const buffer = Buffer.from(match[2], "base64");
      res.setHeader("Content-Type", match[1].trim() || "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${fileName.replace(/"/g, "%22")}"`);
      res.send(buffer);
      return;
    }
    res.redirect(302, fileUrl);
  } catch (error: any) {
    const msg = error?.message ?? String(error);
    console.error("Error serving offer letter:", msg);
    res.status(500).json({
      error: "Failed to load offer letter",
      ...(process.env.NODE_ENV !== "production" && msg ? { detail: msg } : {}),
    });
  }
});

/**
 * GET /api/recruitment/offers/:id/link
 * HR-only: Get the candidate-facing offer link for a sent offer
 */
router.get("/offers/:id/link", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const rows = await sql`SELECT id, status, response_token FROM offers WHERE id = ${req.params.id}`;
    if (rows.length === 0) return res.status(404).json({ error: "Offer not found" });

    let token = rows[0].response_token;

    // If offer is sent but has no token (legacy data), generate one now
    if (!token && rows[0].status === "sent") {
      token = crypto.randomBytes(32).toString("hex");
      await sql`UPDATE offers SET response_token = ${token}, updated_at = NOW() WHERE id = ${rows[0].id}`;
    }

    if (!token) return res.status(400).json({ error: "No response link available. Offer must be sent first." });

    // Build the URL using the request's host
    const protocol = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.headers["x-forwarded-host"] || req.get("host");
    const url = `${protocol}://${host}/offer-response/${token}`;

    res.json({ url, token, status: rows[0].status });
  } catch (error) {
    console.error("Error getting offer link:", error?.message ?? String(error));
    res.status(500).json({ error: "Failed to get offer link" });
  }
});

export default router;
