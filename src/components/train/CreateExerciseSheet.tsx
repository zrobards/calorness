"use client";

import { useState, useTransition } from "react";
import type { ExerciseOption } from "@/lib/training";
import { createExercise } from "@/lib/clientActions";
import { Sheet } from "@/components/diary/Sheet";
import { haptic } from "@/lib/haptics";
import { titleCase } from "./muscleFilters";

const MUSCLES = ["chest", "shoulders", "biceps", "triceps", "forearms", "abdominals", "traps", "lats", "middle back", "lower back", "glutes", "quadriceps", "hamstrings", "adductors", "abductors", "calves", "neck"] as const;
const EQUIPMENT = ["machine", "cable", "dumbbell", "barbell", "body only", "kettlebells", "bands", "e-z curl bar", "other"] as const;
const LABEL: Record<string, string> = { abdominals: "Abs", "middle back": "Upper back", quadriceps: "Quads", "body only": "Bodyweight", "e-z curl bar": "EZ bar" };
const label = (s: string) => LABEL[s] ?? titleCase(s);

const field = "mt-1 w-full rounded-xl border border-rack-line bg-rack px-3 py-2.5 text-base text-chalk focus:border-plate-yellow focus:outline-none";

/** Make an exercise that isn't in the library, like your gym's specific machine. */
export function CreateExerciseSheet({
  initialName,
  onCreated,
  onClose,
}: {
  initialName: string;
  onCreated: (e: ExerciseOption) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [primary, setPrimary] = useState<(typeof MUSCLES)[number]>("chest");
  const [secondary, setSecondary] = useState<string[]>([]);
  const [equipment, setEquipment] = useState<(typeof EQUIPMENT)[number]>("machine");
  const [cardio, setCardio] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const toggleSecondary = (m: string) =>
    setSecondary((s) => (s.includes(m) ? s.filter((x) => x !== m) : s.length < 5 ? [...s, m] : s));

  return (
    <Sheet title="New exercise" onClose={onClose}>
      <p className="mt-1 text-sm text-chalk-muted">Only you see it. It tracks history, PRs, and the muscle map like any other.</p>
      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await createExercise({
              name,
              primaryMuscle: primary,
              secondaryMuscles: secondary.filter((m) => m !== primary) as (typeof MUSCLES)[number][],
              equipment,
              category: cardio ? "CARDIO" : "STRENGTH",
            });
            if ("error" in r && r.error) return setError(r.error);
            if ("exercise" in r && r.exercise) {
              haptic("success");
              onCreated(r.exercise);
            }
          });
        }}
      >
        <label className="block text-sm font-medium text-chalk-muted">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus className={field} placeholder="Pec Deck" />
        </label>

        <fieldset>
          <legend className="text-sm font-medium text-chalk-muted">Main muscle</legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {MUSCLES.filter((m) => m !== "neck").map((m) => (
              <button key={m} type="button" onClick={() => setPrimary(m)} aria-pressed={primary === m}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${primary === m ? "bg-plate-red text-white" : "bg-rack text-chalk-muted"}`}>
                {label(m)}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium text-chalk-muted">Also works (optional)</legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {MUSCLES.filter((m) => m !== primary && m !== "neck").map((m) => (
              <button key={m} type="button" onClick={() => toggleSecondary(m)} aria-pressed={secondary.includes(m)}
                className={`rounded-full px-3 py-1.5 text-sm ${secondary.includes(m) ? "bg-plate-blue/25 text-chalk ring-1 ring-plate-blue" : "bg-rack text-chalk-muted"}`}>
                {label(m)}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium text-chalk-muted">Equipment</legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {EQUIPMENT.map((q) => (
              <button key={q} type="button" onClick={() => setEquipment(q)} aria-pressed={equipment === q}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${equipment === q ? "bg-chalk text-rack" : "bg-rack text-chalk-muted"}`}>
                {label(q)}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={cardio} onChange={(e) => setCardio(e.target.checked)} className="size-4 accent-plate-yellow" />
          Cardio (track it, but don&apos;t count it as lifting volume)
        </label>

        {error && <p role="alert" className="text-sm text-plate-red">{error}</p>}
        <button disabled={pending} className="w-full rounded-xl bg-plate-red py-3.5 font-display text-xl font-semibold text-white disabled:opacity-60">
          {pending ? "Saving…" : "Create exercise"}
        </button>
      </form>
    </Sheet>
  );
}
