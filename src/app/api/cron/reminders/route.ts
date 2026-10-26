import { db } from "@/lib/db";
import { sendPush } from "@/lib/push";
import { getTodaySummary } from "@/lib/activitySummary";
import { dayInZone, hourInZone } from "@/lib/time";

/*
  Daily nudge, run by Vercel Cron (see vercel.json) early afternoon US time.
  Anyone with notifications on who hasn't logged lunch (or anything) today
  gets one reminder. Vercel signs cron calls with CRON_SECRET when it's set.
*/
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });

  const users = await db.user.findMany({
    where: { pushSubscriptions: { some: {} } },
    select: { id: true, timeZone: true },
  });
  const now = new Date();
  let sent = 0;
  for (const u of users) {
    const hour = hourInZone(now, u.timeZone);
    if (hour < 12 || hour > 16) continue; // only nudge around lunchtime where they are
    const day = new Date(`${dayInZone(now, u.timeZone)}T00:00:00Z`);
    const [any, lunch] = await Promise.all([
      db.diaryEntry.count({ where: { userId: u.id, date: day } }),
      db.diaryEntry.count({ where: { userId: u.id, date: day, meal: "LUNCH" } }),
    ]);
    if (lunch > 0) continue;
    // A streak on the line is the strongest reason to open the app
    const summary = await getTodaySummary(u.id).catch(() => null);
    const streak = summary?.logStreak ?? 0;
    sent += await sendPush(u.id, {
      title: any === 0 ? (streak > 1 ? `Keep your ${streak}-day streak going` : "Nothing logged yet today") : "Log lunch?",
      body: any === 0 ? "Snap your next meal and Calorness counts it for you." : "Snap it or tap a saved meal. Takes two seconds.",
      url: "/log",
      tag: "reminder",
    });
  }
  return Response.json({ users: users.length, sent });
}
