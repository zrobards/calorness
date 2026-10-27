"use client";

import { useMemo, useState } from "react";
import { Check, Plus, Search, X } from "lucide-react";
import { CreateExerciseSheet } from "./CreateExerciseSheet";
import type { ExerciseOption } from "@/lib/training";
import { ExerciseThumb } from "./ExerciseThumb";
import { MUSCLE_FILTERS, matchesFilter, searchByName, titleCase } from "./muscleFilters";

export function ExercisePicker({
  exercises,
  onAdd,
  onClose,
  initialQuery = "",
}: {
  initialQuery?: string;
  exercises: ExerciseOption[];
  onAdd: (selected: ExerciseOption[]) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [mine, setMine] = useState<ExerciseOption[]>([]); // made in this session
  const [creating, setCreating] = useState(false);
  // New exercises can also arrive in `exercises` once the page refreshes, so de-duplicate by id
  const all = useMemo(() => {
    const seen = new Set<string>();
    return [...mine, ...exercises].filter((e) => !seen.has(e.id) && seen.add(e.id));
  }, [mine, exercises]);

  const results = useMemo(() => {
    return searchByName(all.filter((e) => matchesFilter(e.primaryMuscles, filter)), query).slice(0, 150);
  }, [all, query, filter]);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-rack" role="dialog" aria-modal="true" aria-label="Add exercises">
      <div
        className="mx-auto w-full max-w-md px-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
      >
        <div className="flex items-center justify-between py-2">
          <button onClick={onClose} className="-ml-2 rounded-lg p-2 text-chalk-muted" aria-label="Close">
            <X size={24} />
          </button>
          <h2 className="font-display text-2xl font-semibold">Add exercises</h2>
          <span className="w-10" />
        </div>
        <label className="relative mt-2 block">
          <Search size={18} className="absolute top-1/2 left-3 -translate-y-1/2 text-chalk-muted" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search 870+ exercises"
            aria-label="Search exercises"
            className="w-full rounded-xl border border-rack-line bg-rack-raised py-3 pr-3 pl-10 focus:border-plate-yellow focus:outline-none"
          />
        </label>
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
          {MUSCLE_FILTERS.map((f, i) => (
            <button
              key={f.label}
              onClick={() => setFilter(i)}
              aria-pressed={filter === i}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium ${
                filter === i ? "border-chalk bg-chalk text-rack" : "border-rack-line text-chalk-muted"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <ul className="mx-auto mt-2 w-full max-w-md flex-1 overflow-y-auto px-4 pb-32">
        {/* Can't find it? Make it. Always one tap away while searching. */}
        {query.trim().length >= 2 && (
          <li>
            <button onClick={() => setCreating(true)} className="flex w-full items-center gap-3 border-b border-rack-line py-3 text-left">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-plate-red/20 text-plate-red"><Plus size={22} aria-hidden /></span>
              <span className="min-w-0">
                <span className="block truncate font-medium">Create &ldquo;{query.trim()}&rdquo;</span>
                <span className="block text-sm text-chalk-muted">{results.length ? "Not the one you want? Add your own." : "Not in the library yet. Add it in a few taps."}</span>
              </span>
            </button>
          </li>
        )}
        {results.map((e) => {
          const on = selected.includes(e.id);
          return (
            <li key={e.id}>
              <button
                onClick={() => toggle(e.id)}
                aria-pressed={on}
                className="flex w-full items-center gap-3 border-b border-rack-line py-2.5 text-left"
              >
                <ExerciseThumb src={e.image} muscles={e.primaryMuscles} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{e.name}</span>
                  <span className="block truncate text-sm text-chalk-muted">
                    {e.custom ? "Your exercise, " : ""}
                    {titleCase(e.primaryMuscles.join(", "))}
                    {e.equipment ? `, ${e.equipment}` : ""}
                  </span>
                </span>
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 ${
                    on ? "border-plate-blue bg-plate-blue" : "border-rack-line"
                  }`}
                >
                  {on && <Check size={16} strokeWidth={3} aria-hidden />}
                </span>
              </button>
            </li>
          );
        })}

      </ul>

      {selected.length > 0 && (
        <div
          className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-rack via-rack to-transparent px-4 pt-6"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
        >
          <button
            onClick={() => onAdd(all.filter((e) => selected.includes(e.id)))}
            className="mx-auto block w-full max-w-md rounded-xl bg-plate-blue py-3.5 font-display text-xl font-semibold text-white"
          >
            Add {selected.length} {selected.length === 1 ? "exercise" : "exercises"}
          </button>
        </div>
      )}
      {creating && (
        <CreateExerciseSheet
          initialName={titleCase(query.trim())}
          onClose={() => setCreating(false)}
          onCreated={(e) => {
            setMine((m) => [e, ...m]);
            setSelected((s) => [...s, e.id]);
            setQuery(e.name);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}
