import "server-only";
import { db } from "@/lib/db";
import { getUserPrefs } from "@/lib/userPrefs";
import { dayInZone } from "@/lib/time";
import { mpsToDisplay, metersToDisplay, streak } from "@/lib/fitness/activity";

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** The last 30 days of activity with averages, bests, goal hits, and trends. */
export async function getActivityHistory(userId: string) {
  const prefs = await getUserPrefs(userId);
  const today = dayInZone(new Date(), prefs.timeZone);
  const start = new Date(Date.parse(`${today}T00:00:00Z`) - 29 * 86_400_000);
  const [user, rows] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { stepGoal: true, activeCalGoal: true, exerciseMinGoal: true, useHealthCalories: true } }),
    db.dailyActivity.findMany({ where: { userId, date: { gte: start } }, orderBy: { date: "asc" } }),
  ]);
  const imperial = prefs.unitSystem === "IMPERIAL";
  const byDay = new Map(rows.map((r) => [r.date.toISOString().slice(0, 10), r]));
  const days = Array.from({ length: 30 }, (_, i) => new Date(start.getTime() + i * 86_400_000).toISOString().slice(0, 10));
  const series = days.map((d) => ({ day: d, row: byDay.get(d) ?? null }));
  const vals = (pick: (r: (typeof rows)[number]) => number | null, from = 0) =>
    series.slice(from).map((s) => (s.row ? pick(s.row) : null)).filter((v): v is number => v !== null);

  const steps = vals((r) => r.steps), steps7 = vals((r) => r.steps, 23);
  const cal = vals((r) => r.activeCalories), cal7 = vals((r) => r.activeCalories, 23);
  const speed = vals((r) => r.walkingSpeedMps);
  const speedFirst = avg(speed.slice(0, Math.ceil(speed.length / 2)));
  const speedLast = avg(speed.slice(Math.ceil(speed.length / 2)));
  const best = rows.reduce<(typeof rows)[number] | null>((b, r) => ((r.steps ?? 0) > (b?.steps ?? -1) ? r : b), null);

  return {
    imperial,
    goals: user,
    today: byDay.get(today) ?? null,
    connected: rows.length > 0,
    lastSync: rows.length ? rows.reduce((a, b) => (a.updatedAt > b.updatedAt ? a : b)).updatedAt : null,
    chart: series.map((s) => ({
      day: s.day,
      label: new Date(`${s.day}T00:00:00Z`).toLocaleDateString("en-US", { month: "numeric", day: "numeric", timeZone: "UTC" }),
      steps: s.row?.steps ?? 0,
      activeCalories: s.row?.activeCalories ?? 0,
      exerciseMinutes: s.row?.exerciseMinutes ?? 0,
      speed: s.row?.walkingSpeedMps ? mpsToDisplay(s.row.walkingSpeedMps, imperial) : null,
      distance: s.row?.distanceM ? metersToDisplay(s.row.distanceM, imperial) : null,
      restingHr: s.row?.restingHr ?? null,
    })),
    stats: {
      steps7: avg(steps7),
      steps30: avg(steps),
      cal7: avg(cal7),
      cal30: avg(cal),
      exercise7: avg(vals((r) => r.exerciseMinutes, 23)),
      speedNow: speedLast === null ? null : mpsToDisplay(speedLast, imperial),
      speedChange: speedFirst && speedLast ? (speedLast - speedFirst) / speedFirst : null,
      distance7: vals((r) => r.distanceM, 23).reduce((a, b) => a + b, 0),
      restingHr: avg(vals((r) => r.restingHr, 23)),
      bestSteps: best?.steps ? { steps: best.steps, day: best.date.toISOString().slice(0, 10) } : null,
      stepGoalDays: rows.filter((r) => (r.steps ?? 0) >= user.stepGoal).length,
      moveGoalDays: rows.filter((r) => (r.activeCalories ?? 0) >= user.activeCalGoal).length,
      stepStreak: streak(rows.filter((r) => (r.steps ?? 0) >= user.stepGoal).map((r) => r.date.toISOString().slice(0, 10)), today),
      daysSynced: rows.length,
    },
  };
}
