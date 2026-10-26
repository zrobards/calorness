"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { consumeAiQuota } from "@/lib/aiLimit";
import { aiConfigured } from "@/lib/ai/foodVision";
import { generateProgram, saveProgram, type ProgramDraft } from "@/lib/ai/program";

const prefsSchema = z.object({
  goal: z.string().min(1).max(60),
  daysPerWeek: z.number().int().min(1).max(7),
  minutes: z.number().int().min(15).max(180),
  equipment: z.string().min(1).max(60),
  experience: z.string().min(1).max(30),
  focus: z.array(z.string().max(30)).max(8),
  avoid: z.string().max(300),
});

const draftSchema = z.object({
  name: z.string().trim().min(1).max(60),
  summary: z.string().max(400),
  unmatched: z.array(z.string()).default([]),
  days: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(40),
        exercises: z
          .array(
            z.object({
              exerciseId: z.string().min(1),
              name: z.string(),
              sets: z.number().int().min(1).max(10),
              repMin: z.number().int().min(1).max(100),
              repMax: z.number().int().min(1).max(100),
              restSeconds: z.number().int().min(0).max(600),
              note: z.string().max(120).optional(),
            }),
          )
          .min(1, "Every day needs at least one exercise."),
      }),
    )
    .min(1)
    .max(7),
});

async function guard(userId: string) {
  if (!aiConfigured()) return { error: "The AI isn't set up yet." };
  const allowed = await consumeAiQuota(userId, "coach");
  return "error" in allowed ? { error: allowed.error ?? "Daily AI limit reached." } : null;
}

export async function buildProgram(prefs: z.input<typeof prefsSchema>) {
  const user = await requireUser();
  const p = prefsSchema.safeParse(prefs);
  if (!p.success) return { error: "Pick your goal, days, and equipment." };
  const blocked = await guard(user.id);
  if (blocked) return blocked;
  const r = await generateProgram(user.id, { prefs: p.data });
  return "error" in r ? r : { draft: r };
}

export async function reviseProgram(draft: ProgramDraft, instruction: string) {
  const user = await requireUser();
  const d = draftSchema.safeParse(draft);
  const ask = z.string().trim().min(3).max(300).safeParse(instruction);
  if (!d.success || !ask.success) return { error: "Say what to change." };
  const blocked = await guard(user.id);
  if (blocked) return blocked;
  const r = await generateProgram(user.id, { draft: d.data, instruction: ask.data });
  return "error" in r ? r : { draft: r };
}

export async function saveProgramDraft(draft: ProgramDraft) {
  const user = await requireUser();
  const d = draftSchema.safeParse(draft);
  if (!d.success) return { error: d.error.issues[0]?.message ?? "Check the program." };
  await saveProgram(user.id, d.data);
  revalidatePath("/train");
  return { ok: true };
}
