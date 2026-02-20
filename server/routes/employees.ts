import { Router } from "express";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { requireAuth, requireRole, canAccessEmployee } from "../middleware/auth";
import { memCache } from "../lib/perf";
import {
  parseFreshteamEmployeeCSV,
  parseFreshteamEmergencyContactsCSV,
  parseFreshteamCompensationsCSV,
  parseFreshteamBankAccountsCSV,
  parseFreshteamDependentsCSV,
  parseFreshteamStocksCSV,
} from "../lib/freshteamCsv";

config();
const sql = neon(process.env.DATABASE_URL!);
const router = Router();

/** Format date for DB (YYYY-MM-DD); timestamps as ISO. */
function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}
function toTimestamp(d: Date): string {
  return d.toISOString();
}

/**
 * GET /api/employees
 * List all employees (Admin/HR see all, Manager sees team, Employee sees directory).
 * Supports ?limit=&offset= for pagination; default limit 500, max 2000. Cache 10s when no params.
 */
router.get("/", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 500, 2000);
    const offset = parseInt(req.query.offset as string) || 0;
    const useCache = !req.query.limit && !req.query.offset;
    if (useCache) {
      const cached = memCache.get<any[]>("employees:list");
      if (cached) return res.json(cached);
    }
    const employees = await sql`
      SELECT 
        id, employee_id, work_email, first_name, middle_name, last_name, avatar,
        job_title, department, sub_department, business_unit, location, grade,
        employment_status, employee_type, join_date,
        city, state, country
      FROM employees
      ORDER BY first_name, last_name
      LIMIT ${limit} OFFSET ${offset}
    `;
    if (useCache) memCache.set("employees:list", employees, 10_000); // 10s TTL
    res.json(employees);
  } catch (error) {
    console.error("Error fetching employees:", error);
    res.status(500).json({ error: "Failed to fetch employees" });
  }
});

/**
 * GET /api/employees/suggested-id
 * Returns a suggested next employee ID (e.g. EMP-009) for hire flows. Admin/HR only.
 */
router.get("/suggested-id", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const rows = await sql`SELECT employee_id FROM employees ORDER BY employee_id`;
    let maxNum = 0;
    for (const r of rows) {
      const id = (r as { employee_id: string }).employee_id;
      const match = id.match(/(\d+)$/);
      if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
    }
    const suggested = `EMP-${String(maxNum + 1).padStart(3, "0")}`;
    res.json({ suggestedId: suggested });
  } catch (error) {
    console.error("Error suggesting employee ID:", error);
    res.status(500).json({ error: "Failed to suggest employee ID" });
  }
});

/**
 * GET /api/employees/documents/:docId/file
 * Serve document file (base64 data URL or redirect). Auth: admin/hr or own employee doc.
 */
router.get("/documents/:docId/file", requireAuth, async (req, res) => {
  try {
    const { docId } = req.params;
    const rows = await sql`
      SELECT ed.file_url, ed.file_name, ed.employee_id
      FROM employee_documents ed
      WHERE ed.id = ${docId}
    `;
    if (rows.length === 0) return res.status(404).json({ error: "Document not found" });
    const row = rows[0];
    const fileUrl = row.file_url;
    if (!fileUrl || typeof fileUrl !== "string") return res.status(404).json({ error: "No file for this document" });

    // Access: admin/hr or the employee who owns this doc
    const canAccess = ["admin", "hr"].includes(req.user!.role) || req.user!.employeeId === row.employee_id;
    if (!canAccess) return res.status(403).json({ error: "Not allowed to view this document" });

    if (fileUrl.startsWith("data:")) {
      const match = fileUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) return res.status(400).json({ error: "Invalid file data" });
      const contentType = match[1];
      const base64 = match[2];
      const buf = Buffer.from(base64, "base64");
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `inline; filename="${(row.file_name || "document").replace(/"/g, "%22")}"`);
      res.setHeader("Cache-Control", "private, max-age=3600");
      res.send(buf);
      return;
    }
    res.redirect(302, fileUrl);
  } catch (error) {
    console.error("Error serving employee document:", error);
    res.status(500).json({ error: "Failed to load document" });
  }
});

