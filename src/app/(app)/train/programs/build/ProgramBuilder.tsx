"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronLeft, Minus, Plus, RefreshCw, Replace, Sparkles, Trash2 } from "lucide-react";
import type { ExerciseOption } from "@/lib/training";
import type { ProgramDraft, ProgramExercise } from "@/lib/ai/program";
import { haptic } from "@/lib/haptics";
import { ExercisePicker } from "@/components/train/ExercisePicker";
import { AiProgress } from "@/components/log/AiProgress";
import { buildProgram, reviseProgram, saveProgramDraft } from "../actions";

const GOALS = ["Build muscle", "Get stronger", "Lose fat, keep muscle", "Athletic and conditioned", "General fitness"];
const EQUIPMENT = ["Full gym", "Dumbbells and bench", "Machines and cables", "Bodyweight at home"];
const LEVELS = ["Beginner", "Intermediate", "Advanced"];
const FOCUS = ["Chest", "Back", "Shoulders", "Arms", "Glutes", "Legs", "Core"];
const IDEAS = ["Make sessions shorter", "Add more arm work", "Swap barbell lifts for dumbbells", "Make Day 1 easier", "Add a cardio finisher"];

const chip = (on: boolean) => `rounded-full px-3.5 py-2 text-sm font-medium ${on ? "bg-chalk text-rack" : "bg-rack-raised text-chalk-muted"}`;

