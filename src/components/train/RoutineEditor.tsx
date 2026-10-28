"use client";

import { useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { ExerciseOption } from "@/lib/training";
import { saveRoutine, type RoutineInput } from "@/app/(app)/train/actions";
import { deleteRoutine } from "@/lib/clientActions";
import { failed, safe } from "@/lib/safeAction";
import { ExercisePicker } from "./ExercisePicker";
import { ExerciseThumb } from "./ExerciseThumb";
import { titleCase } from "./muscleFilters";

type Row = RoutineInput["exercises"][number] & { key: string; name: string; muscles: string[]; image: string | null };

const REST_OPTIONS = [0, 30, 60, 90, 120, 150, 180, 240, 300];

export function RoutineEditor({
  library,
  routine,
  programs = [],
  initialProgramId = null,
}: {
  library: ExerciseOption[];
  routine?: { id: string; name: string; notes: string | null; exercises: Omit<Row, "key">[] };
  /** Your programs, so a routine can be saved into one */
  programs?: { id: string; name: string; pinned: boolean }[];
  initialProgramId?: string | null;
}) {
  const [name, setName] = useState(routine?.name ?? "");
  // New routines go into the program you're running, so they show up on Train right away
  const [programId, setProgramId] = useState<string>(initialProgramId ?? (routine ? "" : programs.find((p) => p.pinned)?.id ?? ""));
  const nameRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const newId = useRef<string | null>(null); // chosen once, so retries can't create copies
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

  // Check the obvious things here first, with a clear message right where you're looking
  const problem = (): string | null => {
    if (!name.trim()) return "Give the routine a name.";
    if (rows.length === 0) return "Add at least one exercise.";
    const bad = rows.find((r) => !(r.targetSets >= 1 && r.targetSets <= 20));
    if (bad) return `${bad.name}: sets must be between 1 and 20.`;
    const badReps = rows.find((r) => (r.targetRepsMin !== null && !(r.targetRepsMin >= 1 && r.targetRepsMin <= 100)) || (r.targetRepsMax !== null && !(r.targetRepsMax >= 1 && r.targetRepsMax <= 100)));
    if (badReps) return `${badReps.name}: reps must be between 1 and 100.`;
    return null;
  };

  const save = () => {
    if (pending) return; // one save at a time, so a double tap can't make two copies
    const p = problem();
    if (p) {
      setError(p);
      if (!name.trim()) nameRef.current?.focus();
      else setTimeout(() => errorRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }), 0);
      return;
    }
    (document.activeElement as HTMLElement | null)?.blur?.(); // close the keyboard first
    if (!routine && !newId.current) newId.current = crypto.randomUUID().replace(/-/g, "");
    startTransition(async () => {
      setError(null);
      const result = await safe(() => saveRoutine(routine?.id ?? null, {
        name,
        notes: notes || undefined,
        programId: programId || null,
        exercises: rows.map(({ exerciseId, targetSets, targetRepsMin, targetRepsMax, restSeconds }) => ({
          exerciseId,
          targetSets,
          targetRepsMin,
          targetRepsMax,
          restSeconds,
        })),
      }, newId.current ?? undefined), { retries: 2 });
      if (failed(result)) {
        setError(result.error);
        setTimeout(() => errorRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }), 0);
      }
    });
  };

  const numberField =
    "w-full rounded-lg border border-rack-line bg-rack px-2 py-2 text-center tabular-nums focus:border-plate-yellow focus:outline-none";

  return (
    <div className="px-5">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        ref={nameRef}
        placeholder="Routine name, like Push A"
        aria-label="Routine name"
        className="w-full border-b-2 border-rack-line bg-transparent pb-2 font-display text-3xl font-bold placeholder:text-chalk-muted/60 focus:border-plate-red focus:outline-none"
      />
      {programs.length > 0 && (
        <label className="mt-4 flex items-center justify-between gap-3 text-sm text-chalk-muted">
          Part of program
          <select value={programId} onChange={(e) => setProgramId(e.target.value)} aria-label="Program"
            className="max-w-[60%] rounded-xl border border-rack-line bg-rack-raised px-3 py-2 text-base text-chalk">
            <option value="">None (single routine)</option>
            {programs.map((p) => <option key={p.id} value={p.id}>{p.name}{p.pinned ? " (running)" : ""}</option>)}
          </select>
        </label>
      )}
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
              <ExerciseThumb src={row.image} muscles={row.muscles} size={40} />
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

      {error && <p ref={errorRef} role="alert" className="mt-4 rounded-xl border border-plate-red/50 bg-plate-red/10 px-3 py-2 text-sm">{error}</p>}

      {/* Save stays in reach at the bottom of the screen */}
      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+5rem+var(--music-dock-h,0px))] z-10 -mx-5 mt-6 flex gap-3 bg-rack/95 px-5 py-3 backdrop-blur">
        {routine && (
          <button
            onClick={() => { if (confirm("Delete this routine? Past workouts stay in your history.")) startTransition(async () => { const r = await safe(() => deleteRoutine(routine.id)); if (failed(r)) setError(r.error); }); }}
            className="rounded-xl border border-rack-line px-4 py-3.5 font-medium text-chalk-muted hover:text-plate-red"
          >
            Delete
          </button>
        )}
        <button
          onClick={save}
          disabled={pending}
          aria-busy={pending}
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
