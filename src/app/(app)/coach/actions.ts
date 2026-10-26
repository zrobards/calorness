"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { aiConfigured } from "@/lib/ai/foodVision";
import { consumeAiQuota } from "@/lib/aiLimit";
import { runCoach, type CoachProgramProposal, type CoachProposal } from "@/lib/ai/coach";
import { ClaudeError } from "@/lib/ai/claude";
import { saveProgram } from "@/lib/ai/program";

export type ChatSummary = { id: string; title: string; updatedAt: string; preview: string };

/** Your Coach chats, newest first. */
export async function listChats(): Promise<ChatSummary[]> {
  const user = await requireUser();
  const chats = await db.coachConversation.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: { messages: { orderBy: { createdAt: "desc" }, take: 1, select: { content: true } } },
  });
  return chats.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt.toISOString(), preview: c.messages[0]?.content.slice(0, 90) ?? "" }));
}

/** Send a message in a chat (or start a new chat when there's no id yet). */
export async function sendCoachMessage(text: string, conversationId?: string | null) {
  const user = await requireUser();
  const message = z.string().trim().min(1).max(1000).safeParse(text);
  if (!message.success) return { error: "Type a message first." };
  if (!aiConfigured()) return { error: "Coach needs the AI key set up in Vercel." };

  let chat = conversationId ? await db.coachConversation.findFirst({ where: { id: conversationId, userId: user.id } }) : null;
  const allowed = await consumeAiQuota(user.id, "coach");
  if ("error" in allowed) return { error: allowed.error };
  // A new chat is named after its first message
  if (!chat) {
    const title = message.data.replace(/\s+/g, " ").slice(0, 60) + (message.data.length > 60 ? "…" : "");
    chat = await db.coachConversation.create({ data: { userId: user.id, title } });
  }

  // The last 16 messages of this chat give Coach the thread
  const history = (await db.coachMessage.findMany({ where: { conversationId: chat.id }, orderBy: { createdAt: "desc" }, take: 16 }))
    .reverse()
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  await db.coachMessage.create({ data: { userId: user.id, conversationId: chat.id, role: "user", content: message.data } });
  try {
    const { reply, proposal, notesChanged } = await runCoach(user.id, history, message.data);
    const saved = await db.coachMessage.create({
      data: { userId: user.id, conversationId: chat.id, role: "assistant", content: reply, proposal: proposal ?? undefined },
    });
    await db.coachConversation.update({ where: { id: chat.id }, data: { updatedAt: new Date() } });
    return { id: saved.id, conversationId: chat.id, reply, proposal, notesChanged };
  } catch (e) {
    return { conversationId: chat.id, error: e instanceof ClaudeError ? e.userMessage : "Coach couldn't answer right now. Try again in a moment." };
  }
}

/** Apply a suggested routine: replace the routine it reworks, or save it as a new one. */
export async function applyProposal(messageId: string, mode: "replace" | "new") {
  const user = await requireUser();
  const msg = await db.coachMessage.findFirst({ where: { id: messageId, userId: user.id } });
  const p = msg?.proposal as CoachProposal | null | undefined;
  if (!p || !("exercises" in p) || p.exercises.length === 0) return { error: "That suggestion is no longer available." };

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

/** Save a program Coach suggested, as is. */
export async function saveCoachProgram(messageId: string) {
  const user = await requireUser();
  const msg = await db.coachMessage.findFirst({ where: { id: messageId, userId: user.id } });
  const p = msg?.proposal as CoachProgramProposal | null | undefined;
  if (!p || p.kind !== "program") return { error: "That program is no longer available." };
  await saveProgram(user.id, p.draft);
  revalidatePath("/train");
  return { ok: true };
}

export async function forgetNote(id: string) {
  const user = await requireUser();
  await db.coachNote.updateMany({ where: { id, userId: user.id }, data: { active: false } });
  revalidatePath("/coach");
  revalidatePath("/train");
}

export async function renameChat(id: string, title: string) {
  const user = await requireUser();
  const t = z.string().trim().min(1).max(80).parse(title);
  await db.coachConversation.updateMany({ where: { id, userId: user.id }, data: { title: t } });
}

export async function deleteChat(id: string) {
  const user = await requireUser();
  await db.coachConversation.deleteMany({ where: { id, userId: user.id } });
}
