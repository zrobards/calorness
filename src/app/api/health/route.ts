import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { plainText, userFromApiKey } from "@/lib/apiAuth";
import { dayInZone } from "@/lib/time";
import { fromHealthAutoExport, isHealthAutoExport } from "@/lib/fitness/healthExport";
import { distanceToMeters, healthNumber, metersToDisplay, mpsToDisplay, speedToMps } from "@/lib/fitness/activity";

/*
  POST /api/health : the day's activity from Apple Health, sent by an iPhone
  Shortcut ("Find Health Samples" for each metric, then this request).
  Run it as many times a day as you like; each run replaces that day's totals.

  Authorization: Bearer cal_…
  JSON or form fields (all optional, send what you have):
    day=YYYY-MM-DD (defaults to today where you are)
    steps, activeCalories (or activeEnergy), exerciseMinutes,
    distance + distanceUnit (mi|km|m), walkingSpeed + speedUnit (mph|km/h|m/s),
    flights, restingHeartRate
  Values can include units ("3.1 mph") or be lists of samples (they're added
  up, or averaged for speed and heart rate).
  To backfill, send { "days": [ { "day": "...", "steps": ... }, ... ] }.
  The Health Auto Export app's REST format ({ data: { metrics: [...] } }) is
  also accepted, so that app can be pointed straight at this address.
*/
type Raw = Record<string, unknown>;

export async function POST(req: Request) {
  const user = await userFromApiKey(req);
  if (!user) return plainText("That Calorness key isn't valid. Make a new one in Profile.", 401);

  let body: Raw = {};
  try {
    const type = (req.headers.get("content-type") ?? "").toLowerCase();
    body = type.includes("json") ? await req.json() : Object.fromEntries(await req.formData());
  } catch {
    return plainText("Couldn't read what the shortcut sent.", 400);
  }

  const imperial = user.unitSystem === "IMPERIAL";
  // The Health Auto Export app sends its own format; turn it into days
  const days = (isHealthAutoExport(body) ? fromHealthAutoExport(body) : Array.isArray(body.days) ? body.days : [body]).slice(-62) as Raw[];
  const saved: string[] = [];

  for (const d of days) {
    const day = typeof d.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.day) ? d.day : dayInZone(new Date(), user.timeZone);
    const pick = (...keys: string[]) => keys.map((k) => d[k]).find((v) => v !== undefined && v !== "");
    const int = (v: number | null) => (v === null ? undefined : Math.round(v));
    const data = {
      steps: int(healthNumber(pick("steps", "stepCount"))),
      activeCalories: int(healthNumber(pick("activeCalories", "activeEnergy", "active_energy"))),
      exerciseMinutes: int(healthNumber(pick("exerciseMinutes", "exerciseTime"))),
      distanceM: distanceToMeters(pick("distance", "walkingRunningDistance"), d.distanceUnit as string | undefined, imperial) ?? undefined,
      walkingSpeedMps: speedToMps(pick("walkingSpeed"), d.speedUnit as string | undefined, imperial) ?? undefined,
      flights: int(healthNumber(pick("flights", "flightsClimbed"))),
      restingHr: int(healthNumber(pick("restingHeartRate", "restingHr"), "avg")),
    };
    // Ignore impossible values instead of storing them
    if (data.steps !== undefined && (data.steps < 0 || data.steps > 150_000)) data.steps = undefined;
    if (data.activeCalories !== undefined && (data.activeCalories < 0 || data.activeCalories > 10_000)) data.activeCalories = undefined;
    if (data.walkingSpeedMps !== undefined && (data.walkingSpeedMps <= 0 || data.walkingSpeedMps > 4)) data.walkingSpeedMps = undefined;
    if (Object.values(data).every((v) => v === undefined)) continue;

    const date = new Date(`${day}T00:00:00Z`);
    await db.dailyActivity.upsert({ where: { userId_date: { userId: user.id, date } }, update: data, create: { userId: user.id, date, ...data } });

    const parts = [
      data.steps !== undefined && `${data.steps.toLocaleString("en-US")} steps`,
      data.activeCalories !== undefined && `${data.activeCalories} active cal`,
      data.exerciseMinutes !== undefined && `${data.exerciseMinutes} exercise min`,
      data.walkingSpeedMps !== undefined && `walking ${mpsToDisplay(data.walkingSpeedMps, imperial).toFixed(1)} ${imperial ? "mph" : "km/h"}`,
      data.distanceM !== undefined && `${metersToDisplay(data.distanceM, imperial).toFixed(1)} ${imperial ? "mi" : "km"}`,
    ].filter(Boolean);
    saved.push(days.length > 1 ? day : parts.join(", "));
  }

  if (saved.length === 0) return plainText("Nothing to save. Send at least steps or activeCalories.", 400);
  revalidatePath("/progress");
  revalidatePath("/diary");
  revalidatePath("/log");
  return plainText(days.length > 1 ? `Synced ${saved.length} days.` : `Synced: ${saved[0]}.`);
}
