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
  status?: string;
  type?: string; // full_time, part_time, etc.
  experience?: string;
  remote?: boolean;
  closing_date?: string | null;
  created_at?: string;
  updated_at?: string;
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
