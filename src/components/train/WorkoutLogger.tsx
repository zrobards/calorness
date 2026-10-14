"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Check, CloudCheck, CloudUpload, Minus, Plus, Timer, Trash2, X } from "lucide-react";
import type { ExerciseOption } from "@/lib/training";
import { compactNumber } from "@/lib/fitness/units";
import { discardWorkout, finishWorkout, previousSetsFor, saveWorkoutEdits, syncWorkoutDraft } from "@/app/(app)/train/actions";
import { haptic } from "@/lib/haptics";
import { suggestNext } from "@/lib/fitness/progression";
import { ExercisePicker } from "./ExercisePicker";
import { ExerciseThumb } from "./ExerciseThumb";
import { titleCase } from "./muscleFilters";

type SetType = "WARMUP" | "NORMAL" | "DROP" | "FAILURE";
type LoggerSet = { id: string; type: SetType; weight: number | null; reps: number | null; completed: boolean };
type PreviousSet = { weight: number | null; reps: number | null; type: string };
export type LoggerExercise = {
  key: string;
  exerciseId: string;
  name: string;
  muscles: string[];
  image: string | null;
  restSeconds: number;
  sets: LoggerSet[];
  equipment?: string | null;
  repMin?: number | null;
  repMax?: number | null;
};
type LoggerState = {
  name: string;
  exercises: LoggerExercise[];
  previous: Record<string, PreviousSet[]>;
  rest?: { endsAt: number; total: number } | null; // saved so the timer survives closing the app
  savedAt?: number;
};

const SET_TYPES: SetType[] = ["NORMAL", "WARMUP", "DROP", "FAILURE"];
const TYPE_BADGE: Record<SetType, { short: string; className: string }> = {
  NORMAL: { short: "", className: "text-chalk" },
  WARMUP: { short: "W", className: "text-plate-yellow" },
  DROP: { short: "D", className: "text-plate-blue" },
  FAILURE: { short: "F", className: "text-plate-red" },
};

const uid = () => Math.random().toString(36).slice(2, 10);
const storageKey = (id: string, mode: string) => `calorness:${mode}:${id}`;

