import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { RoutineEditor } from "@/components/train/RoutineEditor";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { exerciseImageUrl, getExerciseOptions, getRoutine } from "@/lib/training";
import { dataKey } from "@/lib/dataKey";

export const metadata: Metadata = { title: "Edit routine" };

export default async function EditRoutinePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const [routine, library, programs] = await Promise.all([
    getRoutine(user.id, id),
    getExerciseOptions(user.id),
    db.program.findMany({ where: { userId: user.id }, orderBy: [{ position: "asc" }], select: { id: true, name: true, pinned: true } }),
  ]);
  if (!routine) notFound();

  return (
    <>
      <PageHeader title="Edit routine">
        <Link href="/train" className="text-sm font-medium text-chalk-muted">Cancel</Link>
      </PageHeader>
      <RoutineEditor
        // starts over from the saved routine whenever it changes (see dataKey)
        key={dataKey([routine.updatedAt, routine.programId, routine.exercises.map((e) => [e.exerciseId, e.targetSets, e.targetRepsMin, e.targetRepsMax, e.restSeconds])])}
        programs={programs}
        initialProgramId={routine.programId}
        library={library}
        routine={{
          id: routine.id,
          version: routine.updatedAt.toISOString(),
          name: routine.name,
          notes: routine.notes,
          exercises: routine.exercises.map((e) => ({
            exerciseId: e.exerciseId,
            name: e.exercise.name,
            muscles: e.exercise.primaryMuscles,
            image: exerciseImageUrl(e.exercise.images[0]),
            targetSets: e.targetSets,
            targetRepsMin: e.targetRepsMin,
            targetRepsMax: e.targetRepsMax,
            restSeconds: e.restSeconds,
          })),
        }}
      />
    </>
  );
}
