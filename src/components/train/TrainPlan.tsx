"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, ChevronDown, FolderPlus, Pencil, Play, Trash2 } from "lucide-react";
import { haptic } from "@/lib/haptics";
import {
  createProgram,
  deleteProgram,
  moveProgram,
  moveRoutine,
  renameProgram,
  setActiveProgram,
  setRoutineProgram,
  startWorkout,
} from "@/app/(app)/train/actions";

export type PlanRoutine = { id: string; name: string; subtitle: string };
export type PlanProgram = { id: string; name: string; summary: string | null; pinned: boolean; routines: PlanRoutine[] };

/**
 * The Train screen shows only the program you're running. Every program
 * (and any single routines) is kept below in "Your programs", each with an
 * on/off switch. Turning one on turns the others off.
 */
export function TrainPlan({ programs, standalone }: { programs: PlanProgram[]; standalone: PlanRoutine[] }) {
  const [organizing, setOrganizing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const active = programs.find((p) => p.pinned) ?? null;

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

  const routineList = (list: PlanRoutine[]) => (
    <ul className="divide-y divide-rack-line">
      {list.map((r, index) => (
        <li key={r.id} className="flex items-start justify-between gap-3 py-3">
          <Link href={`/train/routines/${r.id}`} className="min-w-0 flex-1">
            <h4 className="truncate font-display text-lg font-semibold">{r.name}</h4>
            <p className="line-clamp-2 text-sm text-chalk-muted">{r.subtitle}</p>
          </Link>
          {organizing ? (
            <div className="flex shrink-0 items-center gap-0.5">
              <button onClick={() => act(() => moveRoutine(r.id, -1))} disabled={pending || index === 0} className="p-1.5 text-chalk-muted disabled:opacity-25" aria-label={`Move ${r.name} up`}><ArrowUp size={17} /></button>
              <button onClick={() => act(() => moveRoutine(r.id, 1))} disabled={pending || index === list.length - 1} className="p-1.5 text-chalk-muted disabled:opacity-25" aria-label={`Move ${r.name} down`}><ArrowDown size={17} /></button>
              <select aria-label={`Move ${r.name} to a program`} value={programs.find((p) => p.routines.some((x) => x.id === r.id))?.id ?? ""}
                onChange={(e) => moveTo(r.id, e.target.value)} className="max-w-28 rounded-lg bg-rack px-2 py-1.5 text-xs">
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
      ))}
    </ul>
  );

  return (
    <div className={pending ? "opacity-70 transition-opacity" : ""}>
      {/* The program you're running */}
      <section className="mx-5" aria-label="Active program">
        {active ? (
          <div className="rounded-2xl bg-rack-raised px-4 pt-4 ring-1 ring-plate-green/50">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold tracking-wide text-plate-green uppercase">Running now</p>
                <h3 className="truncate font-display text-2xl font-semibold">{active.name}</h3>
                {active.summary && <p className="mt-0.5 line-clamp-2 text-xs text-chalk-muted">{active.summary}</p>}
              </div>
              <Switch on label={`Turn off ${active.name}`} onChange={() => act(() => setActiveProgram(null))} />
            </div>
            {active.routines.length ? routineList(active.routines) : <p className="py-4 text-sm text-chalk-muted">No routines in this program yet. Use Organize to move some in.</p>}
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-rack-line p-5 text-center">
            <p className="font-display text-xl font-semibold">No program running</p>
            <p className="mt-1 text-sm text-chalk-muted">
              {programs.length ? "Switch one on below and its routines show up here." : "Build one with AI or add a template to get started."}
            </p>
          </div>
        )}
      </section>

      {/* Everything you've saved */}
      {(programs.length > 0 || standalone.length > 0) && (
        <section className="mt-6" aria-labelledby="library-heading">
          <div className="flex items-center justify-between px-5">
            <h3 id="library-heading" className="font-display text-xl font-semibold">Your programs</h3>
            <div className="flex items-center gap-3">
              {organizing && (
                <button onClick={() => { const n = window.prompt("Name the new program"); if (n?.trim()) act(() => createProgram(n)); }}
                  className="flex items-center gap-1 text-sm font-medium text-plate-blue"><FolderPlus size={16} aria-hidden /> New</button>
              )}
              <button onClick={() => { haptic(); setOrganizing((o) => !o); }} className={`text-sm font-semibold ${organizing ? "text-plate-green" : "text-chalk-muted"}`}>
                {organizing ? "Done" : "Organize"}
              </button>
            </div>
          </div>

          <ul className="mx-5 mt-2 divide-y divide-rack-line overflow-hidden rounded-2xl bg-rack-raised">
            {programs.map((p, pi) => {
              const open = expanded === p.id;
              return (
                <li key={p.id}>
                  <div className="flex items-center gap-2 px-4 py-3">
                    <button onClick={() => { haptic(); setExpanded((e) => (e === p.id ? null : p.id)); }} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={open}>
                      <ChevronDown size={17} className={`shrink-0 text-chalk-muted transition-transform ${open ? "" : "-rotate-90"}`} aria-hidden />
                      <span className="min-w-0">
                        <span className={`block truncate font-semibold ${p.pinned ? "text-plate-green" : ""}`}>{p.name}</span>
                        <span className="block text-xs text-chalk-muted">{p.routines.length} {p.routines.length === 1 ? "routine" : "routines"}{p.pinned ? ", running" : ""}</span>
                      </span>
                    </button>
                    {organizing ? (
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button onClick={() => act(() => moveProgram(p.id, -1))} disabled={pending || pi === 0} className="p-1.5 text-chalk-muted disabled:opacity-25" aria-label={`Move ${p.name} up`}><ArrowUp size={16} /></button>
                        <button onClick={() => act(() => moveProgram(p.id, 1))} disabled={pending || pi === programs.length - 1} className="p-1.5 text-chalk-muted disabled:opacity-25" aria-label={`Move ${p.name} down`}><ArrowDown size={16} /></button>
                        <button onClick={() => { const n = window.prompt("Rename program", p.name); if (n?.trim() && n !== p.name) act(() => renameProgram(p.id, n)); }} className="p-1.5 text-chalk-muted" aria-label={`Rename ${p.name}`}><Pencil size={15} /></button>
                        <button
                          onClick={() => {
                            if (!confirm(`Delete the program "${p.name}"?`)) return;
                            const withRoutines = p.routines.length > 0 && confirm(`Also delete its ${p.routines.length} routines?\n\nOK deletes them. Cancel keeps them as single routines.`);
                            act(() => deleteProgram(p.id, withRoutines));
                          }}
                          className="p-1.5 text-chalk-muted hover:text-plate-red" aria-label={`Delete ${p.name}`}><Trash2 size={15} /></button>
                      </div>
                    ) : (
                      <Switch on={p.pinned} label={p.pinned ? `Turn off ${p.name}` : `Run ${p.name}`} onChange={() => act(() => setActiveProgram(p.pinned ? null : p.id))} />
                    )}
                  </div>
                  {open && <div className="border-t border-rack-line px-4">{p.routines.length ? routineList(p.routines) : <p className="py-3 text-sm text-chalk-muted">Empty. Move routines in with Organize.</p>}</div>}
                </li>
              );
            })}
            {standalone.length > 0 && (
              <li>
                <button onClick={() => { haptic(); setExpanded((e) => (e === "single" ? null : "single")); }} className="flex w-full items-center gap-2 px-4 py-3 text-left" aria-expanded={expanded === "single"}>
                  <ChevronDown size={17} className={`shrink-0 text-chalk-muted transition-transform ${expanded === "single" ? "" : "-rotate-90"}`} aria-hidden />
                  <span>
                    <span className="block font-semibold">Single routines</span>
                    <span className="block text-xs text-chalk-muted">{standalone.length} not in a program</span>
                  </span>
                </button>
                {expanded === "single" && <div className="border-t border-rack-line px-4">{routineList(standalone)}</div>}
              </li>
            )}
          </ul>
        </section>
      )}
    </div>
  );
}

function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: () => void }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={onChange}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? "bg-plate-green" : "bg-rack-line"}`}>
      <span className={`absolute top-0.5 left-0 size-6 rounded-full bg-white shadow transition-transform ${on ? "translate-x-[1.375rem]" : "translate-x-0.5"}`} />
    </button>
  );
}
