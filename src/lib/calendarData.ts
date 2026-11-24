import "server-only";
import { db } from "@/lib/db";
import { dayInZone } from "@/lib/time";
import { daysOfMonth, type CalendarDay } from "./calendar";

const toDay = (d: Date) => d.toISOString().slice(0, 10);

/** Everything for one month, one entry per day. */
export async function getMonth(userId: string, month: string, timeZone: string): Promise<CalendarDay[]> {
  const days = daysOfMonth(month);
  const start = new Date(`${days[0]}T00:00:00Z`);
  const end = new Date(`${days.at(-1)}T00:00:00Z`);
  // Workouts are stored by start time; a day either side covers any time zone
  const wideStart = new Date(start.getTime() - 86_400_000);
  const wideEnd = new Date(end.getTime() + 2 * 86_400_000);

  const [entries, workouts, activities, weights, photos] = await Promise.all([
    db.diaryEntry.findMany({
      where: { userId, date: { gte: start, lte: end } },
      select: { date: true, servings: true, food: { select: { calories: true, proteinG: true, carbsG: true, fatG: true } } },
    }),
    db.workout.findMany({
      where: { userId, endedAt: { not: null }, startedAt: { gte: wideStart, lt: wideEnd } },
      select: { id: true, name: true, startedAt: true, endedAt: true },
      orderBy: { startedAt: "asc" },
    }),
    db.activityEntry.findMany({
      where: { userId, date: { gte: start, lte: end } },
      select: { date: true, name: true, durationMin: true, caloriesNet: true },
      orderBy: { startedAt: "asc" },
    }),
    db.bodyweightEntry.findMany({ where: { userId, date: { gte: start, lte: end } }, select: { date: true, weightKg: true } }),
    db.progressPhoto.findMany({ where: { userId, day: { gte: start, lte: end } }, select: { id: true, day: true }, orderBy: { createdAt: "asc" } }),
  ]);

  const byDay = new Map<string, CalendarDay>(
    days.map((day) => [day, { day, calories: 0, proteinG: 0, carbsG: 0, fatG: 0, foods: 0, workouts: [], activities: [], weightKg: null, photoIds: [] }]),
  );
  for (const e of entries) {
    const d = byDay.get(toDay(e.date));
    if (!d) continue;
    d.calories += e.food.calories * e.servings;
    d.proteinG += e.food.proteinG * e.servings;
    d.carbsG += e.food.carbsG * e.servings;
    d.fatG += e.food.fatG * e.servings;
    d.foods++;
  }
  for (const w of workouts) {
    byDay.get(dayInZone(w.startedAt, timeZone))?.workouts.push({ id: w.id, name: w.name, minutes: Math.max(1, Math.round((w.endedAt!.getTime() - w.startedAt.getTime()) / 60_000)) });
  }
  for (const a of activities) byDay.get(toDay(a.date))?.activities.push({ name: a.name, minutes: Math.round(a.durationMin), calories: a.caloriesNet });
  for (const w of weights) {
    const d = byDay.get(toDay(w.date));
    if (d) d.weightKg = w.weightKg;
  }
  for (const p of photos) byDay.get(toDay(p.day))?.photoIds.push(p.id);

  return [...byDay.values()].map((d) => ({
    ...d,
    calories: Math.round(d.calories),
    proteinG: Math.round(d.proteinG),
    carbsG: Math.round(d.carbsG),
    fatG: Math.round(d.fatG),
  }));
}
