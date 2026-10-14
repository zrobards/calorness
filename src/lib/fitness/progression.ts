// "Double progression", the classic way to get stronger: stay at a weight
// and add reps until you hit the top of your rep range on every working set,
// then add weight and start again at the bottom of the range.

export type PrevSet = { weight: number | null; reps: number | null; type: string };
export type Suggestion = { weight: number; reps: number; reason: "add-weight" | "add-rep" | "repeat" };

export function weightIncrement(unit: "lb" | "kg", equipment: string | null): number {
  const small = equipment === "dumbbell" || equipment === "cable" || equipment === "machine" || equipment === "kettlebells";
  if (unit === "kg") return small ? 2 : 2.5;
  return small ? 5 : 5; // 5 lb: one pair of 2.5s on a barbell, or the next dumbbell up
}

export function suggestNext(input: {
  previous: PrevSet[];
  repMin?: number | null;
  repMax?: number | null;
  unit: "lb" | "kg";
  equipment: string | null;
}): Suggestion[] {
  const working = input.previous.filter((s) => s.type !== "WARMUP" && s.weight && s.reps);
  if (working.length === 0) return [];
  const min = input.repMin ?? 8;
  const max = Math.max(min, input.repMax ?? 12);
  const topWeight = Math.max(...working.map((s) => s.weight!));
  const atTop = working.filter((s) => s.weight === topWeight);
  const hitTop = atTop.every((s) => (s.reps ?? 0) >= max);

  return input.previous.map((s) => {
    if (s.type === "WARMUP" || !s.weight || !s.reps) return { weight: s.weight ?? 0, reps: s.reps ?? 0, reason: "repeat" as const };
    if (hitTop && s.weight === topWeight) {
      return { weight: s.weight + weightIncrement(input.unit, input.equipment), reps: min, reason: "add-weight" as const };
    }
    if (s.weight === topWeight && s.reps < max) return { weight: s.weight, reps: s.reps + 1, reason: "add-rep" as const };
    return { weight: s.weight, reps: s.reps, reason: "repeat" as const };
  });
}
