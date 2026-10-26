import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { getUserPrefs } from "@/lib/userPrefs";
import { addDays, startOfWeek, weeksAgo } from "@/lib/fitness/dates";
import { setsPerMuscle, type Contribution } from "@/lib/fitness/muscles";
import {
  bestSet,
  estimateOneRepMax,
  totalVolumeKg,
  type LoggedSet,
  type PersonalRecords,
} from "@/lib/fitness/strength";

// Every exported function here takes the signed-in user's id, which callers
// get from requireUser(). Queries always filter by that id, so one user can
// never read another user's workouts.

export type ExerciseOption = {
  id: string;
  slug: string;
  name: string;
  equipment: string | null;
  primaryMuscles: string[];
  image: string | null;
  aliases: string[];
  custom?: boolean; // made by this user
};

const IMAGE_BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";

export function exerciseImageUrl(path: string | undefined | null) {
  return path ? IMAGE_BASE + path : null;
}

/** The whole exercise library. Same for everyone, so it's cached. */
export async function getExerciseLibrary(): Promise<ExerciseOption[]> {
  "use cache";
  cacheLife("days");
  cacheTag("exercise-library");

  const rows = await db.exercise.findMany({
    where: { createdById: null },
    orderBy: { name: "asc" },
    select: { id: true, slug: true, name: true, equipment: true, primaryMuscles: true, images: true, aliases: true },
  });
  return rows.map(({ images, ...r }) => ({ ...r, image: exerciseImageUrl(images[0]) }));
}

/** The shared library plus exercises this user created (theirs listed first). */
export async function getExerciseOptions(userId: string): Promise<ExerciseOption[]> {
  const [library, mine] = await Promise.all([
    getExerciseLibrary(),
    db.exercise.findMany({
      where: { createdById: userId },
      orderBy: { name: "asc" },
      select: { id: true, slug: true, name: true, equipment: true, primaryMuscles: true, aliases: true },
    }),
  ]);
  return [...mine.map((m) => ({ ...m, image: null, custom: true })), ...library];
}

export async function getUnitSystem(userId: string) {
  return (await getUserPrefs(userId)).unitSystem; // shared, cached per request
}

export async function getActiveWorkout(userId: string) {
  return db.workout.findFirst({
    where: { userId, endedAt: null },
    orderBy: { startedAt: "desc" },
    select: { id: true, name: true, startedAt: true },
  });
}

/** Your programs (pinned first, then your order), each with its routines, plus standalone routines. */
export async function getTrainingPlan(userId: string) {
  const [programs, routines] = await Promise.all([
    db.program.findMany({ where: { userId }, orderBy: [{ pinned: "desc" }, { position: "asc" }, { createdAt: "asc" }] }),
    getRoutines(userId),
  ]);
  return {
    programs: programs.map((p) => ({ ...p, routines: routines.filter((r) => r.programId === p.id) })),
    standalone: routines.filter((r) => !r.programId),
  };
}

