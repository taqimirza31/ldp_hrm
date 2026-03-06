import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config();
const sql = neon(process.env.DATABASE_URL!);

function revokeSystemAccess(employee: { id: string; work_email: string; first_name: string; last_name: string }) {
  console.log(`[OFFBOARDING HOOK] revokeSystemAccess: Revoking access for ${employee.first_name} ${employee.last_name} (${employee.work_email}). V2: Disable Microsoft 365, Google Workspace, VPN, SaaS accounts.`);
}

async function markAssetsForReturn(employeeId: string) {
  console.log(`[OFFBOARDING HOOK] markAssetsForReturn: Flagging assets for employee ${employeeId}`);
  await sql`UPDATE assigned_systems SET notes=COALESCE(notes,'')||' [Auto-flagged for return on offboarding completion]',updated_at=NOW() WHERE user_id=${employeeId}`;
}

function disableAttendance(employeeId: string) {
  console.log(`[OFFBOARDING HOOK] disableAttendance: Employee ${employeeId} attendance will be blocked. Attendance routes already check employment_status.`);
}

export async function onOffboardingComplete(employee: { id: string; work_email: string; first_name: string; last_name: string }) {
  revokeSystemAccess(employee);
  await markAssetsForReturn(employee.id);
  disableAttendance(employee.id);
}
