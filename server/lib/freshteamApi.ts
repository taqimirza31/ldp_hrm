/**
 * FreshTeam API client for job postings.
 * Used by POST /api/recruitment/migrate-freshteam-jobs.
 * Requires FRESHTEAM_DOMAIN and FRESHTEAM_API_KEY in .env.
 */

const getBaseUrl = (): string => {
  const domain = process.env.FRESHTEAM_DOMAIN?.trim();
  if (!domain) throw new Error("FRESHTEAM_DOMAIN is not set");
  return `https://${domain}.freshteam.com/api`;
};

/** Origin for resume/download URLs (no /api suffix). Used when API returns a relative path. */
export function getFreshTeamOrigin(): string {
  const domain = process.env.FRESHTEAM_DOMAIN?.trim();
  if (!domain) return "";
  return `https://${domain}.freshteam.com`;
}

const getAuthHeader = (): string => {
  const key = process.env.FRESHTEAM_API_KEY?.trim();
  if (!key) throw new Error("FRESHTEAM_API_KEY is not set");
  return `Bearer ${key}`;
};

/** Returns true if FRESHTEAM_DOMAIN and FRESHTEAM_API_KEY are set (for migration endpoint). */
export function isFreshTeamConfigured(): boolean {
  return Boolean(
    process.env.FRESHTEAM_DOMAIN?.trim() && process.env.FRESHTEAM_API_KEY?.trim()
  );
}

export type FreshTeamJobSummary = {
  id: number;
  title?: string;
  status?: string;
  [k: string]: unknown;
};

export type FreshTeamJobDetail = {
  id: number;
  title: string;
  description?: string;
  status?: string; // FreshTeam: draft | published | internal | private | on_hold | closed
  type?: string; // Employment: Full Time, Part Time, Contract, Internship, etc.
  experience?: string; // e.g. Entry Level, Mid-Senior level
  remote?: boolean;
  closing_date?: string | null;
  created_at?: string;
  updated_at?: string;
  deleted?: boolean; // when true, skip in migration
  salary?: { min?: number; max?: number; currency?: string };
  branch?: {
    id?: number;
    name?: string;
    city?: string;
    state?: string;
    country_code?: string;
    zip?: string;
    street?: string;
    [k: string]: unknown;
  } | null;
  department?: { id?: number; name?: string } | null;
  requisitions?: Array<{
    id?: number;
    title?: string;
    recruiters?: Array<{ id?: number; first_name?: string; last_name?: string; official_email?: string }>;
    hiring_managers?: Array<{ id?: number; first_name?: string; last_name?: string; official_email?: string }>;
    [k: string]: unknown;
  }>;
  [k: string]: unknown;
};

const DEFAULT_PER_PAGE = 30;

/** Delay in ms (for rate limiting). Export for use in migration loop. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const FRESHTEAM_MAX_RETRIES_429 = 5;
/** On 429, wait for next minute (rate limit window). Use Retry-After header if present. */
function getWaitMs429(res: Response): number {
  const retryAfter = res.headers.get("Retry-After");
  if (retryAfter) {
    const sec = parseInt(retryAfter, 10);
    if (Number.isFinite(sec)) return sec * 1000;
  }
  return 60000; // 1 minute - wait for next rate limit window
}

