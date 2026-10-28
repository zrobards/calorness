"use client";

import { useActionState } from "react";
import { type GoalFormState } from "./actions";
import { saveGoals } from "@/lib/clientActions";

const field =
  "mt-1 w-full rounded-xl border border-rack-line bg-rack px-3 py-2.5 text-chalk focus:border-plate-yellow focus:outline-none";
const label = "block text-sm font-medium text-chalk-muted";

export function GoalForm({ unitSystem }: { unitSystem: "IMPERIAL" | "METRIC" }) {
  const [state, action, pending] = useActionState<GoalFormState, FormData>(saveGoals, {});
  const imperial = unitSystem === "IMPERIAL";

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="unitSystem" value={unitSystem} />

      <fieldset>
        <legend className={label}>Sex (used by the calorie formula)</legend>
        <div className="mt-1 grid grid-cols-2 gap-2">
          {(["male", "female"] as const).map((s) => (
            <label key={s} className="flex items-center gap-2 rounded-xl border border-rack-line px-3 py-2.5 has-checked:border-plate-yellow">
              <input type="radio" name="sex" value={s} required className="accent-plate-yellow" />
              {s === "male" ? "Male" : "Female"}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-3 gap-2">
        <label className={label}>
          Age
          <input name="ageYears" type="number" inputMode="numeric" required className={field} />
        </label>
        {imperial ? (
          <>
            <label className={label}>
              Height (ft)
              <input name="heightFt" type="number" inputMode="numeric" required className={field} />
            </label>
            <label className={label}>
              (in)
              <input name="heightIn" type="number" inputMode="decimal" step="0.5" defaultValue={0} className={field} />
            </label>
          </>
        ) : (
          <label className={`${label} col-span-2`}>
            Height (cm)
            <input name="heightCm" type="number" inputMode="decimal" required className={field} />
          </label>
        )}
      </div>

      <label className={label}>
        Weight ({imperial ? "lb" : "kg"})
        <input name="weight" type="number" inputMode="decimal" step="0.1" required className={field} />
      </label>

      <label className={label}>
        Activity outside the gym
        <select name="activity" defaultValue="moderate" className={field}>
          <option value="sedentary">Mostly sitting</option>
          <option value="light">Lightly active</option>
          <option value="moderate">Moderately active</option>
          <option value="active">Very active</option>
          <option value="veryActive">Physical job + training</option>
        </select>
      </label>

      <label className={label}>
        Goal
        <select name="goal" defaultValue="MAINTAIN" className={field}>
          <option value="LOSE">Lose fat</option>
          <option value="MAINTAIN">Maintain</option>
          <option value="GAIN">Build muscle</option>
        </select>
      </label>

      {state.error && (
        <p role="alert" className="text-sm text-plate-red">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-plate-red py-3 font-display text-lg font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Calculating…" : "Calculate my targets"}
      </button>
    </form>
  );
}
