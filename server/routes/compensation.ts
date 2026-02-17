import { Router } from "express";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  insertSalaryDetailSchema,
  insertBankingDetailSchema,
  insertBonusSchema,
  insertStockGrantSchema,
} from "../db/schema/compensation";

config();
const sql = neon(process.env.DATABASE_URL!);
const router = Router();

// ==================== SALARY DETAILS ====================

/** GET /api/compensation/:employeeId/salary — all salary records (newest first) */
router.get("/:employeeId/salary", requireAuth, async (req, res) => {
  try {
    const { employeeId } = req.params;
    const rows = await sql`
      SELECT * FROM salary_details WHERE employee_id = ${employeeId}
      ORDER BY start_date DESC, created_at DESC
    `;
    res.json(rows);
  } catch (error) {
    console.error("Error fetching salary details:", error);
    res.status(500).json({ error: "Failed to fetch salary details" });
  }
});

/** POST /api/compensation/:employeeId/salary — add a new salary revision (admin/hr) */
router.post("/:employeeId/salary", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const { employeeId } = req.params;
    const data = insertSalaryDetailSchema.parse({ ...req.body, employeeId });

    // Mark previous current as not current
    await sql`UPDATE salary_details SET is_current = 'false', updated_at = NOW() WHERE employee_id = ${employeeId} AND is_current = 'true'`;

    const result = await sql`
      INSERT INTO salary_details (employee_id, annual_salary, currency, start_date, is_current, reason,
        pay_rate, pay_rate_period, payout_frequency, pay_group, pay_method, eligible_work_hours,
        additional_details, notes, updated_by)
      VALUES (
        ${employeeId}, ${String(data.annualSalary)}, ${data.currency || "PKR"},
        ${new Date(data.startDate).toISOString()}, 'true', ${data.reason || null},
        ${data.payRate ? String(data.payRate) : null}, ${data.payRatePeriod || "Monthly"},
        ${data.payoutFrequency || "Monthly"}, ${data.payGroup || null},
        ${data.payMethod || "Direct Deposit"}, ${data.eligibleWorkHours || null},
        ${data.additionalDetails || null}, ${data.notes || null},
        ${req.user!.id}
      )
      RETURNING *
    `;
    res.status(201).json(result[0]);
  } catch (error: any) {
    if (error.name === "ZodError") return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Error creating salary detail:", error);
    res.status(500).json({ error: "Failed to create salary detail" });
  }
});

/** DELETE /api/compensation/salary/:id — delete a salary record (admin/hr) */
router.delete("/salary/:id", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await sql`DELETE FROM salary_details WHERE id = ${id} RETURNING employee_id, is_current`;
    if (deleted.length === 0) return res.status(404).json({ error: "Not found" });
    // If we deleted the current one, promote the next newest
    if (deleted[0].is_current === "true") {
      await sql`
        UPDATE salary_details SET is_current = 'true', updated_at = NOW()
        WHERE employee_id = ${deleted[0].employee_id}
        AND id = (SELECT id FROM salary_details WHERE employee_id = ${deleted[0].employee_id} ORDER BY start_date DESC LIMIT 1)
      `;
    }
    res.json({ message: "Deleted" });
  } catch (error) {
    console.error("Error deleting salary detail:", error);
    res.status(500).json({ error: "Failed to delete" });
  }
});

// ==================== BANKING DETAILS ====================

/** GET /api/compensation/:employeeId/banking */
router.get("/:employeeId/banking", requireAuth, async (req, res) => {
  try {
    const rows = await sql`
      SELECT * FROM banking_details WHERE employee_id = ${req.params.employeeId} ORDER BY is_primary DESC, created_at DESC
    `;
    res.json(rows);
  } catch (error) {
    console.error("Error fetching banking:", error);
    res.status(500).json({ error: "Failed to fetch banking details" });
  }
});

/** POST /api/compensation/:employeeId/banking — add bank account (admin/hr) */
router.post("/:employeeId/banking", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const { employeeId } = req.params;
    const data = insertBankingDetailSchema.parse({ ...req.body, employeeId });
    const isPrimary = data.isPrimary !== false ? "true" : "false";

    // If setting as primary, demote others
    if (isPrimary === "true") {
      await sql`UPDATE banking_details SET is_primary = 'false', updated_at = NOW() WHERE employee_id = ${employeeId}`;
    }

    const result = await sql`
      INSERT INTO banking_details (employee_id, bank_name, name_on_account, bank_code, account_number, iban, is_primary, updated_by)
      VALUES (${employeeId}, ${data.bankName}, ${data.nameOnAccount}, ${data.bankCode || null},
              ${data.accountNumber}, ${data.iban || null}, ${isPrimary}, ${req.user!.id})
      RETURNING *
    `;
    res.status(201).json(result[0]);
  } catch (error: any) {
    if (error.name === "ZodError") return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Error creating banking detail:", error);
    res.status(500).json({ error: "Failed to create banking detail" });
  }
});

