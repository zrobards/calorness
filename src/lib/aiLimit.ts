import "server-only";
import { db } from "@/lib/db";

// Everyone gets a daily allowance of AI requests (photos, descriptions,
// label scans, re-checks). Keeps the AI bill predictable as friends join.
// Set AI_DAILY_LIMIT in Vercel to change it.
export const aiDailyLimit = () => Number(process.env.AI_DAILY_LIMIT) || 25;

export async function aiUsedToday(userId: string) {
  return db.aiCall.count({ where: { userId, createdAt: { gte: new Date(Date.now() - 24 * 3600_000) } } });
}

/** Records one AI request, or explains why it can't run. */
export async function consumeAiQuota(userId: string, kind: "photo" | "describe" | "label" | "shortcut" | "recheck") {
  const limit = aiDailyLimit();
  if ((await aiUsedToday(userId)) >= limit) {
    return {
      error: `You've used today's ${limit} AI logs. Barcode scans, search, saved meals, and "log again" still work, and the AI resets within 24 hours.`,
    };
  }
  await db.aiCall.create({ data: { userId, kind } });
  return { ok: true as const };
}