export async function getRoutines(userId: string) {
  return db.routine.findMany({
    where: { userId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    include: {
      exercises: {
        orderBy: { order: "asc" },
        include: { exercise: { select: { name: true, primaryMuscles: true } } },
      },
    },
  });
}

export async function getRoutine(userId: string, routineId: string) {
  return db.routine.findFirst({
    where: { id: routineId, userId },
    include: {
      exercises: {
        orderBy: { order: "asc" },
        include: { exercise: { select: { id: true, name: true, primaryMuscles: true, equipment: true, images: true } } },
      },
    },
  });
}

const finishedWorkoutInclude = {
  exercises: {
    orderBy: { order: "asc" as const },
    include: {
      exercise: { select: { id: true, slug: true, name: true, primaryMuscles: true, secondaryMuscles: true } },
      sets: { orderBy: { order: "asc" as const } },
    },
  },
};

function summarize(workout: {
  startedAt: Date;
  endedAt: Date | null;
  exercises: { sets: LoggedSet[] }[];
}) {
  const allSets = workout.exercises.flatMap((e) => e.sets);
  return {
    volumeKg: totalVolumeKg(allSets),
    setCount: allSets.filter((s) => s.type !== "WARMUP").length,
    durationMs: (workout.endedAt ?? workout.startedAt).getTime() - workout.startedAt.getTime(),
  };
}

export async function getRecentWorkouts(userId: string, take = 5) {
  const workouts = await db.workout.findMany({
    where: { userId, endedAt: { not: null } },
    orderBy: { startedAt: "desc" },
    take,
    include: finishedWorkoutInclude,
  });
  return workouts.map((w) => ({ ...w, ...summarize(w) }));
}

/** Training days and volume for the current Monday–Sunday week. */
export async function getThisWeek(userId: string, now: Date) {
  const weekStart = startOfWeek(now);
  const workouts = await db.workout.findMany({
    where: { userId, endedAt: { not: null }, startedAt: { gte: weekStart } },
    include: { exercises: { include: { sets: true } } },
  });

  const days = Array.from({ length: 7 }, (_, i) => ({
    date: addDays(weekStart, i),
    volumeKg: 0,
    workouts: 0,
  }));
  for (const w of workouts) {
    const index = Math.floor((w.startedAt.getTime() - weekStart.getTime()) / 86_400_000);
    const day = days[Math.min(6, Math.max(0, index))];
    day.workouts += 1;
    day.volumeKg += totalVolumeKg(w.exercises.flatMap((e) => e.sets));
  }
  return {
    days,
    workouts: workouts.length,
    volumeKg: days.reduce((s, d) => s + d.volumeKg, 0),
    sets: workouts.flatMap((w) => w.exercises.flatMap((e) => e.sets)).filter((s) => s.type !== "WARMUP").length,
  };
}

/** The workout being logged, plus what the lifter did last time for each exercise. */
export async function getWorkoutForLogging(userId: string, workoutId: string) {
  const workout = await db.workout.findFirst({
    where: { id: workoutId, userId },
    include: {
      routine: { include: { exercises: true } },
      exercises: {
        orderBy: { order: "asc" },
        include: {
          exercise: { select: { id: true, name: true, primaryMuscles: true, equipment: true, images: true } },
          sets: { orderBy: { order: "asc" } },
        },
      },
    },
  });
  if (!workout) return null;

  const previous = await getPreviousSets(
    userId,
    workout.exercises.map((e) => e.exerciseId),
    workout.startedAt,
  );
  return { workout, previous };
}

/** For each exercise, the sets from the most recent finished workout that included it. */
export async function getPreviousSets(userId: string, exerciseIds: string[], before: Date) {
  const result: Record<string, { weightKg: number | null; reps: number | null; type: string }[]> = {};
  if (exerciseIds.length === 0) return result;

  const rows = await db.workoutExercise.findMany({
    where: {
      exerciseId: { in: exerciseIds },
      workout: { userId, endedAt: { not: null }, startedAt: { lt: before } },
    },
    orderBy: { workout: { startedAt: "desc" } },
    include: { sets: { orderBy: { order: "asc" } } },
  });
  for (const row of rows) {
    if (!result[row.exerciseId]) {
      result[row.exerciseId] = row.sets.map((s) => ({ weightKg: s.weightKg, reps: s.reps, type: s.type }));
    }
  }
  return result;
}


/** Best-ever numbers per exercise from workouts before a given time. */
async function getRecordsBefore(userId: string, exerciseIds: string[], before: Date) {
  const sets = await db.workoutSet.findMany({
    where: {
      type: { not: "WARMUP" },
      weightKg: { gt: 0 },
      reps: { gt: 0 },
      workoutExercise: {
        exerciseId: { in: exerciseIds },
        workout: { userId, endedAt: { not: null }, startedAt: { lt: before } },
      },
    },
    select: { weightKg: true, reps: true, workoutExercise: { select: { exerciseId: true } } },
  });

  const records: Record<string, PersonalRecords> = {};
  for (const id of exerciseIds) records[id] = { heaviestKg: 0, bestE1rmKg: 0, bestSetVolumeKg: 0 };
  for (const s of sets) {
    const r = records[s.workoutExercise.exerciseId];
    const w = s.weightKg ?? 0;
    const reps = s.reps ?? 0;
    r.heaviestKg = Math.max(r.heaviestKg, w);
    r.bestE1rmKg = Math.max(r.bestE1rmKg, estimateOneRepMax(w, reps));
    r.bestSetVolumeKg = Math.max(r.bestSetVolumeKg, w * reps);
  }
  return records;
}

export async function getFinishedWorkout(userId: string, workoutId: string) {
  const workout = await db.workout.findFirst({
    where: { id: workoutId, userId, endedAt: { not: null } },
    include: finishedWorkoutInclude,
  });
  if (!workout) return null;
  const records = await getRecordsBefore(
    userId,
    workout.exercises.map((e) => e.exerciseId),
    workout.startedAt,
  );
  return { workout: { ...workout, ...summarize(workout) }, records };
}

export async function getExerciseDetail(userId: string, slug: string) {
  const exercise = await db.exercise.findFirst({
    where: { slug, OR: [{ createdById: null }, { createdById: userId }] },
  });
  if (!exercise) return null;

  const history = await db.workoutExercise.findMany({
    where: { exerciseId: exercise.id, workout: { userId, endedAt: { not: null } } },
    orderBy: { workout: { startedAt: "asc" } },
    include: { workout: { select: { id: true, name: true, startedAt: true } }, sets: { orderBy: { order: "asc" } } },
  });

  const sessions = history
    .map((h) => ({ workout: h.workout, sets: h.sets, best: bestSet(h.sets) }))
    .filter((s) => s.best);

  return { exercise, sessions };
}

/** Everything the Progress tab draws. */
export async function getProgress(userId: string, now: Date) {
  const eightWeeksAgo = addDays(startOfWeek(now), -7 * 7);
  const workouts = await db.workout.findMany({
    where: { userId, endedAt: { not: null }, startedAt: { gte: eightWeeksAgo } },
    include: finishedWorkoutInclude,
  });

  const weeks = Array.from({ length: 8 }, (_, i) => ({
    weekStart: addDays(startOfWeek(now), -7 * (7 - i)),
    volumeKg: 0,
    workouts: 0,
  }));
  for (const w of workouts) {
    const ago = weeksAgo(w.startedAt, now);
    const week = weeks[7 - ago];
    if (!week) continue;
    week.workouts += 1;
    week.volumeKg += totalVolumeKg(w.exercises.flatMap((e) => e.sets));
  }

  const sevenDaysAgo = addDays(now, -7);
  const muscles = setsPerMuscle(
    workouts
      .filter((w) => w.startedAt >= sevenDaysAgo)
      .flatMap((w) =>
        w.exercises.map((e) => ({
          primaryMuscles: e.exercise.primaryMuscles,
          secondaryMuscles: e.exercise.secondaryMuscles,
          workingSets: e.sets.filter((s) => s.type !== "WARMUP").length,
        })),
      ),
  );

  const bodyweights = await db.bodyweightEntry.findMany({
    where: { userId, date: { gte: addDays(now, -120) } },
    orderBy: { date: "asc" },
  });

  // Best estimated 1RM per exercise across all time, top 5
  const allSets = await db.workoutSet.findMany({
    where: {
      type: { not: "WARMUP" },
      weightKg: { gt: 0 },
      reps: { gt: 0 },
      workoutExercise: { workout: { userId, endedAt: { not: null } } },
    },
    select: {
      weightKg: true,
      reps: true,
      workoutExercise: { select: { exercise: { select: { id: true, slug: true, name: true } } } },
    },
  });
  const best = new Map<string, { slug: string; name: string; e1rmKg: number; weightKg: number; reps: number }>();
  for (const s of allSets) {
    const ex = s.workoutExercise.exercise;
    const e1rm = estimateOneRepMax(s.weightKg ?? 0, s.reps ?? 0);
    const current = best.get(ex.id);
    if (!current || e1rm > current.e1rmKg) {
      best.set(ex.id, { slug: ex.slug, name: ex.name, e1rmKg: e1rm, weightKg: s.weightKg ?? 0, reps: s.reps ?? 0 });
    }
  }
  const topLifts = [...best.values()].sort((a, b) => b.e1rmKg - a.e1rmKg).slice(0, 5);

  // Every working set from the last two weeks, so the muscle map can show
  // exactly which sets went into each muscle (this week, last week, last 7 days)
  const twoWeeksAgo = addDays(startOfWeek(now), -7);
  const contributions: Contribution[] = workouts
    .filter((w) => w.startedAt >= twoWeeksAgo)
    .flatMap((w) =>
      w.exercises.map((e) => ({
        workoutId: w.id,
        workoutName: w.name,
        date: w.startedAt.toISOString(),
        exercise: e.exercise.name,
        primaryMuscles: e.exercise.primaryMuscles,
        secondaryMuscles: e.exercise.secondaryMuscles,
        sets: e.sets.filter((s) => s.type !== "WARMUP").map((s) => ({ weightKg: s.weightKg, reps: s.reps, type: s.type })),
      })),
    );
  const windows = { thisWeek: startOfWeek(now).toISOString(), lastWeek: twoWeeksAgo.toISOString(), now: now.toISOString() };

  return { weeks, muscles, bodyweights, topLifts, totalWorkouts: workouts.length, contributions, windows };
}
