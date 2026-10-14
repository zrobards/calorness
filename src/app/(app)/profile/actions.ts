"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { bmrMifflinStJeor, macroTargets, tdee } from "@/lib/fitness/nutrition";
import { inToCm, lbToKg } from "@/lib/fitness/units";
import { newApiKey } from "@/lib/apiKeys";

// Server actions run on the server but are called from forms like normal
// functions. Never trust form input: validate it, and look up the user
// from the session rather than from anything the browser sends.

const goalSchema = z.object({
  unitSystem: z.enum(["IMPERIAL", "METRIC"]),
  sex: z.enum(["male", "female"]),
  ageYears: z.coerce.number().int().min(13).max(100),
  heightFt: z.coerce.number().min(0).max(8).optional(),
  heightIn: z.coerce.number().min(0).max(11.99).optional(),
  heightCm: z.coerce.number().min(100).max(250).optional(),
  weight: z.coerce.number().positive().max(700),
  activity: z.enum(["sedentary", "light", "moderate", "active", "veryActive"]),
  goal: z.enum(["LOSE", "MAINTAIN", "GAIN"]),
});

export type GoalFormState = { error?: string };

export async function saveGoals(
  _prev: GoalFormState,
  formData: FormData,
): Promise<GoalFormState> {
  const user = await requireUser();

  const parsed = goalSchema.safeParse(
    Object.fromEntries([...formData].filter(([, v]) => v !== "")),
  );
  if (!parsed.success) {
    return { error: "Check that every field is filled in with a realistic number." };
  }
  const input = parsed.data;

  const imperial = input.unitSystem === "IMPERIAL";
  const heightCm = imperial
    ? inToCm((input.heightFt ?? 0) * 12 + (input.heightIn ?? 0))
    : input.heightCm;
  const weightKg = imperial ? lbToKg(input.weight) : input.weight;

  if (!heightCm || heightCm < 100 || weightKg < 30) {
    return { error: "Enter your height and weight." };
  }

  const bmr = bmrMifflinStJeor({ sex: input.sex, weightKg, heightCm, ageYears: input.ageYears });
  const targets = macroTargets({
    maintenanceKcal: tdee(bmr, input.activity),
    weightKg,
    goal: input.goal,
  });

  await db.goal.upsert({
    where: { userId: user.id },
    update: { ...targets, goalType: input.goal },
    create: { ...targets, goalType: input.goal, userId: user.id },
  });

  revalidatePath("/diary");
  revalidatePath("/profile");
  redirect("/profile#goals");
}

export async function setUnitSystem(formData: FormData) {
  const user = await requireUser();
  const unitSystem = z.enum(["IMPERIAL", "METRIC"]).parse(formData.get("unitSystem"));
  await db.user.update({ where: { id: user.id }, data: { unitSystem } });
  revalidatePath("/profile");
}

const targetsSchema = z.object({
  calories: z.coerce.number().int().min(800, "Calories should be at least 800.").max(10000),
  proteinG: z.coerce.number().int().min(0).max(1000),
  carbsG: z.coerce.number().int().min(0).max(2000),
  fatG: z.coerce.number().int().min(0).max(1000),
  water: z.coerce.number().min(0).max(10000), // in the user's units (fl oz or ml)
});

export type TargetsState = { error?: string; saved?: boolean };

/** Set calories and each macro by hand, after (or instead of) the calculator. */
export async function updateTargets(_prev: TargetsState, formData: FormData): Promise<TargetsState> {
  const user = await requireUser();
  const parsed = targetsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the numbers." };
  const { unitSystem } = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { unitSystem: true } });
  const { water, ...targets } = parsed.data;
  const waterMl = Math.round(unitSystem === "IMPERIAL" ? water * 29.5735 : water);

  await db.goal.upsert({
    where: { userId: user.id },
    update: { ...targets, waterMl },
    create: { ...targets, waterMl, userId: user.id },
  });
  // Not revalidating /profile on purpose: the form already shows the new numbers
  revalidatePath("/diary");
  revalidatePath("/log");
  return { saved: true };
}

// ─── Phone shortcut keys ──────────────────────────────────────────────────

/** Make a key for an iPhone Shortcut. The full key is returned once and never stored. */
export async function createApiKey(name: string) {
  const user = await requireUser();
  const label = z.string().trim().min(1).max(40).catch("iPhone shortcut").parse(name);
  const count = await db.apiKey.count({ where: { userId: user.id } });
  if (count >= 10) return { error: "You have 10 keys. Delete one first." };
  const { key, prefix, hash } = newApiKey();
  await db.apiKey.create({ data: { userId: user.id, name: label, prefix, hash } });
  revalidatePath("/profile");
  return { key };
}

export async function deleteApiKey(id: string) {
  const user = await requireUser();
  await db.apiKey.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/profile");
}
