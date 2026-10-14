import "server-only";
import { db } from "@/lib/db";
import { dayInZone } from "@/lib/time";

export async function getUserPrefs(userId: string) {
  return db.user.findUniqueOrThrow({ where: { id: userId }, select: { unitSystem: true, timeZone: true } });
}

/** Today's date (YYYY-MM-DD) where the user is. */
export async function userToday(userId: string, now = new Date()) {
  const { timeZone } = await getUserPrefs(userId);
  return { today: dayInZone(now, timeZone), timeZone };
}
