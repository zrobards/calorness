"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { displayWeight } from "@/lib/fitness/units";
import { MUSCLE_LABELS, type MuscleRegion } from "@/lib/fitness/muscles";

type Lift = {
  slug: string; name: string; muscle: string; e1rmKg: number; bestWeightKg: number; bestReps: number;
  bestSet: { weightKg: number; reps: number } | null; sessions: number; sets: number; last: string;
};
const label = (m: string) => MUSCLE_LABELS[m as MuscleRegion] ?? m;
const SORTS = [
  { key: "recent", label: "Recent" },
  { key: "strongest", label: "Strongest" },
  { key: "most", label: "Most trained" },
  { key: "az", label: "A–Z" },
] as const;

export function LiftsList({ lifts, imperial }: { lifts: Lift[]; imperial: boolean }) {
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState<string | null>(null);
  const [sort, setSort] = useState<(typeof SORTS)[number]["key"]>("recent");
  const unit = imperial ? "lb" : "kg";
  const w = (kg: number) => displayWeight(kg, imperial ? "IMPERIAL" : "METRIC");

  const muscles = useMemo(() => [...new Set(lifts.map((l) => l.muscle))].sort((a, b) => label(a).localeCompare(label(b))), [lifts]);
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = lifts.filter((l) => (!muscle || l.muscle === muscle) && (!term || l.name.toLowerCase().includes(term)));
    const by = {
      recent: (a: Lift, b: Lift) => b.last.localeCompare(a.last),
      strongest: (a: Lift, b: Lift) => b.e1rmKg - a.e1rmKg || b.bestReps - a.bestReps,
      most: (a: Lift, b: Lift) => b.sessions - a.sessions,
      az: (a: Lift, b: Lift) => a.name.localeCompare(b.name),
    }[sort];
    return [...list].sort(by);
  }, [lifts, q, muscle, sort]);

  if (lifts.length === 0) return <p className="mt-8 px-5 text-center text-chalk-muted">Finish a workout and your lifts show up here.</p>;

  return (
    <div className="mt-4">
      <div className="px-5">
        <label className="relative block">
          <Search size={18} className="absolute top-1/2 left-3 -translate-y-1/2 text-chalk-muted" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder={`Search ${lifts.length} lifts`} aria-label="Search lifts"
            className="w-full rounded-xl border border-rack-line bg-rack-raised py-3 pr-3 pl-10 focus:border-plate-yellow focus:outline-none" />
        </label>
        <div className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-rack-raised p-1" role="tablist" aria-label="Sort">
          {SORTS.map((s) => (
            <button key={s.key} role="tab" aria-selected={sort === s.key} onClick={() => setSort(s.key)}
              className={`rounded-lg py-1.5 text-xs font-semibold ${sort === s.key ? "bg-chalk text-rack" : "text-chalk-muted"}`}>{s.label}</button>
          ))}
        </div>
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto px-5 pb-1" aria-label="Filter by muscle">
        {[null, ...muscles].map((m) => (
          <button key={m ?? "all"} onClick={() => setMuscle(m)} aria-pressed={muscle === m}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${muscle === m ? "bg-chalk text-rack" : "bg-rack-raised text-chalk-muted"}`}>
            {m ? label(m) : "All muscles"}
          </button>
        ))}
      </div>

      <ul className="mx-5 mt-3 divide-y divide-rack-line overflow-hidden rounded-2xl bg-rack-raised">
        {shown.map((l) => (
          <li key={l.slug}>
            <Link href={`/train/exercises/${l.slug}`} className="flex items-center gap-3 px-4 py-3 active:bg-rack-line/40">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{l.name}</span>
                <span className="block truncate text-xs text-chalk-muted">
                  {label(l.muscle)} · {l.sessions} {l.sessions === 1 ? "session" : "sessions"} · last {new Date(l.last).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </span>
              <span className="text-right">
                {l.bestSet ? (
                  <>
                    <span className="block font-display text-xl leading-tight font-bold tabular-nums">{Math.round(w(l.e1rmKg))}<span className="ml-0.5 text-xs font-semibold text-chalk-muted">{unit}</span></span>
                    <span className="block text-xs text-chalk-muted tabular-nums">best {w(l.bestSet.weightKg)} × {l.bestSet.reps}</span>
                  </>
                ) : (
                  <>
                    <span className="block font-display text-xl leading-tight font-bold tabular-nums">{l.bestReps}<span className="ml-0.5 text-xs font-semibold text-chalk-muted">reps</span></span>
                    <span className="block text-xs text-chalk-muted">bodyweight</span>
                  </>
                )}
              </span>
            </Link>
          </li>
        ))}
        {shown.length === 0 && <li className="px-4 py-6 text-center text-sm text-chalk-muted">No lifts match.</li>}
      </ul>
      <p className="mx-5 mt-2 text-xs text-chalk-muted">The big number is your estimated one-rep max from your best set.</p>
    </div>
  );
}