export function ProgramBuilder({ library, initialDraft, avoid: initialAvoid }: { library: ExerciseOption[]; initialDraft: ProgramDraft | null; avoid: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState<ProgramDraft | null>(initialDraft);
  const [busy, setBusy] = useState<"build" | "revise" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // setup
  const [goal, setGoal] = useState(GOALS[0]);
  const [days, setDays] = useState(4);
  const [minutes, setMinutes] = useState(60);
  const [equipment, setEquipment] = useState(EQUIPMENT[0]);
  const [experience, setExperience] = useState(LEVELS[1]);
  const [focus, setFocus] = useState<string[]>([]);
  const [avoid, setAvoid] = useState(initialAvoid);

  // editing
  const [day, setDay] = useState(0);
  const [ask, setAsk] = useState("");
  const [picker, setPicker] = useState<{ mode: "add" } | { mode: "swap"; index: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const build = async () => {
    haptic();
    setError(null);
    setBusy("build");
    const r = await buildProgram({ goal, daysPerWeek: days, minutes, equipment, experience, focus, avoid }).catch(() => ({ error: "Couldn't reach the AI. Try again." }));
    setBusy(null);
    if ("error" in r && r.error) return setError(r.error);
    if ("draft" in r && r.draft) { haptic("success"); setDraft(r.draft); setDay(0); }
  };

  const revise = async (instruction: string) => {
    if (!draft || instruction.trim().length < 3) return;
    haptic();
    setError(null);
    setBusy("revise");
    const r = await reviseProgram(draft, instruction).catch(() => ({ error: "Couldn't reach the AI. Try again." }));
    setBusy(null);
    if ("error" in r && r.error) return setError(r.error);
    if ("draft" in r && r.draft) { haptic("success"); setDraft(r.draft); setAsk(""); setDay((d) => Math.min(d, r.draft!.days.length - 1)); }
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    const r = await saveProgramDraft(draft);
    setSaving(false);
    if ("error" in r && r.error) return setError(r.error);
    haptic("success");
    router.push("/train");
  };

  // ── small editing helpers ──
  const updateDay = (fn: (exs: ProgramExercise[]) => ProgramExercise[]) =>
    setDraft((d) => d && { ...d, days: d.days.map((x, i) => (i === day ? { ...x, exercises: fn(x.exercises) } : x)) });
  const updateExercise = (index: number, patch: Partial<ProgramExercise>) => updateDay((exs) => exs.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  const move = (index: number, by: number) =>
    updateDay((exs) => {
      const to = index + by;
      if (to < 0 || to >= exs.length) return exs;
      const next = [...exs];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });

  const header = (
    <div className="px-5" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}>
      <Link href="/train" className="-ml-1 inline-flex items-center gap-1 py-2 text-sm font-medium text-chalk-muted">
        <ChevronLeft size={18} aria-hidden /> Train
      </Link>
    </div>
  );

  if (!draft) {
    return (
      <div className="pb-10">
        {header}
        <div className="px-5">
          <h1 className="flex items-center gap-2 font-display text-4xl font-bold tracking-tight"><Sparkles className="text-plate-yellow" size={26} aria-hidden /> Build a program</h1>
          <p className="mt-1 text-chalk-muted">Tell the AI what you want. You can change anything before saving.</p>

          <Field label="Goal">{GOALS.map((g) => <button key={g} onClick={() => setGoal(g)} aria-pressed={goal === g} className={chip(goal === g)}>{g}</button>)}</Field>
          <Field label="Days per week">{[2, 3, 4, 5, 6].map((n) => <button key={n} onClick={() => setDays(n)} aria-pressed={days === n} className={`${chip(days === n)} min-w-11`}>{n}</button>)}</Field>
          <Field label="Minutes per session">{[30, 45, 60, 75, 90].map((n) => <button key={n} onClick={() => setMinutes(n)} aria-pressed={minutes === n} className={chip(minutes === n)}>{n}</button>)}</Field>
          <Field label="Equipment">{EQUIPMENT.map((e) => <button key={e} onClick={() => setEquipment(e)} aria-pressed={equipment === e} className={chip(equipment === e)}>{e}</button>)}</Field>
          <Field label="Experience">{LEVELS.map((l) => <button key={l} onClick={() => setExperience(l)} aria-pressed={experience === l} className={chip(experience === l)}>{l}</button>)}</Field>
          <Field label="Extra focus (optional)">
            {FOCUS.map((f) => (
              <button key={f} onClick={() => setFocus((x) => (x.includes(f) ? x.filter((y) => y !== f) : [...x, f]))} aria-pressed={focus.includes(f)} className={chip(focus.includes(f))}>{f}</button>
            ))}
          </Field>
          <label className="mt-5 block text-sm font-medium text-chalk-muted">
            Anything to avoid or work around? (optional)
            <textarea value={avoid} onChange={(e) => setAvoid(e.target.value)} rows={2} maxLength={300} placeholder="Sore left shoulder, no deadlifts, bad knees…"
              className="mt-1 w-full resize-none rounded-xl border border-rack-line bg-rack-raised px-3 py-2.5 text-base text-chalk focus:border-plate-yellow focus:outline-none" />
          </label>

          {error && <p role="alert" className="mt-3 text-sm text-plate-red">{error}</p>}
          <button onClick={build} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-plate-red py-4 font-display text-xl font-semibold text-white">
            <Sparkles size={20} aria-hidden /> Build my program
          </button>
          <Link href="/train/templates" className="mt-3 block text-center text-sm text-chalk-muted underline underline-offset-4">Or start from a ready-made program</Link>
        </div>
        {busy && <BuildProgress task={busy} />}
      </div>
    );
  }

  const current = draft.days[day];
  return (
    <div className="pb-40">
      {header}
      <div className="px-5">
        <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} aria-label="Program name"
          className="w-full bg-transparent font-display text-3xl font-bold tracking-tight focus:outline-none" />
        {draft.summary && <p className="mt-1 text-sm text-chalk-muted">{draft.summary}</p>}
        {draft.unmatched.length > 0 && (
          <p className="mt-2 rounded-xl bg-plate-yellow/10 px-3 py-2 text-xs text-plate-yellow">Left out (not in the exercise library): {draft.unmatched.join(", ")}. Add your own with + below.</p>
        )}
      </div>

      {/* Days */}
      <div className="mt-4 flex gap-2 overflow-x-auto px-5 pb-1" role="tablist" aria-label="Days">
        {draft.days.map((d, i) => (
          <button key={i} role="tab" aria-selected={day === i} onClick={() => { haptic(); setDay(i); }} className={`shrink-0 ${chip(day === i)}`}>{d.name}</button>
        ))}
        <button onClick={() => { setDraft({ ...draft, days: [...draft.days, { name: `Day ${draft.days.length + 1}`, exercises: [] }] }); setDay(draft.days.length); }}
          className="shrink-0 rounded-full border border-dashed border-rack-line px-3.5 py-2 text-sm text-chalk-muted" aria-label="Add a day">
          <Plus size={16} />
        </button>
      </div>

      {current && (
        <section className="mx-5 mt-3 rounded-2xl bg-rack-raised p-4" aria-label={current.name}>
          <div className="flex items-center gap-2">
            <input value={current.name} onChange={(e) => setDraft({ ...draft, days: draft.days.map((x, i) => (i === day ? { ...x, name: e.target.value } : x)) })} aria-label="Day name"
              className="min-w-0 flex-1 bg-transparent font-display text-2xl font-semibold focus:outline-none" />
            {draft.days.length > 1 && (
              <button onClick={() => { if (confirm(`Remove ${current.name}?`)) { setDraft({ ...draft, days: draft.days.filter((_, i) => i !== day) }); setDay(Math.max(0, day - 1)); } }}
                className="p-1.5 text-chalk-muted hover:text-plate-red" aria-label={`Remove ${current.name}`}><Trash2 size={17} /></button>
            )}
          </div>
          <p className="text-xs text-chalk-muted">
            {current.exercises.length} exercises, {current.exercises.reduce((s, e) => s + e.sets, 0)} sets, about{" "}
            {Math.round(current.exercises.reduce((s, e) => s + e.sets * (0.75 + e.restSeconds / 60), 0))} min
          </p>

          <ol className="mt-3 space-y-2">
            {current.exercises.map((e, i) => (
              <li key={`${e.exerciseId}-${i}`} className="rounded-xl bg-rack p-3">
                <div className="flex items-start gap-2">
                  <button onClick={() => setPicker({ mode: "swap", index: i })} className="min-w-0 flex-1 text-left" aria-label={`Swap ${e.name}`}>
                    <span className="block truncate font-medium">{e.name}</span>
                    <span className="flex items-center gap-1 text-xs text-plate-blue"><Replace size={12} aria-hidden /> Swap</span>
                  </button>
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1 text-chalk-muted disabled:opacity-25" aria-label="Move up"><ArrowUp size={16} /></button>
                  <button onClick={() => move(i, 1)} disabled={i === current.exercises.length - 1} className="p-1 text-chalk-muted disabled:opacity-25" aria-label="Move down"><ArrowDown size={16} /></button>
                  <button onClick={() => updateDay((exs) => exs.filter((_, n) => n !== i))} className="p-1 text-chalk-muted hover:text-plate-red" aria-label={`Remove ${e.name}`}><Trash2 size={16} /></button>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs text-chalk-muted">
                  <Stepper label="Sets" value={e.sets} min={1} max={10} onChange={(v) => updateExercise(i, { sets: v })} />
                  <div>
                    <span>Reps</span>
                    <div className="mt-1 flex items-center justify-center gap-1">
                      <input type="number" inputMode="numeric" value={e.repMin} onChange={(x) => updateExercise(i, { repMin: Math.max(1, Number(x.target.value) || 1) })} aria-label={`${e.name} minimum reps`}
                        className="w-10 rounded-lg bg-rack-raised py-1.5 text-center font-display text-base font-semibold text-chalk" />
                      <span>–</span>
                      <input type="number" inputMode="numeric" value={e.repMax} onChange={(x) => updateExercise(i, { repMax: Math.max(1, Number(x.target.value) || 1) })} aria-label={`${e.name} maximum reps`}
                        className="w-10 rounded-lg bg-rack-raised py-1.5 text-center font-display text-base font-semibold text-chalk" />
                    </div>
                  </div>
                  <Stepper label="Rest" value={e.restSeconds} min={0} max={600} step={15} format={(v) => `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`} onChange={(v) => updateExercise(i, { restSeconds: v })} />
                </div>
                {e.note && <p className="mt-2 text-xs text-chalk-muted">{e.note}</p>}
              </li>
            ))}
          </ol>
          <button onClick={() => setPicker({ mode: "add" })} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-rack-line py-2.5 font-medium text-plate-blue">
            <Plus size={17} aria-hidden /> Add exercise
          </button>
        </section>
      )}

      {/* Ask the AI to change it */}
      <section className="mx-5 mt-4 rounded-2xl border border-rack-line p-4">
        <p className="flex items-center gap-1.5 text-sm font-medium"><Sparkles size={15} className="text-plate-yellow" aria-hidden /> Ask the AI to change it</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {IDEAS.map((idea) => <button key={idea} onClick={() => revise(idea)} disabled={!!busy} className="rounded-full bg-rack-raised px-3 py-1.5 text-xs font-medium disabled:opacity-40">{idea}</button>)}
        </div>
        <div className="mt-2 flex gap-2">
          <input value={ask} onChange={(e) => setAsk(e.target.value)} onKeyDown={(e) => e.key === "Enter" && revise(ask)} placeholder="Replace squats with leg press on Day 2…" aria-label="Change request"
            className="min-w-0 flex-1 rounded-xl border border-rack-line bg-rack-raised px-3 py-2.5 text-base focus:border-plate-yellow focus:outline-none" />
          <button onClick={() => revise(ask)} disabled={!!busy || ask.trim().length < 3} className="rounded-xl bg-rack-raised px-3 disabled:opacity-40" aria-label="Apply change"><RefreshCw size={18} /></button>
        </div>
      </section>

      {error && <p role="alert" className="mx-5 mt-3 text-sm text-plate-red">{error}</p>}
      <div className="fixed inset-x-0 z-20 px-5" style={{ bottom: "calc(env(safe-area-inset-bottom) + 5rem + var(--music-dock-h, 0px))" }}>
        <div className="mx-auto flex max-w-md gap-2">
          <button onClick={() => { if (confirm("Start over? This program won't be saved.")) setDraft(null); }} className="rounded-2xl bg-rack-raised px-4 font-medium text-chalk-muted">Start over</button>
          <button onClick={save} disabled={saving} className="flex-1 rounded-2xl bg-plate-red py-3.5 font-display text-xl font-semibold text-white shadow-xl disabled:opacity-60">
            {saving ? "Saving…" : `Save ${draft.days.length} ${draft.days.length === 1 ? "routine" : "routines"}`}
          </button>
        </div>
      </div>

      {picker && (
        <ExercisePicker
          exercises={library}
          onClose={() => setPicker(null)}
          onAdd={(picked) => {
            const toRow = (o: ExerciseOption): ProgramExercise => ({ exerciseId: o.id, name: o.name, sets: 3, repMin: 8, repMax: 12, restSeconds: 90 });
            if (picker.mode === "swap" && picked[0]) {
              // keep the sets, reps, and rest; change the movement
              updateExercise(picker.index, { exerciseId: picked[0].id, name: picked[0].name });
            } else updateDay((exs) => [...exs, ...picked.map(toRow)]);
            setPicker(null);
          }}
        />
      )}
      {busy && <BuildProgress task={busy} />}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset className="mt-5">
      <legend className="text-sm font-medium text-chalk-muted">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function Stepper({ label, value, min, max, step = 1, format, onChange }: { label: string; value: number; min: number; max: number; step?: number; format?: (v: number) => string; onChange: (v: number) => void }) {
  return (
    <div>
      <span>{label}</span>
      <div className="mt-1 flex items-center justify-center gap-1">
        <button onClick={() => onChange(Math.max(min, value - step))} className="rounded-lg bg-rack-raised p-1.5" aria-label={`Less ${label.toLowerCase()}`}><Minus size={13} /></button>
        <span className="min-w-9 font-display text-base font-semibold text-chalk tabular-nums">{format ? format(value) : value}</span>
        <button onClick={() => onChange(Math.min(max, value + step))} className="rounded-lg bg-rack-raised p-1.5" aria-label={`More ${label.toLowerCase()}`}><Plus size={13} /></button>
      </div>
    </div>
  );
}

function BuildProgress({ task }: { task: "build" | "revise" }) {
  return <AiProgress task={task === "build" ? "program" : "programRevise"} />;
}
