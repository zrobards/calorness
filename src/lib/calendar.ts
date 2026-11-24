// A month at a glance: what you ate (calories and macros against your
// targets), how you trained, weigh-ins, and progress photos, day by day.
// The pure pieces are separate from the database reads so they can be tested.

export type CalendarDay = {
  day: string; // YYYY-MM-DD
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  foods: number; // diary entries
  workouts: { id: string; name: string; minutes: number }[];
  activities: { name: string; minutes: number; calories: number }[];
  weightKg: number | null;
  photoIds: string[];
};

export type CalorieStatus = "none" | "under" | "on" | "over";

/** How a day's calories compare with the target: within 10% counts as on target. */
export function calorieStatus(calories: number, target: number | null): CalorieStatus {
  if (calories <= 0) return "none";
  if (!target) return "on";
  const ratio = calories / target;
  if (ratio < 0.9) return "under";
  if (ratio > 1.1) return "over";
  return "on";
}

/** "2026-11" → every day of that month, as YYYY-MM-DD. */
export function daysOfMonth(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

/** The month before or after, as YYYY-MM. */
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export const isMonth = (s: string | undefined): s is string => !!s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
export const isDay = (s: string | undefined): s is string => !!s && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(s);

export type MonthSummary = {
  daysLogged: number;
  avgCalories: number | null;
  avgProteinG: number | null;
  daysOnTarget: number;
  workouts: number;
  activities: number;
  weightChangeKg: number | null;
};

export function summarize(days: CalendarDay[], target: number | null): MonthSummary {
  const logged = days.filter((d) => d.calories > 0);
  const avg = (f: (d: CalendarDay) => number) => (logged.length ? Math.round(logged.reduce((s, d) => s + f(d), 0) / logged.length) : null);
  const weights = days.filter((d) => d.weightKg !== null);
  return {
    daysLogged: logged.length,
    avgCalories: avg((d) => d.calories),
    avgProteinG: avg((d) => d.proteinG),
    daysOnTarget: target ? logged.filter((d) => calorieStatus(d.calories, target) === "on").length : 0,
    workouts: days.reduce((s, d) => s + d.workouts.length, 0),
    activities: days.reduce((s, d) => s + d.activities.length, 0),
    weightChangeKg: weights.length > 1 ? weights.at(-1)!.weightKg! - weights[0].weightKg! : null,
  };
}
