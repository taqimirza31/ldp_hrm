/**
 * Employee profile types and helpers.
 * API returns snake_case (EmployeeRecord from shared); we use camelCase (EmployeeData) for display/forms.
 */

import type { EmployeeRecord } from "@shared/employeeTypes";

export interface EmployeeData {
  id: string;
  employeeId: string;
  name: string;
  firstName: string;
  lastName: string;
  role: string;
  department: string;
  subDepartment?: string;
  businessUnit?: string;
  primaryTeam?: string;
  costCenter?: string;
  grade?: string;
  jobCategory?: string;
  email: string;
  personalEmail?: string;
  workPhone?: string;
  location?: string;
  status: string;
  employeeType?: string;
  shift?: string;
  joinDate: string;
  avatar?: string;
  managerId?: string;
  managerEmail?: string;
  hrEmail?: string;
  dob?: string;
  gender?: string;
  maritalStatus?: string;
  bloodGroup?: string;
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  probationStartDate?: string;
  probationEndDate?: string;
  confirmationDate?: string;
  noticePeriod?: string;
  resignationDate?: string;
  lastWorkingDate?: string;
  exitType?: string;
  eligibleForRehire?: boolean;
  resignationReason?: string;
  customField1?: string;
  customField2?: string;
}

/** Format date for display (e.g. "Feb 10, 2026") */
export function formatDisplayDate(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return null;
  }
}

export { formatDateOnly } from "@/lib/dateUtils";

/** Map API employee (snake_case) to frontend EmployeeData (camelCase). Accepts partial for limited-profile responses. */
export function mapApiToEmployee(api: Partial<EmployeeRecord>): EmployeeData {
  const statusMap: Record<string, string> = {
    active: "Active",
    onboarding: "Onboarding",
    on_leave: "On Leave",
    terminated: "Terminated",
    resigned: "Resigned",
  };
  const first = String(api.first_name ?? "");
  const last = String(api.last_name ?? "");
  return {
    id: String(api.id ?? ""),
    employeeId: String(api.employee_id ?? ""),
    name: `${first} ${last}`.trim() || "—",
    firstName: first,
    lastName: last,
    role: String(api.job_title ?? ""),
    department: String(api.department ?? ""),
    subDepartment: api.sub_department != null ? String(api.sub_department) : undefined,
    businessUnit: api.business_unit != null ? String(api.business_unit) : undefined,
    primaryTeam: api.primary_team != null ? String(api.primary_team) : undefined,
    costCenter: api.cost_center != null ? String(api.cost_center) : undefined,
    grade: api.grade != null ? String(api.grade) : undefined,
    jobCategory: api.job_category != null ? String(api.job_category) : undefined,
    email: String(api.work_email ?? ""),
    personalEmail: api.personal_email != null ? String(api.personal_email) : undefined,
    workPhone: api.work_phone != null ? String(api.work_phone) : undefined,
    location: api.location != null ? String(api.location) : api.city != null ? String(api.city) : undefined,
    status: statusMap[String(api.employment_status ?? "")] || String(api.employment_status ?? ""),
    employeeType: api.employee_type != null ? String(api.employee_type) : undefined,
    shift: api.shift != null ? String(api.shift) : undefined,
    joinDate: String(api.join_date ?? ""),
    avatar: api.avatar != null ? String(api.avatar) : undefined,
    managerId: api.manager_id != null ? String(api.manager_id) : undefined,
    managerEmail: api.manager_email != null ? String(api.manager_email) : undefined,
    hrEmail: api.hr_email != null ? String(api.hr_email) : undefined,
    dob: api.dob != null ? String(api.dob) : undefined,
    gender: api.gender != null ? String(api.gender) : undefined,
    maritalStatus: api.marital_status != null ? String(api.marital_status) : undefined,
    bloodGroup: api.blood_group != null ? String(api.blood_group) : undefined,
    street: api.street != null ? String(api.street) : undefined,
    city: api.city != null ? String(api.city) : undefined,
    state: api.state != null ? String(api.state) : undefined,
    country: api.country != null ? String(api.country) : undefined,
    zipCode: api.zip_code != null ? String(api.zip_code) : undefined,
    probationStartDate: api.probation_start_date != null ? String(api.probation_start_date) : undefined,
    probationEndDate: api.probation_end_date != null ? String(api.probation_end_date) : undefined,
    confirmationDate: api.confirmation_date != null ? String(api.confirmation_date) : undefined,
    noticePeriod: api.notice_period != null ? String(api.notice_period) : undefined,
    resignationDate: api.resignation_date != null ? String(api.resignation_date) : undefined,
    lastWorkingDate: api.exit_date != null ? String(api.exit_date) : undefined,
    exitType: api.exit_type != null ? String(api.exit_type) : undefined,
    eligibleForRehire: api.eligible_for_rehire === "yes" || api.eligible_for_rehire === true,
    resignationReason: api.resignation_reason != null ? String(api.resignation_reason) : undefined,
    customField1: api.custom_field_1 != null ? String(api.custom_field_1) : undefined,
    customField2: api.custom_field_2 != null ? String(api.custom_field_2) : undefined,
  };
}