async function freshteamFetch<T>(path: string, opts?: RequestInit, retryCount = 0): Promise<T> {
  const base = getBaseUrl();
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: getAuthHeader(),
      ...opts?.headers,
    },
  });
  if (res.status === 429 && retryCount < FRESHTEAM_MAX_RETRIES_429) {
    const waitMs = getWaitMs429(res);
    await sleep(waitMs);
    return freshteamFetch<T>(path, opts, retryCount + 1);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FreshTeam API ${res.status}: ${text || res.statusText}`);
  }
  // When close to rate limit, wait for next minute to avoid 429
  const remaining = res.headers.get("x-ratelimit-remaining");
  if (remaining !== null) {
    const n = parseInt(remaining, 10);
    if (Number.isFinite(n) && n <= 2) await sleep(60000);
  }
  return res.json() as Promise<T>;
}

/** Requests per minute (Trial=10, Growth/Pro=50, Enterprise=60). Used for migration throttle. Stay under your limit. */
export function getFreshTeamRequestsPerMinute(): number {
  const n = parseInt(process.env.FRESHTEAM_REQUESTS_PER_MINUTE ?? "55", 10);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 100) : 55;
}

/** Delay in ms to enforce rate limit (one request per this interval). Default 55/min so we stay under 60/min. */
export function getFreshTeamDelayMs(): number {
  const perMin = getFreshTeamRequestsPerMinute();
  return Math.ceil(60000 / perMin); // e.g. 55/min -> ~1091ms
}

/**
 * List job postings (paginated). Returns summary objects; use getJobPosting(id) for full details.
 */
export async function listJobPostings(
  page = 1,
  perPage: number = DEFAULT_PER_PAGE
): Promise<FreshTeamJobSummary[]> {
  const data = await freshteamFetch<FreshTeamJobSummary[]>(
    `/job_postings?page=${page}&per_page=${perPage}`
  );
  return Array.isArray(data) ? data : [];
}

/**
 * Get a single job posting by ID (full details).
 */
export async function getJobPosting(id: number): Promise<FreshTeamJobDetail> {
  return freshteamFetch<FreshTeamJobDetail>(`/job_postings/${id}`);
}

/**
 * Fetch all job postings by paginating through list, then optionally fetch full detail for each.
 * Returns list of summary objects (each has at least id). Set fetchDetails true to get full job objects.
 */
export async function listAllJobPostings(fetchDetails: boolean): Promise<FreshTeamJobDetail[]> {
  const results: FreshTeamJobDetail[] = [];
  let page = 1;
  let list: FreshTeamJobSummary[] = [];
  do {
    list = await listJobPostings(page);
    for (const summary of list) {
      if (fetchDetails && summary.id != null) {
        const full = await getJobPosting(Number(summary.id));
        results.push(full);
      } else {
        results.push(summary as FreshTeamJobDetail);
      }
    }
    page++;
  } while (list.length === DEFAULT_PER_PAGE);
  return results;
}

// ==================== CANDIDATES & APPLICANTS (for migration) ====================

export type FreshTeamCandidate = {
  id: number;
  first_name?: string;
  middle_name?: string | null;
  last_name?: string;
  email?: string;
  mobile?: string | null;
  phone?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  description?: string | null;
  total_experience_in_months?: number | null;
  created_at?: string;
  updated_at?: string;
  applicant_ids?: number[];
  location?: {
    city?: string | null;
    state?: string | null;
    street?: string | null;
    country_code?: string | null;
    zip_code?: string | null;
  } | null;
  profile_links?: Array<{ name?: string; url?: string }>;
  resumes?: Array<{
    id?: number;
    content_file_name?: string;
    content_file_size?: number;
    url?: string;
    description?: string;
  }>;
  tags?: string[] | unknown[];
  [k: string]: unknown;
};

export type FreshTeamApplicant = {
  id: number;
  candidate_id?: number;
  job_id?: number;
  stage?: string;
  sub_stage?: string | null;
  created_at?: string;
  updated_at?: string;
  cover_letter?: string | null;
  referral_source?: string | null;
  source?: string | null;
  [k: string]: unknown;
};

/** List candidates (paginated). */
export async function listCandidates(
  page = 1,
  perPage: number = DEFAULT_PER_PAGE
): Promise<FreshTeamCandidate[]> {
  const data = await freshteamFetch<FreshTeamCandidate[]>(
    `/candidates?page=${page}&per_page=${perPage}`
  );
  return Array.isArray(data) ? data : [];
}

/**
 * Get a single candidate by ID. FreshTeam returns full candidate data: name, email, phone,
 * location, date_of_birth, gender, experience, description, tags, resumes (with URLs), etc.
 * Always use this when we have candidate_id so we get complete profile + resume.
 */
export async function getCandidate(id: number): Promise<FreshTeamCandidate> {
  return freshteamFetch<FreshTeamCandidate>(`/candidates/${id}`);
}

/** List applicants for a job posting (paginated). Use includeCandidate=true to request nested candidate data and reduce API calls. */
export async function listApplicantsForJob(
  jobPostingId: number,
  page = 1,
  perPage: number = DEFAULT_PER_PAGE,
  includeCandidate = true
): Promise<FreshTeamApplicant[]> {
  let path = `/job_postings/${jobPostingId}/applicants?page=${page}&per_page=${perPage}`;
  if (includeCandidate) path += "&include=candidate";
  const data = await freshteamFetch<FreshTeamApplicant[] | { applicants?: FreshTeamApplicant[]; applicant?: FreshTeamApplicant[]; data?: FreshTeamApplicant[] }>(path);
  const list = Array.isArray(data) ? data : (data && ((data as { applicants?: FreshTeamApplicant[] }).applicants ?? (data as { data?: FreshTeamApplicant[] }).data ?? (data as { applicant?: FreshTeamApplicant[] }).applicant)) ?? [];
  return list;
}

/** Get a single applicant by ID (includes candidate_id, job_id, stage). */
export async function getApplicant(id: number): Promise<FreshTeamApplicant> {
  return freshteamFetch<FreshTeamApplicant>(`/applicants/${id}`);
}

// ==================== EMPLOYEES (for migration) ====================

export type FreshTeamEmployee = {
  id: number;
  first_name: string;
  last_name: string;
  middle_name?: string | null;
  employee_id?: string | null;
  official_email: string;
  personal_email?: string | null;
  designation?: string | null;
  joining_date?: string | null;
  termination_date?: string | null;
  status?: string | null;
  terminated?: boolean;
  employee_type?: string | null;
  department_id?: number | null;
  sub_department_id?: number | null;
  business_unit_id?: number | null;
  team_id?: number | null;
  reporting_to_id?: number | null;
  hr_incharge_id?: number | null;
  branch_id?: number | null;
  shift_id?: number | null;
  address?: { street?: string; city?: string; state?: string; country_code?: string; zip_code?: string } | null;
  communication_address?: {
    communication_street?: string;
    communication_city?: string;
    communication_state?: string;
    communication_country_code?: string;
    communication_zip_code?: string;
  } | null;
  work_numbers?: Array<{ name?: string; number?: string }>;
  phone_numbers?: Array<{ name?: string; number?: string }>;
  date_of_birth?: string | null;
  gender?: string | null;
  marital_status?: string | null;
  blood_group?: string | null;
  probation_start_date?: string | null;
  probation_end_date?: string | null;
  notice_period?: string | null;
  termination_reason?: string | null;
  rehire_eligibility?: boolean | null;
  team?: { id?: number; name?: string } | null;
  department?: { id?: number; name?: string } | null;
  branch?: { id?: number; name?: string } | null;
  avatar_url?: string | null;
  /** Present when GET /api/employees/:id?include=time_off is used. */
  time_off?: FreshTeamEmployeeTimeOff[];
  /** Custom field name -> value (string or { id, value }). Used in employee sync. */
  custom_field_values?: Record<string, string | { id?: number; value?: string | null } | null> | null;
  /** Emergency contacts (name, relationship, contact number, address). Used in employee sync. */
  emergency_contacts?: FreshTeamEmergencyContact[] | null;
  /** Dependents / family (when include=dependents). Used in employee sync. */
  dependents?: FreshTeamDependent[] | null;
  [k: string]: unknown;
};

/** Emergency contact from FreshTeam (GET employee). Doc uses "contant_number" typo; we accept both. */
export type FreshTeamEmergencyContact = {
  name?: string | null;
  relationship?: string | null;
  contant_number?: string | null;
  contact_number?: string | null;
  address?: string | null;
  email?: string | null;
  [k: string]: unknown;
};

/** Dependent / family member from FreshTeam (when include=dependents or in default response). */
export type FreshTeamDependent = {
  name?: string | null;
  full_name?: string | null;
  relationship?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  [k: string]: unknown;
};

/** Per leave-type balance from FreshTeam (employee time_off array item). */
export type FreshTeamEmployeeTimeOff = {
  leave_type?: { id?: number; value?: string } | null;
  leaves_availed?: number;
  leave_credits?: number;
  [k: string]: unknown;
};

/** Compensation details (when include=compensation_details). API may return salary_components and/or annual_salary. */
export type FreshTeamCompensationDetails = {
  annual_salary?: number | null;
  currency?: string | null;
  effective_date?: string | null;
  salary_components?: Array<{ component_type?: string; value?: number; [k: string]: unknown }> | null;
  [k: string]: unknown;
};

/** Bank account (when include=compensation_details). */
export type FreshTeamBankAccount = {
  bank_name?: string | null;
  account_number?: string | null;
  account_holder_name?: string | null;
  name_on_account?: string | null;
  ifsc_code?: string | null;
  bank_code?: string | null;
  iban?: string | null;
  is_primary?: boolean | null;
  [k: string]: unknown;
};

/** Employee response with compensation_details (salary + bank). */
export type FreshTeamEmployeeWithCompensation = FreshTeamEmployee & {
  compensation_details?: FreshTeamCompensationDetails | null;
  bank_accounts?: FreshTeamBankAccount[] | null;
};

/** Get employee with compensation_details, bank_accounts, emergency_contacts, dependents for full sync. */
export async function getEmployeeWithCompensation(id: number): Promise<FreshTeamEmployeeWithCompensation> {
  const res = await freshteamFetch<FreshTeamEmployeeWithCompensation>(`/employees/${id}?include=compensation_details,bank_accounts,emergency_contacts,dependents`);
  const hasComp = res.compensation_details != null || (res as Record<string, unknown>).compensation != null;
  const hasBanks = res.bank_accounts != null && Array.isArray(res.bank_accounts) && res.bank_accounts.length > 0;
  if (hasComp || hasBanks) return res;
  try {
    await sleep(500);
    const alt = await freshteamFetch<FreshTeamEmployeeWithCompensation & { compensation?: FreshTeamCompensationDetails }>(`/employees/${id}?include=compensation`);
    const altComp = alt.compensation_details ?? alt.compensation;
    if (altComp != null || (alt.bank_accounts != null && alt.bank_accounts.length > 0)) {
      return { ...alt, compensation_details: alt.compensation_details ?? alt.compensation ?? undefined };
    }
  } catch {
    // ignore; use first response
  }
  return res;
}

/** List employees (paginated). Includes active and inactive/terminated when no filter. */
export async function listEmployees(
  page = 1,
  perPage: number = 50
): Promise<FreshTeamEmployee[]> {
  const path = `/employees?page=${page}&per_page=${perPage}`;
  const data = await freshteamFetch<FreshTeamEmployee[]>(path);
  return Array.isArray(data) ? data : [];
}

/** Get a single employee by ID (full details). */
export async function getEmployee(id: number): Promise<FreshTeamEmployee> {
  return freshteamFetch<FreshTeamEmployee>(`/employees/${id}`);
}

/** Get employee with leave balances. Use include=time_off to get leave_credits and leaves_availed per leave type. */
export async function getEmployeeWithTimeOff(id: number): Promise<FreshTeamEmployee> {
  return freshteamFetch<FreshTeamEmployee>(`/employees/${id}?include=time_off`);
}

/** List departments (paginated). For mapping department_id to name and for org sync. */
export async function listDepartments(page = 1, perPage = 50): Promise<Array<{ id: number; name?: string; deleted?: boolean }>> {
  const data = await freshteamFetch<Array<{ id: number; name?: string; deleted?: boolean }>>(
    `/departments?page=${page}&per_page=${perPage}`
  );
  return Array.isArray(data) ? data : [];
}

// ==================== ORG STRUCTURE (for migration) ====================

export type FreshTeamBranch = {
  id: number;
  name?: string;
  city?: string | null;
  state?: string | null;
  country_code?: string | null;
  zip?: string | null;
  time_zone?: string | null;
  currency?: string | null;
  language?: string | null;
  main_office?: boolean;
  date_format?: string | null;
  deleted?: boolean;
  [k: string]: unknown;
};

export type FreshTeamOrgUnit = { id: number; name?: string; deleted?: boolean; [k: string]: unknown };

/** List branches (paginated). */
export async function listBranches(page = 1, perPage = 50): Promise<FreshTeamBranch[]> {
  const data = await freshteamFetch<FreshTeamBranch[]>(`/branches?page=${page}&per_page=${perPage}`);
  return Array.isArray(data) ? data : [];
}

/** List sub-departments (paginated). */
export async function listSubDepartments(page = 1, perPage = 50): Promise<FreshTeamOrgUnit[]> {
  const data = await freshteamFetch<FreshTeamOrgUnit[]>(`/sub_departments?page=${page}&per_page=${perPage}`);
  return Array.isArray(data) ? data : [];
}

/** List business units (paginated). */
export async function listBusinessUnits(page = 1, perPage = 50): Promise<FreshTeamOrgUnit[]> {
  const data = await freshteamFetch<FreshTeamOrgUnit[]>(`/business_units?page=${page}&per_page=${perPage}`);
  return Array.isArray(data) ? data : [];
}

/** List teams (paginated). */
export async function listTeams(page = 1, perPage = 50): Promise<FreshTeamOrgUnit[]> {
  const data = await freshteamFetch<FreshTeamOrgUnit[]>(`/teams?page=${page}&per_page=${perPage}`);
  return Array.isArray(data) ? data : [];
}

/** List levels (job bands / grades) (paginated). */
export async function listLevels(page = 1, perPage = 50): Promise<FreshTeamOrgUnit[]> {
  const data = await freshteamFetch<FreshTeamOrgUnit[]>(`/levels?page=${page}&per_page=${perPage}`);
  return Array.isArray(data) ? data : [];
}

// ==================== TIME-OFFS (for migration) ====================

export type FreshTeamTimeOffType = {
  id: number;
  name?: string;
  description?: string;
  deleted?: boolean;
  default?: boolean;
  auto_approve?: boolean;
  auto_approve_after?: number | null;
  auto_approve_limit?: number | null;
  applicable_for?: string | null;
  marital_status?: string | null;
  created_at?: string;
  updated_at?: string;
  [k: string]: unknown;
};

export type FreshTeamTimeOff = {
  id: number;
  created_at?: string;
  updated_at?: string;
  user_id: number;
  start_date: string;
  end_date: string;
  status: "pending" | "approved" | "declined" | "cancelled";
  leave_units: number;
  optional_leave_units?: number | null;
  leave_type_id: number;
  status_comments?: string | null;
  approved_by_id?: number | null;
  applied_by_id: number;
  cancelled_by_id?: number | null;
  rejected_by_id?: number | null;
  comments?: string | null;
  rejected_at?: string | null;
  cancelled_at?: string | null;
  [k: string]: unknown;
};

/** List time-off types (paginated). */
export async function listTimeOffTypes(
  page = 1,
  perPage: number = DEFAULT_PER_PAGE
): Promise<FreshTeamTimeOffType[]> {
  const data = await freshteamFetch<FreshTeamTimeOffType[]>(
    `/time_off_types?page=${page}&per_page=${perPage}`
  );
  return Array.isArray(data) ? data : [];
}

export type ListTimeOffsParams = {
  status?: "pending" | "approved" | "declined" | "cancelled";
  user?: number;
  leave_type?: number;
  location?: number;
  start_date?: string;
  end_date?: string;
  page?: number;
  per_page?: number;
};

/** List time-offs (paginated). Use filters to limit scope. */
export async function listTimeOffs(params: ListTimeOffsParams = {}): Promise<FreshTeamTimeOff[]> {
  const search = new URLSearchParams();
  if (params.status != null) search.set("status", params.status);
  if (params.user != null) search.set("user", String(params.user));
  if (params.leave_type != null) search.set("leave_type", String(params.leave_type));
  if (params.location != null) search.set("location", String(params.location));
  if (params.start_date != null) search.set("start_date", params.start_date);
  if (params.end_date != null) search.set("end_date", params.end_date);
  search.set("page", String(params.page ?? 1));
  search.set("per_page", String(params.per_page ?? DEFAULT_PER_PAGE));
  const path = `/time_offs?${search.toString()}`;
  const data = await freshteamFetch<FreshTeamTimeOff[]>(path);
  return Array.isArray(data) ? data : [];
}

/**
 * If the URL is relative (e.g. /api/... or resumes/123), make it absolute using FreshTeam origin.
 * Call this before fetch when the API returns a path instead of a full URL.
 */
export function toAbsoluteResumeUrl(url: string): string {
  const u = url.trim();
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  const origin = getFreshTeamOrigin();
  if (!origin) return u;
  return u.startsWith("/") ? `${origin}${u}` : `${origin}/${u}`;
}

/**
 * Download a file from URL (e.g. FreshTeam resume) and return as base64 data URL.
 * For FreshTeam-hosted URLs we send Authorization. If the response is a redirect (e.g. to S3),
 * we follow it without sending auth so the signed URL works.
 */
export async function downloadResumeAsDataUrl(
  url: string,
  filename?: string,
  useFreshTeamAuth = false
): Promise<{ dataUrl: string; filename: string } | null> {
  const absoluteUrl = useFreshTeamAuth ? toAbsoluteResumeUrl(url) : url.trim();
  try {
    // Only send auth when the request host is FreshTeam (e.g. api.freshteam.com). Do NOT send auth to S3/CDN.
    let isFreshTeamHost = false;
    try {
      const hostname = new URL(absoluteUrl).hostname.toLowerCase();
      isFreshTeamHost = hostname.endsWith(".freshteam.com");
    } catch {
      // invalid URL
    }
    const headers: Record<string, string> = { Accept: "*/*" };
    try {
      if (isFreshTeamHost) {
        const auth = getAuthHeader();
        if (auth) headers.Authorization = auth;
      }
    } catch {
      // FreshTeam not configured
    }
    let res = await fetch(absoluteUrl, { headers, redirect: "manual" });
    // Follow redirect without auth (e.g. FreshTeam redirects to S3 signed URL)
    if (res.status >= 301 && res.status <= 308) {
      const location = res.headers.get("location");
      if (location) {
        const redirectUrl = location.startsWith("http") ? location : new URL(location, absoluteUrl).href;
        res = await fetch(redirectUrl, { headers: { Accept: "*/*" } });
      }
    }
    if (!res.ok) {
      console.warn("[FreshTeam resume] Download failed:", res.status, res.statusText, absoluteUrl.slice(0, 100));
      return null;
    }
    const buf = await res.arrayBuffer();
    const b64 = Buffer.from(buf).toString("base64");
    if (b64.length === 0) {
      console.warn("[FreshTeam resume] Empty response body:", absoluteUrl.slice(0, 100));
      return null;
    }
    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const dataUrl = `data:${contentType};base64,${b64}`;
    const name = filename || "resume.pdf";
    return { dataUrl, filename: name };
  } catch (err) {
    console.warn("[FreshTeam resume] Download error:", (err as Error)?.message ?? err, absoluteUrl.slice(0, 100));
    return null;
  }
}

/**
 * Fetch resume file from URL and return buffer + metadata for streaming.
 * Uses FreshTeam auth when URL is from FreshTeam (so expired S3 links can be refreshed via GET /candidates/:id from FreshTeam).
 */
export async function fetchResumeBuffer(
  url: string,
  filename?: string
): Promise<{ buffer: Buffer; contentType: string; filename: string } | null> {
  try {
    const headers: Record<string, string> = { Accept: "*/*" };
    if (url.includes("freshteam.com")) {
      try {
        headers.Authorization = getAuthHeader();
      } catch {
        // no FreshTeam config
      }
    }
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const buffer = Buffer.from(buf);
    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const name = filename || "resume.pdf";
    return { buffer, contentType, filename: name };
  } catch {
    return null;
  }
}
