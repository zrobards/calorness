"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { mergeCommunityExercise, publishCommunityExercise, saveLibraryExercise } from "../actions";

const MUSCLES = ["chest", "shoulders", "biceps", "triceps", "forearms", "abdominals", "traps", "lats", "middle back", "lower back", "glutes", "quadriceps", "hamstrings", "adductors", "abductors", "calves", "neck"];
const EQUIPMENT = ["barbell", "dumbbell", "cable", "machine", "body only", "kettlebells", "bands", "e-z curl bar", "medicine ball", "exercise ball", "foam roll", "other"];
const CATEGORIES = [["STRENGTH", "Strength"], ["CARDIO", "Cardio"], ["STRETCHING", "Stretching"], ["PLYOMETRICS", "Plyometrics"]] as const;
type Category = (typeof CATEGORIES)[number][0];

type Details = { name: string; aliases: string[]; primaryMuscles: string[]; secondaryMuscles: string[]; equipment: string | null; category: Category };

const asDetails = (e: { name: string; aliases?: string[]; primaryMuscles: string[]; secondaryMuscles: string[]; equipment: string | null; category: string }): Details => ({
  name: e.name,
  aliases: e.aliases ?? [],
  primaryMuscles: e.primaryMuscles,
  secondaryMuscles: e.secondaryMuscles,
  equipment: e.equipment,
  category: (CATEGORIES.some(([c]) => c === e.category) ? e.category : "STRENGTH") as Category,
});

