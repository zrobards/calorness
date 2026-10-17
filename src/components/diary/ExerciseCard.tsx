"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Dumbbell, Flame, Plus, Trash2 } from "lucide-react";
import { deleteActivity } from "@/app/(app)/train/cardio/actions";

type Item = { id: string; kind: "workout" | "activity"; name: string; minutes: number; total: number; net: number };

/** Today's exercise in the Diary, with what it adds to the calorie goal. */
export function ExerciseCard({ day, exercise }: { day: string; exercise: { items: Item[]; net: number; credit: number; calories: number } }) {
  const [pending, start] = useTransition();
  return (
    <section className="animate-rise mx-5 mt-4 rounded-2xl bg-rack-raised" aria-label="Exercise">
      <div className="flex items-baseline justify-between px-5 pt-4 pb-2">
        <h2 className="font-display text-2xl font-semibold">Exercise</h2>
        <span className="font-display text-lg font-semibold text-plate-green tabular-nums">+{exercise.calories}</span>
      </div>
      {exercise.items.length > 0 && (
        <ul className="divide-y divide-rack-line border-y border-rack-line">
          {exercise.items.map((x) => (
            <li key={x.id} className="flex items-center gap-3 px-5 py-3">
              {x.kind === "workout" ? <Dumbbell size={18} className="shrink-0 text-chalk-muted" aria-hidden /> : <Flame size={18} className="shrink-0 text-plate-red" aria-hidden />}
              <span className="min-w-0 flex-1">
                {x.kind === "workout" ? (
                  <Link href={`/train/history/${x.id}`} className="block truncate font-medium">{x.name}</Link>
                ) : (
                  <span className="block truncate font-medium">{x.name}</span>
                )}
                <span className="text-sm text-chalk-muted">{x.minutes} min, {x.total} cal burned</span>
              </span>
              <span className="text-right font-display text-lg font-semibold tabular-nums">{x.net}</span>
              {x.kind === "activity" && (
                <button disabled={pending} onClick={() => confirm(`Delete ${x.name}?`) && start(() => deleteActivity(x.id))} className="p-1 text-chalk-muted hover:text-plate-red" aria-label={`Delete ${x.name}`}>
                  <Trash2 size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="px-5 py-3">
        {exercise.items.length > 0 && (
          <p className="mb-2 text-xs text-chalk-muted">
            {exercise.net} cal above resting{exercise.credit < 100 ? `; ${exercise.credit}% is added to your goal (change in Profile), since trackers tend to overestimate` : " is added to your goal"}.
            {exercise.calories > 0 && ` That's about ${Math.round((exercise.calories * 0.7) / 4)} g more carbs and ${Math.round((exercise.calories * 0.3) / 9)} g more fat.`}
          </p>
        )}
        <Link href={`/train/cardio/new?day=${day}`} className="flex items-center gap-1.5 font-medium text-plate-blue">
          <Plus size={18} aria-hidden /> Log cardio or activity
        </Link>
      </div>
    </section>
  );
}
