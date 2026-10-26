import "server-only";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/admin";

// Everyone gets a daily allowance of AI requests (photos, descriptions,
// label scans, re-checks, Coach messages, programs). Keeps the AI bill
// predictable as friends join. Set AI_DAILY_LIMIT in Vercel to change it for
// everyone; owners listed in ADMIN_EMAILS have no limit.
export const aiDailyLimit = () => Number(process.env.AI_DAILY_LIMIT) || 25;

/** This person's daily limit: Infinity for owners (ADMIN_EMAILS), else the shared limit. */
export async function aiLimitFor(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
  return isAdmin(user?.email) ? Infinity : aiDailyLimit();
}

export async function aiUsedToday(userId: string) {
  return db.aiCall.count({ where: { userId, createdAt: { gte: new Date(Date.now() - 24 * 3600_000) } } });
}

/** Records one AI request, or explains why it can't run. */
export async function consumeAiQuota(userId: string, kind: "photo" | "describe" | "label" | "shortcut" | "recheck" | "coach") {
  const limit = await aiLimitFor(userId);
  if (Number.isFinite(limit) && (await aiUsedToday(userId)) >= limit) {
    return {
      error: `You've used today's ${limit} AI requests. Barcode scans, search, saved meals, and "log again" still work, and the AI resets within 24 hours.`,
    };
  }
  await db.aiCall.create({ data: { userId, kind } });
  return { ok: true as const };
}
