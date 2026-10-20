import "server-only";
import { db } from "@/lib/db";
import { searchOpenFoodFacts, searchUsda } from "./sources";
import { searchSavedFoods, toCandidate } from "./diary";
import { macroCheck } from "./quality";
import { expandQuery, groupKey, normalize, textMatch } from "./searchText";
import type { FoodCandidate } from "./normalize";

// Food search: gathers candidates from your foods, foods saved in the app,
// what you (and everyone) picked for this search before, USDA, and Open Food
// Facts; scores them; collapses duplicates; and returns one ranked list.
//
// Score = how well the name matches what was typed (typo-tolerant)
//       + a nudge for trustworthy sources (your own > USDA > crowd-sourced)
//       + a big boost for foods you've picked for this search
//       + a small boost for foods other people picked for it
//       − a penalty for entries whose calories and macros disagree

/** The normalized form of a search, used to remember what you picked for it. */
export const pickKey = (q: string) => normalize(expandQuery(q));

/**
 * Two speeds: `local` searches only your foods and foods already saved in
 * the app (instant), and the full search also asks USDA and Open Food Facts
 * (a second or two). The screen shows the local results right away.
 */
export async function findFoods(userId: string, query: string, scope: "local" | "all" = "all"): Promise<FoodCandidate[]> {
  const q = { data: query };

  // The food APIs need the usual spelling ("chick-fil-a"), not what was typed ("chickfila")
  const apiQuery = expandQuery(q.data);
  const key = pickKey(q.data);
  const [saved, usda, off, picks, community] = await Promise.all([
    searchSavedFoods(userId, q.data),
    scope === "all" ? searchUsda(apiQuery) : Promise.resolve([] as FoodCandidate[]),
    scope === "all" ? searchOpenFoodFacts(apiQuery) : Promise.resolve([] as FoodCandidate[]),
    // Foods you picked for this search before (or a search that starts the same way)
    db.searchPick.findMany({
      where: { userId, OR: [{ query: key }, { query: { startsWith: key } }, ...(key.length >= 4 ? [{ query: { contains: key } }] : [])] },
      include: { food: true },
      orderBy: [{ count: "desc" }, { lastAt: "desc" }],
      take: 8,
    }),
    // What everyone else picked for this exact search (counts only; a food
    // still has to be visible to you to show up, so private foods never leak)
    db.searchPick.groupBy({ by: ["foodId"], where: { query: key, NOT: { userId } }, _sum: { count: true } }),
  ]);
  const popularity = new Map(community.map((c) => [c.foodId, c._sum.count ?? 0]));
  const pickedCount = new Map<string, number>();
  for (const p of picks) pickedCount.set(p.foodId, (pickedCount.get(p.foodId) ?? 0) + p.count);

  // Score everything together: how well the name matches what you typed, a
  // nudge toward trustworthy sources, and a big boost for foods you've
  // picked for this search before. Badly inconsistent entries are dropped.
  const SOURCE_BONUS = { CUSTOM: 0.25, USDA: 0.12, COMMUNITY: 0.1, AI_ESTIMATE: 0.05, OPEN_FOOD_FACTS: 0 } as const;
  const minMatch = normalize(apiQuery).split(" ").length >= 3 ? 0.75 : 0.6;
  const candidates = [...picks.map((p) => toCandidate(p.food)), ...saved, ...usda, ...off];
  const seen = new Set<string>();
  const scored = candidates
    .filter((f) => {
      const id = `${f.source}:${f.externalId ?? f.id}`;
      return !seen.has(id) && !!seen.add(id);
    })
    .map((f) => {
      const match = textMatch(q.data, f);
      const check = macroCheck(f);
      const picked = f.id ? pickedCount.get(f.id) ?? 0 : 0;
      const popular = f.id ? popularity.get(f.id) ?? 0 : 0;
      const mine = f.id && (f.source === "CUSTOM" || f.source === "AI_ESTIMATE") && saved.concat(picks.map((p) => toCandidate(p.food))).some((s) => s.id === f.id);
      return {
        f,
        picked,
        mine,
        // community foods earn more trust the more people agree on them
        score: match + SOURCE_BONUS[f.source] + (f.source === "COMMUNITY" ? Math.min(0.1, (f.confirmations ?? 0) * 0.02) : 0) + (mine ? 0.2 : 0) + (picked ? 0.6 + Math.log2(1 + picked) * 0.1 : 0) + Math.min(0.3, Math.log2(1 + popular) * 0.1) - (check.flagged ? 0.3 : 0),
        keep: picked > 0 || match >= (mine ? 0.5 : minMatch),
        badData: check.flagged && Math.abs(check.diff) > 0.4 * Math.max(f.calories, check.expected),
      };
    })
    .filter((x) => x.keep && !x.badData);

  // One entry per food: "Chick-fil-A Sauce" from five crowd-sourced entries
  // becomes a single result. Within a group, prefer what you've used, then
  // your own foods, then the version closest to the group's typical calories
  // per 100 g (the crowd consensus), then the more trusted source.
  const groups = new Map<string, typeof scored>();
  for (const x of scored) {
    const g = x.picked || x.mine ? `mine:${x.f.id}` : groupKey(x.f) || `${x.f.source}:${x.f.externalId}`;
    groups.set(g, [...(groups.get(g) ?? []), x]);
  }
  const density = (f: FoodCandidate) => (f.servingUnit === "g" || f.servingUnit === "ml") && f.servingSize > 0 ? (f.calories / f.servingSize) * 100 : null;
  const best = [...groups.values()].map((items) => {
    const ds = items.map((x) => density(x.f)).filter((d): d is number => d !== null).sort((a, b) => a - b);
    const median = ds.length >= 3 ? ds[Math.floor(ds.length / 2)] : null;
    const adjusted = items.map((x) => {
      const d = density(x.f);
      const off = median && d !== null ? Math.min(1, Math.abs(d - median) / median) : 0;
      return { ...x, score: x.score - off * 0.4 };
    });
    return adjusted.sort((a, b) => b.score - a.score)[0];
  });

  return best.sort((a, b) => b.score - a.score).slice(0, 30).map((x) => x.f);
}

