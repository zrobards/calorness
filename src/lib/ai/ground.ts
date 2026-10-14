import "server-only";
import type { AiFoodItem } from "./parse";
import type { FoodCandidate } from "@/lib/nutrition/normalize";
import { searchOpenFoodFacts, searchUsda } from "@/lib/nutrition/sources";
import { searchSavedFoods } from "@/lib/nutrition/diary";
import { rankMatches } from "@/lib/nutrition/match";
import { macroCheck } from "@/lib/nutrition/quality";

export type FoodMatch = { food: FoodCandidate; score: number };
export type GroundedItem = AiFoodItem & { matches?: FoodMatch[] };

/**
 * The AI is good at recognizing *what* a packaged food is, and bad at
 * knowing its exact calories. So for packaged items we take the brand and
 * product it read, find the real product in your foods, USDA, and Open Food
 * Facts, and offer the label values instead of the guess.
 */
export async function groundItems(userId: string, items: AiFoodItem[]): Promise<GroundedItem[]> {
  return Promise.all(
    items.map(async (item) => {
      if (!item.packaged || !(item.product || item.name)) return item;
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
