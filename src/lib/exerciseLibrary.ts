import "server-only";
import { updateTag } from "next/cache";
import type { ExerciseCategory } from "@prisma/client";
import { db } from "@/lib/db";

// The shared exercise library grows from what people add. Exercises someone
// creates are private at first. When enough different people create the same
// one (same name), it joins the library for everyone, and their own copies
// are switched to the library one, history and all. The owner can also do
// this by hand from the admin screen, or fold them into an existing exercise.

const MIN_PEOPLE = () => Math.max(2, Number(process.env.EXERCISE_MIN_PEOPLE) || 3);

/** "Cable  Y-Raise!" → "cable y raise". Exported for tests. */
export function exerciseKey(name: string) {
  return name.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

const mostCommon = <T,>(values: T[]): T | undefined => {
  const counts = new Map<string, { v: T; n: number }>();
  for (const v of values) {
    const k = JSON.stringify(v);
    counts.set(k, { v, n: (counts.get(k)?.n ?? 0) + 1 });
  }
  return [...counts.values()].sort((a, b) => b.n - a.n)[0]?.v;
};

export type CommunityExercise = {
  key: string;
  name: string;
  people: number;
  ids: string[];
  uses: number;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipment: string | null;
  category: ExerciseCategory;
  /** a library exercise with the same name or alias, if any */
  match: { id: string; name: string } | null;
};

/** People's own exercises, grouped by name, most-shared first. */
export async function communityExercises(limit = 60, nameHint?: string): Promise<CommunityExercise[]> {
  const [custom, library] = await Promise.all([
    db.exercise.findMany({
      where: { createdById: { not: null }, ...(nameHint ? { name: { contains: nameHint, mode: "insensitive" as const } } : {}) },
      select: { id: true, name: true, createdById: true, primaryMuscles: true, secondaryMuscles: true, equipment: true, category: true, _count: { select: { workoutExercises: true, routineExercises: true } } },
      take: 5000,
    }),
    db.exercise.findMany({ where: { createdById: null }, select: { id: true, name: true, aliases: true } }),
  ]);
  const libraryByKey = new Map<string, { id: string; name: string }>();
  for (const e of library) for (const n of [e.name, ...e.aliases]) libraryByKey.set(exerciseKey(n), { id: e.id, name: e.name });

  const groups = new Map<string, typeof custom>();
  for (const e of custom) {
    const k = exerciseKey(e.name);
    if (k) groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  return [...groups.entries()]
    .map(([key, rows]) => ({
      key,
      name: mostCommon(rows.map((r) => r.name.trim()))!,
      people: new Set(rows.map((r) => r.createdById)).size,
      ids: rows.map((r) => r.id),
      uses: rows.reduce((s, r) => s + r._count.workoutExercises + r._count.routineExercises, 0),
      primaryMuscles: mostCommon(rows.map((r) => r.primaryMuscles)) ?? [],
      secondaryMuscles: mostCommon(rows.map((r) => r.secondaryMuscles)) ?? [],
      equipment: mostCommon(rows.map((r) => r.equipment)) ?? null,
      category: mostCommon(rows.map((r) => r.category)) ?? "STRENGTH",
      match: libraryByKey.get(key) ?? null,
    }))
    .sort((a, b) => b.people - a.people || b.uses - a.uses)
    .slice(0, limit);
}

/** Point everyone's copies at one library exercise, then remove the copies. */
async function foldInto(libraryId: string, ids: string[]) {
  const copies = ids.filter((id) => id !== libraryId);
  if (!copies.length) return 0;
  await db.$transaction([
    db.routineExercise.updateMany({ where: { exerciseId: { in: copies } }, data: { exerciseId: libraryId } }),
    db.workoutExercise.updateMany({ where: { exerciseId: { in: copies } }, data: { exerciseId: libraryId } }),
    db.exercise.deleteMany({ where: { id: { in: copies }, createdById: { not: null } } }),
  ]);
  return copies.length;
}

const slugFor = async (name: string) => {
  const base = exerciseKey(name).replace(/ /g, "-").slice(0, 60) || "exercise";
  let slug = base;
  for (let i = 2; await db.exercise.findUnique({ where: { slug }, select: { id: true } }); i++) slug = `${base}-${i}`;
  return slug;
};

/** Add a group of people's exercises to the library as one shared exercise. */
export async function publishExercise(
  ids: string[],
  details: { name: string; primaryMuscles: string[]; secondaryMuscles: string[]; equipment: string | null; category: ExerciseCategory },
) {
  const created = await db.exercise.create({
    data: { slug: await slugFor(details.name), name: details.name.trim(), primaryMuscles: details.primaryMuscles, secondaryMuscles: details.secondaryMuscles, equipment: details.equipment, category: details.category, instructions: [], images: [] },
  });
  const moved = await foldInto(created.id, ids);
  updateTag("exercise-library");
  return { id: created.id, moved };
}

/** Fold people's exercises into an existing library exercise, keeping their name as an alias. */
export async function mergeIntoLibrary(ids: string[], libraryId: string, alias: string) {
  const target = await db.exercise.findFirst({ where: { id: libraryId, createdById: null } });
  if (!target) return { error: "That library exercise is gone." };
  if (exerciseKey(alias) !== exerciseKey(target.name) && !target.aliases.some((a) => exerciseKey(a) === exerciseKey(alias))) {
    await db.exercise.update({ where: { id: target.id }, data: { aliases: [...target.aliases, alias.trim()].slice(0, 20) } });
  }
  const moved = await foldInto(target.id, ids);
  updateTag("exercise-library");
  return { ok: true as const, moved };
}

/**
 * After someone creates an exercise: if enough different people now have one
 * with this name and the library doesn't, add it to the library. Never throws.
 */
export async function maybePromote(name: string) {
  try {
    const key = exerciseKey(name);
    const longest = key.split(" ").sort((a, b) => b.length - a.length)[0];
    if (!longest) return null;
    const group = (await communityExercises(5000, longest)).find((g) => g.key === key);
    if (!group || group.match || group.people < MIN_PEOPLE() || !group.primaryMuscles.length) return null;
    return await publishExercise(group.ids, group);
  } catch (e) {
    console.error("exercise promotion failed", e);
    return null;
  }
}
