import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { aiFoodResultSchema, type AiFoodResult } from "./parse";

// Reusing an AI answer, strictly: only for the same person, only for typed
// descriptions (never photos), and only when the words are exactly the same
// apart from capitals, spacing, and end punctuation. "2 eggs" and "3 eggs"
// are different, "a big bowl" and "a bowl" are different. Nothing is pooled
// across people, because two people's "chicken and rice" can be very
// different meals. Correcting an answer deletes it, so the next time is fresh.

const KEEP_DAYS = 60;

/** The description, tidied. Exported for tests. */
export function answerKey(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[\s.!?,;:]+$/, "");
}

export async function reusableAnswer(userId: string, text: string): Promise<AiFoodResult | null> {
  const key = answerKey(text);
  if (key.length < 2) return null;
  const row = await db.aiAnswer.findUnique({ where: { userId_key: { userId, key } } });
  if (!row || row.createdAt < new Date(Date.now() - KEEP_DAYS * 86_400_000)) return null;
  const parsed = aiFoodResultSchema.safeParse(row.result);
  return parsed.success && parsed.data.items.length ? parsed.data : null;
}

export async function saveAnswer(userId: string, text: string, result: AiFoodResult) {
  const key = answerKey(text);
  if (key.length < 2 || !result.items.length) return;
  const data = { result: result as unknown as Prisma.InputJsonValue, createdAt: new Date() };
  await db.aiAnswer.upsert({ where: { userId_key: { userId, key } }, update: data, create: { userId, key, ...data } }).catch(() => {});
}

export async function forgetAnswer(userId: string, text: string) {
  await db.aiAnswer.deleteMany({ where: { userId, key: answerKey(text) } }).catch(() => {});
}
