"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Dumbbell, Flame, HeartPulse, Pencil, Plus, Trash2 } from "lucide-react";
import { EditSessionTime } from "@/components/train/EditSessionTime";
import { deleteActivity } from "@/lib/clientActions";

type Item = { id: string; kind: "workout" | "activity" | "health"; name: string; minutes: number; effort?: string; total: number; net: number; included?: boolean };

/** Today's exercise in the Diary, with what it adds to the calorie goal. */
export function ExerciseCard({ day, exercise, onChanged }: { day: string; exercise: { items: Item[]; net: number; credit: number; calories: number; fromHealth?: boolean }; onChanged?: () => void }) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <section className="animate-rise mx-5 mt-4 rounded-2xl bg-rack-raised" aria-label="Exercise">
      <div className="flex items-baseline justify-between px-5 pt-4 pb-2">
        <h2 className="font-display text-2xl font-semibold">Exercise</h2>
        <span className="font-display text-lg font-semibold text-plate-green tabular-nums">+{exercise.calories}</span>
      </div>
      {exercise.items.length > 0 && (
        <ul className="divide-y divide-rack-line border-y border-rack-line">
          {exercise.items.map((x) => (
            <li key={x.id} className="px-5 py-3"><div className="flex items-center gap-3">
              {x.kind === "health" ? <HeartPulse size={18} className="shrink-0 text-plate-red" aria-hidden /> : x.kind === "workout" ? <Dumbbell size={18} className="shrink-0 text-chalk-muted" aria-hidden /> : <Flame size={18} className="shrink-0 text-plate-red" aria-hidden />}
              <span className="min-w-0 flex-1">
                {x.kind === "workout" ? (
                  <Link href={`/train/history/${x.id}`} className="block truncate font-medium">{x.name}</Link>
                ) : (
                  <span className="block truncate font-medium">{x.name}</span>
                )}
                <span className="text-sm text-chalk-muted">
                  {x.kind === "health" ? `${x.minutes ? `${x.minutes} exercise min, ` : ""}synced from your iPhone` : `${x.minutes} min, ${x.total} cal burned`}
                  {x.included && ", counted in Apple Health"}
                </span>
              </span>
              <span className={`text-right font-display text-lg font-semibold tabular-nums ${x.included ? "text-chalk-muted line-through decoration-1" : ""}`}>{x.net}</span>
              {x.kind !== "health" && (
                <button onClick={() => setEditing((e) => (e === x.id ? null : x.id))} className={`p-1 ${editing === x.id ? "text-plate-yellow" : "text-chalk-muted"}`} aria-label={`Change how long ${x.name} lasted`} aria-expanded={editing === x.id}>
                  <Pencil size={16} />
                </button>
              )}
              {x.kind === "activity" && (
                <button disabled={pending} onClick={() => confirm(`Delete ${x.name}?`) && start(async () => { await deleteActivity(x.id); onChanged?.(); })} className="p-1 text-chalk-muted hover:text-plate-red" aria-label={`Delete ${x.name}`}>
                  <Trash2 size={16} />
                </button>
              )}
              </div>
              {editing === x.id && x.kind !== "health" && (
                <div className="mt-3">
                  <EditSessionTime kind={x.kind} id={x.id} minutes={x.minutes} effort={x.effort}
                    onSaved={() => { onChanged?.(); setTimeout(() => setEditing(null), 700); }} onCancel={() => setEditing(null)} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="px-5 py-3">
        {exercise.items.length > 0 && (
          <p className="mb-2 text-xs text-chalk-muted">
            {exercise.fromHealth ? "Using Apple Health's active calories (they already include your workouts). " : ""}{exercise.net} cal above resting{exercise.credit < 100 ? `; ${exercise.credit}% is added to your goal (change in Profile), since trackers tend to overestimate` : " is added to your goal"}.
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
