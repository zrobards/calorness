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

// ─── Which sets went into each muscle (Progress drill-down) ──────────────

export type SetDetail = { weightKg: number | null; reps: number | null; type: string };
export type Contribution = {
  workoutId: string;
  workoutName: string;
  date: string; // ISO time the workout started
  exercise: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  sets: SetDetail[]; // working sets only (no warm-ups)
};
export type MuscleEntry = Contribution & { role: "primary" | "secondary"; counted: number };

/** Totals and the exercises behind them, for workouts between `from` and `to`. */
export function muscleBreakdown(contributions: Contribution[], from: Date, to: Date) {
  const totals = Object.fromEntries(MUSCLE_REGIONS.map((m) => [m, 0])) as Record<MuscleRegion, number>;
  const entries = Object.fromEntries(MUSCLE_REGIONS.map((m) => [m, [] as MuscleEntry[]])) as Record<MuscleRegion, MuscleEntry[]>;
  for (const c of contributions) {
    const t = new Date(c.date);
    if (t < from || t >= to || c.sets.length === 0) continue;
    const add = (m: string, role: MuscleEntry["role"]) => {
      if (!isMuscleRegion(m)) return;
      const counted = role === "primary" ? c.sets.length : c.sets.length * 0.5;
      totals[m] += counted;
      entries[m].push({ ...c, role, counted });
    };
    c.primaryMuscles.forEach((m) => add(m, "primary"));
    c.secondaryMuscles.filter((m) => !c.primaryMuscles.includes(m)).forEach((m) => add(m, "secondary"));
  }
  for (const m of MUSCLE_REGIONS) entries[m].sort((a, b) => b.date.localeCompare(a.date));
  return { totals, entries };
}
