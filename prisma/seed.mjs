// Loads the exercise library into the database. Safe to run on every deploy:
// existing exercises are skipped, photos/how-tos/aliases are kept up to date,
// and duplicates from earlier versions are merged.
//
// Sources:
//  - data/exercises.json: free-exercise-db by yuhonas (public domain, Unlicense)
//    https://github.com/yuhonas/free-exercise-db
//  - data/exercises-extra.json: common gym exercises written for Calorness
//    (machines and cable moves the main set lacks, like the Pec Deck). Where
//    the main set has the same movement under another name, its photos and
//    instructions are reused.
//  - data/exercise-aliases.json: gym slang for main-set names ("rdl", "ohp")
//  - data/exercise-fixes.json: how-tos for the few main-set entries without one
//  - data/exercises-merged.json: added exercises that turned out to duplicate a
//    main-set name; any history using them is moved to the original
import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const load = async (name) => JSON.parse(await readFile(new URL(`./data/${name}`, import.meta.url), "utf8"));
const slugFor = (name) => "x-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const [main, extra, aliases, merged, fixes] = await Promise.all([
  load("exercises.json"),
  load("exercises-extra.json"),
  load("exercise-aliases.json"),
  load("exercises-merged.json"),
  load("exercise-fixes.json"), // how-tos for the few main-set entries that came without any
]);

// 1. Merge old duplicates into the main-set exercise with the same name
let mergedCount = 0;
for (const name of merged) {
  const dup = await db.exercise.findUnique({ where: { slug: slugFor(name) } });
  if (!dup) continue;
  const original = await db.exercise.findFirst({ where: { name, createdById: null, NOT: { slug: dup.slug } } });
  if (!original) continue;
  await db.$transaction([
    db.routineExercise.updateMany({ where: { exerciseId: dup.id }, data: { exerciseId: original.id } }),
    db.workoutExercise.updateMany({ where: { exerciseId: dup.id }, data: { exerciseId: original.id } }),
    db.exercise.delete({ where: { id: dup.id } }),
  ]);
  mergedCount++;
}

// 2. Add anything new
const { count } = await db.exercise.createMany({ data: [...main, ...extra], skipDuplicates: true });

// 3. Keep photos, how-tos, and aliases current for the added exercises
for (const e of extra) {
  await db.exercise.updateMany({ where: { slug: e.slug }, data: { aliases: e.aliases, images: e.images, instructions: e.instructions } });
}
for (const [name, list] of Object.entries(aliases)) {
  await db.exercise.updateMany({ where: { name, createdById: null, slug: { not: { startsWith: "x-" } } }, data: { aliases: list } });
}

for (const [name, instructions] of Object.entries(fixes)) {
  await db.exercise.updateMany({ where: { name, createdById: null, instructions: { isEmpty: true } }, data: { instructions } });
}

console.log(`Exercise library: ${count} added, ${mergedCount} duplicates merged, ${main.length + extra.length} total.`);
await db.$disconnect();
