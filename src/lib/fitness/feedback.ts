import { estimateOneRepMax } from "./strength";

// Instant coaching on a finished workout: no AI call, so it's there the moment
// you tap Finish. Looks at each exercise against your last few sessions of it,
// your push/pull balance over the past week (climbing counts as pulling), and
// whether you're eating enough for your goal.

export type Tone = "win" | "fix" | "info";
export type FeedbackNote = { tone: Tone; title: string; detail: string };

type Set = { weightKg: number | null; reps: number | null; completed?: boolean; type?: string };
export type ExerciseSession = { name: string; muscles: string[]; sets: Set[]; repMax?: number | null };
/** Best estimated max in each earlier session of this exercise, newest first. */
export type History = Record<string, number[]>;

const PUSH = new Set(["chest", "triceps", "shoulders"]);
const PULL = new Set(["lats", "middle back", "biceps", "forearms"]);

const working = (sets: Set[]) => sets.filter((s) => s.type !== "WARMUP" && (s.completed ?? true) && (s.reps ?? 0) > 0);
export const bestE1rm = (sets: Set[]) => Math.max(0, ...working(sets).filter((s) => (s.weightKg ?? 0) > 0).map((s) => estimateOneRepMax(s.weightKg!, s.reps!)));

export function exerciseFeedback(ex: ExerciseSession, history: number[], kgToShown: (kg: number) => number, unit: string): FeedbackNote | null {
  const sets = working(ex.sets);
  if (!sets.length) return null;
  const now = bestE1rm(ex.sets);
  if (now === 0 || history.length === 0) return null; // bodyweight or first time: nothing to compare
  const last = history[0];
  const best = Math.max(...history);

  if (now > best * 1.005) return { tone: "win", title: `${ex.name}: new best`, detail: `Estimated max ${Math.round(kgToShown(now))} ${unit}, up from ${Math.round(kgToShown(best))}.` };
  if (now < last * 0.93) {
    return {
      tone: "fix",
      title: `${ex.name}: down from last time`,
      detail: "About 7% weaker than your last session. One off day is normal; if it happens twice in a row, check sleep and food, or take a lighter week.",
    };
  }
  // Same top performance for 3+ sessions in a row
  const recent = [now, ...history.slice(0, 2)];
  if (recent.length === 3 && Math.max(...recent) <= Math.min(...recent) * 1.01) {
    return {
      tone: "fix",
      title: `${ex.name}: stuck for 3 sessions`,
      detail: "Try one change: add a set, use a slightly lighter weight for more reps, or swap in a close variation for a few weeks.",
    };
  }
  // Every working set at the top of the planned rep range: time to add weight
  if (ex.repMax && sets.every((s) => (s.reps ?? 0) >= ex.repMax!) && sets.some((s) => (s.weightKg ?? 0) > 0)) {
    return { tone: "win", title: `${ex.name}: ready to go heavier`, detail: `You hit ${ex.repMax} reps on every set. Add a little weight next time.` };
  }
  return null;
}

/** Hard sets per side over the last 7 days. Climbing sessions count as pulling (about 1 set per 6 minutes). */
export function pushPullNote(weekSets: { muscles: string[] }[], climbingMinutes: number): FeedbackNote | null {
  let push = 0, pull = 0;
  for (const s of weekSets) {
    const m = s.muscles[0];
    if (PUSH.has(m)) push++;
    else if (PULL.has(m)) pull++;
  }
  pull += Math.round(climbingMinutes / 6);
  if (push + pull < 12) return null;
  if (pull >= push * 1.6) {
    return {
      tone: "fix",
      title: "Pulling is outweighing pushing",
      detail: `This week: about ${pull} pulling sets${climbingMinutes ? " (climbing included)" : ""} vs ${push} pushing. That imbalance can hold back your presses and stress your shoulders. Trade one pulling exercise for a pressing one, or add 2–3 sets of chest or triceps.`,
    };
  }
  if (push >= pull * 1.6) {
    return { tone: "fix", title: "Pushing is outweighing pulling", detail: `About ${push} pushing sets vs ${pull} pulling this week. Add rows or pulldowns to keep your shoulders healthy.` };
  }
  return null;
}

/** Eating well under target while trying to gain makes strength progress much harder. */
export function fuelNote(goal: "gain" | "lose" | "maintain" | null, avgCalories: number | null, target: number | null, daysLogged: number): FeedbackNote | null {
  if (!goal || !target || avgCalories === null || daysLogged < 3) return null;
  const gap = target - avgCalories;
  if (goal !== "lose" && gap > 300) {
    return { tone: "fix", title: "Not eating enough to grow", detail: `You've averaged ${Math.round(avgCalories).toLocaleString("en-US")} calories on logged days, about ${Math.round(gap)} under your target. Strength and muscle gains stall in a deficit; add a snack or a bigger meal on training and climbing days.` };
  }
  return null;
}
