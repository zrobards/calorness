import Link from "next/link";
import { AlertTriangle, MessageCircle, Sparkles, Trophy } from "lucide-react";
import { getWorkoutFeedbackData } from "@/lib/training";
import { getCalorieWeek } from "@/lib/nutrition/diary";
import { bestE1rm, exerciseFeedback, fuelNote, pushPullNote, type FeedbackNote } from "@/lib/fitness/feedback";
import { displayWeight, weightUnit } from "@/lib/fitness/units";
import { userToday } from "@/lib/userPrefs";

/** Instant coach notes on a finished workout: what went well and what to fix. */
export async function CoachFeedback({ userId, workoutId, unitSystem }: { userId: string; workoutId: string; unitSystem: "IMPERIAL" | "METRIC" }) {
  const data = await getWorkoutFeedbackData(userId, workoutId);
  if (!data) return null;
  const { today } = await userToday(userId);
  const week = await getCalorieWeek(userId, today).catch(() => null);

  const history: Record<string, number[]> = {};
  for (const e of data.earlier) {
    const v = bestE1rm(e.sets.map((s) => ({ ...s, completed: s.completed })));
    if (v > 0) (history[e.exerciseId] ??= []).push(v);
  }
  const repMax = new Map(data.workout.routine?.exercises.map((r) => [r.exerciseId, r.targetRepsMax]) ?? []);
  const show = (kg: number) => displayWeight(kg, unitSystem);
  const unit = weightUnit(unitSystem);

  const notes: FeedbackNote[] = [];
  for (const e of data.workout.exercises) {
    const n = exerciseFeedback({ name: e.exercise.name, muscles: e.exercise.primaryMuscles, sets: e.sets, repMax: repMax.get(e.exerciseId) ?? null }, history[e.exerciseId] ?? [], show, unit);
    if (n) notes.push(n);
  }
  const balance = pushPullNote(data.weekSets.map((s) => ({ muscles: s.workoutExercise.exercise.primaryMuscles })), data.climbingMinutes);
  if (balance) notes.push(balance);
  const logged = week ? week.filter((d) => d.calories > 0) : [];
  const fuel = fuelNote(
    data.goal ? (data.goal.goalType.toLowerCase() as "gain" | "lose" | "maintain") : null,
    logged.length ? logged.reduce((s, d) => s + d.calories, 0) / logged.length : null,
    data.goal?.calories ?? null,
    logged.length,
  );
  if (fuel) notes.push(fuel);

  // Fixes first, then wins; at most five so it stays readable
  const shown = [...notes.filter((n) => n.tone === "fix"), ...notes.filter((n) => n.tone !== "fix")].slice(0, 5);
  const ask = encodeURIComponent(`I just finished ${data.workout.name}. ${shown.filter((n) => n.tone === "fix").map((n) => n.title).join(". ")}. What should I change?`);

  return (
    <section className="animate-rise mt-6 rounded-2xl bg-rack-raised p-5" aria-labelledby="coach-notes">
      <h2 id="coach-notes" className="flex items-center gap-2 font-display text-2xl font-semibold">
        <Sparkles size={20} className="text-plate-yellow" aria-hidden /> Coach notes
      </h2>
      {shown.length === 0 ? (
        <p className="mt-2 text-sm text-chalk-muted">Solid session. Nothing to fix. Keep logging and Coach will point out trends as they appear.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {shown.map((n) => (
            <li key={n.title} className="flex gap-3">
              {n.tone === "fix" ? <AlertTriangle size={18} className="mt-0.5 shrink-0 text-plate-yellow" aria-hidden /> : <Trophy size={18} className="mt-0.5 shrink-0 text-plate-green" aria-hidden />}
              <span>
                <span className="block font-semibold">{n.title}</span>
                <span className="text-sm text-chalk-muted">{n.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <Link href={`/coach?new=1&q=${ask}`} className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-rack py-2.5 text-sm font-semibold">
        <MessageCircle size={16} aria-hidden /> Talk it through with Coach
      </Link>
    </section>
  );
}
