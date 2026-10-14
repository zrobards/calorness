export type Remaining = { calories: number; proteinG: number; carbsG: number; fatG: number };
export type FitCandidate = { id: string; name: string; calories: number; proteinG: number; carbsG: number; fatG: number };

/**
 * From foods you actually eat, pick the ones that fit what's left today.
 * Must fit the calories; ranked by how well they fill your biggest gap
 * (usually protein) without blowing through the others.
 */
export function suggestFits<T extends FitCandidate>(left: Remaining, foods: T[], limit = 4): T[] {
  if (left.calories < 50) return [];
  const proteinPriority = left.proteinG > 15 ? left.proteinG / Math.max(1, left.calories / 10) : 0;
  return foods
    .filter((f) => f.calories > 0 && f.calories <= left.calories * 1.05)
    .filter((f) => f.carbsG <= Math.max(left.carbsG, 0) + 10 && f.fatG <= Math.max(left.fatG, 0) + 5)
    .map((f) => {
      const proteinDensity = (f.proteinG * 4) / f.calories; // share of calories from protein
      const fillsCalories = Math.min(1, f.calories / left.calories);
      return { f, score: proteinDensity * (1 + proteinPriority) + fillsCalories * 0.5 };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.f);
}
