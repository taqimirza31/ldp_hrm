import { Router } from "express";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import crypto from "crypto";
import { requireAuth, requireRole } from "../middleware/auth";
import { memCache } from "../lib/perf";
import {
  listJobPostings,
  getJobPosting,
  isFreshTeamConfigured,
  listCandidates,
  listApplicantsForJob,
  getApplicant,
  getCandidate,
  downloadResumeAsDataUrl,
  fetchResumeBuffer,
  getFreshTeamOrigin,
  sleep,
  getFreshTeamDelayMs,
} from "../lib/freshteamApi";
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

/** Resume URL placeholder from failed download – treat as no resume in API responses so UI does not show View. */
function maskPlaceholderResumeUrl(url: string | null | undefined): string {
  const u = (url ?? "").trim();
  if (!u || u === "data:application/octet-stream;base64," || u === "data:application/octet-stream;base64") return "";
  if (u.startsWith("data:application/octet-stream;base64,") && u.replace(/\s/g, "").length < 60) return "";
  return u;
}

router.get("/candidates", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
    const offset = parseInt(req.query.offset as string) || 0;
    const countRows = await sql`SELECT COUNT(*)::int as total FROM candidates`;
    const total = (countRows[0] as { total: number })?.total ?? 0;
    const candidates = await sql`
      SELECT c.id, c.first_name, c.last_name, c.email, c.phone, c.linkedin_url,
        c.current_company, c.current_title, c.experience_years, c.current_salary,
        c.expected_salary, c.salary_currency, c.source, c.resume_url, c.resume_filename, c.created_at,
        c.tags, c.city, c.state, c.country, c.date_of_birth, c.gender,
        (SELECT COUNT(*)::int FROM applications a WHERE a.candidate_id = c.id) as application_count
      FROM candidates c
      ORDER BY c.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const list = Array.isArray(candidates) ? candidates : [];
    const masked = list.map((c: Record<string, unknown>) => ({ ...c, resume_url: maskPlaceholderResumeUrl(c.resume_url as string) }));
    res.json({ candidates: masked, total });
  } catch (error) {
    console.error("Error fetching candidates:", error?.message ?? String(error));
    res.status(500).json({ error: "Failed to fetch candidates" });
  }
});

/**
 * GET /api/recruitment/candidates/:id/resume
 * Streams the candidate's resume from stored content (data URL or legacy http URL).
 * Migration downloads and stores file content so nothing depends on FreshTeam or expiring URLs.
 * Query: download=1 to force Content-Disposition attachment (download instead of inline).
 */
router.get("/candidates/:id/resume", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const forceDownload = req.query.download === "1" || req.query.download === "true";
    const rows = await sql`
      SELECT id, resume_url, resume_filename
      FROM candidates WHERE id = ${id}
    ` as { id: string; resume_url: string | null; resume_filename: string | null }[];
    if (rows.length === 0) return res.status(404).json({ error: "Candidate not found" });

    const candidate = rows[0];
    const storedUrl = candidate.resume_url?.trim() ?? "";
    const storedFilename = candidate.resume_filename?.trim() || "resume.pdf";

    // Placeholder from failed or missing download – treat as no resume (404), not invalid (400).
    const isPlaceholder =
      !storedUrl ||
      storedUrl === "data:application/octet-stream;base64," ||
      storedUrl === "data:application/octet-stream;base64" ||
      (storedUrl.startsWith("data:application/octet-stream;base64,") && storedUrl.replace(/\s/g, "").length < 60);
    if (isPlaceholder) return res.status(404).json({ error: "No resume" });

    const disposition = forceDownload ? "attachment" : "inline";
    const dispValue = `${disposition}; filename="${storedFilename.replace(/"/g, '\\"')}"`;

    if (storedUrl.startsWith("data:")) {
      const base64Index = storedUrl.indexOf(";base64,");
      if (base64Index !== -1) {
        const contentType = storedUrl.slice(5, base64Index).trim() || "application/octet-stream";
        const b64 = storedUrl.slice(base64Index + 8).replace(/\s/g, "");
        const buffer = Buffer.from(b64, "base64");
        if (buffer.length === 0) return res.status(404).json({ error: "No resume" });
        res.setHeader("Content-Type", contentType);
        res.setHeader("Content-Disposition", dispValue);
        return res.send(buffer);
      }
      return res.status(404).json({ error: "No resume" });
    }

    if (storedUrl.startsWith("http://") || storedUrl.startsWith("https://")) {
      const result = await fetchResumeBuffer(storedUrl, storedFilename);
      if (result) {
        res.setHeader("Content-Type", result.contentType);
        res.setHeader("Content-Disposition", forceDownload ? `attachment; filename="${result.filename.replace(/"/g, '\\"')}"` : `inline; filename="${result.filename.replace(/"/g, '\\"')}"`);
        return res.send(result.buffer);
      }
      return res.status(502).json({ error: "Resume link may have expired; re-run migration to store a copy." });
    }

    return res.status(400).json({ error: "Invalid resume format" });
  } catch (error) {
    console.error("Error serving resume:", (error as Error)?.message ?? error);
    res.status(500).json({ error: "Failed to serve resume" });
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

    const c = candidates[0] as Record<string, unknown>;
    res.json({ ...c, resume_url: maskPlaceholderResumeUrl(c.resume_url as string), applications });
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
          first_name = ${validated.firstName}, middle_name = COALESCE(${validated.middleName ?? null}, middle_name),
          last_name = ${validated.lastName},
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
          source = COALESCE(${validated.source || null}, source), notes = COALESCE(${validated.notes ?? null}, notes),
          tags = COALESCE(${validated.tags != null ? JSON.stringify(validated.tags) : null}, tags),
          updated_at = NOW()
        WHERE id = ${existing[0].id} RETURNING *
      `;
      candidate = result[0];
    } else {
      const result = await sql`
        INSERT INTO candidates (
          first_name, middle_name, last_name, email, phone, linkedin_url,
          current_company, current_title, experience_years,
          current_salary, expected_salary, salary_currency,
          resume_url, resume_filename,
          date_of_birth, gender, marital_status, blood_group, personal_email,
          street, city, state, country, zip_code,
          source, notes, tags
        ) VALUES (
          ${validated.firstName}, ${validated.middleName ?? null}, ${validated.lastName}, ${validated.email},
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
          ${validated.source || "manual"}, ${validated.notes || null},
          ${validated.tags != null ? JSON.stringify(validated.tags) : null}
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
        first_name = COALESCE(${u.firstName}, first_name),
        middle_name = COALESCE(${u.middleName ?? null}, middle_name),
        last_name = COALESCE(${u.lastName}, last_name),
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
        tags = COALESCE(${u.tags != null ? JSON.stringify(u.tags) : null}, tags),
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

/** Parse comma-separated or single query param into non-empty string array. */
function parseMultiParam(q: string | string[] | undefined): string[] {
  if (q == null || q === "") return [];
  const s = Array.isArray(q) ? q.join(",") : String(q);
  return s.split(",").map((v) => v.trim()).filter(Boolean);
}

router.get("/jobs", requireAuth, async (req, res) => {
  try {
    const statuses = parseMultiParam(req.query.status as string | string[]);
    const departments = parseMultiParam(req.query.department as string | string[]);
    const locations = parseMultiParam(req.query.location as string | string[]);
    const employmentTypes = parseMultiParam(req.query.employmentType as string | string[]);
    const limit = Math.min(parseInt(req.query.limit as string) || 200, 500);
    const offset = parseInt(req.query.offset as string) || 0;

    const conditions: string[] = ["1=1"];
    const params: any[] = [];
    if (statuses.length > 0) {
      params.push(statuses);
      conditions.push(`j.status = ANY($${params.length}::text[])`);
    }
    if (departments.length > 0) {
      params.push(departments);
      conditions.push(`j.department = ANY($${params.length}::text[])`);
    }
    if (locations.length > 0) {
      params.push(locations);
      conditions.push(`j.location = ANY($${params.length}::text[])`);
    }
    if (employmentTypes.length > 0) {
      params.push(employmentTypes);
      conditions.push(`j.employment_type = ANY($${params.length}::text[])`);
    }
    const whereClause = conditions.join(" AND ");

    // Total count (same filters, no limit/offset)
    const countQuery = `SELECT COUNT(*)::int as total FROM job_postings j WHERE ${whereClause}`;
    const countRows = await (sql as any)(countQuery, params);
    const total = (countRows?.[0]?.total ?? 0) as number;

    params.push(limit, offset);
    const query = `
      SELECT j.id, j.title, j.department, j.location, j.employment_type,
             j.description, j.requirements, j.salary_range_min, j.salary_range_max,
             j.salary_currency, j.headcount, j.hiring_manager_id, j.hiring_manager_ids,
             j.status, j.published_channels, j.experience_level, j.remote,
             j.published_at, j.closed_at, j.created_at, j.updated_at
      FROM job_postings j
      WHERE ${whereClause}
      ORDER BY j.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;
    const jobs = await (sql as any)(query, params);

    if ((jobs as any[]).length === 0) {
      return res.json({ jobs: [], total });
    }

    const jobIds = (jobs as any[]).map((j: any) => j.id);
    const countByJobId = new Map<string, { application_count: number; hired_count: number }>();

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
    res.json({ jobs: list, total });
  } catch (error) {
    console.error("Error fetching jobs:", error?.message ?? String(error));
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

router.get("/jobs/published", async (req, res) => {
  try {
    const jobs = await sql`
      SELECT id, title, department, location, employment_type, description, requirements,
             salary_range_min, salary_range_max, salary_currency, experience_level, remote, published_at
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
               c.current_company, c.experience_years, c.expected_salary, c.resume_url, c.resume_filename,
               c.source, c.tags,
               TRIM(CONCAT_WS(', ', NULLIF(TRIM(COALESCE(c.city, '')), ''), NULLIF(TRIM(COALESCE(c.country, '')), ''))) as location
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
        status, published_channels, experience_level, remote, published_at
      ) VALUES (
        ${validated.title}, ${validated.department},
        ${validated.location || null}, ${validated.employmentType || null},
        ${validated.description || null}, ${validated.requirements || null},
        ${validated.salaryRangeMin ?? null}, ${validated.salaryRangeMax ?? null},
        ${validated.salaryCurrency || null},
        ${validated.headcount || 1}, ${singleHmId}, ${hmIdsJson},
        ${validated.status || "draft"},
        ${validated.publishedChannels ? JSON.stringify(validated.publishedChannels) : null},
        ${validated.experienceLevel ?? null}, ${validated.remote ?? null},
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
        experience_level = COALESCE(${u.experienceLevel}, experience_level),
        remote = COALESCE(${u.remote}, remote),
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

// ==================== FRESHTEAM JOB MIGRATION (ADMIN, API KEY FROM ENV) ====================

/** Resolve FreshTeam recruiter/hiring-manager emails to our employee IDs. */
async function resolveHiringManagerIdsByEmails(emails: string[]): Promise<string[]> {
  if (!emails.length) return [];
  const unique = Array.from(new Set(emails)).filter(Boolean);
  const rows = await sql`
    SELECT id FROM employees WHERE work_email = ANY(${unique})
  ` as { id: string }[];
  return rows.map((r) => r.id);
}

router.post("/migrate-freshteam-jobs", requireAuth, requireRole(["admin"]), async (_req, res) => {
  try {
    if (!isFreshTeamConfigured()) {
      return res.status(503).json({
        error: "FreshTeam migration not configured",
        message: "Set FRESHTEAM_DOMAIN and FRESHTEAM_API_KEY in .env (admin API key from FreshTeam).",
      });
    }
    const perPage = 30;
    let page = 1;
    let totalProcessed = 0;
    let created = 0;
    let updated = 0;
    const errors: { jobId: number; error: string }[] = [];

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const list = await listJobPostings(page, perPage);
      if (list.length === 0) break;

      for (const summary of list) {
        const ftId = summary.id;
        if (ftId == null) continue;
        try {
          const job = await getJobPosting(ftId);
          const title = job.title?.trim() || "Untitled";
          const department = job.department?.name?.trim() || "Unspecified";

          const locationParts = [
            job.branch?.city,
            job.branch?.state,
            job.branch?.country_code,
            job.branch?.name,
          ].filter(Boolean);
          const location = locationParts.length ? locationParts.join(", ") : null;

          const employmentType = job.type ?? null;
          const description = job.description ?? null;
          const salaryMin = job.salary?.min != null ? Number(job.salary.min) : null;
          const salaryMax = job.salary?.max != null ? Number(job.salary.max) : null;
          const salaryCurrency = job.salary?.currency ?? null;
          const experienceLevel = job.experience ?? null;
          const remote = job.remote ?? null;

          let status: "draft" | "published" | "paused" | "closed" | "archived" = "draft";
          if (job.status === "published") status = "published";
          else if (job.status === "closed") status = "closed";
          else if (job.status === "paused") status = "paused";
          else if (job.status === "archived") status = "archived";

          const closedAt = job.closing_date ? new Date(job.closing_date) : null;
          const publishedAt = status === "published" ? new Date() : null;

          const emails: string[] = [];
          const reqs = job.requisitions ?? [];
          for (const r of reqs) {
            for (const rec of r.recruiters ?? []) {
              if (rec.official_email) emails.push(rec.official_email);
            }
            for (const hm of r.hiring_managers ?? []) {
              if (hm.official_email) emails.push(hm.official_email);
            }
          }
          const hiringManagerIds = await resolveHiringManagerIdsByEmails(emails);
          const hmIdsJson = hiringManagerIds.length ? JSON.stringify(hiringManagerIds) : null;
          const singleHmId = hiringManagerIds.length ? hiringManagerIds[0] : null;

          const existing = await sql`
            SELECT id FROM job_postings WHERE title = ${title} AND department = ${department}
          ` as { id: string }[];
          const ftJobIdStr = String(ftId);
          if (existing.length > 0) {
            await sql`
              UPDATE job_postings SET
                location = ${location},
                employment_type = ${employmentType},
                description = ${description},
                salary_range_min = ${salaryMin},
                salary_range_max = ${salaryMax},
                salary_currency = ${salaryCurrency},
                hiring_manager_id = ${singleHmId},
                hiring_manager_ids = ${hmIdsJson},
                status = ${status},
                experience_level = ${experienceLevel},
                remote = ${remote},
                freshteam_job_id = ${ftJobIdStr},
                published_at = ${publishedAt},
                closed_at = ${closedAt},
                updated_at = NOW()
              WHERE id = ${existing[0].id}
            `;
            updated += 1;
          } else {
            await sql`
              INSERT INTO job_postings (
                title, department, location, employment_type,
                description, requirements,
                salary_range_min, salary_range_max, salary_currency,
                headcount, hiring_manager_id, hiring_manager_ids,
                status, experience_level, remote, freshteam_job_id, published_at, closed_at
              ) VALUES (
                ${title}, ${department}, ${location}, ${employmentType},
                ${description}, null,
                ${salaryMin}, ${salaryMax}, ${salaryCurrency},
                1, ${singleHmId}, ${hmIdsJson},
                ${status}, ${experienceLevel}, ${remote}, ${ftJobIdStr}, ${publishedAt}, ${closedAt}
              )
            `;
            created += 1;
          }
          totalProcessed += 1;
        } catch (err: any) {
          errors.push({ jobId: ftId, error: err?.message ?? String(err) });
        }
      }
      if (list.length < perPage) break;
      page += 1;
    }

    res.json({
      message: "FreshTeam job migration finished",
      totalProcessed,
      created,
      updated,
      errors: errors.length ? errors : undefined,
    });
  } catch (error: any) {
    console.error("FreshTeam job migration error:", error?.message ?? error);
    res.status(500).json({
      error: "Migration failed",
      message: error?.message ?? String(error),
    });
  }
});

/** Map FreshTeam applicant stage to our application_stage enum. */
function mapFtStageToOur(ftStage: string | undefined): string {
  if (!ftStage) return "applied";
  const s = String(ftStage).toLowerCase();
  if (s.includes("reject")) return "rejected";
  if (s.includes("hire") || s === "hired") return "hired";
  if (s.includes("offer")) return "offer";
  if (s.includes("verbal") || s.includes("accept")) return "verbally_accepted";
  if (s.includes("interview")) return "interview";
  if (s.includes("assess")) return "assessment";
  if (s.includes("shortlist")) return "shortlisted";
  if (s.includes("screen")) return "screening";
  if (s.includes("longlist")) return "longlisted";
  if (s.includes("tentative")) return "tentative";
  return "applied";
}

/**
 * Derive resume filename from URL path when API does not provide content_file_name.
 * Supports .pdf, .doc, .docx, .odt. Falls back to "resume.pdf".
 */
function deriveResumeFilenameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const segment = pathname.split("/").filter(Boolean).pop();
    if (segment && /\.(pdf|docx?|odt)$/i.test(segment)) return segment;
  } catch {
    // ignore invalid URL
  }
  return "resume.pdf";
}

/** Build candidate-like object from applicant when API returns no candidate_id. Pulls all available fields from applicant / applicant.candidate. */
function candidateFromApplicant(
  applicant: { first_name?: string; last_name?: string; name?: string; email?: string; mobile?: string; phone?: string; candidate?: unknown; [k: string]: unknown },
  applicantId: number
): { first_name: string; last_name: string; email: string; mobile?: string | null; phone?: string | null; middle_name?: string | null; location?: Record<string, unknown> | null; profile_links?: Array<{ name?: string; url?: string }>; date_of_birth?: string | null; gender?: string | null; total_experience_in_months?: number | null; description?: string | null; tags?: unknown[]; resumes?: unknown[] } {
  const c = applicant.candidate as Record<string, unknown> | undefined;
  const src = (key: string, ...altKeys: string[]) => {
    for (const k of [key, ...altKeys]) {
      const v = applicant[k] ?? c?.[k];
      if (v != null && String(v).trim() !== "") return String(v).trim();
    }
    return "";
  };
  let first = String(applicant.first_name ?? c?.first_name ?? "").trim();
  let last = String(applicant.last_name ?? c?.last_name ?? "").trim();
  const name = String(applicant.name ?? c?.name ?? "").trim();
  if (!first && !last && name) {
    const parts = name.split(/\s+/);
    first = parts[0] ?? "";
    last = parts.slice(1).join(" ") || "";
  }
  const email = String(applicant.email ?? c?.email ?? "").trim().toLowerCase();
  const middle = src("middle_name", "middle_name");
  const mobile = (applicant.mobile ?? c?.mobile ?? applicant.phone ?? c?.phone) as string | null | undefined;
  const phone = (applicant.phone ?? c?.phone) as string | null | undefined;
  const loc = applicant.location ?? c?.location ?? applicant.address ?? c?.address;
  const location = loc && typeof loc === "object" ? (loc as Record<string, unknown>) : null;
  const profileLinks = applicant.profile_links ?? c?.profile_links ?? applicant.profile_links_list ?? c?.profile_links_list;
  const profile_links = Array.isArray(profileLinks) ? profileLinks as Array<{ name?: string; url?: string }> : [];
  const dobRaw = applicant.date_of_birth ?? c?.date_of_birth ?? applicant.dob ?? c?.dob;
  const date_of_birth = dobRaw && /^\d{4}-\d{2}-\d{2}/.test(String(dobRaw)) ? String(dobRaw).slice(0, 10) : null;
  const gender = (applicant.gender ?? c?.gender) != null ? String(applicant.gender ?? c?.gender).trim() || null : null;
  const expMonths = applicant.total_experience_in_months ?? c?.total_experience_in_months ?? applicant.experience_in_months ?? c?.experience_in_months;
  const total_experience_in_months = expMonths != null ? Number(expMonths) : null;
  const desc = applicant.description ?? c?.description ?? applicant.summary ?? c?.summary ?? applicant.about ?? c?.about;
  const description = desc != null ? String(desc).trim() || null : null;
  const tagsRaw = applicant.tags ?? c?.tags ?? applicant.skills ?? c?.skills;
  const tags = Array.isArray(tagsRaw) ? tagsRaw : [];
  const resumes = applicant.resumes ?? c?.resumes ?? applicant.documents ?? c?.documents;
  const resumesArr = Array.isArray(resumes) ? resumes : [];

  return {
    first_name: first || "Applicant",
    last_name: last || String(applicantId),
    email: email || `applicant_${applicantId}@migrated.freshteam`,
    mobile: mobile ?? null,
    phone: phone ?? null,
    middle_name: middle || null,
    location,
    profile_links,
    date_of_birth,
    gender,
    total_experience_in_months,
    description,
    tags: tags.length ? tags : [],
    resumes: resumesArr,
  };
}

/**
 * POST /api/recruitment/migrate-freshteam-candidates
 *
 * Two-phase: (1) Migrate all candidates by ID first (GET /candidates → GET /candidates/:id) so full data + resume
 * are stored and we set freshteam_candidate_id. (2) Link them to jobs: list applicants per job, match by
 * freshteam_candidate_id, insert applications. Applicants ≠ Candidates; full profile + resumes only from candidate API.
 */
router.post("/migrate-freshteam-candidates", requireAuth, requireRole(["admin"]), async (_req, res) => {
  try {
    if (!isFreshTeamConfigured()) {
      return res.status(503).json({
        error: "FreshTeam migration not configured",
        message: "Set FRESHTEAM_DOMAIN and FRESHTEAM_API_KEY in .env.",
      });
    }

    let ourJobsWithFtId = await sql`
      SELECT id, freshteam_job_id FROM job_postings
      WHERE freshteam_job_id IS NOT NULL AND freshteam_job_id != ''
    ` as { id: string; freshteam_job_id: string }[];

    // If no jobs with FreshTeam id yet, try to backfill: match our jobs to FreshTeam by title+department and set freshteam_job_id.
    if (ourJobsWithFtId.length === 0) {
      let page = 1;
      const perPage = 30;
      let backfilled = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const list = await listJobPostings(page, perPage);
        if (list.length === 0) break;
        for (const summary of list) {
          const ftId = summary.id;
          if (ftId == null) continue;
          try {
            const job = await getJobPosting(ftId);
            const title = (job.title?.trim() || "Untitled").toLowerCase();
            const department = (job.department?.name?.trim() || "Unspecified").toLowerCase();
            const existing = await sql`
              SELECT id FROM job_postings
              WHERE LOWER(TRIM(title)) = ${title} AND LOWER(TRIM(department)) = ${department}
            ` as { id: string }[];
            if (existing.length > 0) {
              await sql`
                UPDATE job_postings SET freshteam_job_id = ${String(ftId)}, updated_at = NOW()
                WHERE id = ${existing[0].id}
              `;
              backfilled += 1;
            }
          } catch {
            // skip this job
          }
        }
        if (list.length < perPage) break;
        page += 1;
      }
      ourJobsWithFtId = await sql`
        SELECT id, freshteam_job_id FROM job_postings
        WHERE freshteam_job_id IS NOT NULL AND freshteam_job_id != ''
      ` as { id: string; freshteam_job_id: string }[];
      if (ourJobsWithFtId.length === 0) {
        return res.status(400).json({
          error: "No jobs with FreshTeam id",
          message: "Run job migration first (Migrate from FreshTeam on Jobs tab) so we can link applicants to jobs. No jobs could be matched to FreshTeam by title and department.",
        });
      }
      // backfill ran; continue with candidate migration
    }

    const delayMs = getFreshTeamDelayMs();
    const perPage = 50;
    let candidatesCreated = 0;
    let candidatesUpdated = 0;
    let applicationsCreated = 0;
    let applicantsProcessed = 0;
    const errors: { applicantId?: number; candidateId?: number; error: string }[] = [];

    // ========== PHASE 1: Migrate all candidates by ID (full data + resume), set freshteam_candidate_id ==========
    console.log("[FreshTeam migration] Phase 1: Starting. Rate limit delay:", delayMs, "ms per request. This can take several minutes.");
    let candidatePage = 1;
    const candidateListPerPage = 50;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      let candidateList: Awaited<ReturnType<typeof listCandidates>> = [];
      try {
        candidateList = await listCandidates(candidatePage, candidateListPerPage);
        console.log("[FreshTeam migration] Phase 1: Listed", candidateList.length, "candidates on page", candidatePage);
        await sleep(delayMs);
      } catch (err: any) {
        errors.push({ error: `Phase 1 list candidates: ${err?.message ?? String(err)}` });
        console.error("[FreshTeam migration] Phase 1 list error:", err?.message ?? err);
        break;
      }
      if (candidateList.length === 0) break;
      for (const summary of candidateList) {
        const ftCandidateId = summary.id;
        if (ftCandidateId == null) continue;
        try {
          const candidate = await getCandidate(Number(ftCandidateId));
          await sleep(delayMs);
          const email = (candidate.email ?? "").trim().toLowerCase();
          if (!email) continue;
          const raw = candidate as Record<string, unknown>;
          if (candidatesCreated + candidatesUpdated === 0) {
            console.log("[FreshTeam migration] First candidate API keys (for debugging null fields):", Object.keys(raw).sort().join(", "));
          }
          const firstName = (candidate.first_name ?? raw?.first_name ?? raw?.firstName ?? "").toString().trim() || "Unknown";
          const middleName = (candidate.middle_name ?? raw?.middle_name ?? raw?.middleName) != null ? String(candidate.middle_name ?? raw?.middle_name ?? raw?.middleName).trim() || null : null;
          const lastName = (candidate.last_name ?? raw?.last_name ?? raw?.lastName ?? "").toString().trim() || "";
          const phone = candidate.mobile ?? candidate.phone ?? raw?.mobile ?? raw?.phone ?? null;
          const loc = candidate.location ?? raw?.location ?? raw?.address ?? raw?.address_details;
          const locObj = loc && typeof loc === "object" ? (loc as Record<string, unknown>) : null;
          const city = (locObj?.city ?? locObj?.City ?? locObj?.state_name) != null ? String(locObj?.city ?? locObj?.City ?? locObj?.state_name) : null;
          const state = (locObj?.state ?? locObj?.State ?? locObj?.state_code) != null ? String(locObj?.state ?? locObj?.State ?? locObj?.state_code) : null;
          const country = (locObj?.country_code ?? locObj?.country ?? locObj?.Country ?? locObj?.country_name) != null ? String(locObj?.country_code ?? locObj?.country ?? locObj?.Country ?? locObj?.country_name) : null;
          const street = (locObj?.street ?? locObj?.Street ?? locObj?.address_line_1 ?? locObj?.address) != null ? String(locObj?.street ?? locObj?.Street ?? locObj?.address_line_1 ?? locObj?.address) : null;
          const zipCode = (locObj?.zip_code ?? locObj?.zip ?? locObj?.postal_code ?? locObj?.pincode) != null ? String(locObj?.zip_code ?? locObj?.zip ?? locObj?.postal_code ?? locObj?.pincode) : null;
          const profileLinks = candidate.profile_links ?? raw?.profile_links ?? raw?.profile_links_list ?? raw?.profileLinks ?? raw?.social_links;
          const linksArr = Array.isArray(profileLinks) ? profileLinks : [];
          const linkedinEntry = linksArr.find((p: unknown) => (p && typeof p === "object" && (p as Record<string, unknown>).name) ? String((p as Record<string, unknown>).name).toLowerCase() === "linkedin" : (p && typeof p === "object" && (p as Record<string, unknown>).type) ? String((p as Record<string, unknown>).type).toLowerCase() === "linkedin" : false) as { url?: string } | undefined;
          const linkedinUrl = linkedinEntry?.url ?? null;
          const dobRaw = candidate.date_of_birth ?? raw?.date_of_birth ?? raw?.dob ?? raw?.dateOfBirth ?? raw?.birth_date;
          const dateOfBirth = dobRaw && /^\d{4}-\d{2}-\d{2}/.test(String(dobRaw)) ? String(dobRaw).slice(0, 10) : null;
          const gender = (candidate.gender ?? raw?.gender) != null ? String(candidate.gender ?? raw?.gender).trim() || null : null;
          const expMonths = candidate.total_experience_in_months ?? raw?.total_experience_in_months ?? raw?.experience_in_months ?? raw?.totalExperienceInMonths ?? raw?.experience ?? (raw?.experience as { total_months?: number })?.total_months;
          const experienceYears = expMonths != null ? Math.round(Number(expMonths) / 12) : (raw?.experience_years != null ? Number(raw.experience_years) : null);
          const currentCompany = (candidate as any).current_company ?? raw?.current_company ?? (candidate as any).company ?? raw?.company ?? raw?.company_name ?? raw?.employer ?? raw?.current_employer ?? (raw?.custom_field_values && typeof raw.custom_field_values === "object" ? ((raw.custom_field_values as Record<string, unknown>).company ?? (raw.custom_field_values as Record<string, unknown>).current_company) : null);
          const currentTitle = (candidate as any).current_title ?? raw?.current_title ?? (candidate as any).designation ?? raw?.designation ?? (candidate as any).job_title ?? raw?.job_title ?? raw?.title ?? raw?.position ?? raw?.role ?? (raw?.custom_field_values && typeof raw.custom_field_values === "object" ? ((raw.custom_field_values as Record<string, unknown>).job_title ?? (raw.custom_field_values as Record<string, unknown>).current_title) : null);
          const currentCompanyStr = currentCompany != null ? String(currentCompany).trim() || null : null;
          const currentTitleStr = currentTitle != null ? String(currentTitle).trim() || null : null;
          const notes = (candidate.description ?? raw?.description ?? raw?.summary ?? raw?.about ?? raw?.bio ?? raw?.notes) != null ? String(candidate.description ?? raw?.description ?? raw?.summary ?? raw?.about ?? raw?.bio ?? raw?.notes).trim() || null : null;
          const tagsArr = Array.isArray(candidate.tags) ? candidate.tags : (Array.isArray(raw?.tags) ? raw.tags : []);
          const skillsArr = Array.isArray((candidate as any).skills) ? (candidate as any).skills : Array.isArray(raw?.skills) ? (raw.skills as string[]) : Array.isArray(raw?.keywords) ? (raw.keywords as string[]) : [];
          const combinedTags = [...tagsArr.filter((t): t is string => typeof t === "string"), ...skillsArr.filter((s): s is string => typeof s === "string")];
          const uniqueTags = Array.from(new Set(combinedTags.map((t) => String(t).trim()).filter(Boolean)));
          const tagsJson = uniqueTags.length > 0 ? JSON.stringify(uniqueTags) : null;
          const expectedSalary = raw?.expected_salary != null ? Number(raw.expected_salary) : raw?.expected_pay != null ? Number(raw.expected_pay) : (raw?.custom_field_values && typeof raw.custom_field_values === "object" ? Number((raw.custom_field_values as Record<string, unknown>).expected_salary) : null) || null;
          const currentSalary = raw?.current_salary != null ? Number(raw.current_salary) : raw?.current_pay != null ? Number(raw.current_pay) : null;
          const salaryCurrency = (raw?.salary_currency ?? raw?.currency ?? (raw?.expected_salary_currency)) != null ? String(raw?.salary_currency ?? raw?.currency ?? raw?.expected_salary_currency).trim() || null : null;
          let resumeUrl = "";
          let resumeFilename: string | null = null;
          const resumesList = candidate.resumes ?? raw?.resumes ?? raw?.documents ?? raw?.attachments ?? raw?.resume;
          const resumesArr = Array.isArray(resumesList) ? resumesList : (resumesList && typeof resumesList === "object" ? [resumesList] : []);
          const firstResume = resumesArr[0];
          const resumeObj = firstResume && typeof firstResume === "object" ? (firstResume as Record<string, unknown>) : null;
          let resumeUrlAttr: string | undefined =
            (resumeObj?.url ?? resumeObj?.file_url ?? resumeObj?.document_url ?? resumeObj?.content_url
              ?? resumeObj?.download_url ?? resumeObj?.attachment_url ?? (resumeObj as any)?.resume_url
              ?? raw?.resume_url ?? raw?.resume_link ?? raw?.resume_download_url) as string | undefined;
          if ((!resumeUrlAttr || typeof resumeUrlAttr !== "string") && resumeObj?.id != null) {
            const origin = getFreshTeamOrigin();
            if (origin) {
              resumeUrlAttr = `${origin}/api/candidates/${ftCandidateId}/resumes/${resumeObj.id}`;
            } else if (resumesArr.length > 0 && candidatesCreated + candidatesUpdated <= 1) {
              console.warn("[FreshTeam migration] Resume object keys (first candidate):", Object.keys(resumeObj || {}));
            }
          }
          const resumeNameAttr = resumeObj?.content_file_name ?? resumeObj?.file_name ?? resumeObj?.name ?? resumeObj?.filename ?? (raw?.resume_filename && typeof raw.resume_filename === "string" ? raw.resume_filename : null);
          if (resumeUrlAttr && typeof resumeUrlAttr === "string") {
            const url = resumeUrlAttr.trim();
            const nameFromApi = (resumeNameAttr && typeof resumeNameAttr === "string") ? resumeNameAttr.trim() || null : null;
            let downloaded = await downloadResumeAsDataUrl(url, nameFromApi ?? deriveResumeFilenameFromUrl(url), true);
            if (!downloaded && resumeObj?.id != null && url.includes("/resumes/") && !url.includes("/download")) {
              const origin = getFreshTeamOrigin();
              if (origin) {
                const downloadPath = `${origin}/api/candidates/${ftCandidateId}/resumes/${resumeObj.id}/download`;
                downloaded = await downloadResumeAsDataUrl(downloadPath, nameFromApi ?? "resume.pdf", true);
                await sleep(delayMs);
              }
            }
            if (downloaded) {
              resumeUrl = downloaded.dataUrl;
              resumeFilename = downloaded.filename;
            } else if (resumeUrlAttr) {
              console.warn("[FreshTeam migration] Resume download failed for candidate", ftCandidateId, email, "URL (first 80 chars):", url.slice(0, 80));
            }
            await sleep(delayMs);
          }
          const ftCandidateIdStr = String(ftCandidateId);
          const existingCandidate = await sql`SELECT id, resume_url, resume_filename FROM candidates WHERE LOWER(TRIM(email)) = ${email}` as { id: string; resume_url: string; resume_filename: string | null }[];
          if (existingCandidate.length > 0) {
            const ourId = existingCandidate[0].id;
            const existingResume = existingCandidate[0].resume_url?.trim() ?? "";
            const isPlaceholderResume = !existingResume || existingResume === "data:application/octet-stream;base64," || existingResume.length < 100;
            const setResume = resumeUrl && (isPlaceholderResume || !existingResume);
            await sql`UPDATE candidates SET first_name = ${firstName}, middle_name = COALESCE(${middleName}, middle_name), last_name = ${lastName}, phone = COALESCE(${phone}, phone), linkedin_url = COALESCE(${linkedinUrl}, linkedin_url), current_company = COALESCE(${currentCompanyStr}, current_company), current_title = COALESCE(${currentTitleStr}, current_title), current_salary = COALESCE(${currentSalary ?? null}, current_salary), expected_salary = COALESCE(${expectedSalary ?? null}, expected_salary), salary_currency = COALESCE(${salaryCurrency ?? null}, salary_currency), city = COALESCE(${city}, city), state = COALESCE(${state}, state), country = COALESCE(${country}, country), street = COALESCE(${street}, street), zip_code = COALESCE(${zipCode}, zip_code), date_of_birth = COALESCE(${dateOfBirth}, date_of_birth), gender = COALESCE(${gender}, gender), experience_years = COALESCE(${experienceYears}, experience_years), notes = COALESCE(${notes}, notes), tags = COALESCE(${tagsJson}, tags), resume_url = ${setResume ? resumeUrl : existingCandidate[0].resume_url}, resume_filename = ${setResume ? resumeFilename : existingCandidate[0].resume_filename}, freshteam_candidate_id = ${ftCandidateIdStr}, updated_at = NOW() WHERE id = ${ourId}`;
            candidatesUpdated += 1;
          } else {
            const resumeUrlForInsert = resumeUrl && resumeUrl.trim() !== "" ? resumeUrl : "";
            if (!resumeUrlForInsert && resumeUrlAttr) {
              console.warn("[FreshTeam migration] Resume download failed for candidate", ftCandidateIdStr, email, "- storing no resume");
            }
            await sql`INSERT INTO candidates (first_name, middle_name, last_name, email, phone, linkedin_url, current_company, current_title, current_salary, expected_salary, salary_currency, city, state, country, street, zip_code, date_of_birth, gender, experience_years, notes, tags, resume_url, resume_filename, source, freshteam_candidate_id) VALUES (${firstName}, ${middleName}, ${lastName}, ${email}, ${phone ?? null}, ${linkedinUrl ?? null}, ${currentCompanyStr ?? null}, ${currentTitleStr ?? null}, ${currentSalary ?? null}, ${expectedSalary ?? null}, ${salaryCurrency ?? null}, ${city ?? null}, ${state ?? null}, ${country ?? null}, ${street ?? null}, ${zipCode ?? null}, ${dateOfBirth}, ${gender}, ${experienceYears}, ${notes}, ${tagsJson}, ${resumeUrlForInsert}, ${resumeFilename ?? null}, 'freshteam', ${ftCandidateIdStr})`;
            candidatesCreated += 1;
          }
          if (candidatesCreated + candidatesUpdated === 1) {
            console.log("[FreshTeam migration] Phase 1: First candidate migrated. Continuing...");
          }
          if ((candidatesCreated + candidatesUpdated) % 50 === 0 && (candidatesCreated + candidatesUpdated) > 0) {
            console.log(`[FreshTeam migration] Phase 1: ${candidatesCreated} created, ${candidatesUpdated} updated so far`);
          }
        } catch (err: any) {
          errors.push({ candidateId: ftCandidateId, error: err?.message ?? String(err) });
        }
      }
      if (candidateList.length < candidateListPerPage) break;
      candidatePage += 1;
    }
    console.log(`[FreshTeam migration] Phase 1 done. Phase 2: Linking candidates to jobs (applicants).`);

    // ========== PHASE 2: Link candidates to jobs via applicants (match by freshteam_candidate_id) ==========
    const candidateCache = new Map<number, Awaited<ReturnType<typeof getCandidate>>>();
    for (const { id: ourJobId, freshteam_job_id: ftJobId } of ourJobsWithFtId) {
      const ftJobIdNum = parseInt(ftJobId, 10);
      if (Number.isNaN(ftJobIdNum)) continue;

      let page = 1;
      let applicantList: Awaited<ReturnType<typeof listApplicantsForJob>> = [];
      do {
        try {
          applicantList = await listApplicantsForJob(ftJobIdNum, page, perPage);
          await sleep(delayMs);
        } catch (err: any) {
          errors.push({ error: `Job ${ftJobId}: ${err?.message ?? String(err)}` });
          break;
        }

        if (applicantList.length === 0 && page === 1) {
          console.log(`[FreshTeam migration] Job ${ftJobId}: no applicants returned`);
        }

        for (const appSummary of applicantList) {
          const applicantId = appSummary.id;
          if (applicantId == null) continue;
          applicantsProcessed += 1;
          try {
            const applicant = appSummary as Awaited<ReturnType<typeof getApplicant>>;
            let candidate_id: number | null = (appSummary as any).candidate_id ?? null;
            const embedded = (appSummary as any).candidate;
            if (candidate_id == null && embedded && typeof embedded === "object" && (embedded as any).id != null)
              candidate_id = Number((embedded as any).id);

            // Phase 2: Prefer lookup by freshteam_candidate_id (candidates already migrated in Phase 1 with full data).
            let ourCandidateId: string | null = null;
            if (candidate_id != null) {
              const byFtId = await sql`SELECT id FROM candidates WHERE freshteam_candidate_id = ${String(candidate_id)}` as { id: string }[];
              if (byFtId.length > 0) ourCandidateId = byFtId[0].id;
            }
            if (ourCandidateId != null) {
              const existingApp = await sql`SELECT id FROM applications WHERE candidate_id = ${ourCandidateId} AND job_id = ${ourJobId}` as { id: string }[];
              if (existingApp.length === 0) {
                const appliedAt = applicant.created_at ? new Date(applicant.created_at) : new Date();
                const stage = mapFtStageToOur((applicant.stage ?? applicant.sub_stage) ?? undefined);
                const coverLetter = applicant.cover_letter ? String(applicant.cover_letter).trim() || null : null;
                const referralSource = (applicant.referral_source ?? applicant.source) ? String(applicant.referral_source ?? applicant.source).trim() || null : null;
                await sql`INSERT INTO applications (candidate_id, job_id, stage, applied_at, cover_letter, referral_source) VALUES (${ourCandidateId}, ${ourJobId}, ${stage}, ${appliedAt.toISOString()}, ${coverLetter}, ${referralSource})`;
                applicationsCreated += 1;
              }
              if (applicantsProcessed % 25 === 0) console.log(`[FreshTeam migration] Progress: ${applicantsProcessed} processed, ${candidatesCreated} created, ${candidatesUpdated} updated, ${applicationsCreated} applications`);
              continue;
            }

            // Fallback: no candidate by freshteam_candidate_id (e.g. new in FT after Phase 1) — fetch full candidate and create/update + application.
            let applicantDetail: Awaited<ReturnType<typeof getApplicant>> = applicant;
            if (candidate_id == null) {
              applicantDetail = await getApplicant(Number(applicantId));
              await sleep(delayMs);
              candidate_id = applicantDetail.candidate_id ?? null;
            }
            let candidate: Awaited<ReturnType<typeof getCandidate>> | ReturnType<typeof candidateFromApplicant>;
            if (candidate_id != null) {
              if (!candidateCache.has(candidate_id)) {
                candidateCache.set(candidate_id, await getCandidate(candidate_id));
                await sleep(delayMs);
              }
              candidate = candidateCache.get(candidate_id)!;
            } else {
              candidate = candidateFromApplicant(applicantDetail, Number(applicantId));
            }

            const email = (candidate.email ?? "").trim().toLowerCase();
            if (!email) {
              errors.push({ applicantId: Number(applicantId), candidateId: candidate_id ?? undefined, error: "Candidate has no email" });
              continue;
            }

            const raw = candidate as Record<string, unknown>;
            const firstName = (candidate.first_name ?? raw?.first_name ?? raw?.firstName ?? "").toString().trim() || "Unknown";
            const middleName = (candidate.middle_name ?? raw?.middle_name ?? raw?.middleName) != null ? String(candidate.middle_name ?? raw?.middle_name ?? raw?.middleName).trim() || null : null;
            const lastName = (candidate.last_name ?? raw?.last_name ?? raw?.lastName ?? "").toString().trim() || "";
            const phone = candidate.mobile ?? candidate.phone ?? raw?.mobile ?? raw?.phone ?? null;
            const loc = candidate.location ?? raw?.location ?? raw?.address ?? raw?.address_details;
            const locObj = loc && typeof loc === "object" ? (loc as Record<string, unknown>) : null;
            const city = (locObj?.city ?? locObj?.City ?? locObj?.state_name) != null ? String(locObj?.city ?? locObj?.City ?? locObj?.state_name) : null;
            const state = (locObj?.state ?? locObj?.State ?? locObj?.state_code) != null ? String(locObj?.state ?? locObj?.State ?? locObj?.state_code) : null;
            const country = (locObj?.country_code ?? locObj?.country ?? locObj?.Country ?? locObj?.country_name) != null ? String(locObj?.country_code ?? locObj?.country ?? locObj?.Country ?? locObj?.country_name) : null;
            const street = (locObj?.street ?? locObj?.Street ?? locObj?.address_line_1 ?? locObj?.address) != null ? String(locObj?.street ?? locObj?.Street ?? locObj?.address_line_1 ?? locObj?.address) : null;
            const zipCode = (locObj?.zip_code ?? locObj?.zip ?? locObj?.postal_code ?? locObj?.pincode) != null ? String(locObj?.zip_code ?? locObj?.zip ?? locObj?.postal_code ?? locObj?.pincode) : null;
            const profileLinks = candidate.profile_links ?? raw?.profile_links ?? raw?.profile_links_list ?? raw?.profileLinks ?? raw?.social_links;
            const linksArr = Array.isArray(profileLinks) ? profileLinks : [];
            const linkedinEntry = linksArr.find((p: unknown) => (p && typeof p === "object" && (p as Record<string, unknown>).name) ? String((p as Record<string, unknown>).name).toLowerCase() === "linkedin" : (p && typeof p === "object" && (p as Record<string, unknown>).type) ? String((p as Record<string, unknown>).type).toLowerCase() === "linkedin" : false) as { url?: string } | undefined;
            const linkedinUrl = linkedinEntry?.url ?? null;
            const dobRaw = candidate.date_of_birth ?? raw?.date_of_birth ?? raw?.dob ?? raw?.dateOfBirth ?? raw?.birth_date;
            const dateOfBirth = dobRaw && /^\d{4}-\d{2}-\d{2}/.test(String(dobRaw)) ? String(dobRaw).slice(0, 10) : null;
            const gender = (candidate.gender ?? raw?.gender) != null ? String(candidate.gender ?? raw?.gender).trim() || null : null;
            const expMonths = candidate.total_experience_in_months ?? raw?.total_experience_in_months ?? raw?.experience_in_months ?? raw?.totalExperienceInMonths ?? raw?.experience;
            const experienceYears = expMonths != null ? Math.round(Number(expMonths) / 12) : (raw?.experience_years != null ? Number(raw.experience_years) : null);
            const currentCompany = (candidate as any).current_company ?? raw?.current_company ?? (candidate as any).company ?? raw?.company ?? raw?.company_name ?? raw?.employer ?? raw?.current_employer ?? (raw?.custom_field_values && typeof raw.custom_field_values === "object" ? ((raw.custom_field_values as Record<string, unknown>).company ?? (raw.custom_field_values as Record<string, unknown>).current_company) : null);
            const currentTitle = (candidate as any).current_title ?? raw?.current_title ?? (candidate as any).designation ?? raw?.designation ?? (candidate as any).job_title ?? raw?.job_title ?? raw?.title ?? raw?.position ?? raw?.role ?? (raw?.custom_field_values && typeof raw.custom_field_values === "object" ? ((raw.custom_field_values as Record<string, unknown>).job_title ?? (raw.custom_field_values as Record<string, unknown>).current_title) : null);
            const currentCompanyStr = currentCompany != null ? String(currentCompany).trim() || null : null;
            const currentTitleStr = currentTitle != null ? String(currentTitle).trim() || null : null;
            const notes = (candidate.description ?? raw?.description ?? raw?.summary ?? raw?.about ?? raw?.bio ?? raw?.notes) != null ? String(candidate.description ?? raw?.description ?? raw?.summary ?? raw?.about ?? raw?.bio ?? raw?.notes).trim() || null : null;
            const tagsArrP2 = Array.isArray(candidate.tags) ? candidate.tags : (Array.isArray(raw?.tags) ? raw.tags : []);
            const skillsArrP2 = Array.isArray((candidate as any).skills) ? (candidate as any).skills : Array.isArray(raw?.skills) ? (raw.skills as string[]) : Array.isArray(raw?.keywords) ? (raw.keywords as string[]) : [];
            const combinedTagsP2 = [...tagsArrP2.filter((t): t is string => typeof t === "string"), ...skillsArrP2.filter((s): s is string => typeof s === "string")];
            const uniqueTagsP2 = Array.from(new Set(combinedTagsP2.map((t) => String(t).trim()).filter(Boolean)));
            const tagsJson = uniqueTagsP2.length > 0 ? JSON.stringify(uniqueTagsP2) : null;
            const expectedSalaryP2 = raw?.expected_salary != null ? Number(raw.expected_salary) : raw?.expected_pay != null ? Number(raw.expected_pay) : (raw?.custom_field_values && typeof raw.custom_field_values === "object" ? Number((raw.custom_field_values as Record<string, unknown>).expected_salary) : null) || null;
            const currentSalaryP2 = raw?.current_salary != null ? Number(raw.current_salary) : raw?.current_pay != null ? Number(raw.current_pay) : null;
            const salaryCurrencyP2 = (raw?.salary_currency ?? raw?.currency ?? raw?.expected_salary_currency) != null ? String(raw?.salary_currency ?? raw?.currency ?? raw?.expected_salary_currency).trim() || null : null;

            let resumeUrl = "";
            let resumeFilename: string | null = null;
            const resumesList = candidate.resumes ?? raw?.resumes ?? raw?.documents ?? raw?.attachments ?? raw?.resume;
            const resumesArr = Array.isArray(resumesList) ? resumesList : (resumesList && typeof resumesList === "object" ? [resumesList] : []);
            const firstResume = resumesArr[0];
            const resumeObj = firstResume && typeof firstResume === "object" ? (firstResume as Record<string, unknown>) : null;
            let resumeUrlAttrP2: string | undefined =
              (resumeObj?.url ?? resumeObj?.file_url ?? resumeObj?.document_url ?? resumeObj?.content_url
                ?? resumeObj?.download_url ?? resumeObj?.attachment_url ?? (resumeObj as any)?.resume_url
                ?? raw?.resume_url ?? raw?.resume_link ?? raw?.resume_download_url) as string | undefined;
            if ((!resumeUrlAttrP2 || typeof resumeUrlAttrP2 !== "string") && resumeObj?.id != null && candidate_id != null) {
              const origin = getFreshTeamOrigin();
              if (origin) resumeUrlAttrP2 = `${origin}/api/candidates/${candidate_id}/resumes/${resumeObj.id}`;
            }
            const resumeNameAttr = resumeObj?.content_file_name ?? resumeObj?.file_name ?? resumeObj?.name ?? resumeObj?.filename
              ?? (raw?.resume_filename && typeof raw.resume_filename === "string" ? raw.resume_filename : null);
            if (resumeUrlAttrP2 && typeof resumeUrlAttrP2 === "string") {
              const url = resumeUrlAttrP2.trim();
              const nameFromApi = (resumeNameAttr && typeof resumeNameAttr === "string") ? resumeNameAttr.trim() || null : null;
              let downloaded = await downloadResumeAsDataUrl(url, nameFromApi ?? deriveResumeFilenameFromUrl(url), true);
              if (!downloaded && resumeObj?.id != null && candidate_id != null && url.includes("/resumes/") && !url.includes("/download")) {
                const origin = getFreshTeamOrigin();
                if (origin) {
                  downloaded = await downloadResumeAsDataUrl(`${origin}/api/candidates/${candidate_id}/resumes/${resumeObj.id}/download`, nameFromApi ?? "resume.pdf", true);
                  await sleep(delayMs);
                }
              }
              if (downloaded) {
                resumeUrl = downloaded.dataUrl;
                resumeFilename = downloaded.filename;
              } else if (resumeUrlAttrP2) {
                console.warn("[FreshTeam migration] Phase 2: Resume download failed for", email, "URL (first 80):", url.slice(0, 80));
              }
              await sleep(delayMs);
            }

            const existingCandidate = await sql`
              SELECT id, resume_url, resume_filename FROM candidates WHERE LOWER(TRIM(email)) = ${email}
            ` as { id: string; resume_url: string; resume_filename: string | null }[];
            if (existingCandidate.length > 0) {
              const ourCandidateId = existingCandidate[0].id;
              const existingResume = existingCandidate[0].resume_url?.trim() ?? "";
              const isPlaceholderResume = !existingResume || existingResume === "data:application/octet-stream;base64," || existingResume.length < 100;
              const setResume = resumeUrl && (isPlaceholderResume || !existingResume);
              await sql`
                UPDATE candidates SET
                  first_name = ${firstName}, middle_name = COALESCE(${middleName}, middle_name),
                  last_name = ${lastName},
                  phone = COALESCE(${phone}, phone), linkedin_url = COALESCE(${linkedinUrl}, linkedin_url),
                  current_company = COALESCE(${currentCompanyStr}, current_company),
                  current_title = COALESCE(${currentTitleStr}, current_title),
                  current_salary = COALESCE(${currentSalaryP2 ?? null}, current_salary),
                  expected_salary = COALESCE(${expectedSalaryP2 ?? null}, expected_salary),
                  salary_currency = COALESCE(${salaryCurrencyP2 ?? null}, salary_currency),
                  city = COALESCE(${city}, city), state = COALESCE(${state}, state),
                  country = COALESCE(${country}, country), street = COALESCE(${street}, street),
                  zip_code = COALESCE(${zipCode}, zip_code),
                  date_of_birth = COALESCE(${dateOfBirth}, date_of_birth),
                  gender = COALESCE(${gender}, gender),
                  experience_years = COALESCE(${experienceYears}, experience_years),
                  notes = COALESCE(${notes}, notes),
                  tags = COALESCE(${tagsJson}, tags),
                  resume_url = ${setResume ? resumeUrl : existingCandidate[0].resume_url},
                  resume_filename = ${setResume ? resumeFilename : existingCandidate[0].resume_filename},
                  freshteam_candidate_id = ${candidate_id != null ? String(candidate_id) : null},
                  updated_at = NOW()
                WHERE id = ${ourCandidateId}
              `;
              candidatesUpdated += 1;
              if (applicantsProcessed % 25 === 0) {
                console.log(`[FreshTeam migration] Progress: ${applicantsProcessed} processed, ${candidatesCreated} created, ${candidatesUpdated} updated, ${applicationsCreated} applications`);
              }

              const existingApp = await sql`
                SELECT id FROM applications WHERE candidate_id = ${ourCandidateId} AND job_id = ${ourJobId}
              ` as { id: string }[];
              if (existingApp.length === 0) {
                const appliedAt = applicantDetail.created_at ? new Date(applicantDetail.created_at) : new Date();
                const stage = mapFtStageToOur((applicantDetail.stage ?? applicantDetail.sub_stage) ?? undefined);
                const coverLetter = applicantDetail.cover_letter ? String(applicantDetail.cover_letter).trim() || null : null;
                const referralSource = (applicantDetail.referral_source ?? applicantDetail.source) ? String(applicantDetail.referral_source ?? applicantDetail.source).trim() || null : null;
                const cId = (ourCandidateId ?? "") as string;
                const jId = (ourJobId ?? "") as string;
                await sql`
                  INSERT INTO applications (candidate_id, job_id, stage, applied_at, cover_letter, referral_source)
                  VALUES (${cId}, ${jId}, ${stage}, ${appliedAt.toISOString()}, ${coverLetter}, ${referralSource})
                `;
                applicationsCreated += 1;
              }
              // else: application already exists for this candidate+job (e.g. from earlier run) — we don't duplicate
            } else {
              const resumeUrlForInsert = resumeUrl && resumeUrl.trim() !== "" ? resumeUrl : "";
              if (!resumeUrlForInsert && resumeUrlAttrP2) {
                console.warn("[FreshTeam migration] Phase 2: Resume download failed for", email, "- storing no resume");
              }
              const ftIdStr = candidate_id != null ? String(candidate_id) : null;
              const result = await sql`
                INSERT INTO candidates (
                  first_name, middle_name, last_name, email, phone, linkedin_url,
                  current_company, current_title, current_salary, expected_salary, salary_currency,
                  city, state, country, street, zip_code,
                  date_of_birth, gender, experience_years, notes, tags,
                  resume_url, resume_filename, source, freshteam_candidate_id
                ) VALUES (
                  ${firstName}, ${middleName}, ${lastName}, ${email}, ${phone ?? null}, ${linkedinUrl ?? null},
                  ${currentCompanyStr ?? null}, ${currentTitleStr ?? null}, ${currentSalaryP2 ?? null}, ${expectedSalaryP2 ?? null}, ${salaryCurrencyP2 ?? null},
                  ${city ?? null}, ${state ?? null}, ${country ?? null}, ${street ?? null}, ${zipCode ?? null},
                  ${dateOfBirth}, ${gender}, ${experienceYears}, ${notes}, ${tagsJson},
                  ${resumeUrlForInsert}, ${resumeFilename ?? null}, 'freshteam', ${ftIdStr}
                ) RETURNING id
              ` as { id: string }[];
              const newCandidateId = result[0]?.id;
              if (!newCandidateId) continue;
              candidatesCreated += 1;
              if (applicantsProcessed % 25 === 0) {
                console.log(`[FreshTeam migration] Progress: ${applicantsProcessed} processed, ${candidatesCreated} created, ${candidatesUpdated} updated, ${applicationsCreated} applications`);
              }

              const appliedAt = applicantDetail.created_at ? new Date(applicantDetail.created_at) : new Date();
              const stage = mapFtStageToOur((applicantDetail.stage ?? applicantDetail.sub_stage) ?? undefined);
              const coverLetter = applicantDetail.cover_letter ? String(applicantDetail.cover_letter).trim() || null : null;
              const referralSource = (applicantDetail.referral_source ?? applicantDetail.source) ? String(applicantDetail.referral_source ?? applicantDetail.source).trim() || null : null;
              const jId = (ourJobId ?? "") as string;
              await sql`
                INSERT INTO applications (candidate_id, job_id, stage, applied_at, cover_letter, referral_source)
                VALUES (${newCandidateId}, ${jId}, ${stage}, ${appliedAt.toISOString()}, ${coverLetter}, ${referralSource})
              `;
              applicationsCreated += 1;
            }
          } catch (err: any) {
            errors.push({ applicantId: Number(applicantId), error: err?.message ?? String(err) });
          }
        }
        if (applicantList.length < perPage) break;
        page += 1;
      } while (true);
    }

    res.json({
      message: "FreshTeam candidate migration finished",
      applicantsProcessed,
      candidatesCreated,
      candidatesUpdated,
      applicationsCreated,
      candidatesInCache: candidateCache.size,
      errors: errors.length ? errors : undefined,
    });
  } catch (error: any) {
    console.error("FreshTeam candidate migration error:", error?.message ?? error);
    res.status(500).json({
      error: "Migration failed",
      message: error?.message ?? String(error),
    });
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
               c.current_company, c.experience_years, c.expected_salary, c.resume_url, c.resume_filename,
               c.source, c.tags,
               TRIM(CONCAT_WS(', ', NULLIF(TRIM(COALESCE(c.city, '')), ''), NULLIF(TRIM(COALESCE(c.country, '')), ''))) as location,
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
               c.current_company, c.experience_years, c.expected_salary, c.resume_url, c.resume_filename,
               c.source, c.tags,
               TRIM(CONCAT_WS(', ', NULLIF(TRIM(COALESCE(c.city, '')), ''), NULLIF(TRIM(COALESCE(c.country, '')), ''))) as location,
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
               c.current_company, c.experience_years, c.expected_salary, c.resume_url, c.resume_filename,
               c.source, c.tags,
               TRIM(CONCAT_WS(', ', NULLIF(TRIM(COALESCE(c.city, '')), ''), NULLIF(TRIM(COALESCE(c.country, '')), ''))) as location,
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
    const maskedList = (Array.isArray(list) ? list : []).map((row: Record<string, unknown>) => ({ ...row, resume_url: maskPlaceholderResumeUrl(row.resume_url as string) }));
    res.json(maskedList);
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

    const app0 = apps[0] as Record<string, unknown>;
    const maskedApp = { ...app0, resume_url: maskPlaceholderResumeUrl(app0.resume_url as string) };

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
    res.json({ ...maskedApp, stage_history: history, offer: offerRows[0] || null });
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