/** The edit form shared by library edits, new exercises, and publishing people's ones. */
function Editor({ initial, submitLabel, onSubmit, onCancel }: { initial: Details; submitLabel: string; onSubmit: (d: Details) => Promise<{ error?: string } | { ok: true }>; onCancel: () => void }) {
  const [d, setD] = useState(initial);
  const [aliases, setAliases] = useState(initial.aliases.join(", "));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toggle = (k: "primaryMuscles" | "secondaryMuscles", m: string) =>
    setD({ ...d, [k]: d[k].includes(m) ? d[k].filter((x) => x !== m) : [...d[k], m] });

  return (
    <div className="mt-3 space-y-3 rounded-xl bg-rack p-3">
      <label className="block text-xs text-chalk-muted">Name<input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} className={input} /></label>
      <label className="block text-xs text-chalk-muted">Other names people use (commas)<input value={aliases} onChange={(e) => setAliases(e.target.value)} placeholder="pec deck, fly machine" className={input} /></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs text-chalk-muted">Equipment
          <select value={d.equipment ?? ""} onChange={(e) => setD({ ...d, equipment: e.target.value || null })} className={input}>
            <option value="">None</option>
            {EQUIPMENT.map((x) => <option key={x}>{x}</option>)}
          </select>
        </label>
        <label className="block text-xs text-chalk-muted">Type
          <select value={d.category} onChange={(e) => setD({ ...d, category: e.target.value as Category })} className={input}>
            {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </div>
      {(["primaryMuscles", "secondaryMuscles"] as const).map((k) => (
        <fieldset key={k}>
          <legend className="text-xs text-chalk-muted">{k === "primaryMuscles" ? "Main muscles" : "Also works"}</legend>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {MUSCLES.map((m) => (
              <button key={m} type="button" aria-pressed={d[k].includes(m)} onClick={() => toggle(k, m)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${d[k].includes(m) ? (k === "primaryMuscles" ? "bg-plate-yellow text-rack" : "bg-plate-blue text-rack") : "bg-rack-raised text-chalk-muted"}`}>
                {m}
              </button>
            ))}
          </div>
        </fieldset>
      ))}
      {error && <p role="alert" className="text-sm text-plate-red">{error}</p>}
      <div className="flex gap-2">
        <button disabled={pending} className="flex-1 rounded-xl bg-plate-blue py-2.5 font-semibold text-rack disabled:opacity-50"
          onClick={() => start(async () => {
            setError(null);
            const r = await onSubmit({ ...d, aliases: aliases.split(",").map((a) => a.trim().toLowerCase()).filter(Boolean) }).catch(() => ({ error: "No connection. Try again." }));
            if ("error" in r && r.error) setError(r.error);
          })}>
          {pending ? "Saving…" : submitLabel}
        </button>
        <button disabled={pending} onClick={onCancel} className="rounded-xl bg-rack-raised px-4 py-2.5 font-semibold text-chalk-muted">Cancel</button>
      </div>
    </div>
  );
}

const input = "mt-1 block w-full appearance-none rounded-lg bg-rack-raised px-3 py-2 text-base text-chalk [color-scheme:dark]";

export function LibraryExerciseRow({ exercise }: { exercise: Details & { id: string; uses: number } }) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(exercise);
  return (
    <li className="py-2.5">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-start justify-between gap-3 text-left" aria-expanded={open}>
        <span className="min-w-0">
          <span className="block truncate font-semibold">{shown.name}</span>
          <span className="block truncate text-xs text-chalk-muted">{[shown.primaryMuscles.join(", "), shown.equipment, shown.aliases.length ? `aka ${shown.aliases.join(", ")}` : null].filter(Boolean).join(" · ")}</span>
        </span>
        <span className="shrink-0 text-xs text-chalk-muted">{exercise.uses.toLocaleString("en-US")} {exercise.uses === 1 ? "use" : "uses"}</span>
      </button>
      {open && (
        <Editor initial={asDetails(shown)} submitLabel="Save" onCancel={() => setOpen(false)}
          onSubmit={async (d) => {
            const r = await saveLibraryExercise(exercise.id, d);
            if ("ok" in r) { setShown({ ...shown, ...d }); setOpen(false); }
            return r;
          }} />
      )}
    </li>
  );
}

export function NewExercise() {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  if (!open)
    return (
      <button onClick={() => { setOpen(true); setDone(null); }} className="flex items-center gap-1 text-sm font-semibold text-plate-blue">
        <Plus size={16} aria-hidden /> {done ? `Added ${done}. Add another` : "Add"}
      </button>
    );
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-3xl bg-rack-raised p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl">
      <h3 className="font-display text-xl font-semibold">New library exercise</h3>
      <Editor initial={{ name: "", aliases: [], primaryMuscles: [], secondaryMuscles: [], equipment: null, category: "STRENGTH" }} submitLabel="Add to library" onCancel={() => setOpen(false)}
        onSubmit={async (d) => {
          const r = await saveLibraryExercise(null, d);
          if ("ok" in r) { setDone(d.name); setOpen(false); }
          return r;
        }} />
    </div>
  );
}

type Group = { key: string; name: string; people: number; ids: string[]; uses: number; primaryMuscles: string[]; secondaryMuscles: string[]; equipment: string | null; category: string; match: { id: string; name: string } | null };

/** The list keeps what you just did on screen, even after the row it came from is gone. */
export function CommunityExercises({ groups, library }: { groups: Group[]; library: { id: string; name: string }[] }) {
  const [notes, setNotes] = useState<string[]>([]);
  return (
    <>
      {notes.map((n) => <p key={n} role="status" className="mb-2 rounded-xl bg-plate-green/15 px-3 py-2 text-sm">{n}</p>)}
      {groups.length === 0 && <p className="text-sm text-chalk-muted">None waiting.</p>}
      <ul className="divide-y divide-rack-line">
        {groups.map((g) => <CommunityExerciseRow key={g.key} group={g} library={library} onDone={(n) => setNotes((x) => [n, ...x])} />)}
      </ul>
    </>
  );
}

function CommunityExerciseRow({ group, library, onDone }: { group: Group; library: { id: string; name: string }[]; onDone: (note: string) => void }) {
  const [mode, setMode] = useState<"publish" | "merge" | null>(null);
  const [target, setTarget] = useState(group.match?.id ?? "");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const finish = (note: string) => { setDone(true); onDone(note); };
  if (done) return null;
  return (
    <li className="py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{group.name}</p>
          <p className="text-xs text-chalk-muted">
            {group.people} {group.people === 1 ? "person" : "people"} · used {group.uses}× · {group.primaryMuscles.join(", ") || "no muscle set"}
            {group.match && <span className="text-plate-yellow"> · same as library &ldquo;{group.match.name}&rdquo;</span>}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button onClick={() => setMode(mode === "merge" ? null : "merge")} className="rounded-full bg-rack px-3 py-1.5 text-xs font-semibold text-chalk-muted">Merge</button>
          {!group.match && <button onClick={() => setMode(mode === "publish" ? null : "publish")} className="rounded-full bg-rack px-3 py-1.5 text-xs font-semibold text-plate-blue">Add</button>}
        </div>
      </div>
      {mode === "publish" && (
        <Editor initial={asDetails(group)} submitLabel="Add to library" onCancel={() => setMode(null)}
          onSubmit={async (d) => {
            const r = await publishCommunityExercise(group.ids, d);
            if ("ok" in r) finish(`Added “${d.name}” to the library; ${r.moved} ${r.moved === 1 ? "copy" : "copies"} switched over.`);
            return r;
          }} />
      )}
      {mode === "merge" && (
        <div className="mt-3 flex gap-2 rounded-xl bg-rack p-3">
          <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Library exercise to merge into" className="min-w-0 flex-1 appearance-none rounded-lg bg-rack-raised px-3 py-2 text-base [color-scheme:dark]">
            <option value="">Pick the library exercise…</option>
            {library.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <button disabled={!target || pending} className="rounded-xl bg-plate-blue px-4 font-semibold text-rack disabled:opacity-50"
            onClick={() => start(async () => {
              const r = await mergeCommunityExercise(group.ids, target, group.name).catch(() => ({ error: "No connection. Try again." }));
              if ("error" in r && r.error) return alert(r.error);
              finish(`Merged “${group.name}” into “${library.find((e) => e.id === target)?.name}”; ${group.ids.length} ${group.ids.length === 1 ? "copy" : "copies"} switched over.`);
            })}>
            {pending ? "…" : "Merge"}
          </button>
        </div>
      )}
    </li>
  );
}
