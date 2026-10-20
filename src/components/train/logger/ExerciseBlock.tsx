"use client";

import { memo } from "react";
import { Check, Minus, Plus, Timer, Trash2 } from "lucide-react";
import { suggestNext } from "@/lib/fitness/progression";
import { ExerciseThumb } from "../ExerciseThumb";
import { titleCase } from "../muscleFilters";
import { formatClock } from "./clock";
import type { LoggerExercise, LoggerSet, PreviousSet, SetType } from "./types";

const SET_TYPES: SetType[] = ["NORMAL", "WARMUP", "DROP", "FAILURE"];
const TYPE_BADGE: Record<SetType, { short: string; className: string }> = {
  NORMAL: { short: "", className: "text-chalk" },
  WARMUP: { short: "W", className: "text-plate-yellow" },
  DROP: { short: "D", className: "text-plate-blue" },
  FAILURE: { short: "F", className: "text-plate-red" },
};
const REST_OPTIONS = [0, 60, 90, 120, 180, 240];
const numberInput =
  "w-full rounded-lg bg-rack px-1 py-2 text-center font-display text-lg font-semibold tabular-nums placeholder:text-chalk-muted/50 focus:outline focus:outline-2 focus:outline-plate-yellow";

export type ExerciseHandlers = {
  updateSet: (exKey: string, setId: string, patch: Partial<LoggerSet>) => void;
  /** A set was checked off with these numbers (blanks already filled from the target). */
  completeSet: (ex: LoggerExercise, setId: string, weight: number | null, reps: number | null) => void;
  addSet: (exKey: string) => void;
  removeLastSet: (exKey: string) => void;
  removeExercise: (exKey: string, name: string) => void;
  setRest: (exKey: string, seconds: number) => void;
};

/**
 * One exercise and its sets. Memoized: typing in one exercise, or the clock
 * ticking, doesn't re-render the others.
 */
