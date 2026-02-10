import { Router } from "express";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { requireAuth, requireRole } from "../middleware/auth";

config();
const sql = neon(process.env.DATABASE_URL!);
const router = Router();

// ==================== DOCUMENT RULE ENGINE ====================

/**
 * Document checklist generator based on is_first_job flag.
 * Returns array of { documentType, required } tuples.
 *
 * Rules:
 * - Mandatory always: cnic_front, cnic_back, professional_photo
 * - Optional always: passport, drivers_license
 * - Academic: degree_transcript (required unless HR waives)
 * - If is_first_job = true:
 *     - salary_slip → not_applicable
 *     - experience_certificate → not_applicable
 *     - resignation_acceptance → not_applicable
 *     - internship_certificate → optional
 * - If is_first_job = false:
 *     - experience_certificate → required
 *     - salary_slip → required
 *     - resignation_acceptance → required
 *     - internship_certificate → not shown
 */
function generateDocumentChecklist(isFirstJob: boolean): { documentType: string; required: boolean; autoStatus: string }[] {
  const docs: { documentType: string; required: boolean; autoStatus: string }[] = [
    // Mandatory — always
    { documentType: "cnic_front", required: true, autoStatus: "pending" },
    { documentType: "cnic_back", required: true, autoStatus: "pending" },
    { documentType: "professional_photo", required: true, autoStatus: "pending" },
    // Optional identity
    { documentType: "passport", required: false, autoStatus: "pending" },
    { documentType: "drivers_license", required: false, autoStatus: "pending" },
    // Academic
    { documentType: "degree_transcript", required: true, autoStatus: "pending" },
  ];

  if (isFirstJob) {
    // First job: employment history auto not_applicable
    docs.push(
      { documentType: "salary_slip", required: false, autoStatus: "not_applicable" },
      { documentType: "experience_certificate", required: false, autoStatus: "not_applicable" },
      { documentType: "resignation_acceptance", required: false, autoStatus: "not_applicable" },
      { documentType: "internship_certificate", required: false, autoStatus: "pending" },
    );
  } else {
    // Experienced: employment history required
    docs.push(
      { documentType: "experience_certificate", required: true, autoStatus: "pending" },
      { documentType: "salary_slip", required: true, autoStatus: "pending" },
      { documentType: "resignation_acceptance", required: true, autoStatus: "pending" },
    );
  }

  return docs;
}

/** Human-readable document type labels */
const DOC_TYPE_LABELS: Record<string, string> = {
  cnic_front: "CNIC Front",
  cnic_back: "CNIC Back",
  professional_photo: "Professional Profile Photograph",
  passport: "Passport",
  drivers_license: "Driver's License",
  degree_transcript: "Degree / Transcript",
  experience_certificate: "Experience Certificate",
  salary_slip: "Latest Salary Slip",
  resignation_acceptance: "Resignation Acceptance Letter",
  internship_certificate: "Internship Certificate",
};

// ==================== INITIATE TENTATIVE ====================

/**
 * POST /api/tentative/initiate
 * HR moves candidate to Tentative after offer is accepted.
 * Creates tentative_record + generates document checklist.
 */