/**
 * GET /api/employees/:id/documents
 * List documents for an employee (tentative verification copies, manual uploads). Auth: admin/hr or own profile.
 */
router.get("/:id/documents", requireAuth, canAccessEmployee, async (req, res) => {
  try {
    const { id: employeeId } = req.params;
    const docs = await sql`
      SELECT id, display_name, document_type, file_name, source, uploaded_at, created_at
      FROM employee_documents
      WHERE employee_id = ${employeeId}
      ORDER BY uploaded_at DESC NULLS LAST, created_at DESC
    `;
    res.json(docs);
  } catch (error) {
    console.error("Error fetching employee documents:", error);
    res.status(500).json({ error: "Failed to fetch documents" });
  }
});

/**
 * POST /api/employees/:id/documents
 * HR/Admin manually upload a document for an employee. Body: { displayName, fileUrl (data URL), fileName }
 */
router.post("/:id/documents", requireAuth, requireRole(["admin", "hr"]), canAccessEmployee, async (req, res) => {
  try {
    const { id: employeeId } = req.params;
    const { displayName, fileUrl, fileName } = req.body;
    if (!fileUrl || typeof fileUrl !== "string") {
      return res.status(400).json({ error: "fileUrl (data URL) is required" });
    }
    if (!fileName || typeof fileName !== "string") {
      return res.status(400).json({ error: "fileName is required" });
    }
    const display = (displayName && String(displayName).trim()) || fileName;
    const result = await sql`
      INSERT INTO employee_documents (employee_id, document_type, display_name, file_url, file_name, source, uploaded_at)
      VALUES (${employeeId}, 'manual', ${display}, ${fileUrl}, ${fileName}, 'manual', NOW())
      RETURNING id, display_name, document_type, file_name, source, uploaded_at, created_at
    `;
    res.status(201).json(result[0]);
  } catch (error) {
    console.error("Error uploading employee document:", error);
    res.status(500).json({ error: "Failed to upload document" });
  }
});

/**
 * DELETE /api/employees/documents/:docId
 * HR/Admin remove a document from an employee.
 */
router.delete("/documents/:docId", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const { docId } = req.params;
    const deleted = await sql`DELETE FROM employee_documents WHERE id = ${docId} RETURNING id`;
    if (deleted.length === 0) return res.status(404).json({ error: "Document not found" });
    res.json({ message: "Deleted" });
  } catch (error) {
    console.error("Error deleting employee document:", error);
    res.status(500).json({ error: "Failed to delete document" });
  }
});

