import "server-only";
import { db } from "@/lib/db";
import { correctionFactor } from "@/lib/nutrition/consensus";
import { groupKey } from "@/lib/nutrition/searchText";
import type { GroundedItem } from "./ground";

// When people fix AI estimates by typing real numbers, remember how far off
// the AI was for that kind of food. Once several different people correct
// the same food the same way, new estimates for everyone are nudged by the
// typical correction (and the review screen says so).
const MIN_PEOPLE = () => Math.max(2, Number(process.env.AI_CORRECTION_MIN_PEOPLE) || 3);
const keyFor = (name: string) => groupKey({ name, brand: null });

export async function recordCorrections(
  userId: string,
  items: { name: string; calories: number; protein_g: number; original?: { calories: number; protein_g: number } | null }[],
) {
  const rows = items
    .filter((i) => i.original && i.original.calories > 0 && keyFor(i.name))
    .map((i) => ({ userId, key: keyFor(i.name), aiCalories: i.original!.calories, finalCalories: i.calories, aiProteinG: i.original!.protein_g, finalProteinG: i.protein_g }));
  if (rows.length) await db.aiCorrection.createMany({ data: rows }).catch((e) => console.error("saving AI corrections failed", e));
}

export type Adjusted = GroundedItem & { adjusted?: { people: number; percent: number } };

/** Apply what people have taught us to fresh estimates (not to foods matched to real labels). */
export async function applyCorrections<T extends GroundedItem>(items: T[]): Promise<(T & { adjusted?: { people: number; percent: number } })[]> {
  const keys = [...new Set(items.map((i) => keyFor(i.name)).filter(Boolean))];
  if (keys.length === 0) return items;
  const since = new Date(Date.now() - 365 * 86_400_000);
  const rows = await db.aiCorrection
    .findMany({ where: { key: { in: keys }, createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take: 1000 })
    .catch(() => []);
  return items.map((item) => {
    if (item.my_food || (item.matches?.[0]?.score ?? 0) >= 0.75) return item; // real numbers already
    const f = correctionFactor(rows.filter((r) => r.key === keyFor(item.name)), MIN_PEOPLE());
    if (!f) return item;
    const r1 = (n: number) => Math.round(n * 10) / 10;
    return {
      ...item,
      calories: Math.round(item.calories * f.calories),
      protein_g: r1(item.protein_g * f.protein),
      carbs_g: r1(item.carbs_g * f.calories),
      fat_g: r1(item.fat_g * f.calories),
      adjusted: { people: f.people, percent: Math.round((f.calories - 1) * 100) },
    };
  });
}
