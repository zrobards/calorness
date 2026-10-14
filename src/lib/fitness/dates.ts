// Week math for charts. Weeks start on Monday, like most training logs.

const DAY_MS = 86_400_000;

export function startOfWeek(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(d.getTime() - day * DAY_MS);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Index of each date's week relative to the current week: 0 = this week. */
export function weeksAgo(date: Date, now: Date): number {
  return Math.round((startOfWeek(now).getTime() - startOfWeek(date).getTime()) / (7 * DAY_MS));
}

/** "2026-10-13" for a Date, using UTC, matching how @db.Date columns are stored. */
export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Until users can pick a time zone, dates display in US Eastern (Louisville).
export const APP_TIME_ZONE = "America/New_York";

export function formatDay(date: Date, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) {
  return date.toLocaleDateString("en-US", { timeZone: APP_TIME_ZONE, ...opts });
}
