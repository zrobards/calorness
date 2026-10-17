"use client";

import { useState, useTransition } from "react";
import { saveBodyStats, setExerciseCredit } from "@/app/(app)/train/cardio/actions";
import { haptic } from "@/lib/haptics";

const field = "mt-1 w-full rounded-xl border border-rack-line bg-rack px-3 py-2.5 text-base text-chalk tabular-nums focus:border-plate-yellow focus:outline-none";
const CREDITS = [
  { value: 0, label: "Don't add" },
  { value: 50, label: "50%" },
  { value: 75, label: "75%" },
  { value: 100, label: "All" },
];

/** Body stats for calorie-burn math, and how much exercise to add back to the day. */
export function BodyStatsCard({ imperial, initial, credit }: {
  imperial: boolean;
  initial: { sex: string | null; age: number | null; heightCm: number | null };
  credit: number;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [creditNow, setCreditNow] = useState(credit);
  const totalIn = initial.heightCm ? Math.round(initial.heightCm / 2.54) : null;

  return (
    <div>
      <p className="mt-1 text-sm text-chalk-muted">Used to estimate calories burned. Weight comes from your latest weigh-in on Progress.</p>
      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
          start(async () => {
            const r = await saveBodyStats(data);
            setMsg(r.error ?? "Saved.");
            if (!r.error) haptic("success");
          });
        }}
      >
        <div className="grid grid-cols-2 gap-2">
          {(["male", "female"] as const).map((s) => (
            <label key={s} className="flex items-center gap-2 rounded-xl border border-rack-line px-3 py-2.5 has-checked:border-plate-yellow">
              <input type="radio" name="sex" value={s} defaultChecked={initial.sex === s} required className="accent-plate-yellow" />
              {s === "male" ? "Male" : "Female"}
            </label>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <label className="block text-sm font-medium text-chalk-muted">Age<input name="age" type="number" inputMode="numeric" defaultValue={initial.age ?? ""} required className={field} /></label>
          {imperial ? (
            <>
              <label className="block text-sm font-medium text-chalk-muted">Height (ft)<input name="heightFt" type="number" inputMode="numeric" defaultValue={totalIn ? Math.floor(totalIn / 12) : ""} required className={field} /></label>
              <label className="block text-sm font-medium text-chalk-muted">(in)<input name="heightIn" type="number" inputMode="numeric" defaultValue={totalIn ? totalIn % 12 : ""} className={field} /></label>
            </>
          ) : (
            <label className="col-span-2 block text-sm font-medium text-chalk-muted">Height (cm)<input name="heightCm" type="number" inputMode="decimal" defaultValue={initial.heightCm ? Math.round(initial.heightCm) : ""} required className={field} /></label>
          )}
        </div>
        {msg && <p role="status" className="text-sm text-chalk-muted">{msg}</p>}
        <button disabled={pending} className="w-full rounded-xl bg-rack py-2.5 font-semibold disabled:opacity-60">{pending ? "Saving…" : "Save body stats"}</button>
      </form>

      <fieldset className="mt-5 border-t border-rack-line pt-4">
        <legend className="text-sm font-medium">Add exercise calories to my daily goal</legend>
        <p className="text-xs text-chalk-muted">Fitness trackers tend to overestimate burn, so 75% is a safe middle ground.</p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {CREDITS.map((c) => (
            <button key={c.value} type="button" aria-pressed={creditNow === c.value}
              onClick={() => { haptic(); setCreditNow(c.value); start(() => setExerciseCredit(c.value)); }}
              className={`rounded-xl py-2 text-sm font-semibold ${creditNow === c.value ? "bg-chalk text-rack" : "bg-rack text-chalk-muted"}`}>
              {c.label}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
