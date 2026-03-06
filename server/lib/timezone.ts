/**
 * Per-user timezone (set in Settings). IANA names: Asia/Karachi, America/New_York, Asia/Kolkata.
 */
import { format } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

const DEFAULT_TZ = "UTC";

export function getDefaultTz(): string {
  const tz = process.env.DEFAULT_TIMEZONE?.trim();
  return tz && tz.length > 0 ? tz : DEFAULT_TZ;
}

/** Resolve timezone from user preference or fallback to default. */
export function resolveUserTz(userTimeZone: string | null | undefined): string {
  const tz = userTimeZone?.trim();
  return tz && tz.length > 0 ? tz : getDefaultTz();
}

/** Get current user's timezone from DB (for use in routes). Returns resolved IANA string. */
export async function getRequestTz(
  req: { user?: { id?: string } },
  sql: (strings: TemplateStringsArray, ...values: any[]) => Promise<any[]>
): Promise<string> {
  const userId = req?.user?.id;
  if (!userId) return getDefaultTz();
  const rows = await sql`SELECT time_zone FROM users WHERE id = ${userId} LIMIT 1`;
  const tz = rows[0] ? (rows[0] as { time_zone?: string | null }).time_zone : null;
  return resolveUserTz(tz);
}

export function todayInTz(tz: string): string {
  const safeTz = tz?.trim() || getDefaultTz();
  const now = new Date();
  const zoned = toZonedTime(now, safeTz);
  return format(zoned, "yyyy-MM-dd");
}

export function dateInTz(utcDate: Date, tz: string): string {
  const safeTz = tz?.trim() || getDefaultTz();
  const zoned = toZonedTime(utcDate, safeTz);
  return format(zoned, "yyyy-MM-dd");
}

/** Parse local date+time in the given timezone → UTC Date. */
export function parseLocalToUtc(dateStr: string, timeStr: string, tz: string): Date {
  const safeTz = tz?.trim() || getDefaultTz();
  const [y, m, d] = dateStr.split("-").map(Number);
  const parts = (timeStr || "00:00").split(":");
  const h = Number(parts[0]) || 0;
  const min = Number(parts[1]) || 0;
  const sec = Number(parts[2]) || 0;
  const localAsIf = new Date(y, m - 1, d, h, min, sec);
  return fromZonedTime(localAsIf, safeTz);
}
