"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { lookupBarcodeOnline, searchOpenFoodFacts, searchUsda } from "@/lib/nutrition/sources";
import { findFoodByBarcode, searchSavedFoods, dayToDate, MEALS, toCandidate } from "@/lib/nutrition/diary";
import { normalizeBarcode, type FoodCandidate } from "@/lib/nutrition/normalize";
import { macroCheck } from "@/lib/nutrition/quality";
import { expandQuery, normalize, textMatch } from "@/lib/nutrition/searchText";
import { candidateSchema, ensureFood } from "@/lib/nutrition/foods";

const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const mealSchema = z.enum(MEALS);

// ─── Finding foods ────────────────────────────────────────────────────────

/**
 * Searches three places at once: foods already saved (instant, includes the
 * user's custom foods), USDA (generic + branded), and Open Food Facts.
 */
export async function searchFoods(query: string) {
  const user = await requireUser();
  const q = z.string().trim().min(2).max(80).safeParse(query);
  if (!q.success) return { foods: [] as FoodCandidate[] };

  // The food APIs need the usual spelling ("chick-fil-a"), not what was typed ("chickfila")
  const apiQuery = expandQuery(q.data);
  const [saved, usda, off] = await Promise.all([
    searchSavedFoods(user.id, q.data),
    searchUsda(apiQuery),
    searchOpenFoodFacts(apiQuery),
  ]);

  // Rank everything together: how well the name matches what you typed, plus
  // a nudge toward more trustworthy sources. Entries whose calories and
  // macros badly disagree are dropped; mild mismatches sink and get a warning.
  const SOURCE_BONUS = { CUSTOM: 0.25, USDA: 0.12, AI_ESTIMATE: 0.05, OPEN_FOOD_FACTS: 0 } as const;
  const seen = new Set<string>();
  const ranked = [...saved, ...usda, ...off]
    .filter((f) => {
      const key = `${f.source}:${f.externalId ?? f.id}`;
      return !seen.has(key) && !!seen.add(key);
    })
    .map((f) => {
      const match = textMatch(q.data, f);
      const check = macroCheck(f);
      const mine = f.id && f.source === "CUSTOM" ? 0.2 : 0; // your own foods first
      return { f, match, score: match + SOURCE_BONUS[f.source] + mine - (check.flagged ? 0.3 : 0), badData: check.flagged && Math.abs(check.diff) > 0.4 * Math.max(f.calories, check.expected) };
    })
    // longer searches must match more of their words, so "chick-fil-a nuggets" doesn't list every sauce
    .filter((x) => x.match >= (normalize(apiQuery).split(" ").length >= 3 ? 0.75 : 0.6) && !x.badData)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.f);

  return { foods: ranked.slice(0, 40) };
}

export async function lookupBarcode(code: string) {
  const user = await requireUser();
  const barcode = normalizeBarcode(z.string().max(20).parse(code));
  if (barcode.length < 8) return { food: null, barcode };
  const food = (await findFoodByBarcode(user.id, barcode)) ?? (await lookupBarcodeOnline(barcode));
  return { food, barcode };
}

// ─── Logging ──────────────────────────────────────────────────────────────



export async function addDiaryEntry(input: { food: FoodCandidate; day: string; meal: string; servings: number }) {
  const user = await requireUser();
  const parsed = z
    .object({ food: candidateSchema, day: daySchema, meal: mealSchema, servings: z.number().positive().max(100) })
    .safeParse(input);
  if (!parsed.success) return { error: "That amount doesn't look right." };

  const foodId = await ensureFood(user.id, parsed.data.food);
  await db.diaryEntry.create({
    data: { userId: user.id, foodId, date: dayToDate(parsed.data.day), meal: parsed.data.meal, servings: parsed.data.servings },
  });
  revalidatePath("/diary");
  return { ok: true };
}

export async function updateDiaryEntry(entryId: string, servings: number) {
  const user = await requireUser();
  const s = z.number().positive().max(100).parse(servings);
  await db.diaryEntry.updateMany({ where: { id: entryId, userId: user.id }, data: { servings: s } });
  revalidatePath("/diary");
}

export async function deleteDiaryEntry(entryId: string) {
  const user = await requireUser();
  await db.diaryEntry.deleteMany({ where: { id: entryId, userId: user.id } });
  revalidatePath("/diary");
}

/** MyFitnessPal's "copy from yesterday" for one meal. */
export async function copyMealFromDay(fromDay: string, toDay: string, meal: string) {
  const user = await requireUser();
  const m = mealSchema.parse(meal);
  const entries = await db.diaryEntry.findMany({
    where: { userId: user.id, date: dayToDate(daySchema.parse(fromDay)), meal: m },
  });
  if (entries.length === 0) return { error: "Nothing was logged for that meal." };
  await db.diaryEntry.createMany({
    data: entries.map((e) => ({ userId: user.id, foodId: e.foodId, meal: m, servings: e.servings, date: dayToDate(daySchema.parse(toDay)) })),
  });
  revalidatePath("/diary");
  return { ok: true, count: entries.length };
}

// ─── Custom foods ─────────────────────────────────────────────────────────

