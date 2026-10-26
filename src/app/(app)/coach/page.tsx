import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { CoachProgramProposal, CoachProposal } from "@/lib/ai/coach";
import { CoachChat } from "./CoachChat";

// AI answers can take a while; give server actions on this page up to 5 minutes
export const maxDuration = 300;

export const metadata: Metadata = { title: "Coach" };

// /coach opens your most recent chat (or a new one); /coach?c=<id> opens a
// specific chat; /coach?new=1 starts fresh.
export default async function CoachPage({ searchParams }: { searchParams: Promise<{ c?: string; new?: string }> }) {
  const user = await requireUser();
  const { c, new: fresh } = await searchParams;
  const chat = fresh
    ? null
    : c
      ? await db.coachConversation.findFirst({ where: { id: c, userId: user.id } })
      : await db.coachConversation.findFirst({ where: { userId: user.id, updatedAt: { gte: hoursAgo(12) } }, orderBy: { updatedAt: "desc" } });
  const [messages, notes] = await Promise.all([
    chat ? db.coachMessage.findMany({ where: { conversationId: chat.id }, orderBy: { createdAt: "asc" }, take: 200 }) : Promise.resolve([]),
    db.coachNote.findMany({ where: { userId: user.id, active: true }, orderBy: { createdAt: "asc" } }),
  ]);
  return (
    <CoachChat
      key={chat?.id ?? "new"}
      chat={chat ? { id: chat.id, title: chat.title } : null}
      initialMessages={messages.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        proposal: (m.proposal as CoachProposal | CoachProgramProposal | null) ?? null,
      }))}
      notes={notes.map((n) => ({ id: n.id, kind: n.kind, text: n.text }))}
    />
  );
}

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 3600_000);
}
