"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { bmrMifflinStJeor, macroTargets, tdee } from "@/lib/fitness/nutrition";
import { inToCm, lbToKg } from "@/lib/fitness/units";

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
  redirect("/diary");
}

export async function setUnitSystem(formData: FormData) {
  const user = await requireUser();
  const unitSystem = z.enum(["IMPERIAL", "METRIC"]).parse(formData.get("unitSystem"));
  await db.user.update({ where: { id: user.id }, data: { unitSystem } });
  revalidatePath("/profile");
}
