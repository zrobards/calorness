export type Sex = "male" | "female";
export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "veryActive";
export type GoalType = "LOSE" | "MAINTAIN" | "GAIN";

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  veryActive: 1.9,
};

export const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const;

/** Basal metabolic rate via the Mifflin–St Jeor equation. */
export function bmrMifflinStJeor(input: {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  ageYears: number;
}): number {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.ageYears;
  return input.sex === "male" ? base + 5 : base - 161;
}

/** Total daily energy expenditure = BMR × activity multiplier. */
export function tdee(bmr: number, activity: ActivityLevel): number {
  return bmr * ACTIVITY_MULTIPLIERS[activity];
}

/** Calories implied by a set of macros. */
export function caloriesFromMacros(m: {
  proteinG: number;
  carbsG: number;
  fatG: number;
}): number {
  return (
    m.proteinG * KCAL_PER_GRAM.protein +
    m.carbsG * KCAL_PER_GRAM.carbs +
    m.fatG * KCAL_PER_GRAM.fat
  );
}

/**
 * Starting daily targets. Protein is set per kg of bodyweight (higher in a
 * deficit to protect muscle), fat is 25% of calories, carbs fill the rest.
 * Calorie adjustments are deliberately moderate.
 */
export function macroTargets(input: {
  maintenanceKcal: number;
  weightKg: number;
  goal: GoalType;
}) {
  const adjustment = { LOSE: -500, MAINTAIN: 0, GAIN: 300 }[input.goal];
  const calories = Math.round(input.maintenanceKcal + adjustment);
  const proteinPerKg = input.goal === "LOSE" ? 2.2 : 1.8;
  const proteinG = Math.round(input.weightKg * proteinPerKg);
  const fatG = Math.round((calories * 0.25) / KCAL_PER_GRAM.fat);
  const remaining =
    calories - proteinG * KCAL_PER_GRAM.protein - fatG * KCAL_PER_GRAM.fat;
  const carbsG = Math.max(0, Math.round(remaining / KCAL_PER_GRAM.carbs));
  return { calories, proteinG, carbsG, fatG };
}

/** Scale a food's per-serving nutrients by the number of servings eaten. */
export function scaleNutrients<
  T extends { calories: number; proteinG: number; carbsG: number; fatG: number },
>(food: T, servings: number) {
  return {
    calories: food.calories * servings,
    proteinG: food.proteinG * servings,
    carbsG: food.carbsG * servings,
    fatG: food.fatG * servings,
  };
}
