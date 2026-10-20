"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MUSCLE_LABELS, muscleBreakdown, type Contribution, type MuscleRegion } from "@/lib/fitness/muscles";
import { displayWeight } from "@/lib/fitness/units";
import { haptic } from "@/lib/haptics";
import { Sheet } from "@/components/diary/Sheet";
import { MuscleMap } from "./MuscleMap";

type WindowKey = "last7" | "thisWeek" | "lastWeek";
const WINDOWS: { key: WindowKey; label: string }[] = [
  { key: "thisWeek", label: "This week" },
  { key: "last7", label: "Last 7 days" },
  { key: "lastWeek", label: "Last week" },
];
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/**
 * The muscle map, but tappable: pick a muscle (on the body or in the list)
 * to see every set that counted toward it in the chosen week.
 */
export function MuscleExplorer({ contributions, windows, imperial }: {
  contributions: Contribution[];
  windows: { thisWeek: string; lastWeek: string; now: string };
  imperial: boolean;
}) {
  const [range, setRange] = useState<WindowKey>("thisWeek");
  const [selected, setSelected] = useState<MuscleRegion | null>(null);
  const unit = imperial ? "lb" : "kg";

  const { totals, entries } = useMemo(() => {
    const now = new Date(windows.now);
    const end = new Date(now.getTime() + 60_000);
    const [from, to] =
      range === "thisWeek" ? [new Date(windows.thisWeek), end]
      : range === "lastWeek" ? [new Date(windows.lastWeek), new Date(windows.thisWeek)]
      : [new Date(now.getTime() - 7 * 86_400_000), end];
    return muscleBreakdown(contributions, from, to);
  }, [contributions, windows, range]);

  const pick = (m: MuscleRegion) => {
    haptic();
    setSelected(m);
  };
  const list = selected ? entries[selected] : [];
  // Group the selected muscle's entries by workout, newest first
  const byWorkout = list.reduce<{ id: string; name: string; date: string; items: typeof list }[]>((acc, e) => {
    const last = acc.at(-1);
    if (last?.id === e.workoutId) last.items.push(e);
    else acc.push({ id: e.workoutId, name: e.workoutName, date: e.date, items: [e] });
    return acc;
  }, []);

  return (
    <div>
      <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-rack p-1" role="tablist" aria-label="Week">
        {WINDOWS.map((w) => (
          <button key={w.key} role="tab" aria-selected={range === w.key} onClick={() => { haptic(); setRange(w.key); }}
            className={`rounded-lg py-1.5 text-sm font-medium ${range === w.key ? "bg-chalk text-rack" : "text-chalk-muted"}`}>
            {w.label}
          </button>
        ))}
      </div>
      <MuscleMap sets={totals} onSelect={pick} selected={selected} />
      <p className="mt-3 text-center text-xs text-chalk-muted">Tap a muscle to see the sets behind it.</p>

      {selected && (
        <Sheet title={`${MUSCLE_LABELS[selected]}: ${fmt(totals[selected])} sets`} onClose={() => setSelected(null)}>
          <p className="mt-1 text-sm text-chalk-muted">
            {WINDOWS.find((w) => w.key === range)!.label}. Sets where it&apos;s the main muscle count fully; as a helper muscle, half.
          </p>
          {byWorkout.length === 0 ? (
            <p className="mt-6 text-center text-chalk-muted">No sets for this muscle in this period.</p>
          ) : (
            <ol className="mt-4 space-y-4">
              {byWorkout.map((w) => (
                <li key={w.id}>
                  <Link href={`/train/history/${w.id}`} className="flex items-baseline justify-between">
                    <span className="font-display text-lg font-semibold">{w.name}</span>
                    <span className="text-sm text-chalk-muted">
                      {new Date(w.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </span>
                  </Link>
                  <ul className="mt-2 space-y-2">
                    {w.items.map((e, i) => (
                      <li key={`${e.exercise}-${i}`} className="rounded-xl bg-rack p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{e.exercise}</span>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${e.role === "primary" ? "bg-plate-red/20 text-plate-red" : "bg-plate-blue/20 text-plate-blue"}`}>
                            {e.role === "primary" ? "Main" : "Helper ½"} · {fmt(e.counted)} sets
                          </span>
                        </div>
                        <ol className="mt-2 flex flex-wrap gap-1.5 text-sm tabular-nums">
                          {e.sets.map((s, n) => (
                            <li key={n} className="rounded-lg bg-rack-raised px-2 py-1">
                              {s.weightKg ? `${displayWeight(s.weightKg, imperial ? "IMPERIAL" : "METRIC")} ${unit} × ` : ""}{s.reps ?? 0}
                              {s.type === "DROP" ? " D" : s.type === "FAILURE" ? " F" : ""}
                            </li>
                          ))}
                        </ol>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </Sheet>
      )}
    </div>
  );
}
