import "server-only";
import { db } from "@/lib/db";
import { scaleNutrients } from "@/lib/fitness/nutrition";
import { addDays } from "@/lib/fitness/dates";
import { zonedDayStart } from "@/lib/time";
import { verifiedShare } from "./quality";
import { totalVolumeKg } from "@/lib/fitness/strength";
import type { FoodCandidate } from "./normalize";

export const MEALS = ["BREAKFAST", "LUNCH", "DINNER", "SNACKS"] as const;
export type MealName = (typeof MEALS)[number];
export const MEAL_LABELS: Record<MealName, string> = { BREAKFAST: "Breakfast", LUNCH: "Lunch", DINNER: "Dinner", SNACKS: "Snacks" };

/** "2026-10-14" → the Date stored in @db.Date columns. */
export const dayToDate = (day: string) => new Date(`${day}T00:00:00Z`);

type Totals = { calories: number; proteinG: number; carbsG: number; fatG: number };
const zero = (): Totals => ({ calories: 0, proteinG: 0, carbsG: 0, fatG: 0 });
const add = (a: Totals, b: Totals) => ({
  calories: a.calories + b.calories,
  proteinG: a.proteinG + b.proteinG,
  carbsG: a.carbsG + b.carbsG,
  fatG: a.fatG + b.fatG,
});

export async function getDiaryDay(userId: string, day: string, timeZone = "America/New_York") {
  const dayStart = zonedDayStart(day, timeZone);
  const date = dayToDate(day);
  const [entries, water, goal, workouts] = await Promise.all([
    db.diaryEntry.findMany({ where: { userId, date }, orderBy: { createdAt: "asc" }, include: { food: true } }),
    db.waterEntry.findMany({ where: { userId, date }, orderBy: { createdAt: "asc" } }),
    db.goal.findUnique({ where: { userId } }),
    // Workouts that started during this calendar day where the user is
    db.workout.findMany({
      where: { userId, endedAt: { not: null }, startedAt: { gte: dayStart, lt: new Date(dayStart.getTime() + 86_400_000) } },
      include: { exercises: { include: { sets: true } } },
    }),
  ]);

  const meals = MEALS.map((meal) => {
    const items = entries
      .filter((e) => e.meal === meal)
      .map((e) => ({ id: e.id, servings: e.servings, food: e.food, nutrients: scaleNutrients(e.food, e.servings) }));
    return { meal, label: MEAL_LABELS[meal], items, totals: items.reduce((t, i) => add(t, i.nutrients), zero()) };
  });

  return {
    meals,
    totals: meals.reduce((t, m) => add(t, m.totals), zero()),
    // How much of today came from verified sources rather than AI estimates
    verified: verifiedShare(meals.flatMap((m) => m.items.map((i) => ({ calories: i.nutrients.calories, source: i.food.source })))),
    waterMl: water.reduce((s, w) => s + w.ml, 0),
    waterEntries: water.length,
    goal,
    workouts: workouts.map((w) => ({ id: w.id, name: w.name, volumeKg: totalVolumeKg(w.exercises.flatMap((e) => e.sets)) })),
  };
}

export const toCandidate = (f: {
  id: string; source: FoodCandidate["source"]; externalId: string | null; barcode: string | null; name: string; brand: string | null;
  servingSize: number; servingUnit: string; servingLabel: string | null; calories: number; proteinG: number; carbsG: number; fatG: number;
  fiberG: number | null; sugarG: number | null; sodiumMg: number | null;
}): FoodCandidate => ({
  id: f.id, source: f.source, externalId: f.externalId, barcode: f.barcode, name: f.name, brand: f.brand,
  servingSize: f.servingSize, servingUnit: f.servingUnit, servingLabel: f.servingLabel, calories: f.calories,
  proteinG: f.proteinG, carbsG: f.carbsG, fatG: f.fatG, fiberG: f.fiberG, sugarG: f.sugarG, sodiumMg: f.sodiumMg,
});

/** Foods this user logged most recently, newest first, no duplicates. */
export async function getRecentFoods(userId: string) {
  const entries = await db.diaryEntry.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 150,
    include: { food: true },
  });
  const seen = new Map<string, { food: FoodCandidate; servings: number; count: number }>();
  for (const e of entries) {
    const existing = seen.get(e.foodId);
    if (existing) existing.count += 1;
    else seen.set(e.foodId, { food: toCandidate(e.food), servings: e.servings, count: 1 });
  }
  return [...seen.values()].slice(0, 30);
}

export async function getMyFoods(userId: string) {
  const foods = await db.food.findMany({ where: { createdById: userId }, orderBy: { name: "asc" } });
  return foods.map(toCandidate);
}

export async function searchSavedFoods(userId: string, query: string) {
  const words = query.trim().split(/\s+/).filter(Boolean).slice(0, 5);
  if (words.length === 0) return [];
  const foods = await db.food.findMany({
    where: {
      OR: [{ createdById: null }, { createdById: userId }],
      AND: words.map((w) => ({ OR: [{ name: { contains: w, mode: "insensitive" as const } }, { brand: { contains: w, mode: "insensitive" as const } }] })),
    },
    take: 10,
  });
  return foods.map(toCandidate);
}

export async function findFoodByBarcode(userId: string, barcode: string) {
  const food = await db.food.findFirst({ where: { barcode, OR: [{ createdById: null }, { createdById: userId }] } });
  return food ? toCandidate(food) : null;
}

/** Daily calories for the last 7 days, for the Progress tab. */
export async function getCalorieWeek(userId: string, today: string) {
  const end = dayToDate(today);
  const start = addDays(end, -6);
  const entries = await db.diaryEntry.findMany({
    where: { userId, date: { gte: start, lte: end } },
    include: { food: { select: { calories: true } } },
  });
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i);
    const calories = entries
      .filter((e) => e.date.getTime() === date.getTime())
      .reduce((s, e) => s + e.food.calories * e.servings, 0);
    return { date, calories };
  });
}

export async function getSavedMeals(userId: string) {
  const meals = await db.savedMeal.findMany({
    where: { userId },
    orderBy: [{ lastUsed: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    include: { items: { include: { food: true } } },
    take: 12,
  });
  return meals.map((m) => ({
    id: m.id,
    name: m.name,
    itemCount: m.items.length,
    calories: Math.round(m.items.reduce((s, i) => s + i.food.calories * i.servings, 0)),
    proteinG: Math.round(m.items.reduce((s, i) => s + i.food.proteinG * i.servings, 0)),
  }));
}
