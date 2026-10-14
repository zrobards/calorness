"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { lookupBarcodeOnline, searchOpenFoodFacts, searchUsda } from "@/lib/nutrition/sources";
import { findFoodByBarcode, searchSavedFoods, dayToDate, MEALS, toCandidate } from "@/lib/nutrition/diary";
import { normalizeBarcode, type FoodCandidate } from "@/lib/nutrition/normalize";

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

  const [saved, usda, off] = await Promise.all([
    searchSavedFoods(user.id, q.data),
    searchUsda(q.data),
    searchOpenFoodFacts(q.data),
  ]);

  // Interleave the two outside sources so neither drowns out the other,
  // and drop anything we already listed from the saved foods
  const seen = new Set(saved.map((f) => `${f.source}:${f.externalId}`));
  const merged: FoodCandidate[] = [...saved];
  // Generic USDA foods (no brand) lead, then branded results alternate by source
  for (const f of usda.filter((x) => !x.brand)) {
    seen.add(`${f.source}:${f.externalId}`);
    merged.push(f);
  }
  for (let i = 0; i < Math.max(usda.length, off.length); i++) {
    for (const f of [usda[i], off[i]]) {
      if (f && !seen.has(`${f.source}:${f.externalId}`)) {
        seen.add(`${f.source}:${f.externalId}`);
        merged.push(f);
      }
    }
  }
  return { foods: merged.slice(0, 40) };
}

export async function lookupBarcode(code: string) {
  const user = await requireUser();
  const barcode = normalizeBarcode(z.string().max(20).parse(code));
  if (barcode.length < 8) return { food: null, barcode };
  const food = (await findFoodByBarcode(user.id, barcode)) ?? (await lookupBarcodeOnline(barcode));
  return { food, barcode };
}

// ─── Logging ──────────────────────────────────────────────────────────────

const candidateSchema = z.object({
  id: z.string().optional(),
  source: z.enum(["USDA", "OPEN_FOOD_FACTS", "CUSTOM", "AI_ESTIMATE"]),
  externalId: z.string().nullable(),
  barcode: z.string().nullable(),
  name: z.string().min(1).max(200),
  brand: z.string().max(200).nullable(),
  servingSize: z.number().positive(),
  servingUnit: z.string().max(20),
  servingLabel: z.string().max(100).nullable(),
  calories: z.number().min(0).max(10000),
  proteinG: z.number().min(0).max(1000),
  carbsG: z.number().min(0).max(1000),
  fatG: z.number().min(0).max(1000),
  fiberG: z.number().min(0).max(1000).nullable(),
  sugarG: z.number().min(0).max(1000).nullable(),
  sodiumMg: z.number().min(0).max(100000).nullable(),
});

/** Save a food from search results so diary entries can point at it. */
async function ensureFood(userId: string, candidate: z.infer<typeof candidateSchema>) {
  if (candidate.id) {
    const existing = await db.food.findFirst({
      where: { id: candidate.id, OR: [{ createdById: null }, { createdById: userId }] },
    });
    if (existing) return existing.id;
  }
  if (candidate.source === "CUSTOM" || candidate.source === "AI_ESTIMATE" || !candidate.externalId) throw new Error("Unknown food");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, ...data } = candidate;
  const food = await db.food.upsert({
    where: { source_externalId: { source: candidate.source, externalId: candidate.externalId } },
    update: {},
    create: data,
  });
  return food.id;
}

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
