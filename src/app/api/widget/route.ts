import { NextResponse } from "next/server";
import { userFromApiKey } from "@/lib/apiAuth";
import { getTodaySummary, nudge } from "@/lib/activitySummary";

/*
  GET /api/widget : today's numbers as JSON for a home-screen widget
  (the Scriptable script in Profile → Home-screen widget).
  Authorization: Bearer cal_…
*/
export async function GET(req: Request) {
  const user = await userFromApiKey(req);
  if (!user) return NextResponse.json({ error: "That Calorness key isn't valid. Make a new one in Profile." }, { status: 401 });
  const s = await getTodaySummary(user.id);
  return NextResponse.json({ ...s, message: nudge(s) }, { headers: { "cache-control": "no-store" } });
}
