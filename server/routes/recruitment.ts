import { Router } from "express";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { requireAuth, requireRole } from "../middleware/auth";
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
  // Build a parameterised IN clause
  const rows = await sql`
    SELECT id, first_name, last_name FROM employees WHERE id = ANY(${ids})
  `;
  const map = new Map(rows.map((r: any) => [r.id, `${r.first_name} ${r.last_name}`]));
  return ids.map((id) => map.get(id) || id);
}

// ==================== CANDIDATES ====================

router.get("/candidates", requireAuth, async (req, res) => {
  try {
    const candidates = await sql`
      SELECT c.*,
        (SELECT COUNT(*)::int FROM applications a WHERE a.candidate_id = c.id) as application_count
      FROM candidates c
      ORDER BY c.created_at DESC
    `;
    res.json(candidates);
  } catch (error) {
    console.error("Error fetching candidates:", error);
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
    console.error("Error fetching candidate:", error);
    res.status(500).json({ error: "Failed to fetch candidate" });
  }
});

router.post("/candidates", async (req, res) => {
  try {
    const validated = insertCandidateSchema.parse(req.body);
    const existing = await sql`SELECT id FROM candidates WHERE email = ${validated.email}`;

    let candidate;
    if (existing.length > 0) {
      const result = await sql`
        UPDATE candidates SET
          first_name = ${validated.firstName}, last_name = ${validated.lastName},
          phone = ${validated.phone || null}, linkedin_url = ${validated.linkedinUrl || null},
          current_company = ${validated.currentCompany || null}, current_title = ${validated.currentTitle || null},
          experience_years = ${validated.experienceYears ?? null},
          current_salary = ${validated.currentSalary ?? null}, expected_salary = ${validated.expectedSalary ?? null},
          salary_currency = ${validated.salaryCurrency || null},
          resume_url = ${validated.resumeUrl}, resume_filename = ${validated.resumeFilename || null},
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
          resume_url, resume_filename, source, notes
        ) VALUES (
          ${validated.firstName}, ${validated.lastName}, ${validated.email},
          ${validated.phone || null}, ${validated.linkedinUrl || null},
          ${validated.currentCompany || null}, ${validated.currentTitle || null},
          ${validated.experienceYears ?? null},
          ${validated.currentSalary ?? null}, ${validated.expectedSalary ?? null},
          ${validated.salaryCurrency || null},
          ${validated.resumeUrl}, ${validated.resumeFilename || null},
          ${validated.source || "career_page"}, ${validated.notes || null}
        ) RETURNING *
      `;
      candidate = result[0];
    }

    res.status(201).json(candidate);
  } catch (error: any) {
    console.error("Error creating candidate:", error);
    if (error.name === "ZodError") return res.status(400).json({ error: "Validation failed", details: error.errors });
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
        source = COALESCE(${u.source}, source), notes = COALESCE(${u.notes}, notes),
        updated_at = NOW()
      WHERE id = ${id} RETURNING *
    `;
    res.json(result[0]);
  } catch (error) {
    console.error("Error updating candidate:", error);
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

router.get("/jobs", requireAuth, async (req, res) => {
  try {
    const includeArchived = req.query.includeArchived === "1";
    const jobs = await sql`
      SELECT j.*,
        (SELECT COUNT(*)::int FROM applications a WHERE a.job_id = j.id) as application_count,
        (SELECT COUNT(*)::int FROM applications a WHERE a.job_id = j.id AND a.stage = 'hired') as hired_count
      FROM job_postings j
      WHERE (${includeArchived} OR j.status != 'archived')
      ORDER BY j.created_at DESC
    `;

    // Resolve hiring manager names from IDs
    const enriched = await Promise.all(jobs.map(async (j: any) => {
      const hmIds: string[] = j.hiring_manager_ids
        ? (Array.isArray(j.hiring_manager_ids) ? j.hiring_manager_ids : JSON.parse(j.hiring_manager_ids))
        : (j.hiring_manager_id ? [j.hiring_manager_id] : []);
      const hmNames = await resolveEmployeeNames(hmIds);
      return { ...j, hm_names: hmNames, hm_ids: hmIds };
    }));

    res.json(enriched);
  } catch (error) {
    console.error("Error fetching jobs:", error);
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
    const hmNames = await resolveEmployeeNames(hmIds);

    const applications = await sql`
      SELECT a.*, c.id as candidate_id, c.first_name, c.last_name, c.email as candidate_email,
             c.current_company, c.experience_years, c.expected_salary, c.resume_url, c.resume_filename
      FROM applications a
      INNER JOIN candidates c ON c.id = a.candidate_id
      WHERE a.job_id = ${id}
      ORDER BY a.applied_at DESC
    `;

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
    console.error("Error creating job:", error);
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
    let whereClause = "";
    const params: any[] = [];
    if (jobId) { params.push(jobId); whereClause = `WHERE a.job_id = $${params.length}`; }
    else if (candidateId) { params.push(candidateId); whereClause = `WHERE a.candidate_id = $${params.length}`; }

    const query = `
      SELECT a.*, c.first_name, c.last_name, c.email as candidate_email,
             c.current_company, c.experience_years, c.expected_salary, c.resume_url,
             j.title as job_title, j.department as job_department,
             o.id as offer_id, o.status as offer_status
      FROM applications a
      INNER JOIN candidates c ON c.id = a.candidate_id
      INNER JOIN job_postings j ON j.id = a.job_id
      LEFT JOIN offers o ON o.application_id = a.id
      ${whereClause}
      ORDER BY a.applied_at DESC
    `;

    const applications = await sql(query, params);
    res.json(applications);
  } catch (error) {
    console.error("Error fetching applications:", error);
    res.status(500).json({ error: "Failed to fetch applications" });
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

    const history = await sql`
      SELECT h.*, u.email as moved_by_email
      FROM application_stage_history h
      LEFT JOIN users u ON u.id = h.moved_by
      WHERE h.application_id = ${id}
      ORDER BY h.created_at ASC
    `;

    const offerRows = await sql`SELECT * FROM offers WHERE application_id = ${id}`;
    res.json({ ...apps[0], stage_history: history, offer: offerRows[0] || null });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch application" });
  }
});

router.post("/applications", async (req, res) => {
  try {
    const validated = insertApplicationSchema.parse(req.body);
    const candidateCheck = await sql`SELECT id FROM candidates WHERE id = ${validated.candidateId}`;
    if (candidateCheck.length === 0) return res.status(404).json({ error: "Candidate not found" });
    const jobCheck = await sql`SELECT id FROM job_postings WHERE id = ${validated.jobId}`;
    if (jobCheck.length === 0) return res.status(404).json({ error: "Job posting not found" });

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
    if (stage === "hired") return res.status(400).json({ error: "Cannot move to Hired via stage change. Use the Hire action after the offer is accepted." });
    if (stage === "tentative") return res.status(400).json({ error: "Cannot move to Tentative via stage change. Use the Initiate Tentative action after the offer is accepted." });

    const existing = await sql`SELECT * FROM applications WHERE id = ${id}`;
    if (existing.length === 0) return res.status(404).json({ error: "Application not found" });

    const fromStage = existing[0].stage;
    if (fromStage === "hired") return res.status(400).json({ error: "Cannot change stage of a hired candidate" });

    const result = await sql`
      UPDATE applications SET
        stage = ${stage}, stage_updated_at = NOW(),
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

    if (appCheck[0].stage !== "offer" && appCheck[0].stage !== "hired") {
      const fromStage = appCheck[0].stage;
      await sql`UPDATE applications SET stage = 'offer', stage_updated_at = NOW(), updated_at = NOW() WHERE id = ${validated.applicationId}`;
      await sql`
        INSERT INTO application_stage_history (application_id, from_stage, to_stage, notes, moved_by)
        VALUES (${validated.applicationId}, ${fromStage}, 'offer', 'Offer created', ${req.user!.id})
      `;
    }

    const result = await sql`
      INSERT INTO offers (
        application_id, salary, salary_currency,
        job_title, department, start_date, employment_type,
        terms, status, esign_status
      ) VALUES (
        ${validated.applicationId}, ${validated.salary}, ${validated.salaryCurrency || null},
        ${validated.jobTitle}, ${validated.department || null},
        ${validated.startDate || null}, ${validated.employmentType || null},
        ${validated.terms || null}, ${validated.status || "draft"}, ${validated.esignStatus || null}
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
    if (u.status === "sent" && !sentAt) sentAt = new Date();
    if ((u.status === "accepted" || u.status === "rejected") && !respondedAt) respondedAt = new Date();

    const result = await sql`
      UPDATE offers SET
        salary = COALESCE(${u.salary}, salary), salary_currency = COALESCE(${u.salaryCurrency}, salary_currency),
        job_title = COALESCE(${u.jobTitle}, job_title), department = COALESCE(${u.department}, department),
        start_date = COALESCE(${u.startDate}, start_date), employment_type = COALESCE(${u.employmentType}, employment_type),
        terms = COALESCE(${u.terms}, terms), status = COALESCE(${u.status}, status),
        sent_at = ${sentAt}, responded_at = ${respondedAt},
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

// ==================== HIRE CONVERSION ====================

router.post("/applications/:id/hire", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { employeeId, workEmail } = req.body;
    if (!employeeId || !workEmail) return res.status(400).json({ error: "employeeId and workEmail are required" });

    const apps = await sql`
      SELECT a.*, c.first_name, c.last_name, c.email as personal_email, c.phone
      FROM applications a INNER JOIN candidates c ON c.id = a.candidate_id WHERE a.id = ${id}
    `;
    if (apps.length === 0) return res.status(404).json({ error: "Application not found" });
    const app = apps[0];
    if (app.stage === "hired") return res.status(400).json({ error: "Already hired" });
    if (app.employee_id) return res.status(400).json({ error: "Already linked to an employee" });

    const offerRows = await sql`SELECT * FROM offers WHERE application_id = ${id}`;
    if (offerRows.length === 0) return res.status(400).json({ error: "No offer exists" });
    const offer = offerRows[0];
    if (offer.status !== "accepted") return res.status(400).json({ error: `Offer must be accepted. Current: '${offer.status}'.` });

    // If tentative record exists, must be cleared
    const tentativeCheck = await sql`SELECT id, status FROM tentative_records WHERE application_id = ${id}`;
    if (tentativeCheck.length > 0 && tentativeCheck[0].status !== "cleared") {
      return res.status(400).json({ error: "Tentative record exists but is not cleared. Use Confirm Hire from the tentative review instead." });
    }

    const joinDate = offer.start_date || new Date();
    const empResult = await sql`
      INSERT INTO employees (
        employee_id, work_email, first_name, last_name,
        job_title, department, employment_status, employee_type,
        join_date, personal_email, work_phone, source
      ) VALUES (
        ${employeeId}, ${workEmail}, ${app.first_name}, ${app.last_name},
        ${offer.job_title}, ${offer.department || "Other"},
        'onboarding', ${offer.employment_type || "full_time"},
        ${joinDate}, ${app.personal_email || null}, ${app.phone || null}, 'manual'
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

export default router;
