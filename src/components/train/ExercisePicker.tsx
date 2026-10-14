"use client";

import { useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";
import type { ExerciseOption } from "@/lib/training";
import { ExerciseThumb } from "./ExerciseThumb";
import { MUSCLE_FILTERS, matchesFilter, searchByName, titleCase } from "./muscleFilters";

export function ExercisePicker({
  exercises,
  onAdd,
  onClose,
}: {
  exercises: ExerciseOption[];
  onAdd: (selected: ExerciseOption[]) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);

  const results = useMemo(() => {
    return searchByName(exercises.filter((e) => matchesFilter(e.primaryMuscles, filter)), query).slice(0, 120);
  }, [exercises, query, filter]);

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
        {results.map((e) => {
          const on = selected.includes(e.id);
          return (
            <li key={e.id}>
              <button
                onClick={() => toggle(e.id)}
                aria-pressed={on}
                className="flex w-full items-center gap-3 border-b border-rack-line py-2.5 text-left"
              >
                <ExerciseThumb src={e.image} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{e.name}</span>
                  <span className="block truncate text-sm text-chalk-muted">
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
        {results.length === 0 && <li className="py-10 text-center text-chalk-muted">No exercises match “{query}”.</li>}
      </ul>

      {selected.length > 0 && (
        <div
          className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-rack via-rack to-transparent px-4 pt-6"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
        >
          <button
            onClick={() => onAdd(exercises.filter((e) => selected.includes(e.id)))}
            className="mx-auto block w-full max-w-md rounded-xl bg-plate-blue py-3.5 font-display text-xl font-semibold text-white"
          >
            Add {selected.length} {selected.length === 1 ? "exercise" : "exercises"}
          </button>
        </div>
      )}
    </div>
  );
}
