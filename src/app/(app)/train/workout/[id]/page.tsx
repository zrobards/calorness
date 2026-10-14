import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { WorkoutLoggerClient } from "@/components/train/WorkoutLoggerClient";
import { requireUser } from "@/lib/auth";
import { exerciseImageUrl, getExerciseLibrary, getUnitSystem, getWorkoutForLogging } from "@/lib/training";
import { toDisplayPrevious } from "@/lib/training-display";
import { displayWeight, weightUnit } from "@/lib/fitness/units";

export const metadata: Metadata = { title: "Workout" };

export default async function WorkoutPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const [data, library, unitSystem] = await Promise.all([
    getWorkoutForLogging(user.id, id),
    getExerciseLibrary(),
    getUnitSystem(user.id),
  ]);
  if (!data) notFound();
  if (data.workout.endedAt) redirect(`/train/history/${id}`);

  const { workout, previous } = data;
  const restFor = (exerciseId: string) =>
    workout.routine?.exercises.find((r) => r.exerciseId === exerciseId)?.restSeconds ?? 90;

  return (
    <WorkoutLoggerClient
      workout={{ id: workout.id, name: workout.name, startedAt: workout.startedAt.toISOString() }}
      unit={weightUnit(unitSystem)}
      library={library}
      initialPrevious={toDisplayPrevious(previous, unitSystem)}
      initialExercises={workout.exercises.map((e) => ({
        key: e.id,
        exerciseId: e.exerciseId,
        name: e.exercise.name,
        muscles: e.exercise.primaryMuscles,
        image: exerciseImageUrl(e.exercise.images[0]),
        restSeconds: restFor(e.exerciseId),
        sets: e.sets.map((s) => ({
          id: s.id,
          type: s.type,
          weight: s.weightKg === null ? null : displayWeight(s.weightKg, unitSystem),
          reps: s.reps,
          completed: s.completed,
        })),
      }))}
    />
  );
}