/** Labels for tentative document types (used when syncing to employee_documents) */
const TENTATIVE_DOC_LABELS: Record<string, string> = {
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

/**
 * POST /api/employees/:id/sync-tentative-documents
 * Copy verified tentative documents to this employee's profile (for hires that were confirmed before the copy-on-confirm feature).
 * HR/Admin only. Idempotent: skips docs already copied (same tentative_document_id).
 */
router.post("/:id/sync-tentative-documents", requireAuth, requireRole(["admin", "hr"]), canAccessEmployee, async (req, res) => {
  try {
    const { id: employeeId } = req.params;

    // Find an application that is hired and linked to this employee
    const apps = await sql`
      SELECT id FROM applications
      WHERE employee_id = ${employeeId} AND stage = 'hired'
      ORDER BY updated_at DESC LIMIT 1
    `;
    if (apps.length === 0) {
      return res.status(404).json({ error: "No hired application found for this employee" });
    }
    const applicationId = apps[0].id;

    // Find cleared tentative record for this application
    const tentRows = await sql`
      SELECT id FROM tentative_records
      WHERE application_id = ${applicationId} AND status = 'cleared'
      LIMIT 1
    `;
    if (tentRows.length === 0) {
      return res.status(404).json({ error: "No cleared tentative record found for this hire" });
    }
    const tentativeId = tentRows[0].id;

    // Verified docs from tentative
    const verifiedDocs = await sql`
      SELECT id, document_type, file_url, file_name, uploaded_at
      FROM tentative_documents
      WHERE tentative_record_id = ${tentativeId}
        AND status = 'verified'
        AND file_url IS NOT NULL AND file_url != ''
    `;

    // Already-copied tentative_document_ids for this employee
    const existing = await sql`
      SELECT tentative_document_id FROM employee_documents
      WHERE employee_id = ${employeeId} AND tentative_document_id IS NOT NULL
    `;
    const existingIds = new Set((existing as { tentative_document_id: string | null }[]).map((r) => r.tentative_document_id).filter(Boolean));

    let copied = 0;
    for (const d of verifiedDocs) {
      if (existingIds.has(d.id)) continue;
      const label = TENTATIVE_DOC_LABELS[d.document_type] || (d.document_type || "").replace(/_/g, " ");
      await sql`
        INSERT INTO employee_documents (employee_id, document_type, display_name, file_url, file_name, source, tentative_document_id, uploaded_at)
        VALUES (${employeeId}, ${d.document_type}, ${label}, ${d.file_url}, ${d.file_name || null}, 'tentative_verification', ${d.id}, ${d.uploaded_at})
      `;
      copied++;
    }

    res.json({ message: copied > 0 ? `Copied ${copied} document(s) from tentative verification` : "No new documents to copy (already synced)", copied });
  } catch (error) {
    console.error("Error syncing tentative documents:", error);
    res.status(500).json({ error: "Failed to sync documents" });
  }
});

/**
 * GET /api/employees/:id
 * Get single employee details
 */
router.get("/:id", requireAuth, canAccessEmployee, async (req, res) => {
  try {
    const { id } = req.params;
    
    const employees = await sql`
      SELECT * FROM employees WHERE id = ${id}
    `;

    if (employees.length === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    // If employee (not admin/hr), hide sensitive fields
    const employee = employees[0];
    if (!["admin", "hr"].includes(req.user!.role) && req.user!.employeeId !== id) {
      // Return limited info for directory view
      return res.json({
        id: employee.id,
        employee_id: employee.employee_id,
        first_name: employee.first_name,
        last_name: employee.last_name,
        work_email: employee.work_email,
        job_title: employee.job_title,
        department: employee.department,
        location: employee.location,
        avatar: employee.avatar,
      });
    }

    res.json(employee);
  } catch (error) {
    console.error("Error fetching employee:", error);
    res.status(500).json({ error: "Failed to fetch employee" });
  }
});

/**
 * PATCH /api/employees/:id
 * Admin/HR direct update - no approval needed
 */
router.patch("/:id", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Build dynamic update query
    const allowedFields = [
      "employee_id", "work_email", "first_name", "middle_name", "last_name", "avatar",
      "job_title", "department", "sub_department", "business_unit", "primary_team",
      "cost_center", "grade", "job_category", "location", "manager_id", "manager_email", "hr_email",
      "employment_status", "employee_type", "shift",
      "personal_email", "work_phone",
      "dob", "gender", "marital_status", "blood_group",
      "street", "city", "state", "country", "zip_code",
      "comm_street", "comm_city", "comm_state", "comm_country", "comm_zip_code",
      "join_date", "probation_start_date", "probation_end_date", "confirmation_date", "notice_period",
      "resignation_date", "exit_date", "exit_type", "resignation_reason", "eligible_for_rehire",
      "custom_field_1", "custom_field_2", "source"
    ];

    // Filter to only allowed fields
    const filteredUpdates: Record<string, any> = {};
    for (const key of Object.keys(updates)) {
      const snakeKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
      if (allowedFields.includes(snakeKey)) {
        filteredUpdates[snakeKey] = updates[key];
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    // If updating work_email, normalize and ensure it's not already used by another employee
    if (filteredUpdates.work_email != null) {
      const workEmail = String(filteredUpdates.work_email).trim().toLowerCase();
      if (workEmail) {
        const existing = await sql`
          SELECT id FROM employees WHERE LOWER(work_email) = ${workEmail} AND id != ${id}
        `;
        if (existing.length > 0) {
          return res.status(400).json({ error: "Work email is already in use by another employee" });
        }
        filteredUpdates.work_email = workEmail;
      } else {
        // work_email is required in schema; omit from update if empty so we don't set null
        delete filteredUpdates.work_email;
      }
    }

    // Build SET clause dynamically for Neon (using positional parameters)
    const keys = Object.keys(filteredUpdates);
    const values = Object.values(filteredUpdates);
    
    // Build SET assignments: col1 = $1, col2 = $2, ...
    const setClause = keys
      .map((key, i) => `${key} = $${i + 1}`)
      .join(", ");
    
    // ID goes at the end for the WHERE clause
    const idParamIndex = keys.length + 1;
    const queryText = `UPDATE employees SET ${setClause}, updated_at = NOW() WHERE id = $${idParamIndex} RETURNING *`;

    // Use Neon's raw query execution
    const result = await sql(queryText, [...values, id]);

    if (result.length === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    memCache.invalidate("employees:");
    res.json({ 
      message: "Employee updated successfully",
      employee: result[0] 
    });
  } catch (error) {
    console.error("Error updating employee:", error);
    res.status(500).json({ error: "Failed to update employee" });
  }
});

/**
 * POST /api/employees/import-freshteam-csv
 * Import employees from FreshTeam export CSV. Body: { csv: string }.
 * Creates new employees or updates existing by work_email. Sets source = 'freshteam'.
 * Resolves manager_id from manager_email after insert. Admin/HR only.
 */
router.post("/import-freshteam-csv", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const csv = typeof req.body?.csv === "string" ? req.body.csv : "";
    if (!csv.trim()) {
      return res.status(400).json({ error: "Body must include { csv: \"...\" } with FreshTeam export CSV content." });
    }

    const rows = parseFreshteamEmployeeCSV(csv);
    if (rows.length === 0) {
      return res.status(400).json({ error: "No valid employee rows found. Ensure CSV has header: First Name, Last Name, Official Email, Date Of Joining, etc." });
    }

    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const e of rows) {
      const joinDateStr = toTimestamp(e.joinDate);
      const probationStartStr = e.probationStartDate ? toTimestamp(e.probationStartDate) : null;
      const probationEndStr = e.probationEndDate ? toTimestamp(e.probationEndDate) : null;
      const dobStr = e.dob ? toDateStr(e.dob) : null;
      const terminationDateStr = e.terminationDate ? toTimestamp(e.terminationDate) : null;

      const existing = await sql`
        SELECT id FROM employees WHERE work_email = ${e.workEmail}
      `;

      if (existing.length > 0) {
        await sql`
          UPDATE employees SET
            first_name = ${e.firstName}, last_name = ${e.lastName}, middle_name = ${e.middleName},
            job_title = ${e.jobTitle}, department = ${e.department}, sub_department = ${e.subDepartment},
            business_unit = ${e.businessUnit}, primary_team = ${e.primaryTeam}, cost_center = ${e.costCenter},
            grade = ${e.grade}, job_category = ${e.jobCategory}, location = ${e.location},
            manager_email = ${e.managerEmail}, hr_email = ${e.hrEmail},
            employment_status = ${e.employmentStatus}, employee_type = ${e.employeeType}, shift = ${e.shift},
            join_date = ${joinDateStr}, probation_start_date = ${probationStartStr}, probation_end_date = ${probationEndStr},
            notice_period = ${e.noticePeriod}, resignation_reason = ${e.resignationReason},
            exit_date = ${terminationDateStr}, exit_type = ${e.exitType},
            personal_email = ${e.personalEmail}, work_phone = ${e.workPhone},
            dob = ${dobStr}, gender = ${e.gender}, marital_status = ${e.maritalStatus},
            street = ${e.street}, city = ${e.city}, state = ${e.state}, country = ${e.country}, zip_code = ${e.zipCode},
            comm_street = ${e.commStreet}, comm_city = ${e.commCity}, comm_state = ${e.commState},
            comm_country = ${e.commCountry}, comm_zip_code = ${e.commZipCode},
            custom_field_1 = ${e.customField1}, custom_field_2 = ${e.customField2},
            source = 'freshteam', updated_at = NOW()
          WHERE id = ${existing[0].id}
        `;
        updated++;
      } else {
        try {
          await sql`
            INSERT INTO employees (
              employee_id, work_email, first_name, middle_name, last_name,
              job_title, department, sub_department, business_unit, primary_team, cost_center, grade, job_category,
              location, manager_email, hr_email, employment_status, employee_type, shift,
              join_date, probation_start_date, probation_end_date, notice_period,
              resignation_reason, exit_date, exit_type,
              personal_email, work_phone, dob, gender, marital_status,
              street, city, state, country, zip_code,
              comm_street, comm_city, comm_state, comm_country, comm_zip_code,
              custom_field_1, custom_field_2, source
            ) VALUES (
              ${e.employeeId}, ${e.workEmail}, ${e.firstName}, ${e.middleName}, ${e.lastName},
              ${e.jobTitle}, ${e.department}, ${e.subDepartment}, ${e.businessUnit}, ${e.primaryTeam},
              ${e.costCenter}, ${e.grade}, ${e.jobCategory}, ${e.location}, ${e.managerEmail}, ${e.hrEmail},
              ${e.employmentStatus}, ${e.employeeType}, ${e.shift},
              ${joinDateStr}, ${probationStartStr}, ${probationEndStr}, ${e.noticePeriod},
              ${e.resignationReason}, ${terminationDateStr}, ${e.exitType},
              ${e.personalEmail}, ${e.workPhone}, ${dobStr}, ${e.gender}, ${e.maritalStatus},
              ${e.street}, ${e.city}, ${e.state}, ${e.country}, ${e.zipCode},
              ${e.commStreet}, ${e.commCity}, ${e.commState}, ${e.commCountry}, ${e.commZipCode},
              ${e.customField1}, ${e.customField2}, 'freshteam'
            )
          `;
          created++;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          if (String(msg).includes("23505") || String(msg).includes("unique")) {
            errors.push(`${e.workEmail}: Employee ID or email already exists (skipped insert, try update).`);
          } else {
            errors.push(`${e.workEmail}: ${msg}`);
          }
        }
      }
    }

    // Resolve manager_id from manager_email (match existing employees by work_email)
    await sql`
      UPDATE employees e
      SET manager_id = (SELECT id FROM employees m WHERE m.work_email = e.manager_email LIMIT 1),
          updated_at = NOW()
      WHERE e.manager_email IS NOT NULL AND e.manager_email != ''
        AND (e.manager_id IS NULL OR e.manager_id = '')
        AND EXISTS (SELECT 1 FROM employees m WHERE m.work_email = e.manager_email)
    `;

    memCache.invalidate("employees:");
    res.json({
      message: "FreshTeam CSV import completed.",
      created,
      updated,
      total: rows.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("FreshTeam CSV import error:", message);
    res.status(500).json({ error: "Import failed", message });
  }
});

/**
 * POST /api/employees/import-freshteam-extras
 * Import emergency contacts, compensations, bank accounts, dependents, stocks from FreshTeam CSVs.
 * Body: { emergencyContactsCsv?, compensationsCsv?, bankAccountsCsv?, dependentsCsv?, stocksCsv? }.
 * Each value is optional. Employees must already exist (matched by Official Email = work_email). Admin/HR only.
 */
router.post("/import-freshteam-extras", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const emergencyContactsCsv = typeof req.body?.emergencyContactsCsv === "string" ? req.body.emergencyContactsCsv : "";
    const compensationsCsv = typeof req.body?.compensationsCsv === "string" ? req.body.compensationsCsv : "";
    const bankAccountsCsv = typeof req.body?.bankAccountsCsv === "string" ? req.body.bankAccountsCsv : "";
    const dependentsCsv = typeof req.body?.dependentsCsv === "string" ? req.body.dependentsCsv : "";
    const stocksCsv = typeof req.body?.stocksCsv === "string" ? req.body.stocksCsv : "";

    if (!emergencyContactsCsv.trim() && !compensationsCsv.trim() && !bankAccountsCsv.trim() && !dependentsCsv.trim() && !stocksCsv.trim()) {
      return res.status(400).json({
        error: "Body must include at least one of: emergencyContactsCsv, compensationsCsv, bankAccountsCsv, dependentsCsv, stocksCsv",
      });
    }

    const stats = { emergencyContacts: 0, compensations: 0, bankAccounts: 0, dependents: 0, stocks: 0 };
    const errors: string[] = [];

    const getEmployeeId = async (workEmail: string): Promise<string | null> => {
      const rows = await sql`SELECT id FROM employees WHERE work_email = ${workEmail} LIMIT 1`;
      return rows.length > 0 ? (rows[0] as { id: string }).id : null;
    };

    if (emergencyContactsCsv.trim()) {
      const rows = parseFreshteamEmergencyContactsCSV(emergencyContactsCsv);
      for (const r of rows) {
        const employeeId = await getEmployeeId(r.workEmail);
        if (!employeeId) {
          errors.push(`Emergency contact: no employee for ${r.workEmail}`);
          continue;
        }
        await sql`
          INSERT INTO emergency_contacts (employee_id, full_name, relationship, phone, email, address)
          VALUES (${employeeId}, ${r.fullName}, ${r.relationship}, ${r.phone}, ${r.email}, ${r.address})
        `;
        stats.emergencyContacts++;
      }
    }

    if (compensationsCsv.trim()) {
      const rows = parseFreshteamCompensationsCSV(compensationsCsv);
      for (const r of rows) {
        const employeeId = await getEmployeeId(r.workEmail);
        if (!employeeId) {
          errors.push(`Compensation: no employee for ${r.workEmail}`);
          continue;
        }
        await sql`UPDATE salary_details SET is_current = 'false', updated_at = NOW() WHERE employee_id = ${employeeId} AND is_current = 'true'`;
        await sql`
          INSERT INTO salary_details (employee_id, annual_salary, currency, start_date, is_current, reason,
            pay_rate, pay_rate_period, payout_frequency, pay_group, pay_method, eligible_work_hours, additional_details, notes)
          VALUES (${employeeId}, ${r.annualSalary}, ${r.currency}, ${r.effectiveDate.toISOString()}, 'true', ${r.reason},
            ${r.payRateAmount}, ${r.duration || "Monthly"}, ${r.payoutFrequency}, ${r.payGroup}, ${r.payMethod},
            ${r.eligibleWorkHours}, ${r.additionalDetails}, ${r.summaryNotes})
        `;
        stats.compensations++;
      }
    }

    if (bankAccountsCsv.trim()) {
      const rows = parseFreshteamBankAccountsCSV(bankAccountsCsv);
      for (const r of rows) {
        const employeeId = await getEmployeeId(r.workEmail);
        if (!employeeId) {
          errors.push(`Bank account: no employee for ${r.workEmail}`);
          continue;
        }
        await sql`
          INSERT INTO banking_details (employee_id, bank_name, name_on_account, bank_code, account_number, is_primary)
          VALUES (${employeeId}, ${r.bankName}, ${r.nameOnAccount}, ${r.bankCode}, ${r.accountNumber}, 'true')
        `;
        stats.bankAccounts++;
      }
    }

    if (dependentsCsv.trim()) {
      const rows = parseFreshteamDependentsCSV(dependentsCsv);
      for (const r of rows) {
        const employeeId = await getEmployeeId(r.workEmail);
        if (!employeeId) {
          errors.push(`Dependent: no employee for ${r.workEmail}`);
          continue;
        }
        const dobStr = r.dateOfBirth ? r.dateOfBirth.toISOString() : null;
        await sql`
          INSERT INTO dependents (employee_id, full_name, relationship, date_of_birth, gender)
          VALUES (${employeeId}, ${r.fullName}, ${r.relationship}, ${dobStr}, ${r.gender})
        `;
        stats.dependents++;
      }
    }

    if (stocksCsv.trim()) {
      const rows = parseFreshteamStocksCSV(stocksCsv);
      for (const r of rows) {
        const employeeId = await getEmployeeId(r.workEmail);
        if (!employeeId) {
          errors.push(`Stock: no employee for ${r.workEmail}`);
          continue;
        }
        await sql`
          INSERT INTO stock_grants (employee_id, units, grant_date, vesting_schedule, notes)
          VALUES (${employeeId}, ${r.units}, ${r.grantDate.toISOString()}, ${r.vestingSchedule}, ${r.notes})
        `;
        stats.stocks++;
      }
    }

    res.json({
      message: "FreshTeam extras import completed.",
      stats,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("FreshTeam extras import error:", message);
    res.status(500).json({ error: "Import failed", message });
  }
});

/**
 * POST /api/employees
 * Create new employee (Admin/HR only)
 */
router.post("/", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const {
      // Required fields
      employeeId, workEmail, firstName, lastName, jobTitle, department, joinDate,
      // Optional basic info
      middleName, avatar,
      // Optional work details
      subDepartment, businessUnit, primaryTeam, costCenter, grade, jobCategory, 
      location, managerEmail, hrEmail,
      // Optional employment
      employmentStatus = "onboarding", employeeType = "full_time", shift,
      probationStartDate, probationEndDate, confirmationDate, noticePeriod,
      // Optional contact
      personalEmail, workPhone,
      // Optional personal
      dob, gender, maritalStatus, bloodGroup,
      // Optional address
      street, city, state, country, zipCode,
      // System
      source = "manual"
    } = req.body;

    // Validate required fields
    if (!employeeId || !workEmail || !firstName || !lastName || !jobTitle || !department || !joinDate) {
      return res.status(400).json({ 
        error: "Missing required fields",
        required: ["employeeId", "workEmail", "firstName", "lastName", "jobTitle", "department", "joinDate"]
      });
    }

    const result = await sql`
      INSERT INTO employees (
        employee_id, work_email, first_name, middle_name, last_name, avatar,
        job_title, department, sub_department, business_unit, primary_team, 
        cost_center, grade, job_category, location, manager_email, hr_email,
        employment_status, employee_type, shift,
        join_date, probation_start_date, probation_end_date, confirmation_date, notice_period,
        personal_email, work_phone,
        dob, gender, marital_status, blood_group,
        street, city, state, country, zip_code,
        source
      )
      VALUES (
        ${employeeId}, ${workEmail}, ${firstName}, ${middleName || null}, ${lastName}, ${avatar || null},
        ${jobTitle}, ${department}, ${subDepartment || null}, ${businessUnit || null}, ${primaryTeam || null},
        ${costCenter || null}, ${grade || null}, ${jobCategory || null}, ${location || null}, ${managerEmail || null}, ${hrEmail || null},
        ${employmentStatus}, ${employeeType}, ${shift || null},
        ${joinDate}, ${probationStartDate || null}, ${probationEndDate || null}, ${confirmationDate || null}, ${noticePeriod || null},
        ${personalEmail || null}, ${workPhone || null},
        ${dob || null}, ${gender || null}, ${maritalStatus || null}, ${bloodGroup || null},
        ${street || null}, ${city || null}, ${state || null}, ${country || null}, ${zipCode || null},
        ${source}
      )
      RETURNING *
    `;

    res.status(201).json({
      message: "Employee created successfully",
      employee: result[0]
    });
  } catch (error: any) {
    console.error("Error creating employee:", error);
    if (error.code === "23505") {
      return res.status(409).json({ error: "Employee ID or email already exists" });
    }
    if (error.code === "22P02" || error.message?.includes("invalid input value")) {
      return res.status(400).json({
        error: "Invalid employment status. Ensure migration 0004_add_employment_status_onboarding.sql has been run.",
      });
    }
    res.status(500).json({ error: "Failed to create employee" });
  }
});

/**
 * DELETE /api/employees/:id
 * Delete employee (Admin only)
 */
router.delete("/:id", requireAuth, requireRole(["admin"]), async (req, res) => {
  try {
    const { id } = req.params;

    // Delete onboarding records (tasks cascade automatically) before deleting employee
    await sql`DELETE FROM onboarding_records WHERE employee_id = ${id}`;

    const result = await sql`
      DELETE FROM employees WHERE id = ${id} RETURNING id
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    res.json({ message: "Employee deleted successfully" });
  } catch (error) {
    console.error("Error deleting employee:", error);
    res.status(500).json({ error: "Failed to delete employee" });
  }
});

export default router;
