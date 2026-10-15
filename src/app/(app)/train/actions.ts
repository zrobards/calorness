"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { toKg, type UnitSystem } from "@/lib/fitness/units";
import type { Prisma } from "@prisma/client";
import { TEMPLATES } from "@/lib/templates";
import { getPreviousSets, getUnitSystem } from "@/lib/training";
import { toDisplayPrevious } from "@/lib/training-display";

// ─── Routines ─────────────────────────────────────────────────────────────

const routineSchema = z.object({
  name: z.string().trim().min(1, "Give the routine a name.").max(60),
  notes: z.string().trim().max(500).optional(),
  exercises: z
    .array(
      z.object({
        exerciseId: z.string().min(1),
        targetSets: z.number().int().min(1).max(20),
        targetRepsMin: z.number().int().min(1).max(100).nullable(),
        targetRepsMax: z.number().int().min(1).max(100).nullable(),
        restSeconds: z.number().int().min(0).max(600),
      }),
    )
    .min(1, "Add at least one exercise.")
    .max(30),
});

export type RoutineInput = z.infer<typeof routineSchema>;

export async function saveRoutine(routineId: string | null, input: RoutineInput) {
  const user = await requireUser();
  const parsed = routineSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the routine." };
  const { name, notes, exercises } = parsed.data;

  const rows = exercises.map((e, order) => ({ ...e, order }));

  if (routineId) {
    // Make sure the routine belongs to this user before changing it
    const existing = await db.routine.findFirst({ where: { id: routineId, userId: user.id } });
    if (!existing) return { error: "That routine no longer exists." };
    // Replace the exercise list in one transaction so a failure can't leave it half-saved
    await db.$transaction([
      db.routineExercise.deleteMany({ where: { routineId } }),
      db.routine.update({
        where: { id: routineId },
        data: { name, notes, exercises: { create: rows } },
      }),
    ]);
  } else {
    const count = await db.routine.count({ where: { userId: user.id } });
    await db.routine.create({
      data: { userId: user.id, name, notes, position: count, exercises: { create: rows } },
    });
  }

  revalidatePath("/train");
  redirect("/train");
}

export async function deleteRoutine(routineId: string) {
  const user = await requireUser();
  await db.routine.deleteMany({ where: { id: routineId, userId: user.id } });
  revalidatePath("/train");
  redirect("/train");
}

// ─── Workouts ─────────────────────────────────────────────────────────────

/** Start a workout from a routine (or empty). Resumes an unfinished one instead of starting a second. */
export async function startWorkout(routineId: string | null) {
  const user = await requireUser();

  const active = await db.workout.findFirst({ where: { userId: user.id, endedAt: null } });
  if (active) redirect(`/train/workout/${active.id}`);

  const routine = routineId
    ? await db.routine.findFirst({
        where: { id: routineId, userId: user.id },
        include: { exercises: { orderBy: { order: "asc" } } },
      })
    : null;

  const workout = await db.workout.create({
    data: {
      userId: user.id,
      routineId: routine?.id,
      name: routine?.name ?? workoutNameForNow(),
      exercises: {
        create: (routine?.exercises ?? []).map((re) => ({
          exerciseId: re.exerciseId,
          order: re.order,
          supersetGroup: re.supersetGroup,
          // blank set rows for each target set, ready to fill in
          sets: { create: Array.from({ length: re.targetSets }, (_, order) => ({ order })) },
        })),
      },
    },
  });

  redirect(`/train/workout/${workout.id}`);
}

function workoutNameForNow() {
  const hour = new Date().getUTCHours() - 5; // rough US Eastern; refined when we add time zones
  const h = (hour + 24) % 24;
  if (h < 11) return "Morning workout";
  if (h < 17) return "Afternoon workout";
  return "Evening workout";
}

const setSchema = z.object({
  type: z.enum(["WARMUP", "NORMAL", "DROP", "FAILURE"]),
  weight: z.number().min(0).max(2000).nullable(), // in the user's display unit
  reps: z.number().int().min(0).max(1000).nullable(),
  completed: z.boolean(),
});

const finishSchema = z.object({
  name: z.string().trim().min(1).max(60),
  notes: z.string().trim().max(1000).optional(),
  exercises: z
    .array(z.object({ exerciseId: z.string().min(1), restSeconds: z.number().int().min(0).max(600), sets: z.array(setSchema).max(50) }))
    .max(40),
});

export type FinishWorkoutInput = z.infer<typeof finishSchema>;

type ExerciseInput = FinishWorkoutInput["exercises"];

