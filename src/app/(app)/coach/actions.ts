"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { aiConfigured } from "@/lib/ai/foodVision";
import { consumeAiQuota } from "@/lib/aiLimit";
import { runCoach, type CoachProposal } from "@/lib/ai/coach";
import { ClaudeError } from "@/lib/ai/claude";

export async function sendCoachMessage(text: string) {
  const user = await requireUser();
  const message = z.string().trim().min(1).max(1000).safeParse(text);
  if (!message.success) return { error: "Type a message first." };
  if (!aiConfigured()) return { error: "Coach needs the AI key set up in Vercel." };
  const allowed = await consumeAiQuota(user.id, "coach");
  if ("error" in allowed) return { error: allowed.error };

  // The last 12 messages give the coach the thread without growing forever
  const history = (await db.coachMessage.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 12 }))
    .reverse()
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  await db.coachMessage.create({ data: { userId: user.id, role: "user", content: message.data } });
  try {
    const { reply, proposal, notesChanged } = await runCoach(user.id, history, message.data);
    const saved = await db.coachMessage.create({
      data: { userId: user.id, role: "assistant", content: reply, proposal: proposal ?? undefined },
    });
    revalidatePath("/coach");
    return { id: saved.id, reply, proposal, notesChanged };
  } catch (e) {
    return { error: e instanceof ClaudeError ? e.userMessage : "Coach couldn't answer right now. Try again in a moment." };
  }
}

/** Apply a suggested routine: replace the routine it reworks, or save it as a new one. */
export async function applyProposal(messageId: string, mode: "replace" | "new") {
  const user = await requireUser();
  const msg = await db.coachMessage.findFirst({ where: { id: messageId, userId: user.id } });
  const p = msg?.proposal as CoachProposal | null | undefined;
  if (!p || p.exercises.length === 0) return { error: "That suggestion is no longer available." };

  const rows = p.exercises.map((e, order) => ({
    exerciseId: e.exerciseId,
    order,
    targetSets: e.sets,
    targetRepsMin: e.repMin,
    targetRepsMax: e.repMax,
    restSeconds: e.restSeconds,
  }));

  if (mode === "replace" && p.replacesRoutineId) {
    const existing = await db.routine.findFirst({ where: { id: p.replacesRoutineId, userId: user.id } });
    if (!existing) return { error: "The original routine is gone. Save it as new instead." };
    await db.$transaction([
      db.routineExercise.deleteMany({ where: { routineId: existing.id } }),
      db.routine.update({ where: { id: existing.id }, data: { notes: p.reason || existing.notes, exercises: { create: rows } } }),
    ]);
  } else {
    const position = await db.routine.count({ where: { userId: user.id } });
    await db.routine.create({ data: { userId: user.id, name: p.name, notes: p.reason, position, exercises: { create: rows } } });
  }
  revalidatePath("/train");
  return { ok: true };
}

export async function forgetNote(id: string) {
  const user = await requireUser();
  await db.coachNote.updateMany({ where: { id, userId: user.id }, data: { active: false } });
  revalidatePath("/coach");
  revalidatePath("/train");
}

export async function clearCoachChat() {
  const user = await requireUser();
  await db.coachMessage.deleteMany({ where: { userId: user.id } });
  revalidatePath("/coach");
}
