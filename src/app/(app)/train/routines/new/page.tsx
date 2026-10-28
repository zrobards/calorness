import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { RoutineEditor } from "@/components/train/RoutineEditor";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getExerciseOptions } from "@/lib/training";

export const metadata: Metadata = { title: "New routine" };

export default async function NewRoutinePage() {
  const user = await requireUser();
  const [library, programs] = await Promise.all([
    getExerciseOptions(user.id),
    db.program.findMany({ where: { userId: user.id }, orderBy: [{ position: "asc" }], select: { id: true, name: true, pinned: true } }),
  ]);
  return (
    <>
      <PageHeader title="New routine">
        <Link href="/train" className="text-sm font-medium text-chalk-muted">Cancel</Link>
      </PageHeader>
      <RoutineEditor library={library} programs={programs} />
    </>
  );
}
