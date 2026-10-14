import "server-only";
import { exerciseImageUrl, getExerciseLibrary, getUnitSystem, getWorkoutForLogging } from "@/lib/training";
import { toDisplayPrevious } from "@/lib/training-display";
import { displayWeight, weightUnit } from "@/lib/fitness/units";

/** Everything the workout logger needs, shared by the live and edit screens. */
export async function loadLoggerProps(userId: string, workoutId: string) {
  const [data, library, unitSystem] = await Promise.all([
    getWorkoutForLogging(userId, workoutId),
    getExerciseLibrary(),
    getUnitSystem(userId),
  ]);
  if (!data) return null;
  const { workout, previous } = data;
  const restFor = (exerciseId: string) =>
    workout.routine?.exercises.find((r) => r.exerciseId === exerciseId)?.restSeconds ?? 90;

  return {
    ended: workout.endedAt !== null,
    props: {
      workout: {
        id: workout.id,
        name: workout.name,
        startedAt: workout.startedAt.toISOString(),
        updatedAt: workout.updatedAt.toISOString(),
      },
      unit: weightUnit(unitSystem),
      library,
      initialPrevious: toDisplayPrevious(previous, unitSystem),
      initialExercises: workout.exercises.map((e) => ({
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
      })),
    },
  };
}