export const ExerciseBlock = memo(function ExerciseBlock({ ex, previous, unit, justDone, handlers }: {
  ex: LoggerExercise;
  previous: PreviousSet[] | undefined;
  unit: "lb" | "kg";
  justDone: string | null;
  handlers: ExerciseHandlers;
}) {
  // What to aim for this time, based on last session (double progression)
  const targets = suggestNext({ previous: previous ?? [], repMin: ex.repMin, repMax: ex.repMax, unit, equipment: ex.equipment ?? null });
  let workingIndex = 0;

  return (
    <section className="rounded-2xl bg-rack-raised py-4" aria-label={ex.name}>
      <div className="flex items-center gap-3 px-4">
        <ExerciseThumb src={ex.image} muscles={ex.muscles} size={42} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-xl font-semibold text-plate-blue">{ex.name}</h2>
          <p className="truncate text-xs text-chalk-muted">{titleCase(ex.muscles.join(", "))}</p>
        </div>
        <button onClick={() => handlers.removeExercise(ex.key, ex.name)} className="p-2 text-chalk-muted hover:text-plate-red" aria-label={`Remove ${ex.name}`}>
          <Trash2 size={18} />
        </button>
      </div>

      <button
        onClick={() => handlers.setRest(ex.key, REST_OPTIONS[(REST_OPTIONS.indexOf(ex.restSeconds) + 1) % REST_OPTIONS.length] ?? 90)}
        className="mt-2 ml-4 flex items-center gap-1.5 text-sm text-plate-blue"
      >
        <Timer size={15} aria-hidden /> Rest: {ex.restSeconds === 0 ? "off" : formatClock(ex.restSeconds * 1000)}
      </button>

      <table className="mt-3 w-full text-sm">
        <thead className="text-xs text-chalk-muted">
          <tr>
            <th className="w-12 pb-1 font-medium">Set</th>
            <th className="pb-1 text-left font-medium">Previous</th>
            <th className="w-20 pb-1 font-medium">{unit}</th>
            <th className="w-16 pb-1 font-medium">Reps</th>
            <th className="w-14 pb-1"><span className="sr-only">Done</span></th>
          </tr>
        </thead>
        <tbody>
          {ex.sets.map((set, i) => {
            if (set.type !== "WARMUP") workingIndex += 1;
            const prev = previous?.[i];
            const target = targets[i];
            const progressing = target && target.reason !== "repeat";
            const badge = TYPE_BADGE[set.type];
            const flash = justDone === set.id;
            return (
              <tr key={set.id} className={`${set.completed ? "bg-plate-green/15" : ""} ${flash ? "animate-flash" : ""}`}>
                <td className="py-1 text-center">
                  <button
                    onClick={() => handlers.updateSet(ex.key, set.id, { type: SET_TYPES[(SET_TYPES.indexOf(set.type) + 1) % 4] })}
                    className={`h-9 w-9 rounded-lg font-display text-lg font-bold ${badge.className}`}
                    aria-label={`Set ${i + 1} type: ${set.type.toLowerCase()}. Tap to change.`}
                  >
                    {badge.short || workingIndex}
                  </button>
                </td>
                <td className="py-1">
                  <button onClick={() => prev && handlers.updateSet(ex.key, set.id, { weight: prev.weight, reps: prev.reps })} className="text-left text-chalk-muted tabular-nums" disabled={!prev}>
                    {prev ? `${prev.weight ?? 0} × ${prev.reps ?? 0}` : "—"}
                    {progressing && !set.completed && (
                      <span className="block text-xs font-semibold text-plate-green" aria-label={`Target ${target.weight} by ${target.reps}`}>
                        → {target.weight} × {target.reps}
                      </span>
                    )}
                  </button>
                </td>
                <td className="px-1 py-1">
                  <input type="number" inputMode="decimal" step="any" value={set.weight ?? ""}
                    placeholder={target ? String(target.weight) : prev?.weight != null ? String(prev.weight) : "0"}
                    onChange={(e) => handlers.updateSet(ex.key, set.id, { weight: e.target.value === "" ? null : Number(e.target.value) })}
                    aria-label={`Set ${i + 1} weight`} className={numberInput} />
                </td>
                <td className="px-1 py-1">
                  <input type="number" inputMode="numeric" value={set.reps ?? ""}
                    placeholder={target ? String(target.reps) : prev?.reps != null ? String(prev.reps) : "0"}
                    onChange={(e) => handlers.updateSet(ex.key, set.id, { reps: e.target.value === "" ? null : Math.round(Number(e.target.value)) })}
                    aria-label={`Set ${i + 1} reps`} className={numberInput} />
                </td>
                <td className="py-1 pr-3 text-center">
                  <button
                    onClick={() =>
                      set.completed
                        ? handlers.updateSet(ex.key, set.id, { completed: false })
                        : // Blanks take today's target, so tapping the check logs the suggested set
                          handlers.completeSet(ex, set.id, set.weight ?? target?.weight ?? prev?.weight ?? null, set.reps ?? target?.reps ?? prev?.reps ?? null)
                    }
                    aria-pressed={set.completed}
                    aria-label={`Mark set ${i + 1} ${set.completed ? "not done" : "done"}`}
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${set.completed ? "bg-plate-green text-white" : "bg-rack text-chalk-muted"} ${flash ? "animate-pop" : ""}`}
                  >
                    <Check size={20} strokeWidth={3} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="mt-2 flex gap-2 px-4">
        <button onClick={() => handlers.addSet(ex.key)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-rack py-2.5 font-medium">
          <Plus size={17} aria-hidden /> Add set
        </button>
        {ex.sets.length > 1 && (
          <button onClick={() => handlers.removeLastSet(ex.key)} className="flex items-center justify-center gap-1.5 rounded-xl bg-rack px-4 py-2.5 text-chalk-muted" aria-label="Remove last set">
            <Minus size={17} aria-hidden />
          </button>
        )}
      </div>
    </section>
  );
});