/** DELETE /api/compensation/banking/:id */
router.delete("/banking/:id", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const result = await sql`DELETE FROM banking_details WHERE id = ${req.params.id} RETURNING id`;
    if (result.length === 0) return res.status(404).json({ error: "Not found" });
    res.json({ message: "Deleted" });
  } catch (error) {
    console.error("Error deleting banking detail:", error);
    res.status(500).json({ error: "Failed to delete" });
  }
});

// ==================== BONUSES ====================

/** GET /api/compensation/:employeeId/bonuses */
router.get("/:employeeId/bonuses", requireAuth, async (req, res) => {
  try {
    const rows = await sql`
      SELECT * FROM bonuses WHERE employee_id = ${req.params.employeeId} ORDER BY bonus_date DESC
    `;
    res.json(rows);
  } catch (error) {
    console.error("Error fetching bonuses:", error);
    res.status(500).json({ error: "Failed to fetch bonuses" });
  }
});

/** POST /api/compensation/:employeeId/bonuses */
router.post("/:employeeId/bonuses", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const { employeeId } = req.params;
    const data = insertBonusSchema.parse({ ...req.body, employeeId });
    const result = await sql`
      INSERT INTO bonuses (employee_id, bonus_type, amount, currency, bonus_date, notes, updated_by)
      VALUES (${employeeId}, ${data.bonusType}, ${String(data.amount)}, ${data.currency || "PKR"},
              ${new Date(data.bonusDate).toISOString()}, ${data.notes || null}, ${req.user!.id})
      RETURNING *
    `;
    res.status(201).json(result[0]);
  } catch (error: any) {
    if (error.name === "ZodError") return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Error creating bonus:", error);
    res.status(500).json({ error: "Failed to create bonus" });
  }
});

/** DELETE /api/compensation/bonuses/:id */
router.delete("/bonuses/:id", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const result = await sql`DELETE FROM bonuses WHERE id = ${req.params.id} RETURNING id`;
    if (result.length === 0) return res.status(404).json({ error: "Not found" });
    res.json({ message: "Deleted" });
  } catch (error) {
    console.error("Error deleting bonus:", error);
    res.status(500).json({ error: "Failed to delete" });
  }
});

// ==================== STOCK GRANTS ====================

/** GET /api/compensation/:employeeId/stock-grants */
router.get("/:employeeId/stock-grants", requireAuth, async (req, res) => {
  try {
    const rows = await sql`
      SELECT * FROM stock_grants WHERE employee_id = ${req.params.employeeId} ORDER BY grant_date DESC
    `;
    res.json(rows);
  } catch (error) {
    console.error("Error fetching stock grants:", error);
    res.status(500).json({ error: "Failed to fetch stock grants" });
  }
});

/** POST /api/compensation/:employeeId/stock-grants */
router.post("/:employeeId/stock-grants", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const { employeeId } = req.params;
    const data = insertStockGrantSchema.parse({ ...req.body, employeeId });
    const result = await sql`
      INSERT INTO stock_grants (employee_id, units, grant_date, vesting_schedule, notes, updated_by)
      VALUES (${employeeId}, ${data.units}, ${new Date(data.grantDate).toISOString()},
              ${data.vestingSchedule || null}, ${data.notes || null}, ${req.user!.id})
      RETURNING *
    `;
    res.status(201).json(result[0]);
  } catch (error: any) {
    if (error.name === "ZodError") return res.status(400).json({ error: "Validation failed", details: error.errors });
    console.error("Error creating stock grant:", error);
    res.status(500).json({ error: "Failed to create stock grant" });
  }
});

/** DELETE /api/compensation/stock-grants/:id */
router.delete("/stock-grants/:id", requireAuth, requireRole(["admin", "hr"]), async (req, res) => {
  try {
    const result = await sql`DELETE FROM stock_grants WHERE id = ${req.params.id} RETURNING id`;
    if (result.length === 0) return res.status(404).json({ error: "Not found" });
    res.json({ message: "Deleted" });
  } catch (error) {
    console.error("Error deleting stock grant:", error);
    res.status(500).json({ error: "Failed to delete" });
  }
});

export default router;
