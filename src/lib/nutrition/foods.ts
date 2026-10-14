import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";

export const candidateSchema = z.object({
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
export async function ensureFood(userId: string, candidate: z.infer<typeof candidateSchema>) {
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

