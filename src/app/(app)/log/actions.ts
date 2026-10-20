"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { estimateFoods, readLabel } from "@/lib/ai/foodVision";
import { aiFoodItemSchema } from "@/lib/ai/parse";
import { dayToDate, MEALS } from "@/lib/nutrition/diary";
import { saveAiItems } from "@/lib/nutrition/aiLog";
import { groundItems } from "@/lib/ai/ground";
import { consumeAiQuota } from "@/lib/aiLimit";
import { candidateSchema, ensureFood } from "@/lib/nutrition/foods";

const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Photo and/or text → estimated foods for the user to review. Nothing is saved yet. */
export async function aiEstimate(input: {
  imageBase64?: string;
  mediaType?: string;
  text?: string;
  previous?: unknown[];
  correction?: string;
}) {
  const user = await requireUser();
  const parsed = z
    .object({
      imageBase64: z.string().max(1_400_000).optional(), // ~1 MB image after resizing on the phone
      mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]).optional(),
      text: z.string().max(500).optional(),
      previous: z.array(aiFoodItemSchema).max(15).optional(),
      correction: z.string().max(500).optional(),
    })
    .safeParse(input);
  if (!parsed.success || (!parsed.data.imageBase64 && !parsed.data.text?.trim())) {
    return { error: "Add a photo or describe what you ate." };
  }
  const { imageBase64, mediaType, text, previous, correction } = parsed.data;
  const allowed = await consumeAiQuota(user.id, correction ? "recheck" : imageBase64 ? "photo" : "describe");
  if ("error" in allowed) return { error: allowed.error };
  const result = await estimateFoods({
    image: imageBase64 ? { base64: imageBase64, mediaType: mediaType ?? "image/jpeg" } : undefined,
    text,
    previous,
    correction,
  });
  if ("error" in result) return result;
  // Packaged foods: swap the guess for the real label values when we can find the product
  return { ...result, items: await groundItems(user.id, result.items) };
}

/** Save reviewed AI estimates as foods and log them in one go. */
export async function logAiItems(input: { day: string; meal: string; items: unknown[] }) {
  const user = await requireUser();
  const parsed = z
    .object({
      day: daySchema,
      meal: z.enum(MEALS),
      items: z
        .array(
          aiFoodItemSchema.extend({
            // set when the user picked the real product from the database
            match: z.object({ food: candidateSchema, servings: z.number().positive().max(50) }).optional(),
            // set when the user typed their own numbers
            edited: z.boolean().optional(),
          }),
        )
        .min(1)
        .max(20),
    })
    .safeParse(input);
  if (!parsed.success) return { error: "Something in that list doesn't look right." };
  const { day, meal, items } = parsed.data;

  // Matched foods: make sure each exists, then add them all in one write
  const matched = items.filter((i) => i.match);
  const foodIds = await Promise.all(matched.map((i) => ensureFood(user.id, i.match!.food)));
  if (matched.length)
    await db.diaryEntry.createMany({
      data: matched.map((i, n) => ({ userId: user.id, foodId: foodIds[n], servings: i.match!.servings, meal, date: dayToDate(day) })),
    });
  await saveAiItems(user.id, day, meal, items.filter((i) => !i.match));
  revalidatePath("/diary");
  revalidatePath("/log");
  return { ok: true, count: items.length };
}

/** One tap: log a food again with the same amount as last time. Returns the entry id for Undo. */
export async function quickRelog(input: { foodId: string; servings: number; day: string; meal: string }) {
  const user = await requireUser();
  const { foodId, servings, day, meal } = z
    .object({ foodId: z.string(), servings: z.number().positive().max(100), day: daySchema, meal: z.enum(MEALS) })
    .parse(input);
  const food = await db.food.findFirst({ where: { id: foodId, OR: [{ createdById: null }, { createdById: user.id }, { shared: true }] } });
  if (!food) return { error: "That food is gone." };
  const entry = await db.diaryEntry.create({ data: { userId: user.id, foodId, servings, meal, date: dayToDate(day) } });
  revalidatePath("/diary");
  return { entryId: entry.id, calories: Math.round(food.calories * servings) };
}

/** Photo of a Nutrition Facts panel → exact per-serving numbers to confirm and save. */
export async function scanLabel(input: { imageBase64: string; mediaType: string }) {
  const user = await requireUser();
  const parsed = z
    .object({ imageBase64: z.string().min(10).max(1_400_000), mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]) })
    .safeParse(input);
  if (!parsed.success) return { error: "Couldn't read that photo." };
  const allowed = await consumeAiQuota(user.id, "label");
  if ("error" in allowed) return { error: allowed.error };
  return readLabel({ base64: parsed.data.imageBase64, mediaType: parsed.data.mediaType });
}
