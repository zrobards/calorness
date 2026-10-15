import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { CoachProposal } from "@/lib/ai/coach";
import { CoachChat } from "./CoachChat";

export const metadata: Metadata = { title: "Coach" };

export default async function CoachPage() {
  const user = await requireUser();
  const [messages, notes] = await Promise.all([
    db.coachMessage.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" }, take: 60 }),
    db.coachNote.findMany({ where: { userId: user.id, active: true }, orderBy: { createdAt: "asc" } }),
  ]);
  return (
    <CoachChat
      initialMessages={messages.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        proposal: (m.proposal as CoachProposal | null) ?? null,
      }))}
      notes={notes.map((n) => ({ id: n.id, kind: n.kind, text: n.text }))}
    />
  );
}
