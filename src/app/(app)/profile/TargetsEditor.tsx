"use client";

import { useActionState, useState } from "react";
import { caloriesFromMacros } from "@/lib/fitness/nutrition";
import { haptic } from "@/lib/haptics";
import { updateTargets, type TargetsState } from "./actions";

type Targets = { calories: number; proteinG: number; carbsG: number; fatG: number; water: number };

const FIELDS = [
  { key: "proteinG", label: "Protein", unit: "g", color: "border-plate-blue", dot: "bg-plate-blue" },
  { key: "carbsG", label: "Carbs", unit: "g", color: "border-plate-yellow", dot: "bg-plate-yellow" },
  { key: "fatG", label: "Fat", unit: "g", color: "border-plate-green", dot: "bg-plate-green" },
] as const;

/**
 * Edit your daily targets directly. Shows how many calories your macros add
 * up to, so it's easy to keep the two in agreement.
 */
export function TargetsEditor({ initial, waterUnit }: { initial: Targets; waterUnit: "fl oz" | "ml" }) {
  const [values, setValues] = useState(initial);
  const [baseline, setBaseline] = useState(initial); // what's saved on the server
  const [state, action, pending] = useActionState<TargetsState, FormData>(async (prev, fd) => {
    const r = await updateTargets(prev, fd);
    if (r.saved) {
      haptic("success");
      // read back from the submitted form, so this never uses stale values
      const n = (k: string) => Number(fd.get(k)) || 0;
      setBaseline({ calories: n("calories"), proteinG: n("proteinG"), carbsG: n("carbsG"), fatG: n("fatG"), water: n("water") });
    }
    return r;
  }, {});
  // When the server sends new targets (after saving, or after recalculating
  // from your stats), adopt them. This is React's "adjust state when a prop
  // changes" pattern, which avoids remounting and losing the "Saved" message.
  const [lastInitial, setLastInitial] = useState(initial);
  if (JSON.stringify(initial) !== JSON.stringify(lastInitial)) {
    setLastInitial(initial);
    setBaseline(initial);
    setValues(initial);
  }

  const set = (key: keyof Targets, v: string) => setValues((s) => ({ ...s, [key]: v === "" ? 0 : Number(v) }));
  const fromMacros = Math.round(caloriesFromMacros(values));
  const gap = fromMacros - values.calories;
  const changed = JSON.stringify(values) !== JSON.stringify(baseline);

  return (
    <form action={action} className="mt-4 space-y-3">
      <label className="block text-sm font-medium text-chalk-muted">
        Calories
        <input name="calories" type="number" inputMode="numeric" value={values.calories || ""} onChange={(e) => set("calories", e.target.value)}
          className="mt-1 w-full rounded-xl border-2 border-plate-red bg-rack px-3 py-2.5 font-display text-2xl font-bold text-chalk tabular-nums focus:outline-none" />
      </label>

      <div className="grid grid-cols-3 gap-2">
        {FIELDS.map((f) => (
          <label key={f.key} className="block text-sm font-medium text-chalk-muted">
            <span className="flex items-center gap-1.5"><span className={`size-2 rounded-full ${f.dot}`} aria-hidden />{f.label} ({f.unit})</span>
            <input name={f.key} type="number" inputMode="numeric" value={values[f.key] || ""} onChange={(e) => set(f.key, e.target.value)}
              className={`mt-1 w-full rounded-xl border-2 ${f.color} bg-rack px-3 py-2.5 font-display text-xl font-bold text-chalk tabular-nums focus:outline-none`} />
          </label>
        ))}
      </div>

      {/* Do the macros agree with the calorie number? */}
      <div className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm ${Math.abs(gap) > 50 ? "bg-plate-yellow/15" : "bg-rack"}`}>
        <span>
          Macros add up to <span className="font-semibold tabular-nums">{fromMacros.toLocaleString("en-US")}</span> cal
          {Math.abs(gap) > 50 && <span className="text-chalk-muted"> ({gap > 0 ? "+" : ""}{gap.toLocaleString("en-US")})</span>}
        </span>
        {Math.abs(gap) > 50 && (
          <button type="button" onClick={() => { haptic(); setValues((s) => ({ ...s, calories: fromMacros })); }} className="shrink-0 font-semibold text-plate-blue">
            Use {fromMacros.toLocaleString("en-US")}
          </button>
        )}
      </div>

      <label className="block text-sm font-medium text-chalk-muted">
        Water ({waterUnit})
        <input name="water" type="number" inputMode="numeric" value={values.water || ""} onChange={(e) => set("water", e.target.value)}
          className="mt-1 w-full rounded-xl border border-rack-line bg-rack px-3 py-2.5 text-chalk tabular-nums focus:border-plate-yellow focus:outline-none" />
      </label>

      {state.error && <p role="alert" className="text-sm text-plate-red">{state.error}</p>}
      <button disabled={pending || (!changed && !state.error)}
        className="w-full rounded-xl bg-plate-red py-3 font-display text-lg font-semibold text-white disabled:opacity-40">
        {pending ? "Saving…" : state.saved && !changed ? "Saved" : "Save targets"}
      </button>
    </form>
  );
}