router.post("/initiate", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const { applicationId, isFirstJob } = req.body;
    if (!applicationId) {
      return res.status(400).json({ error: "applicationId is required" });
    }

    // Validate application exists and offer is accepted
    const apps = await sql`
      SELECT a.*, o.status as offer_status, o.id as offer_id
      FROM applications a
      LEFT JOIN offers o ON o.application_id = a.id
      WHERE a.id = ${applicationId}
    `;
    if (apps.length === 0) return res.status(404).json({ error: "Application not found" });
    const app = apps[0];

    if (app.offer_status !== "accepted") {
      return res.status(400).json({ error: `Offer must be accepted before initiating tentative. Current: '${app.offer_status || "no offer"}'.` });
    }
    if (app.stage === "hired") {
      return res.status(400).json({ error: "Candidate is already hired" });
    }

    // Check if tentative already exists
    const existing = await sql`SELECT id FROM tentative_records WHERE application_id = ${applicationId}`;
    if (existing.length > 0) {
      return res.status(400).json({ error: "Tentative record already exists for this application" });
    }

    // Create tentative record
    const tentRows = await sql`
      INSERT INTO tentative_records (application_id, candidate_id, status, is_first_job, initiated_by)
      VALUES (${applicationId}, ${app.candidate_id}, 'pending', ${isFirstJob ?? false}, ${req.user!.id})
      RETURNING *
    `;
    const tentative = tentRows[0];

    // Generate document checklist
    const docs = generateDocumentChecklist(!!isFirstJob);
    for (const doc of docs) {
      await sql`
        INSERT INTO tentative_documents (tentative_record_id, document_type, required, status)
        VALUES (${tentative.id}, ${doc.documentType}, ${doc.required}, ${doc.autoStatus})
      `;
    }

    // Move application stage to "tentative"
    const fromStage = app.stage;
    await sql`
      UPDATE applications SET stage = 'tentative', stage_updated_at = NOW(), updated_at = NOW()
      WHERE id = ${applicationId}
    `;
    await sql`
      INSERT INTO application_stage_history (application_id, from_stage, to_stage, notes, moved_by)
      VALUES (${applicationId}, ${fromStage}, 'tentative', 'Tentative hiring initiated — document collection started', ${req.user!.id})
    `;

    // Fetch documents for response
    const documents = await sql`
      SELECT * FROM tentative_documents WHERE tentative_record_id = ${tentative.id} ORDER BY created_at
    `;

    res.status(201).json({
      ...tentative,
      documents,
      portalUrl: `/tentative-portal/${tentative.portal_token}`,
    });
  } catch (error) {
    console.error("Error initiating tentative:", error);
    res.status(500).json({ error: "Failed to initiate tentative" });
  }
});

// ==================== GET TENTATIVE RECORD ====================

/** GET /api/tentative/:applicationId — Fetch tentative record for an application */
router.get("/:applicationId", requireAuth, async (req, res) => {
  try {
    const { applicationId } = req.params;
    const rows = await sql`
      SELECT tr.*, c.first_name, c.last_name, c.email
      FROM tentative_records tr
      JOIN candidates c ON c.id = tr.candidate_id
      WHERE tr.application_id = ${applicationId}
    `;
    if (rows.length === 0) return res.status(404).json({ error: "No tentative record found" });

    const documents = await sql`
      SELECT * FROM tentative_documents WHERE tentative_record_id = ${rows[0].id} ORDER BY created_at
    `;

    res.json({ ...rows[0], documents });
  } catch (error) {
    console.error("Error fetching tentative:", error);
    res.status(500).json({ error: "Failed to fetch tentative record" });
  }
});

/** GET /api/tentative — List all tentative records (HR dashboard) */
router.get("/", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const rows = await sql`
      SELECT tr.*, c.first_name, c.last_name, c.email,
        j.title as job_title, j.department,
        (SELECT count(*)::int FROM tentative_documents td WHERE td.tentative_record_id = tr.id AND td.required = true AND td.status NOT IN ('verified', 'not_applicable')) as pending_required,
        (SELECT count(*)::int FROM tentative_documents td WHERE td.tentative_record_id = tr.id AND td.required = true) as total_required
      FROM tentative_records tr
      JOIN candidates c ON c.id = tr.candidate_id
      JOIN applications a ON a.id = tr.application_id
      JOIN job_postings j ON j.id = a.job_id
      ORDER BY tr.created_at DESC
    `;
    res.json(rows);
  } catch (error) {
    console.error("Error listing tentatives:", error);
    res.status(500).json({ error: "Failed to list tentative records" });
  }
});

// ==================== CANDIDATE PORTAL (TOKEN-BASED) ====================

/**
 * GET /api/tentative/portal/:token
 * Public endpoint — no auth needed. Token authenticates the candidate.
 * Returns tentative record + document checklist + candidate info.
 */
