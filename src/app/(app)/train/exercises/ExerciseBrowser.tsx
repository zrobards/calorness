"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { ExerciseOption } from "@/lib/training";
import { ExerciseThumb } from "@/components/train/ExerciseThumb";
import { MUSCLE_FILTERS, matchesFilter, searchByName, titleCase } from "@/components/train/muscleFilters";

export function ExerciseBrowser({ library }: { library: ExerciseOption[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(0);
  const results = useMemo(() => {
    return searchByName(library.filter((e) => matchesFilter(e.primaryMuscles, filter)), query);
  }, [library, query, filter]);

  return (
    <div className="mt-4">
      <label className="relative mx-5 block">
        <Search size={18} className="absolute top-1/2 left-3 -translate-y-1/2 text-chalk-muted" aria-hidden />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${library.length} exercises`} aria-label="Search exercises"
          className="w-full rounded-xl border border-rack-line bg-rack-raised py-3 pr-3 pl-10 focus:border-plate-yellow focus:outline-none" />
      </label>
      <div className="mt-3 flex gap-2 overflow-x-auto px-5 pb-1">
        {MUSCLE_FILTERS.map((f, i) => (
          <button key={f.label} onClick={() => setFilter(i)} aria-pressed={filter === i}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium ${filter === i ? "border-chalk bg-chalk text-rack" : "border-rack-line text-chalk-muted"}`}>
            {f.label}
          </button>
        ))}
      </div>
      <p className="mt-3 px-5 text-sm text-chalk-muted">{results.length} exercises</p>
      <ul className="mt-1 px-5">
        {results.slice(0, 200).map((e) => (
          <li key={e.id}>
            <Link href={`/train/exercises/${e.slug}`} className="flex items-center gap-3 border-b border-rack-line py-2.5">
              <ExerciseThumb src={e.image} />
              <span className="min-w-0">
                <span className="block truncate font-medium">{e.name}</span>
                <span className="block truncate text-sm text-chalk-muted">
                  {titleCase(e.primaryMuscles.join(", "))}{e.equipment ? `, ${e.equipment}` : ""}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {results.length > 200 && <p className="py-4 text-center text-sm text-chalk-muted">Search to narrow down the rest.</p>}
    </div>
  );
}
