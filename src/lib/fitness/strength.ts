export type LoggedSet = {
  weightKg: number | null;
  reps: number | null;
  type?: "WARMUP" | "NORMAL" | "DROP" | "FAILURE";
  completed?: boolean;
};

/**
 * Estimated one-rep max using the Epley formula: weight × (1 + reps / 30).
 * A single rep is already a 1RM. Estimates get unreliable past ~12 reps,
 * so we cap there rather than report a misleading number.
 */
export function estimateOneRepMax(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return weightKg;
  const cappedReps = Math.min(reps, 12);
  return weightKg * (1 + cappedReps / 30);
}

/** Sets that count toward stats: completed, and not warm-ups. */
export function workingSets(sets: LoggedSet[]): LoggedSet[] {
  return sets.filter((s) => s.completed !== false && s.type !== "WARMUP");
}

/** Total volume = sum of weight × reps across working sets. */
export function totalVolumeKg(sets: LoggedSet[]): number {
  return workingSets(sets).reduce(
    (sum, s) => sum + (s.weightKg ?? 0) * (s.reps ?? 0),
    0,
  );
}

/** The set with the highest estimated 1RM, or null if none qualify. */
export function bestSet(sets: LoggedSet[]) {
  let best: { set: LoggedSet; e1rm: number } | null = null;
  for (const set of workingSets(sets)) {
    if (!set.weightKg || !set.reps) continue;
    const e1rm = estimateOneRepMax(set.weightKg, set.reps);
    if (!best || e1rm > best.e1rm) best = { set, e1rm };
  }
  return best;
}

export type PersonalRecords = {
  heaviestKg: number;
  bestE1rmKg: number;
  bestSetVolumeKg: number;
};

/**
 * Compare a new session's sets against the lifter's previous records and
 * report which kinds of PR were broken (Hevy shows these as trophies).
 */
export function findNewRecords(
  previous: PersonalRecords,
  sets: LoggedSet[],
): (keyof PersonalRecords)[] {
  const broken = new Set<keyof PersonalRecords>();
  for (const s of workingSets(sets)) {
    if (!s.weightKg || !s.reps) continue;
    if (s.weightKg > previous.heaviestKg) broken.add("heaviestKg");
    if (estimateOneRepMax(s.weightKg, s.reps) > previous.bestE1rmKg)
      broken.add("bestE1rmKg");
    if (s.weightKg * s.reps > previous.bestSetVolumeKg)
      broken.add("bestSetVolumeKg");
  }
  return [...broken];
}
