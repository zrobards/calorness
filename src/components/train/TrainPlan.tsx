"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, ChevronDown, FolderPlus, Pencil, Pin, Play, Trash2 } from "lucide-react";
import { haptic } from "@/lib/haptics";
import {
  createProgram,
  deleteProgram,
  moveProgram,
  moveRoutine,
  pinProgram,
  renameProgram,
  setRoutineProgram,
  startWorkout,
} from "@/app/(app)/train/actions";

export type PlanRoutine = { id: string; name: string; subtitle: string };
export type PlanProgram = { id: string; name: string; summary: string | null; pinned: boolean; routines: PlanRoutine[] };

const OPEN_KEY = "calorness:train:open-programs";

/**
 * Programs (bundles of routines) as collapsible cards, then standalone
 * routines. "Organize" reveals reordering, pinning, renaming, deleting, and
 * moving routines between programs, so the everyday view stays clean.
 */
export function TrainPlan({ programs, standalone }: { programs: PlanProgram[]; standalone: PlanRoutine[] }) {
  const [organizing, setOrganizing] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [pending, start] = useTransition();

  // Which programs are open is remembered on the phone; by default the pinned
  // one (or the first) is open and the rest are tucked away
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const saved = JSON.parse(localStorage.getItem(OPEN_KEY) ?? "null") as Record<string, boolean> | null;
        const defaults = Object.fromEntries(programs.map((p, i) => [p.id, p.pinned || (i === 0 && !programs.some((x) => x.pinned))]));
        setOpen({ ...defaults, ...(saved ?? {}) });
      } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, [programs]);
  const toggle = (pid: string) => {
    haptic();
    setOpen((o) => {
      const next = { ...o, [pid]: !o[pid] };
      try { localStorage.setItem(OPEN_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const act = (fn: () => Promise<unknown>) => start(async () => { haptic(); await fn(); });
  const moveTo = (routineId: string, value: string) =>
    act(async () => {
      if (value === "__new") {
        const name = window.prompt("Name the new program");
        if (!name?.trim()) return;
        const { id } = await createProgram(name);
        await setRoutineProgram(routineId, id);
      } else await setRoutineProgram(routineId, value || null);
    });

  const routineRow = (r: PlanRoutine, list: PlanRoutine[], index: number) => (
    <li key={r.id} className="flex items-start justify-between gap-3 py-3">
      <Link href={`/train/routines/${r.id}`} className="min-w-0 flex-1">
        <h4 className="truncate font-display text-lg font-semibold">{r.name}</h4>
        <p className="line-clamp-2 text-sm text-chalk-muted">{r.subtitle}</p>
      </Link>
      {organizing ? (
        <div className="flex shrink-0 items-center gap-0.5">
          <button onClick={() => act(() => moveRoutine(r.id, -1))} disabled={pending || index === 0} className="p-1.5 text-chalk-muted disabled:opacity-25" aria-label={`Move ${r.name} up`}><ArrowUp size={17} /></button>
          <button onClick={() => act(() => moveRoutine(r.id, 1))} disabled={pending || index === list.length - 1} className="p-1.5 text-chalk-muted disabled:opacity-25" aria-label={`Move ${r.name} down`}><ArrowDown size={17} /></button>
          <select
            aria-label={`Move ${r.name} to a program`}
            value={programs.find((p) => p.routines.some((x) => x.id === r.id))?.id ?? ""}
            onChange={(e) => moveTo(r.id, e.target.value)}
            className="max-w-28 rounded-lg bg-rack px-2 py-1.5 text-xs"
          >
            <option value="">No program</option>
            {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            <option value="__new">+ New program…</option>
          </select>
        </div>
      ) : (
        <form action={startWorkout.bind(null, r.id)} className="shrink-0">
          <button className="flex items-center gap-1.5 rounded-xl bg-chalk px-3.5 py-2 font-display text-base font-semibold text-rack" aria-label={`Start ${r.name}`}>
            <Play size={14} fill="currentColor" aria-hidden /> Start
          </button>
        </form>
      )}
    </li>
  );

  return (
    <div className={pending ? "opacity-70 transition-opacity" : ""}>
      <div className="flex justify-end gap-3 px-5">
        {organizing && (
          <button onClick={() => { const n = window.prompt("Name the new program"); if (n?.trim()) act(() => createProgram(n)); }}
            className="flex items-center gap-1 text-sm font-medium text-plate-blue">
            <FolderPlus size={16} aria-hidden /> New program
          </button>
        )}
        <button onClick={() => { haptic(); setOrganizing((o) => !o); }} className={`text-sm font-semibold ${organizing ? "text-plate-green" : "text-chalk-muted"}`}>
          {organizing ? "Done" : "Organize"}
        </button>
      </div>

      <ul className="mt-2 space-y-3 px-5">
        {programs.map((p, pi) => {
          const isOpen = organizing || !!open[p.id];
          return (
            <li key={p.id} className={`overflow-hidden rounded-2xl bg-rack-raised ${p.pinned ? "ring-1 ring-plate-yellow/50" : ""}`}>
              <div className="flex items-center gap-2 px-4 py-3">
                <button onClick={() => toggle(p.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={isOpen}>
                  <ChevronDown size={18} className={`shrink-0 text-chalk-muted transition-transform ${isOpen ? "" : "-rotate-90"}`} aria-hidden />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5">
                      {p.pinned && <Pin size={14} className="shrink-0 fill-plate-yellow text-plate-yellow" aria-label="Current program" />}
                      <span className="truncate font-display text-xl font-semibold">{p.name}</span>
                    </span>
                    <span className="block text-xs text-chalk-muted">{p.routines.length} {p.routines.length === 1 ? "routine" : "routines"}{p.pinned ? ", current program" : ""}</span>
                  </span>
                </button>
                {organizing && (
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button onClick={() => act(() => moveProgram(p.id, -1))} disabled={pending || pi === 0} className="p-1.5 text-chalk-muted disabled:opacity-25" aria-label={`Move ${p.name} up`}><ArrowUp size={17} /></button>
                    <button onClick={() => act(() => moveProgram(p.id, 1))} disabled={pending || pi === programs.length - 1} className="p-1.5 text-chalk-muted disabled:opacity-25" aria-label={`Move ${p.name} down`}><ArrowDown size={17} /></button>
                    <button onClick={() => act(() => pinProgram(p.id))} className={`p-1.5 ${p.pinned ? "text-plate-yellow" : "text-chalk-muted"}`} aria-label={p.pinned ? `Unpin ${p.name}` : `Pin ${p.name} as your current program`}><Pin size={17} /></button>
                    <button onClick={() => { const n = window.prompt("Rename program", p.name); if (n?.trim() && n !== p.name) act(() => renameProgram(p.id, n)); }} className="p-1.5 text-chalk-muted" aria-label={`Rename ${p.name}`}><Pencil size={16} /></button>
                    <button
                      onClick={() => {
                        if (!confirm(`Delete the program "${p.name}"?`)) return;
                        const withRoutines = p.routines.length > 0 && confirm(`Also delete its ${p.routines.length} routines?\n\nOK deletes them. Cancel keeps them as standalone routines.`);
                        act(() => deleteProgram(p.id, withRoutines));
                      }}
                      className="p-1.5 text-chalk-muted hover:text-plate-red" aria-label={`Delete ${p.name}`}><Trash2 size={16} /></button>
                  </div>
                )}
              </div>
              {isOpen && (
                <div className="border-t border-rack-line px-4">
                  {p.summary && !organizing && <p className="pt-3 text-xs text-chalk-muted">{p.summary}</p>}
                  {p.routines.length ? (
                    <ul className="divide-y divide-rack-line">{p.routines.map((r, i) => routineRow(r, p.routines, i))}</ul>
                  ) : (
                    <p className="py-3 text-sm text-chalk-muted">No routines yet. Tap Organize, then move routines in with the program menu.</p>
                  )}
                </div>
              )}
            </li>
          );
        })}

        {standalone.length > 0 && (
          <li className="rounded-2xl bg-rack-raised px-4">
            {programs.length > 0 && <p className="pt-3 text-xs font-semibold tracking-wide text-chalk-muted uppercase">Other routines</p>}
            <ul className="divide-y divide-rack-line">{standalone.map((r, i) => routineRow(r, standalone, i))}</ul>
          </li>
        )}
      </ul>
    </div>
  );
}