export function WorkoutLogger({
  workout,
  unit,
  initialExercises,
  initialPrevious,
  library,
  mode = "live",
}: {
  mode?: "live" | "edit";
  workout: { id: string; name: string; startedAt: string; updatedAt: string };
  unit: "lb" | "kg";
  initialExercises: LoggerExercise[];
  initialPrevious: Record<string, PreviousSet[]>;
  library: ExerciseOption[];
}) {
  // This component only renders in the browser (see WorkoutLoggerClient), so
  // it can safely restore an in-progress session from localStorage. That
  // means a refresh, a dead battery, or closing the app mid-set loses nothing.
  // Two copies can exist: this phone's (localStorage) and the server's
  // autosave. Use whichever is newer, so a second device picks up where
  // the first left off.
  const [state, setState] = useState<LoggerState>(() => {
    const server: LoggerState = { name: workout.name, exercises: initialExercises, previous: initialPrevious };
    try {
      const saved = localStorage.getItem(storageKey(workout.id, mode));
      if (saved) {
        const local = JSON.parse(saved) as LoggerState;
        if ((local.savedAt ?? 0) >= new Date(workout.updatedAt).getTime() - 2000) return local;
      }
    } catch {}
    return server;
  });
  const [sync, setSync] = useState<"saved" | "saving" | "offline">("saved");
  const [justDone, setJustDone] = useState<string | null>(null);
  const latest = useRef(state);
  const [picking, setPicking] = useState(false);
  const rest = state.rest ?? null;
  const setRest = (r: LoggerState["rest"] | ((r: LoggerState["rest"]) => LoggerState["rest"])) =>
    setState((s) => ({ ...s, rest: typeof r === "function" ? r(s.rest) : r }));
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const payload = useCallback(
    (st: LoggerState) => ({
      name: st.name.trim() || "Workout",
      exercises: st.exercises.map((e) => ({
        exerciseId: e.exerciseId,
        restSeconds: e.restSeconds,
        sets: e.sets.map(({ type, weight, reps, completed }) => ({ type, weight, reps, completed })),
      })),
    }),
    [],
  );

  const pushToServer = useCallback(async () => {
    if (mode !== "live") return;
    setSync("saving");
    try {
      const r = await syncWorkoutDraft(workout.id, payload(latest.current));
      setSync("error" in r ? "offline" : "saved");
    } catch {
      setSync("offline"); // no signal: it's still safe on the phone, and retries on the next change
    }
  }, [mode, payload, workout.id]);

  // Save to the phone instantly, and to the server a moment after you stop tapping
  useEffect(() => {
    latest.current = state;
    try {
      localStorage.setItem(storageKey(workout.id, mode), JSON.stringify({ ...state, savedAt: Date.now() }));
    } catch {}
    if (mode !== "live") return;
    const t = setTimeout(pushToServer, 1500);
    return () => clearTimeout(t);
  }, [state, workout.id, mode, pushToServer]);

  // Rest timer on the lock screen: if you leave the app mid-rest, ask the
  // server to notify you when it's over; coming back cancels that.
  const nextLabelRef = useRef<string | null>(null);
  useEffect(() => {
    if (mode !== "live") return;
    const onChange = () => {
      if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
      const r = latest.current.rest; // kept current by the autosave effect
      if (document.visibilityState === "hidden" && r) {
        const seconds = Math.round((r.endsAt - Date.now()) / 1000);
        if (seconds > 3) {
          fetch("/api/push/rest", { method: "POST", keepalive: true, headers: { "content-type": "application/json" },
            body: JSON.stringify({ seconds: Math.min(seconds, 290), label: nextLabelRef.current ?? undefined }) }).catch(() => {});
        }
      } else if (document.visibilityState === "visible") {
        fetch("/api/push/rest", { method: "DELETE", keepalive: true }).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, [mode]);

  // Save right away when the app is swiped away or the screen locks
  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && pushToServer();
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [pushToServer]);

  // Keep the screen awake during a live workout so you don't have to unlock between sets
  useEffect(() => {
    if (mode !== "live" || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request("screen");
      } catch {}
    };
    acquire();
    const onVisible = () => document.visibilityState === "visible" && acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
    };
  }, [mode]);

  // One clock drives the elapsed time and the rest timer
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const restLeft = rest ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000)) : 0;
  useEffect(() => {
    if (rest && restLeft === 0) {
      haptic("warning");
      const t = setTimeout(() => setState((st) => ({ ...st, rest: null })), 2500);
      return () => clearTimeout(t);
    }
  }, [rest, restLeft]);

  const elapsed = Math.max(0, now - new Date(workout.startedAt).getTime());
  const stats = useMemo(() => {
    let volume = 0;
    let sets = 0;
    for (const e of state.exercises)
      for (const s of e.sets)
        if (s.completed && s.type !== "WARMUP") {
          sets += 1;
          volume += (s.weight ?? 0) * (s.reps ?? 0);
        }
    return { volume, sets };
  }, [state.exercises]);

  const updateExercise = (key: string, fn: (e: LoggerExercise) => LoggerExercise) =>
    setState((s) => ({ ...s, exercises: s.exercises.map((e) => (e.key === key ? fn(e) : e)) }));

  const updateSet = (exKey: string, setId: string, patch: Partial<LoggerSet>) =>
    updateExercise(exKey, (e) => ({ ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) }));

  // What to aim for this time, based on last session (double progression)
  const suggestionsFor = (ex: LoggerExercise) =>
    suggestNext({
      previous: state.previous[ex.exerciseId] ?? [],
      repMin: ex.repMin,
      repMax: ex.repMax,
      unit,
      equipment: ex.equipment ?? null,
    });

  const toggleComplete = (ex: LoggerExercise, set: LoggerSet, index: number) => {
    if (set.completed) return updateSet(ex.key, set.id, { completed: false });
    // Fill blanks with today's target, so tapping the check logs the suggested set
    const prev = state.previous[ex.exerciseId]?.[index];
    const target = suggestionsFor(ex)[index];
    const weight = set.weight ?? target?.weight ?? prev?.weight ?? null;
    const reps = set.reps ?? target?.reps ?? prev?.reps ?? null;
    if (reps === null) return setError("Enter reps before checking off the set.");
    setError(null);
    updateSet(ex.key, set.id, { completed: true, weight, reps });
    haptic("success");
    setJustDone(set.id);
    if (mode === "live" && ex.restSeconds > 0) {
      nextLabelRef.current = ex.name;
      setRest({ endsAt: now + ex.restSeconds * 1000, total: ex.restSeconds });
    }
  };

  const addSet = (ex: LoggerExercise) => {
    const last = ex.sets.at(-1);
    updateExercise(ex.key, (e) => ({
      ...e,
      sets: [...e.sets, { id: uid(), type: "NORMAL", weight: last?.weight ?? null, reps: last?.reps ?? null, completed: false }],
    }));
  };

  const addExercises = async (picked: ExerciseOption[]) => {
    setPicking(false);
    const rows: LoggerExercise[] = picked.map((p) => ({
      key: `${p.id}-${uid()}`,
      exerciseId: p.id,
      name: p.name,
      muscles: p.primaryMuscles,
      image: p.image,
      restSeconds: 90,
      equipment: p.equipment,
      sets: Array.from({ length: 3 }, () => ({ id: uid(), type: "NORMAL" as const, weight: null, reps: null, completed: false })),
    }));
    setState((s) => ({ ...s, exercises: [...s.exercises, ...rows] }));
    const prev = await previousSetsFor(workout.id, picked.map((p) => p.id));
    setState((s) => ({ ...s, previous: { ...s.previous, ...prev } }));
  };

  const finish = () => {
    const incomplete = state.exercises.some((e) => e.sets.some((s) => !s.completed));
    if (incomplete && !confirm("Unchecked sets will be left out. Save the workout?")) return;
    localStorage.removeItem(storageKey(workout.id, mode));
    startTransition(async () => {
      const save = mode === "edit" ? saveWorkoutEdits : finishWorkout;
      const result = await save(workout.id, payload(state));
      // these redirect on success, so getting a result back means it failed
      if (result?.error) {
        setError(result.error);
        localStorage.setItem(storageKey(workout.id, mode), JSON.stringify({ ...state, savedAt: Date.now() }));
      }
    });
  };

  const discard = () => {
    if (!confirm("Discard this workout? Nothing from it will be saved.")) return;
    localStorage.removeItem(storageKey(workout.id, mode));
    startTransition(() => discardWorkout(workout.id));
  };

  const numberInput =
    "w-full rounded-lg bg-rack px-1 py-2 text-center font-display text-lg font-semibold tabular-nums placeholder:text-chalk-muted/50 focus:outline focus:outline-2 focus:outline-plate-yellow";

  return (
    <div className="pb-40">
      {/* Sticky header with the live clock */}
      <header
        className="sticky top-0 z-20 border-b border-rack-line bg-rack/95 px-5 pb-3 backdrop-blur"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
      >
        <div className="flex items-center gap-3">
          <input
            value={state.name}
            onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
            aria-label="Workout name"
            className="min-w-0 flex-1 bg-transparent font-display text-2xl font-bold focus:outline-none"
          />
          <button
            onClick={finish}
            disabled={pending}
            className="rounded-xl bg-plate-red px-5 py-2 font-display text-lg font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Saving…" : mode === "edit" ? "Save" : "Finish"}
          </button>
        </div>
        {mode === "live" ? (
          <p className="mt-1 flex items-center gap-1 text-xs text-chalk-muted" aria-live="polite">
            {sync === "saving" ? <CloudUpload size={13} aria-hidden /> : <CloudCheck size={13} aria-hidden />}
            {sync === "saving" ? "Saving…" : sync === "offline" ? "Saved on this phone, will sync when online" : "All sets saved"}
          </p>
        ) : (
          <p className="mt-1 text-xs text-plate-yellow">Editing a finished workout. Only checked sets are kept.</p>
        )}
        <dl className="mt-2 grid grid-cols-3 text-sm">
          <Stat label="Duration" value={mode === "edit" ? "—" : formatClock(elapsed)} />
          <Stat label={`Volume (${unit})`} value={compactNumber(stats.volume)} />
          <Stat label="Sets" value={String(stats.sets)} />
        </dl>
      </header>

      {error && (
        <p role="alert" className="mx-5 mt-3 rounded-xl border border-plate-red/50 bg-plate-red/10 px-4 py-2 text-sm">
          {error}
        </p>
      )}

      <div className="mt-4 space-y-4 px-3">
        {state.exercises.map((ex) => {
          let workingIndex = 0;
          const targets = suggestionsFor(ex);
          return (
            <section key={ex.key} className="rounded-2xl bg-rack-raised py-4" aria-label={ex.name}>
              <div className="flex items-center gap-3 px-4">
                <ExerciseThumb src={ex.image} size={42} />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-display text-xl font-semibold text-plate-blue">{ex.name}</h2>
                  <p className="truncate text-xs text-chalk-muted">{titleCase(ex.muscles.join(", "))}</p>
                </div>
                <button
                  onClick={() => confirm(`Remove ${ex.name}?`) && setState((s) => ({ ...s, exercises: s.exercises.filter((e) => e.key !== ex.key) }))}
                  className="p-2 text-chalk-muted hover:text-plate-red"
                  aria-label={`Remove ${ex.name}`}
                >
                  <Trash2 size={18} />
                </button>
              </div>

              <button
                onClick={() => {
                  const options = [0, 60, 90, 120, 180, 240];
                  const next = options[(options.indexOf(ex.restSeconds) + 1) % options.length] ?? 90;
                  updateExercise(ex.key, (e) => ({ ...e, restSeconds: next }));
                }}
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
                    const prev = state.previous[ex.exerciseId]?.[i];
                    const target = targets[i];
                    const progressing = target && target.reason !== "repeat";
                    const badge = TYPE_BADGE[set.type];
                    return (
                      <tr key={set.id} className={`${set.completed ? "bg-plate-green/15" : ""} ${justDone === set.id ? "animate-flash" : ""}`}>
                        <td className="py-1 text-center">
                          <button
                            onClick={() => updateSet(ex.key, set.id, { type: SET_TYPES[(SET_TYPES.indexOf(set.type) + 1) % 4] })}
                            className={`h-9 w-9 rounded-lg font-display text-lg font-bold ${badge.className}`}
                            aria-label={`Set ${i + 1} type: ${set.type.toLowerCase()}. Tap to change.`}
                          >
                            {badge.short || workingIndex}
                          </button>
                        </td>
                        <td className="py-1">
                          <button
                            onClick={() => prev && updateSet(ex.key, set.id, { weight: prev.weight, reps: prev.reps })}
                            className="text-left text-chalk-muted tabular-nums"
                            disabled={!prev}
                          >
                            {prev ? `${prev.weight ?? 0} × ${prev.reps ?? 0}` : "—"}
                            {progressing && !set.completed && (
                              <span className="block text-xs font-semibold text-plate-green" aria-label={`Target ${target.weight} by ${target.reps}`}>
                                → {target.weight} × {target.reps}
                              </span>
                            )}
                          </button>
                        </td>
                        <td className="px-1 py-1">
                          <input
                            type="number"
                            inputMode="decimal"
                            step="any"
                            value={set.weight ?? ""}
                            placeholder={target ? String(target.weight) : prev?.weight != null ? String(prev.weight) : "0"}
                            onChange={(e) => updateSet(ex.key, set.id, { weight: e.target.value === "" ? null : Number(e.target.value) })}
                            aria-label={`Set ${i + 1} weight`}
                            className={numberInput}
                          />
                        </td>
                        <td className="px-1 py-1">
                          <input
                            type="number"
                            inputMode="numeric"
                            value={set.reps ?? ""}
                            placeholder={target ? String(target.reps) : prev?.reps != null ? String(prev.reps) : "0"}
                            onChange={(e) => updateSet(ex.key, set.id, { reps: e.target.value === "" ? null : Math.round(Number(e.target.value)) })}
                            aria-label={`Set ${i + 1} reps`}
                            className={numberInput}
                          />
                        </td>
                        <td className="py-1 pr-3 text-center">
                          <button
                            onClick={() => toggleComplete(ex, set, i)}
                            aria-pressed={set.completed}
                            aria-label={`Mark set ${i + 1} ${set.completed ? "not done" : "done"}`}
                            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${
                              set.completed ? "bg-plate-green text-white" : "bg-rack text-chalk-muted"
                            } ${justDone === set.id ? "animate-pop" : ""}`}
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
                <button onClick={() => addSet(ex)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-rack py-2.5 font-medium">
                  <Plus size={17} aria-hidden /> Add set
                </button>
                {ex.sets.length > 1 && (
                  <button
                    onClick={() => updateExercise(ex.key, (e) => ({ ...e, sets: e.sets.slice(0, -1) }))}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-rack px-4 py-2.5 text-chalk-muted"
                    aria-label="Remove last set"
                  >
                    <Minus size={17} aria-hidden />
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <div className="mt-4 space-y-3 px-3">
        <button
          onClick={() => setPicking(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-plate-blue py-3.5 font-display text-xl font-semibold text-white"
        >
          <Plus size={20} aria-hidden /> Add exercise
        </button>
        {mode === "live" && (
          <button onClick={discard} className="w-full rounded-2xl py-3 font-medium text-plate-red">
            Discard workout
          </button>
        )}
      </div>

      {rest && <RestTimer left={restLeft} total={rest.total} onAdjust={(d) => { haptic(); setRest((r) => r && { endsAt: r.endsAt + d * 1000, total: Math.max(1, r.total + d) }); }} onSkip={() => setRest(null)} />}

      {picking && <ExercisePicker exercises={library} onClose={() => setPicking(false)} onAdd={addExercises} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-chalk-muted">{label}</dt>
      <dd className="font-display text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function formatClock(ms: number) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0");
  return h ? `${h}:${mm}:${String(s).padStart(2, "0")}` : `${mm}:${String(s).padStart(2, "0")}`;
}

function RestTimer({ left, total, onAdjust, onSkip }: { left: number; total: number; onAdjust: (d: number) => void; onSkip: () => void }) {
  const r = 26;
  const circumference = 2 * Math.PI * r;
  const progress = total > 0 ? left / total : 0;
  const done = left === 0;
  return (
    <div
      className="fixed inset-x-0 z-30 px-3"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 4.75rem)" }}
      role="timer"
      aria-live="polite"
      aria-label={done ? "Rest over" : `Rest ${left} seconds left`}
    >
      <div className={`mx-auto flex max-w-md items-center gap-4 rounded-2xl border px-4 py-3 shadow-2xl ${done ? "border-plate-green bg-plate-green/20" : "border-rack-line bg-rack-raised"}`}>
        <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden className="-rotate-90">
          <circle cx="32" cy="32" r={r} fill="none" stroke="var(--color-rack-line)" strokeWidth="6" />
          <circle
            cx="32" cy="32" r={r} fill="none" stroke="var(--color-plate-blue)" strokeWidth="6" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)}
            className="transition-[stroke-dashoffset] duration-300 ease-linear"
          />
        </svg>
        <div className="flex-1">
          <p className="text-xs text-chalk-muted">{done ? "Rest over" : "Resting"}</p>
          <p className="font-display text-4xl leading-none font-bold tabular-nums">{done ? "Go" : formatClock(left * 1000)}</p>
        </div>
        {!done && (
          <>
            <button onClick={() => onAdjust(-15)} className="rounded-lg bg-rack px-2.5 py-2 text-sm font-medium" aria-label="15 seconds less">−15</button>
            <button onClick={() => onAdjust(15)} className="rounded-lg bg-rack px-2.5 py-2 text-sm font-medium" aria-label="15 seconds more">+15</button>
          </>
        )}
        <button onClick={onSkip} className="p-1.5 text-chalk-muted" aria-label="Close rest timer">
          <X size={20} />
        </button>
      </div>
    </div>
  );
}
