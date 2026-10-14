import { KCAL_PER_GRAM } from "@/lib/fitness/nutrition";

/**
 * Calories should roughly equal 4×protein + 4×carbs + 9×fat. When a food's
 * numbers don't add up, the entry is probably wrong (a typo, the wrong
 * serving, or a mislabeled product). Fiber, sugar alcohols, and alcohol
 * explain small gaps, so we only flag big ones.
 */
export function macroCheck(f: { calories: number; proteinG: number; carbsG: number; fatG: number }) {
  const expected = f.proteinG * KCAL_PER_GRAM.protein + f.carbsG * KCAL_PER_GRAM.carbs + f.fatG * KCAL_PER_GRAM.fat;
  const diff = f.calories - expected;
  const flagged = Math.abs(diff) > Math.max(30, 0.25 * Math.max(f.calories, expected));
  return { expected: Math.round(expected), diff: Math.round(diff), flagged };
}

/** Share of the day's calories from verified sources (label, barcode, database, your own foods), 0 to 1. */
export function verifiedShare(entries: { calories: number; source: string }[]) {
  const total = entries.reduce((s, e) => s + e.calories, 0);
  if (total <= 0) return null;
  const verified = entries.filter((e) => e.source !== "AI_ESTIMATE").reduce((s, e) => s + e.calories, 0);
  return verified / total;
}
