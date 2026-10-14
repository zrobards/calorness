// Loads the exercise library into the database.
// Source: free-exercise-db by yuhonas (public domain, Unlicense)
// https://github.com/yuhonas/free-exercise-db
//
// Safe to run on every deploy: exercises that already exist are skipped.
import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const exercises = JSON.parse(
  await readFile(new URL("./data/exercises.json", import.meta.url), "utf8"),
);

const { count } = await db.exercise.createMany({
  data: exercises,
  skipDuplicates: true,
});

console.log(`Exercise library: ${count} added, ${exercises.length - count} already present.`);
await db.$disconnect();