/** Replace a workout's exercises and sets in one transaction (the replace-all pattern keeps saves simple). */
function writeExercises(workoutId: string, exercises: ExerciseInput, unitSystem: UnitSystem, data: Prisma.WorkoutUpdateInput) {
  return db.$transaction([
    db.workoutExercise.deleteMany({ where: { workoutId } }),
    db.workout.update({
      where: { id: workoutId },
      data: {
        ...data,
        exercises: {
          create: exercises.map((e, order) => ({
            exerciseId: e.exerciseId,
            order,
            sets: {
              create: e.sets.map((s, setOrder) => ({
                order: setOrder,
                type: s.type,
                weightKg: s.weight === null ? null : toKg(s.weight, unitSystem),
                reps: s.reps,
                completed: s.completed,
              })),
            },
          })),
        },
      },
    }),
  ]);
}

const completedOnly = (exercises: ExerciseInput) =>
  exercises.map((e) => ({ ...e, sets: e.sets.filter((s) => s.completed) })).filter((e) => e.sets.length > 0);

async function unitsFor(userId: string) {
  const { unitSystem } = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { unitSystem: true } });
  return unitSystem;
}

/**
 * Autosave while you lift. Runs a couple of seconds after every change, and
 * when the app goes to the background, so closing the app, a dead battery, or
 * switching phones never loses a set.
 */
export async function syncWorkoutDraft(workoutId: string, input: FinishWorkoutInput) {
  const user = await requireUser();
  const parsed = finishSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid" };
  const workout = await db.workout.findFirst({ where: { id: workoutId, userId: user.id, endedAt: null } });
  if (!workout) return { error: "closed" };
  await writeExercises(workoutId, parsed.data.exercises, await unitsFor(user.id), { name: parsed.data.name });
  return { savedAt: Date.now() };
}

export async function finishWorkout(workoutId: string, input: FinishWorkoutInput) {
  const user = await requireUser();
  const parsed = finishSchema.safeParse(input);
  if (!parsed.success) return { error: "Some sets have values that don't look right." };

  const workout = await db.workout.findFirst({ where: { id: workoutId, userId: user.id, endedAt: null } });
  if (!workout) return { error: "This workout was already finished or discarded." };

  // Keep only completed sets, and drop exercises that end up with none (like Hevy)
  const exercises = completedOnly(parsed.data.exercises);
  if (exercises.length === 0) return { error: "Complete at least one set, or discard the workout." };

  await writeExercises(workoutId, exercises, await unitsFor(user.id), {
    name: parsed.data.name,
    notes: parsed.data.notes,
    endedAt: new Date(),
  });

  revalidatePath("/train");
  revalidatePath("/progress");
  redirect(`/train/history/${workoutId}?finished=1`);
}

/** Fix a finished workout's sets without changing when it happened. */
export async function saveWorkoutEdits(workoutId: string, input: FinishWorkoutInput) {
  const user = await requireUser();
  const parsed = finishSchema.safeParse(input);
  if (!parsed.success) return { error: "Some sets have values that don't look right." };
  const workout = await db.workout.findFirst({ where: { id: workoutId, userId: user.id, endedAt: { not: null } } });
  if (!workout) return { error: "That workout no longer exists." };
  const exercises = completedOnly(parsed.data.exercises);
  if (exercises.length === 0) return { error: "Keep at least one completed set, or delete the workout." };

  await writeExercises(workoutId, exercises, await unitsFor(user.id), { name: parsed.data.name });
  revalidatePath("/train");
  revalidatePath("/progress");
  redirect(`/train/history/${workoutId}`);
}

/** Ended a workout too early? Reopen it and keep logging. */
export async function reopenWorkout(workoutId: string) {
  const user = await requireUser();
  const active = await db.workout.findFirst({ where: { userId: user.id, endedAt: null } });
  if (active && active.id !== workoutId) redirect(`/train/workout/${active.id}`);
  await db.workout.updateMany({ where: { id: workoutId, userId: user.id }, data: { endedAt: null } });
  revalidatePath("/train");
  redirect(`/train/workout/${workoutId}`);
}

export async function discardWorkout(workoutId: string) {
  const user = await requireUser();
  await db.workout.deleteMany({ where: { id: workoutId, userId: user.id, endedAt: null } });
  revalidatePath("/train");
  redirect("/train");
}

export async function deleteWorkout(workoutId: string) {
  const user = await requireUser();
  await db.workout.deleteMany({ where: { id: workoutId, userId: user.id } });
  revalidatePath("/train");
  revalidatePath("/progress");
  redirect("/train");
}

// ─── Bodyweight ───────────────────────────────────────────────────────────

const bodyweightSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // the user's local calendar day, sent by the browser
  weight: z.coerce.number().positive().max(700),
});

