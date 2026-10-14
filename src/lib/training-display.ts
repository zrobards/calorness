import { displayWeight, type UnitSystem } from "@/lib/fitness/units";

type StoredSet = { weightKg: number | null; reps: number | null; type: string };

/** Convert stored kg to the user's units before sending to the browser. */
export function toDisplayPrevious(previous: Record<string, StoredSet[]>, unitSystem: UnitSystem) {
  return Object.fromEntries(
    Object.entries(previous).map(([id, sets]) => [
      id,
      sets.map((s) => ({
        weight: s.weightKg === null ? null : displayWeight(s.weightKg, unitSystem),
        reps: s.reps,
        type: s.type,
      })),
    ]),
  );
}
