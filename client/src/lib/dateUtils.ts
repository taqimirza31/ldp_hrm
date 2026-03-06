/**
 * Format a date-only value (e.g. join_date, dob) without timezone shift.
 * DB stores these as midnight UTC; parsing as Date and using toLocaleDateString
 * would show the previous day in timezones behind UTC. This parses YYYY-MM-DD
 * and formats that calendar date so "2025-03-07" always shows as Mar 7, 2025.
 */
export function formatDateOnly(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  const s = String(dateStr).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  }
  const [y, m, d] = s.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
