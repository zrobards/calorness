"use server";

import { z } from "zod";
import { revalidatePath, updateTag } from "next/cache";
import { requireUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { requireAdmin } from "@/lib/adminData";
import { db } from "@/lib/db";
import { cleanModel, coachModel, textModel, visionModel } from "@/lib/ai/claude";


/** Owner tool: send a tiny request with each configured model and report which ones work. */
export async function checkAi() {
  const user = await requireUser();
  if (!isAdmin(user.email)) return [];
  const settings = [
    { name: "Photos and labels (AI_VISION_MODEL)", raw: process.env.AI_VISION_MODEL, model: visionModel() },
    { name: "Describe (AI_MODEL)", raw: process.env.AI_MODEL, model: textModel() },
    { name: "Coach (AI_COACH_MODEL)", raw: process.env.AI_COACH_MODEL, model: coachModel() },
  ];
  const base = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";
  return Promise.all(
    settings.map(async (s) => {
      // Test exactly what's typed in Vercel, so typos show up here instead of hiding behind the fallback
      const tested = s.raw ? s.raw : s.model;
      const ignored = !!s.raw && !cleanModel(s.raw);
      try {
        const res = await fetch(`${base}/v1/messages`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY ?? "", "anthropic-version": "2023-06-01" },
          body: JSON.stringify({ model: cleanModel(tested) ?? tested, max_tokens: 5, messages: [{ role: "user", content: "Say OK" }] }),
          signal: AbortSignal.timeout(20_000),
        });
        const detail = res.ok ? "" : (await res.text().catch(() => "")).slice(0, 160);
        return { name: s.name, value: tested, inUse: s.model, ok: res.ok, status: res.status, detail, ignored };
      } catch {
        return { name: s.name, value: tested, inUse: s.model, ok: false, status: 0, detail: "No response", ignored };
      }
    }),
  );
}

// ─── Food database ─────────────────────────────────────────────────────────

const foodEdit = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  brand: z.string().trim().max(80).nullable(),
  servingLabel: z.string().trim().max(80).nullable(),
  servingSize: z.number().positive().max(5000),
  servingUnit: z.string().trim().min(1).max(20),
  calories: z.number().min(0).max(5000),
  proteinG: z.number().min(0).max(500),
  carbsG: z.number().min(0).max(1000),
  fatG: z.number().min(0).max(500),
  hidden: z.boolean(),
});

/** Fix a shared food's name or numbers, or hide it from search. Private foods can't be edited here. */
export async function saveFood(input: z.input<typeof foodEdit>) {
  await requireAdmin();
  const p = foodEdit.safeParse(input);
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Check the numbers." };
  const { id, ...data } = p.data;
  const food = await db.food.findFirst({ where: { id, OR: [{ createdById: null }, { shared: true }] }, select: { hidden: true } });
  if (!food) return { error: "That food is private or gone." };
  await db.food.update({ where: { id }, data: { ...data, brand: data.brand || null, servingLabel: data.servingLabel || null } });
  if (food.hidden !== data.hidden) updateTag("hidden-foods");
  revalidatePath("/admin/foods");
  return { ok: true as const };
}

/** Turn foods several people typed into one shared community food (median of their numbers). */
export async function approveSubmission(key: string) {
  await requireAdmin();
  const subs = await db.foodSubmission.findMany({ where: { key: z.string().min(1).parse(key) }, orderBy: { createdAt: "desc" }, take: 200 });
  if (!subs.length) return { error: "Nothing to approve." };
  const median = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return Math.round((s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) * 10) / 10;
  };
  // use the serving most people described, and the median numbers for it
  const serving = [...subs.reduce((m, s) => m.set(`${s.servingSize}|${s.servingUnit}`, [...(m.get(`${s.servingSize}|${s.servingUnit}`) ?? []), s]), new Map<string, typeof subs>()).values()].sort((a, b) => b.length - a.length)[0];
  const first = serving[0];
  const data = {
    name: first.name,
    brand: first.brand,
    servingLabel: first.servingLabel,
    servingSize: first.servingSize,
    servingUnit: first.servingUnit,
    calories: median(serving.map((s) => s.calories)),
    proteinG: median(serving.map((s) => s.proteinG)),
    carbsG: median(serving.map((s) => s.carbsG)),
    fatG: median(serving.map((s) => s.fatG)),
    confirmations: new Set(subs.map((s) => s.userId)).size,
  };
  await db.food.upsert({ where: { source_externalId: { source: "COMMUNITY", externalId: key } }, update: data, create: { ...data, source: "COMMUNITY", externalId: key } });
  // (no page refresh here: the row shows "Shared" until you come back)
  return { ok: true as const };
}

// ─── Exercise library ──────────────────────────────────────────────────────

const CATEGORIES = ["STRENGTH", "CARDIO", "STRETCHING", "PLYOMETRICS"] as const;
const exerciseDetails = z.object({
  name: z.string().trim().min(2).max(80),
  aliases: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  primaryMuscles: z.array(z.string().trim().min(1).max(30)).min(1, "Pick at least one main muscle.").max(4),
  secondaryMuscles: z.array(z.string().trim().min(1).max(30)).max(8).default([]),
  equipment: z.string().trim().max(30).nullable(),
  category: z.enum(CATEGORIES),
});

export async function saveLibraryExercise(id: string | null, input: z.input<typeof exerciseDetails>) {
  await requireAdmin();
  const p = exerciseDetails.safeParse(input);
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Check the details." };
  const data = { ...p.data, equipment: p.data.equipment || null };
  if (id) {
    const found = await db.exercise.findFirst({ where: { id, createdById: null }, select: { id: true } });
    if (!found) return { error: "That exercise is gone." };
    await db.exercise.update({ where: { id }, data });
  } else {
    const { publishExercise } = await import("@/lib/exerciseLibrary");
    const made = await publishExercise([], data);
    if (data.aliases.length) await db.exercise.update({ where: { id: made.id }, data: { aliases: data.aliases } });
  }
  updateTag("exercise-library");
  revalidatePath("/admin/exercises");
  return { ok: true as const };
}

/** Add people's own exercise (everyone who made one with this name) to the library. */
export async function publishCommunityExercise(ids: string[], input: z.input<typeof exerciseDetails>) {
  await requireAdmin();
  const p = exerciseDetails.safeParse(input);
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Check the details." };
  const { publishExercise } = await import("@/lib/exerciseLibrary");
  const r = await publishExercise(z.array(z.string()).max(500).parse(ids), { ...p.data, equipment: p.data.equipment || null });
  return { ok: true as const, moved: r.moved };
}

/** Fold people's own exercise into one that's already in the library. */
export async function mergeCommunityExercise(ids: string[], libraryId: string, alias: string) {
  await requireAdmin();
  const { mergeIntoLibrary } = await import("@/lib/exerciseLibrary");
  const r = await mergeIntoLibrary(z.array(z.string()).max(500).parse(ids), z.string().min(1).parse(libraryId), z.string().trim().min(1).max(80).parse(alias));
  return r;
}
