// Pure rules for turning many people's hand-typed entries into one shared
// food. Kept separate from the database code so they're easy to test.
import { expandQuery, groupKey, normalize } from "./searchText";
import { plausiblePer100 } from "./normalize";

export type Entry = {
  userId: string;
  name: string;
  brand: string | null;
  servingLabel: string | null;
  servingSize: number;
  servingUnit: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

/** Same food? Brand matters (Chick-fil-A nuggets ≠ store-brand nuggets); word order, sizes, and plurals don't. */
export const entryKey = (e: { name: string; brand: string | null }) => {
  const brand = normalize(expandQuery(e.brand ?? ""));
  const name = groupKey({ name: e.name, brand: e.brand });
  return name ? `${brand}|${name}` : "";
};

const isWeighed = (e: Entry) => (e.servingUnit === "g" || e.servingUnit === "ml") && e.servingSize > 0;
const per100 = (e: Entry, v: number) => (v / e.servingSize) * 100;
const close = (a: number, b: number, pct: number, abs: number) => Math.abs(a - b) <= Math.max(abs, pct * Math.max(a, b));
const servingWords = (e: Entry) => normalize(e.servingLabel ?? "").replace(/\b(serving|servings|of)\b/g, "").trim();

/** Do two entries describe the same food with the same numbers? */
export function agree(a: Entry, b: Entry): boolean {
  if (isWeighed(a) && isWeighed(b)) {
    // compare per 100 g so "113 g" and "4 oz (113 g)" line up
    return close(per100(a, a.calories), per100(b, b.calories), 0.1, 10) && close(per100(a, a.proteinG), per100(b, b.proteinG), 0.15, 2);
  }
  // otherwise the servings have to be described the same way ("8 count")
  if (servingWords(a) !== servingWords(b)) return false;
  return close(a.calories, b.calories, 0.1, 10) && close(a.proteinG, b.proteinG, 0.15, 2);
}

/** A believable entry: not empty, not impossible per 100 g, calories in line with macros. */
export function plausible(e: Entry): boolean {
  if (e.calories <= 0 || e.calories > 5000) return false;
  if (isWeighed(e) && !plausiblePer100({ calories: per100(e, e.calories), proteinG: per100(e, e.proteinG), carbsG: per100(e, e.carbsG), fatG: per100(e, e.fatG) })) return false;
  // calories have to roughly match the macros (shared foods need real macros, not just a calorie number)
  const fromMacros = e.proteinG * 4 + e.carbsG * 4 + e.fatG * 9;
  return !(e.calories > 40 && (fromMacros === 0 || e.calories > fromMacros * 2.2 || fromMacros > e.calories * 2.2));
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Given a new entry and everyone else's entries for the same food, return the
 * shared version if enough different people agree, else null. The shared
 * numbers are the median of the agreeing entries, so one typo can't skew them.
 */
export function consensus(entry: Entry, others: Entry[], minPeople = 2) {
  if (!plausible(entry)) return null;
  const group = [entry, ...others.filter((o) => o.userId !== entry.userId && plausible(o) && agree(entry, o))];
  const people = new Set(group.map((g) => g.userId)).size;
  if (people < minPeople) return null;
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return {
    people,
    name: entry.name,
    brand: entry.brand,
    servingLabel: entry.servingLabel,
    servingSize: entry.servingSize,
    servingUnit: entry.servingUnit,
    // scale each person's numbers to this entry's serving before taking the median
    calories: Math.round(median(group.map((g) => (isWeighed(g) && isWeighed(entry) ? (g.calories / g.servingSize) * entry.servingSize : g.calories)))),
    proteinG: r1(median(group.map((g) => (isWeighed(g) && isWeighed(entry) ? (g.proteinG / g.servingSize) * entry.servingSize : g.proteinG)))),
    carbsG: r1(median(group.map((g) => (isWeighed(g) && isWeighed(entry) ? (g.carbsG / g.servingSize) * entry.servingSize : g.carbsG)))),
    fatG: r1(median(group.map((g) => (isWeighed(g) && isWeighed(entry) ? (g.fatG / g.servingSize) * entry.servingSize : g.fatG)))),
  };
}

// ─── AI corrections ───────────────────────────────────────────────────────

export type Correction = { userId: string; aiCalories: number; finalCalories: number; aiProteinG: number; finalProteinG: number };

/**
 * How far off the AI tends to be for a food, from corrections by at least
 * `minPeople` different people. Returns multipliers, limited to ±40% so a
 * few odd corrections can't make estimates absurd; null when there isn't a
 * clear, consistent pattern.
 */
export function correctionFactor(corrections: Correction[], minPeople = 3) {
  const usable = corrections.filter((c) => c.aiCalories > 20 && c.finalCalories > 0);
  // one vote per person: their most recent corrections are averaged first
  const byUser = new Map<string, number[]>();
  for (const c of usable) byUser.set(c.userId, [...(byUser.get(c.userId) ?? []), c.finalCalories / c.aiCalories]);
  if (byUser.size < minPeople) return null;
  const ratios = [...byUser.values()].map((r) => r.reduce((a, b) => a + b, 0) / r.length);
  const cal = median(ratios);
  // only adjust when most people pushed the same direction
  const sameWay = ratios.filter((r) => (cal > 1 ? r > 1 : r < 1)).length / ratios.length;
  if (Math.abs(cal - 1) < 0.08 || sameWay < 0.7) return null;
  const protein = usable.filter((c) => c.aiProteinG > 2);
  const pRatio = protein.length >= minPeople ? median(protein.map((c) => c.finalProteinG / c.aiProteinG)) : cal;
  const clamp = (r: number) => Math.min(1.4, Math.max(0.6, r));
  return { calories: clamp(cal), protein: clamp(pRatio), people: byUser.size };
}
