"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { updateWorkoutTime } from "@/lib/clientActions";
import { updateActivity } from "@/lib/clientActions";

type Effort = "light" | "moderate" | "vigorous";
const EFFORT_LABEL: Record<Effort, { title: string; hint: string }> = {
  light: { title: "Light", hint: "long rests, easy" },
  moderate: { title: "Moderate", hint: "a typical session" },
  vigorous: { title: "Hard", hint: "short rests, heavy" },
};

/**
 * Fix how long a workout or activity lasted (and how hard it was), so the
 * calories burned are right. Used in the Diary and on a workout's page.
 */
export function EditSessionTime({ kind, id, minutes, effort, onSaved, onCancel }: {
  kind: "workout" | "activity";
  id: string;
  minutes: number;
  effort?: string;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const [value, setValue] = useState(String(Math.round(minutes)));
  const [level, setLevel] = useState<Effort>(effort === "light" || effort === "vigorous" ? effort : "moderate");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const n = Number(value);

  const save = () => start(async () => {
    setError(null);
    const r = kind === "workout" ? await updateWorkoutTime(id, Math.round(n), level) : await updateActivity(id, n, level);
    if ("error" in r && r.error) return setError(r.error);
    haptic("success");
    setSaved(true);
    onSaved?.();
  });

  return (
    <div className="rounded-xl bg-rack p-3">
      <label className="block text-sm font-medium text-chalk-muted">
        How long it lasted (minutes)
        <div className="mt-1 flex gap-2">
          <input type="number" inputMode="numeric" min={1} value={value} onChange={(e) => { setValue(e.target.value); setSaved(false); }}
            className="w-24 rounded-xl border border-rack-line bg-rack-raised px-3 py-2 text-center font-display text-xl font-bold text-chalk tabular-nums focus:border-plate-yellow focus:outline-none" />
          <div className="flex flex-1 gap-1">
            {[-15, -5, 5, 15].map((d) => (
              <button key={d} type="button" onClick={() => { setValue(String(Math.max(1, (Number(value) || 0) + d))); setSaved(false); }}
                className="flex-1 rounded-lg bg-rack-raised text-sm font-medium">{d > 0 ? `+${d}` : d}</button>
            ))}
          </div>
        </div>
      </label>
      <fieldset className="mt-3">
        <legend className="text-sm font-medium text-chalk-muted">How hard</legend>
        <div className="mt-1 grid grid-cols-3 gap-1.5">
          {(Object.keys(EFFORT_LABEL) as Effort[]).map((l) => (
            <button key={l} type="button" aria-pressed={level === l} onClick={() => { setLevel(l); setSaved(false); }}
              className={`rounded-lg px-2 py-1.5 text-left ${level === l ? "bg-chalk text-rack" : "bg-rack-raised"}`}>
              <span className="block text-sm font-semibold">{EFFORT_LABEL[l].title}</span>
              <span className="block text-[11px] opacity-70">{kind === "workout" ? EFFORT_LABEL[l].hint : ""}</span>
            </button>
          ))}
        </div>
      </fieldset>
      {error && <p role="alert" className="mt-2 text-sm text-plate-red">{error}</p>}
      <div className="mt-3 flex gap-2">
        {onCancel && <button type="button" onClick={onCancel} className="rounded-xl bg-rack-raised px-4 py-2 text-sm font-medium">Cancel</button>}
        <button type="button" onClick={save} disabled={pending || !(n >= 1)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-plate-red py-2 font-semibold text-white disabled:opacity-50">
          {saved ? <><Check size={16} aria-hidden /> Updated</> : pending ? "Saving…" : "Update calories"}
        </button>
      </div>
    </div>
  );
}
