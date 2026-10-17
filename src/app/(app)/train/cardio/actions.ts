"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getBody } from "@/lib/body";
import { estimateBurn, findActivity, metFor, type Intensity } from "@/lib/fitness/activities";
import { inToCm, lbToKg } from "@/lib/fitness/units";

const activitySchema = z.object({
  activity: z.string().min(1).max(40), // catalog key or "custom"
  customName: z.string().trim().max(60).optional(),
  customMet: z.number().min(1.5).max(20).optional(),
  intensity: z.enum(["light", "moderate", "vigorous"]),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  minutes: z.number().min(1).max(24 * 60),
  distance: z.number().min(0).max(500).optional(), // miles or km, in the user's units
  inclinePct: z.number().min(0).max(40).optional(),
  avgHeartRate: z.number().int().min(40).max(230).optional(),
  weight: z.number().positive().max(700).optional(), // only if no weigh-in exists yet
  notes: z.string().max(300).optional(),
});

/** Log a cardio session or any activity. Calories are calculated here, on the server. */
export async function logActivity(input: z.input<typeof activitySchema>) {
  const user = await requireUser();
  const parsed = activitySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  const d = parsed.data;

  const { unitSystem } = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { unitSystem: true } });
  const date = new Date(`${d.day}T00:00:00Z`);
  // A first-time user may not have a weigh-in yet; record the one they typed
  if (d.weight) {
    const weightKg = unitSystem === "IMPERIAL" ? lbToKg(d.weight) : d.weight;
    await db.bodyweightEntry.upsert({ where: { userId_date: { userId: user.id, date } }, update: { weightKg }, create: { userId: user.id, date, weightKg } });
  }
  const body = await getBody(user.id, date);
  if (!body.weightKg) return { error: "Add your weight so calories can be estimated." };

  const catalog = d.activity === "custom" ? null : findActivity(d.activity);
  if (d.activity !== "custom" && !catalog) return { error: "Unknown activity." };
  const met = catalog ? metFor(catalog, d.intensity as Intensity) : d.customMet ?? { light: 3, moderate: 5, vigorous: 8 }[d.intensity];
  const distanceM = d.distance ? d.distance * (unitSystem === "IMPERIAL" ? 1609.344 : 1000) : null;

  const burn = estimateBurn({
    weightKg: body.weightKg,
    heightCm: body.heightCm,
    age: body.age,
    sex: body.sex,
    minutes: d.minutes,
    met,
    avgHeartRate: d.avgHeartRate,
    distanceM,
    inclinePct: d.inclinePct,
    speedModel: catalog?.speedModel,
  });

  await db.activityEntry.create({
    data: {
      userId: user.id,
      activity: catalog?.key ?? "custom",
      name: catalog?.name ?? (d.customName || "Activity"),
      intensity: d.intensity,
      date,
      durationMin: d.minutes,
      distanceM,
      inclinePct: d.inclinePct,
      avgHeartRate: d.avgHeartRate,
      caloriesTotal: burn.total,
      caloriesNet: burn.net,
      method: burn.method,
      notes: d.notes,
    },
  });
  revalidatePath("/train");
  revalidatePath("/diary");
  revalidatePath("/log");
  redirect(`/diary?day=${d.day}`);
}

export async function deleteActivity(id: string) {
  const user = await requireUser();
  await db.activityEntry.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/train");
  revalidatePath("/diary");
}

const statsSchema = z.object({
  sex: z.enum(["male", "female"]),
  age: z.coerce.number().int().min(13).max(100),
  heightFt: z.coerce.number().min(0).max(8).optional(),
  heightIn: z.coerce.number().min(0).max(11.99).optional(),
  heightCm: z.coerce.number().min(100).max(250).optional(),
});

/** Save body stats used for calorie math (weight lives in weigh-ins). */
export async function saveBodyStats(input: Record<string, string>) {
  const user = await requireUser();
  const parsed = statsSchema.safeParse(Object.fromEntries(Object.entries(input).filter(([, v]) => v !== "")));
  if (!parsed.success) return { error: "Fill in sex, age, and height." };
  const s = parsed.data;
  const heightCm = s.heightCm ?? (s.heightFt !== undefined ? inToCm(s.heightFt * 12 + (s.heightIn ?? 0)) : undefined);
  if (!heightCm || heightCm < 100) return { error: "Enter your height." };
  await db.user.update({ where: { id: user.id }, data: { sex: s.sex, birthYear: new Date().getFullYear() - s.age, heightCm } });
  revalidatePath("/profile");
  return { ok: true };
}

export async function setExerciseCredit(percent: number) {
  const user = await requireUser();
  const p = z.number().int().min(0).max(100).parse(percent);
  await db.user.update({ where: { id: user.id }, data: { exerciseCredit: p } });
  revalidatePath("/diary");
  revalidatePath("/profile");
}
