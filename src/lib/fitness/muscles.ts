// Groups the exercise library's 17 muscle names into the regions drawn on
// the body map, and counts weekly sets per region the way Hevy does:
// a set counts fully for its primary muscles and half for secondary ones.

export const MUSCLE_REGIONS = [
  "chest",
  "shoulders",
  "biceps",
  "triceps",
  "forearms",
  "abdominals",
  "traps",
  "lats",
  "middle back",
  "lower back",
  "glutes",
  "quadriceps",
  "hamstrings",
  "adductors",
  "abductors",
  "calves",
  "neck",
] as const;

export type MuscleRegion = (typeof MUSCLE_REGIONS)[number];

export const MUSCLE_LABELS: Record<MuscleRegion, string> = {
  chest: "Chest",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  abdominals: "Abs",
  traps: "Traps",
  lats: "Lats",
  "middle back": "Upper back",
  "lower back": "Lower back",
  glutes: "Glutes",
  quadriceps: "Quads",
  hamstrings: "Hamstrings",
  adductors: "Adductors",
  abductors: "Abductors",
  calves: "Calves",
  neck: "Neck",
};

export function isMuscleRegion(m: string): m is MuscleRegion {
  return (MUSCLE_REGIONS as readonly string[]).includes(m);
}

export type MuscleSetInput = {
  primaryMuscles: string[];
  secondaryMuscles: string[];
  workingSets: number;
};

export function setsPerMuscle(items: MuscleSetInput[]): Record<MuscleRegion, number> {
  const totals = Object.fromEntries(MUSCLE_REGIONS.map((m) => [m, 0])) as Record<
    MuscleRegion,
    number
  >;
  for (const item of items) {
    for (const m of item.primaryMuscles) if (isMuscleRegion(m)) totals[m] += item.workingSets;
    for (const m of item.secondaryMuscles)
      if (isMuscleRegion(m)) totals[m] += item.workingSets * 0.5;
  }
  return totals;
}