router.get("/portal/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const rows = await sql`
      SELECT tr.*, c.first_name, c.last_name, c.email
      FROM tentative_records tr
      JOIN candidates c ON c.id = tr.candidate_id
      WHERE tr.portal_token = ${token}
    `;
    if (rows.length === 0) return res.status(404).json({ error: "Invalid or expired portal link" });

    const tentative = rows[0];
    if (tentative.status === "cleared") {
      return res.json({ ...tentative, documents: [], message: "Your documents have been verified. The hiring process is complete." });
    }

    const documents = await sql`
      SELECT id, document_type, required, status, file_name, rejection_reason, uploaded_at, verified_at
      FROM tentative_documents WHERE tentative_record_id = ${tentative.id} ORDER BY created_at
    `;

    // Add human-readable labels
    const enriched = documents.map((d: any) => ({
      ...d,
      label: DOC_TYPE_LABELS[d.document_type] || d.document_type,
    }));

    res.json({ ...tentative, documents: enriched });
  } catch (error) {
    console.error("Error fetching portal:", error);
    res.status(500).json({ error: "Failed to load portal" });
  }
});

/**
 * POST /api/tentative/portal/:token/upload/:docId
 * Candidate uploads a document. Accepts base64 data URL or file URL.
 * Token-based auth — no login needed.
 */
router.post("/portal/:token/upload/:docId", async (req, res) => {
  try {
    const { token, docId } = req.params;
    const { fileUrl, fileName } = req.body;

    if (!fileUrl) return res.status(400).json({ error: "fileUrl is required" });

    // Validate token
    const tentRows = await sql`SELECT id, status FROM tentative_records WHERE portal_token = ${token}`;
    if (tentRows.length === 0) return res.status(404).json({ error: "Invalid portal link" });
    if (tentRows[0].status === "cleared") return res.status(400).json({ error: "Portal is closed — documents already verified" });
    if (tentRows[0].status === "failed") return res.status(400).json({ error: "This tentative record has been marked as failed" });

    // Validate document belongs to this tentative
    const docRows = await sql`
      SELECT * FROM tentative_documents WHERE id = ${docId} AND tentative_record_id = ${tentRows[0].id}
    `;
    if (docRows.length === 0) return res.status(404).json({ error: "Document not found" });

    const doc = docRows[0];
    if (doc.status === "verified") return res.status(400).json({ error: "This document is already verified" });
    if (doc.status === "not_applicable") return res.status(400).json({ error: "This document is marked as not applicable" });

    // Update document with upload
    const result = await sql`
      UPDATE tentative_documents SET
        file_url = ${fileUrl},
        file_name = ${fileName || null},
        status = 'uploaded',
        rejection_reason = NULL,
        uploaded_at = NOW(),
        updated_at = NOW()
      WHERE id = ${docId}
      RETURNING *
    `;

    res.json({ ...result[0], label: DOC_TYPE_LABELS[result[0].document_type] });
  } catch (error) {
    console.error("Error uploading document:", error);
    res.status(500).json({ error: "Failed to upload document" });
  }
});

// ==================== HR VERIFICATION ====================

/**
 * PATCH /api/tentative/documents/:docId/verify
 * HR verifies a single document. Body: { action: "verify" | "reject", reason?: string }
 */
router.patch("/documents/:docId/verify", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const { docId } = req.params;
    const { action, reason } = req.body;

    if (!action || !["verify", "reject"].includes(action)) {
      return res.status(400).json({ error: "action must be 'verify' or 'reject'" });
    }

    const docRows = await sql`SELECT * FROM tentative_documents WHERE id = ${docId}`;
    if (docRows.length === 0) return res.status(404).json({ error: "Document not found" });

    const doc = docRows[0];
    if (doc.status === "not_applicable") return res.status(400).json({ error: "Cannot verify a not-applicable document" });
    if (doc.status === "pending") return res.status(400).json({ error: "Document has not been uploaded yet" });

    if (action === "verify") {
      const result = await sql`
        UPDATE tentative_documents SET
          status = 'verified', verified_by = ${req.user!.id}, verified_at = NOW(),
          rejection_reason = NULL, updated_at = NOW()
        WHERE id = ${docId} RETURNING *
      `;
      res.json(result[0]);
    } else {
      // Reject — candidate can re-upload
      if (!reason) return res.status(400).json({ error: "Rejection reason is required" });
      const result = await sql`
        UPDATE tentative_documents SET
          status = 'rejected', rejection_reason = ${reason},
          verified_by = ${req.user!.id}, updated_at = NOW()
        WHERE id = ${docId} RETURNING *
      `;
      res.json(result[0]);
    }
  } catch (error) {
    console.error("Error verifying document:", error);
    res.status(500).json({ error: "Failed to verify document" });
  }
});

/**
 * POST /api/tentative/:tentativeId/clear
 * HR clears the tentative record. Only when ALL required docs = verified or not_applicable.
 */
router.post("/:tentativeId/clear", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const { tentativeId } = req.params;

    const tentRows = await sql`SELECT * FROM tentative_records WHERE id = ${tentativeId}`;
    if (tentRows.length === 0) return res.status(404).json({ error: "Tentative record not found" });
    if (tentRows[0].status === "cleared") return res.status(400).json({ error: "Already cleared" });

    // Check all required docs are verified or not_applicable
    const pendingRequired = await sql`
      SELECT count(*)::int as count FROM tentative_documents
      WHERE tentative_record_id = ${tentativeId}
        AND required = true
        AND status NOT IN ('verified', 'not_applicable')
    `;
    if (pendingRequired[0].count > 0) {
      return res.status(400).json({
        error: `Cannot clear: ${pendingRequired[0].count} required document(s) still pending or rejected`,
      });
    }

    const result = await sql`
      UPDATE tentative_records SET status = 'cleared', cleared_at = NOW()
      WHERE id = ${tentativeId} RETURNING *
    `;

    res.json(result[0]);
  } catch (error) {
    console.error("Error clearing tentative:", error);
    res.status(500).json({ error: "Failed to clear tentative" });
  }
});

/**
 * POST /api/tentative/:tentativeId/fail
 * HR marks tentative as failed (compliance failure).
 */
router.post("/:tentativeId/fail", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const { tentativeId } = req.params;
    const { reason } = req.body;

    const result = await sql`
      UPDATE tentative_records SET status = 'failed', failed_at = NOW(), failed_reason = ${reason || null}
      WHERE id = ${tentativeId} RETURNING *
    `;
    if (result.length === 0) return res.status(404).json({ error: "Tentative record not found" });

    // Move application to rejected
    const appId = result[0].application_id;
    const appRows = await sql`SELECT stage FROM applications WHERE id = ${appId}`;
    const fromStage = appRows[0]?.stage || "tentative";
    await sql`
      UPDATE applications SET stage = 'rejected', stage_updated_at = NOW(),
        reject_reason = ${reason || 'Failed document verification'}, updated_at = NOW()
      WHERE id = ${appId}
    `;
    await sql`
      INSERT INTO application_stage_history (application_id, from_stage, to_stage, notes, moved_by)
      VALUES (${appId}, ${fromStage}, 'rejected', ${reason || 'Tentative failed — document verification'}, ${req.user!.id})
    `;

    res.json(result[0]);
  } catch (error) {
    console.error("Error failing tentative:", error);
    res.status(500).json({ error: "Failed to update tentative" });
  }
});

// ==================== CONFIRM HIRE (via Tentative) ====================

/**
 * POST /api/tentative/:tentativeId/confirm-hire
 * Final step: creates employee record. Only when tentative.status = "cleared".
 * Body: { employeeId, workEmail }
 *
 * Flow: Tentative Cleared → Confirm Hire → Employee Created → Onboarding (manual)
 */
router.post("/:tentativeId/confirm-hire", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const { tentativeId } = req.params;
    const { employeeId, workEmail } = req.body;

    if (!employeeId || !workEmail) {
      return res.status(400).json({ error: "employeeId and workEmail are required" });
    }

    // Load tentative
    const tentRows = await sql`SELECT * FROM tentative_records WHERE id = ${tentativeId}`;
    if (tentRows.length === 0) return res.status(404).json({ error: "Tentative record not found" });
    const tentative = tentRows[0];

    if (tentative.status !== "cleared") {
      return res.status(400).json({ error: `Tentative must be cleared before hire. Current: '${tentative.status}'.` });
    }

    // Load application + candidate + offer
    const apps = await sql`
      SELECT a.*, c.first_name, c.last_name, c.email as personal_email, c.phone
      FROM applications a
      JOIN candidates c ON c.id = a.candidate_id
      WHERE a.id = ${tentative.application_id}
    `;
    if (apps.length === 0) return res.status(404).json({ error: "Application not found" });
    const app = apps[0];

    if (app.stage === "hired") return res.status(400).json({ error: "Already hired" });
    if (app.employee_id) return res.status(400).json({ error: "Already linked to employee" });

    const offerRows = await sql`SELECT * FROM offers WHERE application_id = ${tentative.application_id}`;
    if (offerRows.length === 0) return res.status(400).json({ error: "No offer found" });
    const offer = offerRows[0];
    if (offer.status !== "accepted") return res.status(400).json({ error: "Offer must be accepted" });

    // Create employee record
    const joinDate = offer.start_date || new Date();
    const empResult = await sql`
      INSERT INTO employees (
        employee_id, work_email, first_name, last_name,
        job_title, department,
        employment_status, employee_type,
        join_date, personal_email, work_phone,
        source
      ) VALUES (
        ${employeeId}, ${workEmail},
        ${app.first_name}, ${app.last_name},
        ${offer.job_title}, ${offer.department || "Other"},
        'onboarding', ${offer.employment_type || "full_time"},
        ${joinDate}, ${app.personal_email || null}, ${app.phone || null},
        'manual'
      ) RETURNING *
    `;
    const employee = empResult[0];

    // Update application → hired
    const fromStage = app.stage;
    await sql`
      UPDATE applications SET
        stage = 'hired', stage_updated_at = NOW(),
        employee_id = ${employee.id}, converted_at = NOW(),
        updated_at = NOW()
      WHERE id = ${tentative.application_id}
    `;
    await sql`
      INSERT INTO application_stage_history (application_id, from_stage, to_stage, notes, moved_by)
      VALUES (${tentative.application_id}, ${fromStage}, 'hired', 'Confirmed hire after tentative clearance', ${req.user!.id})
    `;

    res.status(201).json({
      message: "Candidate hired successfully. Start onboarding from the employee profile.",
      employee,
      tentativeId,
      applicationId: tentative.application_id,
    });
  } catch (error: any) {
    console.error("Error confirming hire:", error);
    if (error.code === "23505") {
      return res.status(409).json({ error: "Employee ID or work email already exists" });
    }
    res.status(500).json({ error: "Failed to confirm hire" });
  }
});

/**
 * PATCH /api/tentative/:tentativeId/first-job
 * Update is_first_job flag and regenerate checklist.
 * Only allowed when tentative is still pending.
 */
router.patch("/:tentativeId/first-job", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const { tentativeId } = req.params;
    const { isFirstJob } = req.body;

    const tentRows = await sql`SELECT * FROM tentative_records WHERE id = ${tentativeId}`;
    if (tentRows.length === 0) return res.status(404).json({ error: "Tentative record not found" });
    if (tentRows[0].status !== "pending") return res.status(400).json({ error: "Can only update first-job flag while tentative is pending" });

    // Update flag
    await sql`UPDATE tentative_records SET is_first_job = ${!!isFirstJob} WHERE id = ${tentativeId}`;

    // Delete existing docs and regenerate
    await sql`DELETE FROM tentative_documents WHERE tentative_record_id = ${tentativeId}`;
    const docs = generateDocumentChecklist(!!isFirstJob);
    for (const doc of docs) {
      await sql`
        INSERT INTO tentative_documents (tentative_record_id, document_type, required, status)
        VALUES (${tentativeId}, ${doc.documentType}, ${doc.required}, ${doc.autoStatus})
      `;
    }

    const documents = await sql`
      SELECT * FROM tentative_documents WHERE tentative_record_id = ${tentativeId} ORDER BY created_at
    `;

    res.json({ ...tentRows[0], is_first_job: !!isFirstJob, documents });
  } catch (error) {
    console.error("Error updating first-job:", error);
    res.status(500).json({ error: "Failed to update" });
  }
});

export default router;
