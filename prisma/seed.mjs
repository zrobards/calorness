// Loads the exercise library into the database. Safe to run on every deploy:
// existing exercises are skipped, and alias lists are kept up to date.
//
// Sources:
//  - data/exercises.json: free-exercise-db by yuhonas (public domain, Unlicense)
//    https://github.com/yuhonas/free-exercise-db
//  - data/exercises-extra.json: common gym exercises written for Calorness
//    (machines and cable moves the main set lacks, like the Pec Deck)
//  - data/exercise-aliases.json: gym slang for main-set names ("rdl", "ohp")
import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const load = async (name) => JSON.parse(await readFile(new URL(`./data/${name}`, import.meta.url), "utf8"));

const [main, extra, aliases] = await Promise.all([
  load("exercises.json"),
  load("exercises-extra.json"),
  load("exercise-aliases.json"),
]);

const { count } = await db.exercise.createMany({ data: [...main, ...extra], skipDuplicates: true });

let updated = 0;
for (const [name, list] of Object.entries(aliases)) {
  const r = await db.exercise.updateMany({ where: { name, createdById: null }, data: { aliases: list } });
  updated += r.count;
}
for (const e of extra) {
  await db.exercise.updateMany({ where: { slug: e.slug }, data: { aliases: e.aliases } });
}

console.log(`Exercise library: ${count} added (${main.length + extra.length} total), aliases set on ${updated + extra.length}.`);
await db.$disconnect();
