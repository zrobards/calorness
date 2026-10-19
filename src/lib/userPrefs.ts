import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { dayInZone } from "@/lib/time";

/**
 * The few settings almost every page needs. Wrapped in React's cache() so
 * the layout and the page share ONE database read per request instead of
 * each asking separately.
 */
export const getUserPrefs = cache(async (userId: string) =>
  db.user.findUniqueOrThrow({ where: { id: userId }, select: { unitSystem: true, timeZone: true, exerciseCredit: true } }),
);

/** Today's date (YYYY-MM-DD) where the user is. */
export async function userToday(userId: string, now = new Date()) {
  const { timeZone } = await getUserPrefs(userId);
  return { today: dayInZone(now, timeZone), timeZone };
}
