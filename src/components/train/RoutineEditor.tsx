"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { ExerciseOption } from "@/lib/training";
import { saveRoutine, deleteRoutine, type RoutineInput } from "@/app/(app)/train/actions";
import { ExercisePicker } from "./ExercisePicker";
import { ExerciseThumb } from "./ExerciseThumb";
import { titleCase } from "./muscleFilters";

type Row = RoutineInput["exercises"][number] & { key: string; name: string; muscles: string[]; image: string | null };

const REST_OPTIONS = [0, 30, 60, 90, 120, 150, 180, 240, 300];

export function RoutineEditor({
  library,
  routine,
}: {
  library: ExerciseOption[];
  routine?: { id: string; name: string; notes: string | null; exercises: Omit<Row, "key">[] };
}) {
  const [name, setName] = useState(routine?.name ?? "");
  const [notes, setNotes] = useState(routine?.notes ?? "");
  const [rows, setRows] = useState<Row[]>(
    () => routine?.exercises.map((e, i) => ({ ...e, key: `${e.exerciseId}-${i}` })) ?? [],
  );
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const update = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const move = (index: number, dir: -1 | 1) =>
    setRows((rs) => {
      const next = [...rs];
      const target = index + dir;
      if (target < 0 || target >= next.length) return rs;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await saveRoutine(routine?.id ?? null, {
        name,
        notes: notes || undefined,
        exercises: rows.map(({ exerciseId, targetSets, targetRepsMin, targetRepsMax, restSeconds }) => ({
          exerciseId,
          targetSets,
          targetRepsMin,
          targetRepsMax,
          restSeconds,
        })),
      });
      if (result?.error) setError(result.error);
    });

  const numberField =
    "w-full rounded-lg border border-rack-line bg-rack px-2 py-2 text-center tabular-nums focus:border-plate-yellow focus:outline-none";

  return (
    <div className="px-5">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Routine name, like Push A"
        aria-label="Routine name"
        className="w-full border-b-2 border-rack-line bg-transparent pb-2 font-display text-3xl font-bold placeholder:text-chalk-muted/60 focus:border-plate-red focus:outline-none"
      />
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        aria-label="Notes"
        rows={2}
        className="mt-4 w-full resize-none rounded-xl border border-rack-line bg-rack-raised px-3 py-2 text-sm focus:border-plate-yellow focus:outline-none"
      />

      <ol className="mt-4 space-y-3">
        {rows.map((row, i) => (
          <li key={row.key} className="rounded-2xl bg-rack-raised p-4">
            <div className="flex items-center gap-3">
              <ExerciseThumb src={row.image} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-lg font-semibold">{row.name}</p>
                <p className="truncate text-xs text-chalk-muted">{titleCase(row.muscles.join(", "))}</p>
              </div>
              <div className="flex items-center text-chalk-muted">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1.5 disabled:opacity-30" aria-label="Move up">
                  <ArrowUp size={18} />
                </button>
                <button onClick={() => move(i, 1)} disabled={i === rows.length - 1} className="p-1.5 disabled:opacity-30" aria-label="Move down">
                  <ArrowDown size={18} />
                </button>
                <button onClick={() => setRows((rs) => rs.filter((r) => r.key !== row.key))} className="p-1.5 hover:text-plate-red" aria-label={`Remove ${row.name}`}>
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-[1fr_1.6fr_1.3fr] gap-2 text-xs text-chalk-muted">
              <label>
                Sets
                <input type="number" inputMode="numeric" min={1} max={20} value={row.targetSets}
                  onChange={(e) => update(row.key, { targetSets: Math.max(1, Number(e.target.value) || 1) })}
                  className={`${numberField} mt-1 text-chalk`} />
              </label>
              <div>
                Reps
                <div className="mt-1 flex items-center gap-1 text-chalk">
                  <input type="number" inputMode="numeric" min={1} value={row.targetRepsMin ?? ""} placeholder="8" aria-label="Minimum reps"
                    onChange={(e) => update(row.key, { targetRepsMin: e.target.value ? Number(e.target.value) : null })}
                    className={numberField} />
                  <span className="text-chalk-muted">–</span>
                  <input type="number" inputMode="numeric" min={1} value={row.targetRepsMax ?? ""} placeholder="12" aria-label="Maximum reps"
                    onChange={(e) => update(row.key, { targetRepsMax: e.target.value ? Number(e.target.value) : null })}
                    className={numberField} />
                </div>
              </div>
              <label>
                Rest
                <select value={row.restSeconds} onChange={(e) => update(row.key, { restSeconds: Number(e.target.value) })}
                  className={`${numberField} mt-1 text-chalk`}>
                  {REST_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s === 0 ? "Off" : s < 60 ? `${s}s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`}</option>
                  ))}
                </select>
              </label>
            </div>
          </li>
        ))}
      </ol>

      <button
        onClick={() => setPicking(true)}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-rack-line py-4 font-medium text-chalk-muted hover:border-plate-blue hover:text-chalk"
      >
        <Plus size={20} aria-hidden /> Add exercises
      </button>

      {error && <p role="alert" className="mt-4 text-sm text-plate-red">{error}</p>}

      <div className="mt-6 flex gap-3">
        {routine && (
          <button
            onClick={() => { if (confirm("Delete this routine? Past workouts stay in your history.")) startTransition(() => deleteRoutine(routine.id)); }}
            className="rounded-xl border border-rack-line px-4 py-3.5 font-medium text-chalk-muted hover:text-plate-red"
          >
            Delete
          </button>
        )}
        <button
          onClick={save}
          disabled={pending}
          className="flex-1 rounded-xl bg-plate-red py-3.5 font-display text-xl font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save routine"}
        </button>
      </div>

      {picking && (
        <ExercisePicker
          exercises={library}
          onClose={() => setPicking(false)}
          onAdd={(picked) => {
            setRows((rs) => [
              ...rs,
              ...picked.map((e, i) => ({
                key: `${e.id}-${Date.now()}-${i}`,
                exerciseId: e.id,
                name: e.name,
                muscles: e.primaryMuscles,
                image: e.image,
                targetSets: 3,
                targetRepsMin: 8,
                targetRepsMax: 12,
                restSeconds: 90,
              })),
            ]);
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}
