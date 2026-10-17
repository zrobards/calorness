"use client";

import { useMemo, useState, useTransition } from "react";
import { Flame, HeartPulse, Search } from "lucide-react";
import { ACTIVITIES, estimateBurn, exerciseCreditCalories, metFor, type Activity, type Intensity } from "@/lib/fitness/activities";
import { lbToKg } from "@/lib/fitness/units";
import { searchByName } from "@/components/train/muscleFilters";
import { haptic } from "@/lib/haptics";
import { logActivity } from "../actions";

type BodyProps = { weight: number | null; weightKg: number | null; heightCm: number | null; age: number | null; sex: "male" | "female" | null };
const CATEGORIES = [...new Set(ACTIVITIES.map((a) => a.category))];
const CUSTOM: Activity = { key: "custom", name: "Something else", category: "Other", met: { light: 3, moderate: 5, vigorous: 8 } };
const field = "mt-1 w-full rounded-xl border border-rack-line bg-rack-raised px-3 py-2.5 text-base text-chalk tabular-nums focus:border-plate-yellow focus:outline-none";

export function CardioForm({ day, imperial, credit, body, recentKeys }: { day: string; imperial: boolean; credit: number; body: BodyProps; recentKeys: string[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [customName, setCustomName] = useState("");
  const [intensity, setIntensity] = useState<Intensity>("moderate");
  const [minutes, setMinutes] = useState("30");
  const [distance, setDistance] = useState("");
  const [incline, setIncline] = useState("");
  const [hr, setHr] = useState("");
  const [weight, setWeight] = useState(body.weight ? String(body.weight) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const list = useMemo(() => {
    const pool = category ? ACTIVITIES.filter((a) => a.category === category) : ACTIVITIES;
    return query.trim() ? searchByName(pool, query) : pool;
  }, [query, category]);
  const recent = recentKeys.map((k) => ACTIVITIES.find((a) => a.key === k)).filter((a): a is Activity => !!a);

  // Live estimate with the same math the server uses
  const weightKg = body.weightKg ?? (Number(weight) > 0 ? (imperial ? lbToKg(Number(weight)) : Number(weight)) : null);
  const levels = activity ? (["light", "moderate", "vigorous"] as Intensity[]).filter((l) => activity.met[l] !== undefined) : [];
  const burn = activity && weightKg && Number(minutes) > 0
    ? estimateBurn({
        weightKg, heightCm: body.heightCm, age: body.age, sex: body.sex,
        minutes: Number(minutes), met: metFor(activity, intensity),
        avgHeartRate: Number(hr) || null,
        distanceM: Number(distance) > 0 ? Number(distance) * (imperial ? 1609.344 : 1000) : null,
        inclinePct: Number(incline) || null, speedModel: activity.speedModel,
      })
    : null;

  const choose = (a: Activity) => {
    haptic();
    setActivity(a);
    const lv = (["moderate", "light", "vigorous"] as Intensity[]).find((l) => a.met[l] !== undefined)!;
    setIntensity(lv);
  };

  if (!activity) {
    return (
      <div className="mt-4">
        <label className="relative block">
          <Search size={18} className="absolute top-1/2 left-3 -translate-y-1/2 text-chalk-muted" aria-hidden />
          <input value={query} onChange={(e) => setQuery(e.target.value)} autoFocus placeholder="Running, climbing, hacky sack…" aria-label="Search activities"
            className="w-full rounded-xl border border-rack-line bg-rack-raised py-3 pr-3 pl-10 focus:border-plate-yellow focus:outline-none" />
        </label>
        <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1">
          {[null, ...CATEGORIES].map((c) => (
            <button key={c ?? "all"} onClick={() => setCategory(c)} aria-pressed={category === c}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${category === c ? "bg-chalk text-rack" : "bg-rack-raised text-chalk-muted"}`}>
              {c ?? "All"}
            </button>
          ))}
        </div>
        {!query && !category && recent.length > 0 && (
          <>
            <p className="mt-4 text-sm font-medium text-chalk-muted">Recent</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {recent.map((a) => <button key={a.key} onClick={() => choose(a)} className="rounded-full bg-plate-blue/15 px-3.5 py-2 text-sm font-medium ring-1 ring-plate-blue/40">{a.name}</button>)}
            </div>
          </>
        )}
        <ul className="mt-3 divide-y divide-rack-line overflow-hidden rounded-2xl bg-rack-raised">
          {list.map((a) => (
            <li key={a.key}>
              <button onClick={() => choose(a)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
                <span>
                  <span className="block font-medium">{a.name}</span>
                  <span className="text-xs text-chalk-muted">{a.category}</span>
                </span>
                <span className="text-xs text-chalk-muted tabular-nums">{a.met.moderate} MET</span>
              </button>
            </li>
          ))}
          <li>
            <button onClick={() => choose(CUSTOM)} className="w-full px-4 py-3 text-left font-medium text-plate-blue">Something else (name it yourself)</button>
          </li>
        </ul>
      </div>
    );
  }

  return (
    <form
      className="mt-4 space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await logActivity({
            activity: activity.key,
            customName: activity.key === "custom" ? customName : undefined,
            intensity, day, minutes: Number(minutes),
            distance: Number(distance) || undefined, inclinePct: Number(incline) || undefined,
            avgHeartRate: Number(hr) || undefined,
            weight: body.weightKg ? undefined : Number(weight) || undefined,
          });
          if (r?.error) setError(r.error);
          else haptic("success");
        });
      }}
    >
      <div className="flex items-center justify-between rounded-2xl bg-rack-raised px-4 py-3">
        <span className="font-display text-2xl font-semibold">{activity.name}</span>
        <button type="button" onClick={() => setActivity(null)} className="text-sm font-medium text-plate-blue">Change</button>
      </div>

      {activity.key === "custom" && (
        <label className="block text-sm font-medium text-chalk-muted">What did you do?
          <input value={customName} onChange={(e) => setCustomName(e.target.value)} required className={field} placeholder="Spikeball, cornhole, laser tag…" />
        </label>
      )}

      {levels.length > 1 && (
        <fieldset>
          <legend className="text-sm font-medium text-chalk-muted">How hard?</legend>
          <div className="mt-2 grid gap-2" style={{ gridTemplateColumns: `repeat(${levels.length}, minmax(0, 1fr))` }}>
            {levels.map((l) => (
              <button key={l} type="button" onClick={() => { haptic(); setIntensity(l); }} aria-pressed={intensity === l}
                className={`rounded-xl px-2 py-2.5 text-left ${intensity === l ? "bg-plate-red text-white" : "bg-rack-raised"}`}>
                <span className="block text-sm font-semibold capitalize">{l}</span>
                {activity.hints?.[l] && <span className={`block text-xs ${intensity === l ? "text-white/85" : "text-chalk-muted"}`}>{activity.hints[l]}</span>}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <div>
        <label className="block text-sm font-medium text-chalk-muted">Minutes
          <input type="number" inputMode="numeric" min={1} value={minutes} onChange={(e) => setMinutes(e.target.value)} required className={`${field} font-display text-2xl font-bold`} />
        </label>
        <div className="mt-2 flex gap-2">
          {[15, 30, 45, 60, 90].map((m) => (
            <button key={m} type="button" onClick={() => setMinutes(String(m))} className={`flex-1 rounded-lg py-1.5 text-sm ${minutes === String(m) ? "bg-chalk text-rack" : "bg-rack-raised text-chalk-muted"}`}>{m}</button>
          ))}
        </div>
      </div>

      {(activity.distance || activity.incline) && (
        <div className="grid grid-cols-2 gap-3">
          {activity.distance && (
            <label className="block text-sm font-medium text-chalk-muted">Distance ({imperial ? "mi" : "km"}, optional)
              <input type="number" inputMode="decimal" step="any" value={distance} onChange={(e) => setDistance(e.target.value)} className={field} />
            </label>
          )}
          {activity.incline && (
            <label className="block text-sm font-medium text-chalk-muted">Incline (%, optional)
              <input type="number" inputMode="decimal" step="any" value={incline} onChange={(e) => setIncline(e.target.value)} className={field} />
            </label>
          )}
        </div>
      )}

      <label className="block text-sm font-medium text-chalk-muted">
        <span className="flex items-center gap-1.5"><HeartPulse size={15} className="text-plate-red" aria-hidden /> Average heart rate (optional, most accurate)</span>
        <input type="number" inputMode="numeric" value={hr} onChange={(e) => setHr(e.target.value)} placeholder="From your watch, e.g. 145" className={field} />
      </label>

      {!body.weightKg && (
        <label className="block text-sm font-medium text-chalk-muted">Your weight ({imperial ? "lb" : "kg"})
          <input type="number" inputMode="decimal" step="any" value={weight} onChange={(e) => setWeight(e.target.value)} required className={field} />
        </label>
      )}

      {burn && (
        <div className="animate-rise rounded-2xl border border-plate-red/40 bg-plate-red/10 p-4" aria-live="polite">
          <p className="flex items-center gap-2 text-sm text-chalk-muted"><Flame size={16} className="text-plate-red" aria-hidden /> Estimated burn</p>
          <p className="mt-1 font-display text-5xl leading-none font-bold tabular-nums">{burn.total.toLocaleString("en-US")}<span className="ml-1 text-lg text-chalk-muted">cal</span></p>
          <p className="mt-2 text-sm">
            <span className="font-semibold">+{exerciseCreditCalories(burn.net, credit)} cal</span> added to today&apos;s goal
            <span className="text-chalk-muted"> ({burn.net} above resting{credit < 100 ? `, ${credit}% credit` : ""})</span>
          </p>
          <p className="mt-1 text-xs text-chalk-muted">
            Based on {burn.explain}.
            {(!body.sex || !body.age || !body.heightCm) && " Add sex, age, and height in Profile for a closer estimate."}
            {burn.method !== "heart-rate" && " Adding heart rate makes it more accurate."}
          </p>
        </div>
      )}

      {error && <p role="alert" className="text-sm text-plate-red">{error}</p>}
      <button disabled={pending} className="w-full rounded-xl bg-plate-red py-3.5 font-display text-xl font-semibold text-white disabled:opacity-60">
        {pending ? "Saving…" : "Log it"}
      </button>
    </form>
  );
}