export async function logBodyweight(
  _prev: { error?: string; ok?: boolean },
  formData: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireUser();
  const parsed = bodyweightSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter a weight." };

  const { unitSystem } = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { unitSystem: true } });
  const date = new Date(`${parsed.data.date}T00:00:00Z`);
  const weightKg = toKg(parsed.data.weight, unitSystem);

  await db.bodyweightEntry.upsert({
    where: { userId_date: { userId: user.id, date } },
    update: { weightKg },
    create: { userId: user.id, date, weightKg },
  });
  revalidatePath("/progress");
  return { ok: true };
}

/** Last session's sets for exercises added mid-workout, in the user's units. */
export async function previousSetsFor(workoutId: string, exerciseIds: string[]) {
  const user = await requireUser();
  const workout = await db.workout.findFirst({ where: { id: workoutId, userId: user.id } });
  if (!workout) return {};
  const ids = z.array(z.string()).max(40).parse(exerciseIds);
  const [previous, unitSystem] = await Promise.all([
    getPreviousSets(user.id, ids, workout.startedAt),
    getUnitSystem(user.id),
  ]);
  return toDisplayPrevious(previous, unitSystem);
}

// ─── Your own exercises ───────────────────────────────────────────────────

const MUSCLES = ["chest", "shoulders", "biceps", "triceps", "forearms", "abdominals", "traps", "lats", "middle back", "lower back", "glutes", "quadriceps", "hamstrings", "adductors", "abductors", "calves", "neck"] as const;
const EQUIPMENT = ["barbell", "dumbbell", "cable", "machine", "body only", "kettlebells", "bands", "e-z curl bar", "other"] as const;

const exerciseSchema = z.object({
  name: z.string().trim().min(2, "Name the exercise.").max(80),
  primaryMuscle: z.enum(MUSCLES),
  secondaryMuscles: z.array(z.enum(MUSCLES)).max(5).default([]),
  equipment: z.enum(EQUIPMENT),
  category: z.enum(["STRENGTH", "CARDIO", "STRETCHING", "PLYOMETRICS"]).default("STRENGTH"),
});

/** Add an exercise that isn't in the library. Only you see it. */
export async function createExercise(input: z.input<typeof exerciseSchema>) {
  const user = await requireUser();
  const parsed = exerciseSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  const { name, primaryMuscle, secondaryMuscles, equipment, category } = parsed.data;

  const duplicate = await db.exercise.findFirst({ where: { createdById: user.id, name: { equals: name, mode: "insensitive" } } });
  if (duplicate) return { error: "You already have an exercise with that name." };

  const slug = `u-${user.id.slice(-6)}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now().toString(36)}`;
  const e = await db.exercise.create({
    data: { slug, name, category, equipment, primaryMuscles: [primaryMuscle], secondaryMuscles, createdById: user.id },
  });
  revalidatePath("/train");
  return {
    exercise: { id: e.id, slug: e.slug, name: e.name, equipment: e.equipment, primaryMuscles: e.primaryMuscles, image: null, aliases: [], custom: true },
  };
}

export async function deleteExercise(id: string) {
  const user = await requireUser();
  const used = await db.workoutExercise.count({ where: { exerciseId: id } });
  if (used > 0) return { error: "This exercise is in your workout history, so it can't be deleted." };
  await db.routineExercise.deleteMany({ where: { exerciseId: id, routine: { userId: user.id } } });
  await db.exercise.deleteMany({ where: { id, createdById: user.id } });
  revalidatePath("/train");
  return { ok: true };
}

// ─── Program templates ────────────────────────────────────────────────────

/** Add every routine in a ready-made program to your routines. */
export async function importTemplate(templateId: string) {
  const user = await requireUser();
  const template = TEMPLATES.find((t) => t.id === templateId);
  if (!template) return { error: "That program isn't available." };

  const names = [...new Set(template.routines.flatMap((r) => r.exercises.map(([n]) => n)))];
  const found = await db.exercise.findMany({ where: { createdById: null, name: { in: names } }, select: { id: true, name: true } });
  const idFor = new Map(found.map((e) => [e.name, e.id]));
  const position = await db.routine.count({ where: { userId: user.id } });

  await db.$transaction(
    template.routines.map((r, i) =>
      db.routine.create({
        data: {
          userId: user.id,
          name: r.name,
          notes: `From the ${template.name} program`,
          position: position + i,
          exercises: {
            create: r.exercises
              .filter(([n]) => idFor.has(n))
              .map(([n, sets, min, max, rest], order) => ({
                exerciseId: idFor.get(n)!,
                order,
                targetSets: sets,
                targetRepsMin: min,
                targetRepsMax: max,
                restSeconds: rest,
              })),
          },
        },
      }),
    ),
  );
  revalidatePath("/train");
  return { ok: true, count: template.routines.length };
}
