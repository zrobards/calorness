"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowLeftRight, Camera, ChevronLeft, ChevronRight, Lock, Scale, Trash2, Users } from "lucide-react";
import { Sheet } from "@/components/diary/Sheet";
import { haptic } from "@/lib/haptics";
import { failed, safe } from "@/lib/safeAction";
import { addProgressPhoto, deleteProgressPhoto, deleteWeighIn, saveWeighIn, setPhotoVisibility } from "./actions";

type Visibility = "PRIVATE" | "FOLLOWERS";
type Photo = { id: string; day: string; width: number; height: number; visibility: Visibility; note: string | null };
type WeighIn = { day: string; weight: number };

const src = (id: string, thumb = false) => `/api/photos/${id}${thumb ? "?size=thumb" : ""}`;
const fmt = (day: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });

/** The weigh-in on that day, or the closest one before it (within two weeks). */
function weightOn(weighIns: WeighIn[], day: string) {
  const w = weighIns.find((x) => x.day <= day); // newest first
  if (!w) return null;
  const gap = (new Date(day).getTime() - new Date(w.day).getTime()) / 86_400_000;
  return gap <= 14 ? w.weight : null;
}

/** "1 year, 3 months" between two days. */
function span(a: string, b: string) {
  const days = Math.round(Math.abs(new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
  if (days < 14) return `${days} ${days === 1 ? "day" : "days"}`;
  if (days < 61) return `${Math.round(days / 7)} weeks`;
  const months = Math.round(days / 30.44);
  const y = Math.floor(months / 12), m = months % 12;
  return [y ? `${y} ${y === 1 ? "year" : "years"}` : "", m ? `${m} ${m === 1 ? "month" : "months"}` : ""].filter(Boolean).join(", ");
}

/** Shrink on the phone: a full-size copy and a small one for the grid. */
async function prepare(file: File) {
  const bitmap = await createImageBitmap(file);
  const encode = (maxSide: number, quality: number) => {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bitmap.width * scale);
    c.height = Math.round(bitmap.height * scale);
    c.getContext("2d")!.drawImage(bitmap, 0, 0, c.width, c.height);
    return { data: c.toDataURL("image/jpeg", quality).split(",")[1], width: c.width, height: c.height };
  };
  let full = encode(1440, 0.82);
  if (full.data.length > 1_300_000) full = encode(1080, 0.75);
  const thumb = encode(400, 0.75);
  bitmap.close();
  return { image: full.data, width: full.width, height: full.height, thumb: thumb.data, preview: `data:image/jpeg;base64,${thumb.data}` };
}

export function PhotosView({
  photos,
  weighIns,
  today,
  unit,
  hasProfile,
  openPhoto,
  addDay,
}: {
  photos: Photo[];
  weighIns: WeighIn[];
  today: string;
  unit: string;
  hasProfile: boolean;
  openPhoto: string | null;
  addDay: string | null;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [adding, setAdding] = useState<Awaited<ReturnType<typeof prepare>> | null>(null);
  const [addFor, setAddFor] = useState<string>(addDay ?? today);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<string | null>(photos.some((p) => p.id === openPhoto) ? openPhoto : null);
  // Then vs now: oldest and newest by default
  const [compare, setCompare] = useState<[string, string] | null>(photos.length > 1 ? [photos.at(-1)!.id, photos[0].id] : null);

  // Opened from the calendar's "Add photo": ask for the picture right away
  useEffect(() => {
    if (addDay) window.history.replaceState(null, "", "/progress/photos");
  }, [addDay]);

  const pick = (forDay = today) => {
    setAddFor(forDay);
    setError(null);
    fileRef.current?.click();
  };
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setPreparing(true);
    try {
      setAdding(await prepare(file));
    } catch {
      setError("Couldn't open that picture. Try a different one.");
    } finally {
      setPreparing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const byMonth = useMemo(() => {
    const groups = new Map<string, Photo[]>();
    for (const p of photos) {
      const k = p.day.slice(0, 7);
      groups.set(k, [...(groups.get(k) ?? []), p]);
    }
    return [...groups.entries()];
  }, [photos]);

  const viewIndex = photos.findIndex((p) => p.id === viewing);

  return (
    <div className="space-y-5 px-5 pb-10">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} aria-label="Choose a progress photo" />
      <button onClick={() => { haptic(); pick(addDay ?? today); }} disabled={preparing}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-plate-yellow py-3.5 font-display text-lg font-semibold text-rack disabled:opacity-60">
        <Camera size={20} aria-hidden /> {preparing ? "Opening…" : "Add progress photo"}
      </button>
      {error && <p role="alert" className="rounded-xl bg-plate-red/10 px-3 py-2 text-sm">{error}</p>}

      {photos.length === 0 && (
        <p className="rounded-2xl bg-rack-raised p-5 text-center text-sm text-chalk-muted">
          Take one now and every few weeks, same spot, same light. In a year you&rsquo;ll be glad you did. Photos are private to you unless you choose to share one with your followers.
        </p>
      )}

      {compare && <Compare photos={photos} weighIns={weighIns} unit={unit} pair={compare} onChange={setCompare} />}

      {byMonth.map(([month, list]) => (
        <section key={month} aria-label={fmt(`${month}-01`, { month: "long", year: "numeric" })}>
          <h2 className="mb-2 font-display text-lg font-semibold">{fmt(`${month}-01`, { month: "long", year: "numeric" })}</h2>
          <ul className="grid grid-cols-3 gap-2">
            {list.map((p) => {
              const wt = weightOn(weighIns, p.day);
              return (
                <li key={p.id}>
                  <button onClick={() => { haptic(); setViewing(p.id); }} className="relative block aspect-[3/4] w-full overflow-hidden rounded-xl bg-rack-raised" aria-label={`Photo from ${fmt(p.day)}${wt ? `, ${wt} ${unit}` : ""}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src(p.id, true)} alt="" loading="lazy" className="size-full object-cover" />
                    <span className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/75 px-1.5 pt-4 pb-1 text-[11px] font-semibold text-white">
                      <span>{fmt(p.day, { month: "short", day: "numeric" })}{wt ? ` · ${wt}` : ""}</span>
                      {p.visibility === "FOLLOWERS" ? <Users size={12} aria-label="Followers can see" /> : <Lock size={12} aria-label="Only you" />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <WeighIns weighIns={weighIns} today={today} unit={unit} />

      {adding && (
        <AddSheet
          prepared={adding}
          day={addFor}
          today={today}
          unit={unit}
          hasProfile={hasProfile}
          weighIns={weighIns}
          onClose={() => setAdding(null)}
        />
      )}

      {viewing && viewIndex >= 0 && (
        <Viewer
          photo={photos[viewIndex]}
          weight={weightOn(weighIns, photos[viewIndex].day)}
          unit={unit}
          hasProfile={hasProfile}
          onPrev={viewIndex < photos.length - 1 ? () => setViewing(photos[viewIndex + 1].id) : undefined}
          onNext={viewIndex > 0 ? () => setViewing(photos[viewIndex - 1].id) : undefined}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}

function Compare({ photos, weighIns, unit, pair, onChange }: { photos: Photo[]; weighIns: WeighIn[]; unit: string; pair: [string, string]; onChange: (p: [string, string]) => void }) {
  const [a, b] = pair.map((id) => photos.find((p) => p.id === id) ?? null);
  if (!a || !b) return null;
  const [wa, wb] = [weightOn(weighIns, a.day), weightOn(weighIns, b.day)];
  const diff = wa !== null && wb !== null ? Math.round((wb - wa) * 10) / 10 : null;
  const choose = (side: 0 | 1, id: string) => onChange(side === 0 ? [id, pair[1]] : [pair[0], id]);
  return (
    <section aria-label="Compare photos" className="rounded-2xl bg-rack-raised p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><ArrowLeftRight size={18} className="text-plate-yellow" aria-hidden /> Then and now</h2>
        <span className="text-xs text-chalk-muted">{span(a.day, b.day)} apart</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {([a, b] as const).map((p, side) => (
          <figure key={side}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src(p.id)} alt={`Progress photo from ${fmt(p.day)}`} className="aspect-[3/4] w-full rounded-xl bg-rack object-cover" />
            <figcaption className="mt-1.5">
              <select value={p.id} onChange={(e) => choose(side as 0 | 1, e.target.value)} aria-label={side ? "Newer photo" : "Older photo"}
                className="w-full appearance-none rounded-lg bg-rack px-2 py-1.5 text-sm font-semibold [color-scheme:dark]">
                {photos.map((x) => <option key={x.id} value={x.id}>{fmt(x.day)}</option>)}
              </select>
              <span className="mt-0.5 block px-1 text-xs text-chalk-muted">{(side ? wb : wa) !== null ? `${side ? wb : wa} ${unit}` : "No weigh-in near then"}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      {diff !== null && (
        <p className="mt-2 text-center text-sm">
          <b className={diff === 0 ? "" : "text-plate-yellow"}>{diff > 0 ? "+" : ""}{diff} {unit}</b> <span className="text-chalk-muted">between these photos</span>
        </p>
      )}
    </section>
  );
}

function VisibilityPicker({ value, onChange, hasProfile }: { value: Visibility; onChange: (v: Visibility) => void; hasProfile: boolean }) {
  return (
    <fieldset>
      <legend className="text-sm text-chalk-muted">Who can see it</legend>
      <div className="mt-1.5 grid grid-cols-2 gap-2">
        {([["PRIVATE", "Only me", Lock], ["FOLLOWERS", "My followers", Users]] as const).map(([v, label, Icon]) => (
          <button key={v} type="button" aria-pressed={value === v} disabled={v === "FOLLOWERS" && !hasProfile} onClick={() => { haptic(); onChange(v); }}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 font-semibold disabled:opacity-40 ${value === v ? "bg-plate-blue text-rack" : "bg-rack text-chalk-muted"}`}>
            <Icon size={16} aria-hidden /> {label}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-chalk-muted">
        {hasProfile ? "Followers you approved see it on your profile. You can change this anytime." : "To share with followers, set up your profile on the Feed tab first."}
      </p>
    </fieldset>
  );
}

function AddSheet({ prepared, day: initialDay, today, unit, hasProfile, weighIns, onClose }: {
  prepared: Awaited<ReturnType<typeof prepare>>;
  day: string;
  today: string;
  unit: string;
  hasProfile: boolean;
  weighIns: WeighIn[];
  onClose: () => void;
}) {
  // Only that exact day's weigh-in is filled in (saving the photo's weight
  // records it for that day, so a guess from another day must never be saved)
  const exact = (d: string) => weighIns.find((w) => w.day === d)?.weight ?? null;
  const [day, setDayState] = useState(initialDay);
  const [weight, setWeight] = useState(exact(initialDay)?.toString() ?? "");
  const [typed, setTyped] = useState(false);
  const setDay = (d: string) => {
    setDayState(d);
    if (!typed) setWeight(exact(d)?.toString() ?? "");
  };
  const near = weightOn(weighIns, day);
  const [visibility, setVisibility] = useState<Visibility>("PRIVATE");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      setError(null);
      const r = await safe(() => addProgressPhoto({ day, image: prepared.image, thumb: prepared.thumb, width: prepared.width, height: prepared.height, visibility, note: note || undefined, weight: weight ? Number(weight) : null }));
      if (failed(r)) return setError(r.error);
      haptic();
      onClose();
    });
  return (
    <Sheet title="New progress photo" onClose={onClose}>
      <div className="mt-3 flex gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={prepared.preview} alt="" className="h-36 w-28 shrink-0 rounded-xl object-cover" />
        <div className="min-w-0 flex-1 space-y-3">
          <label className="block text-sm text-chalk-muted">Date
            <input type="date" value={day} max={today} onChange={(e) => setDay(e.target.value)} className="mt-1 w-full rounded-xl bg-rack px-3 py-2 text-base text-chalk [color-scheme:dark]" />
          </label>
          <label className="block text-sm text-chalk-muted">Weight ({unit}, optional)
            <input type="number" inputMode="decimal" step="0.1" value={weight} onChange={(e) => { setTyped(true); setWeight(e.target.value); }}
              placeholder={near !== null ? `about ${near}` : ""} className="mt-1 w-full rounded-xl bg-rack px-3 py-2 text-base text-chalk tabular-nums placeholder:text-chalk-muted/60" />
          </label>
        </div>
      </div>
      <label className="mt-3 block text-sm text-chalk-muted">Note (optional)
        <input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Front, morning, after 12 weeks of the program…" className="mt-1 w-full rounded-xl bg-rack px-3 py-2 text-base text-chalk" />
      </label>
      <div className="mt-4"><VisibilityPicker value={visibility} onChange={setVisibility} hasProfile={hasProfile} /></div>
      {error && <p role="alert" className="mt-3 text-sm text-plate-red">{error}</p>}
      <button onClick={save} disabled={pending} className="mt-4 w-full rounded-xl bg-plate-blue py-3.5 font-display text-lg font-semibold text-rack disabled:opacity-60">
        {pending ? "Saving…" : "Save photo"}
      </button>
      {weight && <p className="mt-2 text-center text-xs text-chalk-muted">The weight is saved as that day&rsquo;s weigh-in too.</p>}
    </Sheet>
  );
}

function Viewer({ photo, weight, unit, hasProfile, onPrev, onNext, onClose }: {
  photo: Photo;
  weight: number | null;
  unit: string;
  hasProfile: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  onClose: () => void;
}) {
  const [visibility, setVis] = useState<Visibility>(photo.visibility);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const change = (v: Visibility) => {
    setVis(v);
    start(async () => {
      const r = await safe(() => setPhotoVisibility(photo.id, v));
      if (failed(r)) { setVis(photo.visibility); setError(r.error); }
    });
  };
  return (
    <Sheet title={fmt(photo.day, { weekday: "short", month: "long", day: "numeric", year: "numeric" })} onClose={onClose}>
      <div className="relative mt-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={photo.id} src={src(photo.id)} alt={`Progress photo from ${fmt(photo.day)}`} className="max-h-[55dvh] w-full rounded-xl bg-rack object-contain" />
        {onPrev && <button onClick={onPrev} className="absolute top-1/2 left-1 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white" aria-label="Older photo"><ChevronLeft size={20} /></button>}
        {onNext && <button onClick={onNext} className="absolute top-1/2 right-1 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white" aria-label="Newer photo"><ChevronRight size={20} /></button>}
      </div>
      <p className="mt-2 text-sm text-chalk-muted">
        {weight !== null ? <><Scale size={14} className="mr-1 inline" aria-hidden />{weight} {unit}</> : "No weigh-in near this day"}
        {photo.note ? ` · ${photo.note}` : ""}
      </p>
      <div className={`mt-4 ${pending ? "opacity-70" : ""}`}><VisibilityPicker value={visibility} onChange={change} hasProfile={hasProfile} /></div>
      {error && <p role="alert" className="mt-2 text-sm text-plate-red">{error}</p>}
      <button
        onClick={() => {
          if (!confirm("Delete this photo? This can't be undone.")) return;
          start(async () => {
            const r = await safe(() => deleteProgressPhoto(photo.id));
            if (failed(r)) return setError(r.error);
            onClose();
          });
        }}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-rack-line py-3 font-medium text-chalk-muted hover:text-plate-red"
      >
        <Trash2 size={16} aria-hidden /> Delete photo
      </button>
    </Sheet>
  );
}

function WeighIns({ weighIns, today, unit }: { weighIns: WeighIn[]; today: string; unit: string }) {
  const [all, setAll] = useState(false);
  const [day, setDay] = useState(today);
  const [weight, setWeight] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const shown = all ? weighIns : weighIns.slice(0, 8);
  const add = () =>
    start(async () => {
      setError(null);
      const r = await safe(() => saveWeighIn({ day, weight: Number(weight) }));
      if (failed(r)) return setError(r.error);
      haptic();
      setWeight("");
    });
  const first = weighIns.at(-1), last = weighIns[0];
  return (
    <section aria-labelledby="weighins" className="rounded-2xl bg-rack-raised p-4">
      <div className="flex items-baseline justify-between">
        <h2 id="weighins" className="font-display text-lg font-semibold">Weigh-ins</h2>
        {first && last && first !== last && (
          <span className="text-xs text-chalk-muted">
            {Math.round((last.weight - first.weight) * 10) / 10 > 0 ? "+" : ""}{Math.round((last.weight - first.weight) * 10) / 10} {unit} since {fmt(first.day)}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-end gap-2">
        <label className="w-[44%] text-xs text-chalk-muted">Date
          <input type="date" value={day} max={today} onChange={(e) => setDay(e.target.value)} className="mt-1 w-full rounded-xl bg-rack px-2.5 py-2 text-base text-chalk [color-scheme:dark]" />
        </label>
        <label className="min-w-0 flex-1 text-xs text-chalk-muted">Weight ({unit})
          <input type="number" inputMode="decimal" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} className="mt-1 w-full rounded-xl bg-rack px-2.5 py-2 text-base text-chalk tabular-nums" />
        </label>
        <button onClick={add} disabled={pending || !weight} className="rounded-xl bg-plate-blue px-4 py-2.5 font-semibold text-rack disabled:opacity-50">{pending ? "…" : "Log"}</button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-plate-red">{error}</p>}
      {weighIns.length > 0 && (
        <ul className="mt-3 divide-y divide-rack-line">
          {shown.map((w, i) => {
            const prev = weighIns[i + 1];
            const change = prev ? Math.round((w.weight - prev.weight) * 10) / 10 : null;
            return (
              <li key={w.day} className="flex items-center gap-3 py-2 text-sm">
                <span className="flex-1 text-chalk-muted">{fmt(w.day, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span>
                {change !== null && change !== 0 && <span className="text-xs text-chalk-muted tabular-nums">{change > 0 ? "+" : ""}{change}</span>}
                <span className="w-16 text-right font-semibold tabular-nums">{w.weight} {unit}</span>
                <button onClick={() => { if (confirm(`Delete the ${fmt(w.day)} weigh-in?`)) start(async () => { await safe(() => deleteWeighIn(w.day)); }); }} className="p-1 text-chalk-muted hover:text-plate-red" aria-label={`Delete weigh-in from ${fmt(w.day)}`}>
                  <Trash2 size={15} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {weighIns.length > 8 && (
        <button onClick={() => setAll((a) => !a)} className="mt-2 text-sm font-semibold text-plate-blue">{all ? "Show fewer" : `Show all ${weighIns.length}`}</button>
      )}
    </section>
  );
}
