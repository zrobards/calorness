import type { FoodCandidate } from "./normalize";

// Plain, JSON-safe shape of one Diary day. The Diary keeps the latest copy on
// the phone so it can show it instantly, then refreshes it from the server.

export type DiaryItem = { id: string; servings: number; food: FoodCandidate };
export type DiaryMeal = { meal: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACKS"; label: string; items: DiaryItem[] };
export type QuickPick = { food: FoodCandidate; servings: number; count: number };
export type Targets = { calories: number; proteinG: number; carbsG: number; fatG: number; waterMl: number };

export type DiaryData = {
  day: string;
  baseGoal: Targets | null; // before exercise
  exercise: { items: { id: string; kind: "workout" | "activity"; name: string; minutes: number; total: number; net: number }[]; net: number; credit: number; calories: number };
  meals: DiaryMeal[];
  waterMl: number;
  imperial: boolean;
  // foods you usually have at each meal, for one-tap adding
  quick: Record<DiaryMeal["meal"], QuickPick[]>;
};

export type Totals = { calories: number; proteinG: number; carbsG: number; fatG: number };

export const itemNutrients = (i: DiaryItem): Totals => ({
  calories: i.food.calories * i.servings,
  proteinG: i.food.proteinG * i.servings,
  carbsG: i.food.carbsG * i.servings,
  fatG: i.food.fatG * i.servings,
});

export function sumTotals(items: DiaryItem[]): Totals {
  return items.map(itemNutrients).reduce(
    (t, n) => ({ calories: t.calories + n.calories, proteinG: t.proteinG + n.proteinG, carbsG: t.carbsG + n.carbsG, fatG: t.fatG + n.fatG }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

/** The day's targets with exercise calories added (about 70% carbs, 30% fat). */
export function dayTargets(d: DiaryData): Targets | null {
  if (!d.baseGoal) return null;
  const x = d.exercise.calories;
  return { ...d.baseGoal, calories: d.baseGoal.calories + x, carbsG: d.baseGoal.carbsG + Math.round((x * 0.7) / 4), fatG: d.baseGoal.fatG + Math.round((x * 0.3) / 9) };
}

/** Share of calories from verified sources (not AI estimates), or null if nothing's logged. */
export function verifiedShare(meals: DiaryMeal[]): number | null {
  const items = meals.flatMap((m) => m.items);
  const total = items.reduce((s, i) => s + i.food.calories * i.servings, 0);
  if (total <= 0) return null;
  return items.filter((i) => i.food.source !== "AI_ESTIMATE").reduce((s, i) => s + i.food.calories * i.servings, 0) / total;
}
