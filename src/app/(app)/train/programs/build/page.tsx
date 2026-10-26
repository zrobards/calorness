import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getExerciseOptions } from "@/lib/training";
import type { CoachProgramProposal } from "@/lib/ai/coach";
import { ProgramBuilder } from "./ProgramBuilder";

// AI answers can take a while; give server actions on this page up to 5 minutes
export const maxDuration = 300;

export const metadata: Metadata = { title: "Build a program" };

export default async function BuildProgramPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const user = await requireUser();
  const { from } = await searchParams;
  const [library, notes, message] = await Promise.all([
    getExerciseOptions(user.id),
    db.coachNote.findMany({ where: { userId: user.id, active: true, kind: "injury" }, select: { text: true } }),
    from ? db.coachMessage.findFirst({ where: { id: from, userId: user.id }, select: { proposal: true } }) : null,
  ]);
  const p = message?.proposal as CoachProgramProposal | null | undefined;
  return (
    <ProgramBuilder
      library={library}
      initialDraft={p?.kind === "program" ? p.draft : null}
      avoid={notes.map((n) => n.text).join("; ")}
    />
  );
}
