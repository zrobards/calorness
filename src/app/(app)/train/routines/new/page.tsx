import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { RoutineEditor } from "@/components/train/RoutineEditor";
import { requireUser } from "@/lib/auth";
import { getExerciseLibrary } from "@/lib/training";

export const metadata: Metadata = { title: "New routine" };

export default async function NewRoutinePage() {
  await requireUser();
  const library = await getExerciseLibrary();
  return (
    <>
      <PageHeader title="New routine">
        <Link href="/train" className="text-sm font-medium text-chalk-muted">Cancel</Link>
      </PageHeader>
      <RoutineEditor library={library} />
    </>
  );
}
