import "server-only";
import { db } from "@/lib/db";

// Password guessing protection. Counts wrong passwords per email in a
// 15-minute window; after MAX_FAILURES the email is locked for 15 minutes.
// Stored in the database because serverless functions don't share memory.
const WINDOW_MS = 15 * 60_000;
export const MAX_FAILURES = 8;

export async function isLocked(key: string, now = new Date()) {
  const t = await db.authThrottle.findUnique({ where: { key } });
  return !!t?.lockedUntil && t.lockedUntil > now;
}

export async function recordFailure(key: string, now = new Date()) {
  const t = await db.authThrottle.findUnique({ where: { key } });
  const fresh = !t || now.getTime() - t.windowStart.getTime() > WINDOW_MS;
  const failures = fresh ? 1 : t.failures + 1;
  const lockedUntil = failures >= MAX_FAILURES ? new Date(now.getTime() + WINDOW_MS) : null;
  await db.authThrottle.upsert({
    where: { key },
    update: { failures, lockedUntil, ...(fresh ? { windowStart: now } : {}) },
    create: { key, failures, windowStart: now, lockedUntil },
  });
}

export async function clearFailures(key: string) {
  await db.authThrottle.deleteMany({ where: { key } });
}
