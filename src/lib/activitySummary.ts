import "server-only";
import { db } from "@/lib/db";
import { getUserPrefs } from "@/lib/userPrefs";
import { getDiaryDay } from "@/lib/nutrition/diary";
import { dayInZone } from "@/lib/time";
import { streak } from "@/lib/fitness/activity";

/**
 * Everything the "Today" card and the home-screen widget show: what's left
 * to eat, activity toward goals, and the streaks that keep people coming back.
 */
export async function getTodaySummary(userId: string) {
  const prefs = await getUserPrefs(userId);
  const today = dayInZone(new Date(), prefs.timeZone);
  const since = new Date(Date.parse(`${today}T00:00:00Z`) - 120 * 86_400_000);
  const [user, diary, activity, logged, trained] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { stepGoal: true, activeCalGoal: true, exerciseMinGoal: true } }),
    getDiaryDay(userId, today, prefs.timeZone),
    db.dailyActivity.findMany({ where: { userId, date: { gte: since } }, orderBy: { date: "desc" } }),
    db.diaryEntry.findMany({ where: { userId, date: { gte: since } }, select: { date: true }, distinct: ["date"] }),
    Promise.all([
      db.workout.findMany({ where: { userId, endedAt: { not: null }, startedAt: { gte: since } }, select: { startedAt: true } }),
      db.activityEntry.findMany({ where: { userId, date: { gte: since } }, select: { date: true } }),
    ]),
  ]);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const todayActivity = activity.find((a) => iso(a.date) === today) ?? null;

  // An active day: hit the step or exercise goal, or trained or logged cardio
  const activeDays = new Set<string>([
    ...activity.filter((a) => (a.steps ?? 0) >= user.stepGoal || (a.exerciseMinutes ?? 0) >= user.exerciseMinGoal).map((a) => iso(a.date)),
    ...trained[0].map((w) => dayInZone(w.startedAt, prefs.timeZone)),
    ...trained[1].map((a) => iso(a.date)),
  ]);

  const goal = diary.goal;
  return {
    today,
    calories: { eaten: Math.round(diary.totals.calories), goal: goal ? Math.round(goal.calories) : null, left: goal ? Math.round(goal.calories - diary.totals.calories) : null },
    protein: { eaten: Math.round(diary.totals.proteinG), goal: goal ? Math.round(goal.proteinG) : null },
    steps: { value: todayActivity?.steps ?? null, goal: user.stepGoal },
    activeCalories: { value: todayActivity?.activeCalories ?? null, goal: user.activeCalGoal },
    exerciseMinutes: { value: todayActivity?.exerciseMinutes ?? null, goal: user.exerciseMinGoal },
    walkingSpeedMps: todayActivity?.walkingSpeedMps ?? null,
    healthConnected: activity.length > 0,
    logStreak: streak(logged.map((l) => iso(l.date)), today),
    activeStreak: streak(activeDays, today),
    loggedToday: logged.some((l) => iso(l.date) === today),
    imperial: prefs.unitSystem === "IMPERIAL",
  };
}

export type TodaySummary = Awaited<ReturnType<typeof getTodaySummary>>;

/** One short line of encouragement that fits where the person is today. */
export function nudge(s: TodaySummary): string {
  if (!s.loggedToday && s.logStreak > 0) return `Log something today to keep your ${s.logStreak}-day streak going.`;
  if (!s.loggedToday) return "Log your first meal today. It takes one tap.";
  if (s.steps.value !== null && s.steps.value < s.steps.goal) return `${(s.steps.goal - s.steps.value).toLocaleString("en-US")} steps to your goal. A 15-minute walk gets you about 1,500.`;
  if (s.calories.left !== null && s.calories.left > 300) return `${s.calories.left.toLocaleString("en-US")} calories left. Room for a protein-packed meal.`;
  if (s.activeStreak >= 3) return `${s.activeStreak} active days in a row. Keep it rolling.`;
  return "Nice work today. Keep it up.";
}