const customFoodSchema = z.object({
  name: z.string().trim().min(1, "Name the food.").max(120),
  brand: z.string().trim().max(120).optional(),
  servingLabel: z.string().trim().min(1, "Describe the serving, like 1 bar.").max(60),
  servingSize: z.coerce.number().positive().max(5000).optional(),
  servingUnit: z.enum(["g", "ml"]).default("g"),
  calories: z.coerce.number().min(0).max(5000),
  proteinG: z.coerce.number().min(0).max(500),
  carbsG: z.coerce.number().min(0).max(500),
  fatG: z.coerce.number().min(0).max(500),
  barcode: z.string().trim().max(20).optional(),
});

export async function createCustomFood(input: Record<string, string>) {
  const user = await requireUser();
  const parsed = customFoodSchema.safeParse(Object.fromEntries(Object.entries(input).filter(([, v]) => v !== "")));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the numbers." };
  const d = parsed.data;
  const food = await db.food.create({
    data: {
      source: "CUSTOM",
      name: d.name,
      brand: d.brand || null,
      servingLabel: d.servingLabel,
      servingSize: d.servingSize ?? 1,
      servingUnit: d.servingSize ? d.servingUnit : "serving",
      calories: d.calories,
      proteinG: d.proteinG,
      carbsG: d.carbsG,
      fatG: d.fatG,
      barcode: d.barcode ? normalizeBarcode(d.barcode) : null,
      createdById: user.id,
    },
  });
  return { food: toCandidate(food) };
}

// ─── Water ────────────────────────────────────────────────────────────────

export async function addWater(day: string, ml: number) {
  const user = await requireUser();
  const amount = z.number().int().min(-2000).max(2000).parse(Math.round(ml));
  const date = dayToDate(daySchema.parse(day));
  if (amount < 0) {
    // "Undo" removes the most recent glass
    const last = await db.waterEntry.findFirst({ where: { userId: user.id, date }, orderBy: { createdAt: "desc" } });
    if (last) await db.waterEntry.delete({ where: { id: last.id } });
  } else {
    await db.waterEntry.create({ data: { userId: user.id, date, ml: amount } });
  }
  revalidatePath("/diary");
}

// ─── Saved meals ──────────────────────────────────────────────────────────

/** Save everything logged in one meal (e.g. your usual breakfast) for one-tap logging later. */
export async function saveMealFromDay(day: string, meal: string, name: string) {
  const user = await requireUser();
  const label = z.string().trim().min(1).max(60).safeParse(name);
  if (!label.success) return { error: "Give the meal a name." };
  const entries = await db.diaryEntry.findMany({ where: { userId: user.id, date: dayToDate(daySchema.parse(day)), meal: mealSchema.parse(meal) } });
  if (entries.length === 0) return { error: "Nothing logged in that meal yet." };
  await db.savedMeal.create({
    data: { userId: user.id, name: label.data, items: { create: entries.map((e) => ({ foodId: e.foodId, servings: e.servings })) } },
  });
  revalidatePath("/log");
  return { ok: true };
}

/** One tap: log every food in a saved meal. Returns the new entry ids for Undo. */
export async function logSavedMeal(savedMealId: string, day: string, meal: string) {
  const user = await requireUser();
  const saved = await db.savedMeal.findFirst({ where: { id: savedMealId, userId: user.id }, include: { items: { include: { food: true } } } });
  if (!saved) return { error: "That saved meal is gone." };
  const date = dayToDate(daySchema.parse(day));
  const m = mealSchema.parse(meal);
  const created = await db.$transaction(
    saved.items.map((i) => db.diaryEntry.create({ data: { userId: user.id, foodId: i.foodId, servings: i.servings, meal: m, date } })),
  );
  await db.savedMeal.update({ where: { id: saved.id }, data: { lastUsed: new Date() } });
  revalidatePath("/diary");
  revalidatePath("/log");
  return {
    entryIds: created.map((e) => e.id),
    calories: Math.round(saved.items.reduce((s, i) => s + i.food.calories * i.servings, 0)),
  };
}

export async function deleteDiaryEntries(ids: string[]) {
  const user = await requireUser();
  await db.diaryEntry.deleteMany({ where: { id: { in: z.array(z.string()).max(50).parse(ids) }, userId: user.id } });
  revalidatePath("/diary");
  revalidatePath("/log");
}

export async function deleteSavedMeal(id: string) {
  const user = await requireUser();
  await db.savedMeal.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/log");
}

/** Repeat a whole day (handy for meal prep weeks). */
export async function copyWholeDay(fromDay: string, toDay: string) {
  const user = await requireUser();
  const entries = await db.diaryEntry.findMany({ where: { userId: user.id, date: dayToDate(daySchema.parse(fromDay)) } });
  if (entries.length === 0) return { error: "Nothing was logged that day." };
  await db.diaryEntry.createMany({
    data: entries.map((e) => ({ userId: user.id, foodId: e.foodId, meal: e.meal, servings: e.servings, date: dayToDate(daySchema.parse(toDay)) })),
  });
  revalidatePath("/diary");
  return { ok: true, count: entries.length };
}
