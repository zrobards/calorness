import "server-only";
import type { AiFoodItem } from "./parse";
import type { FoodCandidate } from "@/lib/nutrition/normalize";
import { searchOpenFoodFacts, searchUsda, searchUsdaGeneric } from "@/lib/nutrition/sources";
import { textMatch } from "@/lib/nutrition/searchText";
import { round1 } from "@/lib/fitness/units";
import { searchSavedFoods } from "@/lib/nutrition/diary";
import { rankMatches } from "@/lib/nutrition/match";
import { macroCheck } from "@/lib/nutrition/quality";

export type FoodMatch = { food: FoodCandidate; score: number };
export type GroundedItem = AiFoodItem & {
  matches?: FoodMatch[];
  // For unpackaged food: the reference food whose calories per gram were used
  basis?: { name: string; source: "USDA" };
  // How many servings of a matched food (e.g. "two of my shakes")
  suggestedServings?: number;
  // Nudged by other people's corrections of foods like this
  adjusted?: { people: number; percent: number };
};

/**
 * The AI is good at recognizing *what* a packaged food is, and bad at
 * knowing its exact calories. So for packaged items we take the brand and
 * product it read, find the real product in your foods, USDA, and Open Food
 * Facts, and offer the label values instead of the guess.
 */
export async function groundItems(userId: string, items: AiFoodItem[]): Promise<GroundedItem[]> {
  return Promise.all(
    items.map(async (item) => {
      if (!item.packaged) return withReferenceDensity(item);
      if (!(item.product || item.name)) return item;
      const product = item.product || item.name;
      const query = [item.brand, product].filter(Boolean).join(" ").slice(0, 80);
      const [mine, usda, off] = await Promise.all([
        searchSavedFoods(userId, query).catch(() => []),
        searchUsda(query).catch(() => []),
        searchOpenFoodFacts(query).catch(() => []),
      ]);
      const pool = [...mine.filter((f) => f.source !== "AI_ESTIMATE"), ...usda, ...off].filter((f) => !macroCheck(f).flagged);
      const matches = rankMatches({ brand: item.brand, product }, pool).map(({ c, score }) => ({ food: c, score: Math.round(score * 100) / 100 }));
      return matches.length ? { ...item, matches } : item;
    }),
  );
}

/**
 * For unpackaged food the AI is decent at judging *how much* (grams) and
 * less reliable at calories per gram. When USDA has a clear match for the
 * food, use USDA's calories and macros per gram times the AI's portion.
 */
async function withReferenceDensity(item: AiFoodItem): Promise<GroundedItem> {
  if (!(item.grams > 0)) return item;
  const refs = await searchUsdaGeneric(item.name).catch(() => [] as FoodCandidate[]);
  const ref = refs
    .filter((r) => r.servingUnit === "g" && r.servingSize > 0 && !macroCheck(r).flagged)
    .map((r) => ({ r, match: textMatch(item.name, r) }))
    .filter((x) => x.match >= 0.8)
    .sort((a, b) => b.match - a.match || a.r.name.length - b.r.name.length)[0]?.r;
  if (!ref) return item;

  const perGram = (v: number) => v / ref.servingSize;
  const calories = Math.round(perGram(ref.calories) * item.grams);
  // A wildly different answer means the match is probably a different dish; keep the AI's
  if (item.calories > 0 && (calories / item.calories > 2.5 || calories / item.calories < 0.4)) return item;
  return {
    ...item,
    calories,
    protein_g: round1(perGram(ref.proteinG) * item.grams),
    carbs_g: round1(perGram(ref.carbsG) * item.grams),
    fat_g: round1(perGram(ref.fatG) * item.grams),
    basis: { name: ref.name, source: "USDA" },
  };
}
