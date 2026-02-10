import { Router } from "express";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { requireAuth, requireRole, canAccessEmployee } from "../middleware/auth";

config();
const sql = neon(process.env.DATABASE_URL!);
const router = Router();

/**
 * GET /api/employees
 * List all employees (Admin/HR see all, Manager sees team, Employee sees directory)
 */
router.get("/", requireAuth, async (req, res) => {
  try {
    const employees = await sql`
      SELECT 
        id, employee_id, work_email, first_name, middle_name, last_name, avatar,
        job_title, department, sub_department, business_unit, location, grade,
        employment_status, employee_type, join_date,
        city, state, country
      FROM employees
      ORDER BY first_name, last_name
    `;
    res.json(employees);
  } catch (error) {
    console.error("Error fetching employees:", error);
    res.status(500).json({ error: "Failed to fetch employees" });
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
