"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Bookmark, ChevronLeft, ChevronRight, Copy, Droplet, Plus, Search, ShieldCheck, Target, Undo2 } from "lucide-react";
import type { FoodCandidate } from "@/lib/nutrition/normalize";
import { dayTargets, itemNutrients, sumTotals, verifiedShare, type DiaryData, type DiaryItem, type DiaryMeal } from "@/lib/nutrition/diaryData";
import { addWater, copyMealFromDay, copyWholeDay, deleteDiaryEntry, getDiary, saveMealFromDay, updateDiaryEntry } from "@/app/(app)/diary/actions";
import { quickRelog } from "@/app/(app)/log/actions";
import { haptic } from "@/lib/haptics";
import { CalorieRing } from "./CalorieRing";
import { MacroBars } from "@/components/MacroBars";
import { FoodSheet } from "./FoodSheet";
import { AddFoodPanel } from "./AddFoodPanel";
import { ExerciseCard } from "./ExerciseCard";
import { dayLabel, shiftDay } from "./DayNav";
import { Toast, type ToastData } from "@/components/motion/Toast";

// The Diary keeps the last copy of each day on the phone. Opening it shows
// that copy immediately (no loading screen), then quietly swaps in fresh data
// from the server a moment later. Every change you make shows up instantly
// and saves in the background.
const cacheKey = (day: string) => `calorness:diary:v1:${day}`;
const readCache = (day: string): DiaryData | null => {
  try {
    const raw = localStorage.getItem(cacheKey(day));
    return raw ? (JSON.parse(raw) as DiaryData) : null;
  } catch {
    return null;
  }
};
const writeCache = (d: DiaryData) => {
  try {
    localStorage.setItem(cacheKey(d.day), JSON.stringify(d));
  } catch {}
};
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

export function DiaryView({ initialDay, today }: { initialDay: string; today: string }) {
  const [day, setDay] = useState(initialDay);
  const [data, setData] = useState<DiaryData | null>(() => readCache(initialDay));
  const [syncing, setSyncing] = useState(false);
  const [adding, setAdding] = useState<DiaryMeal | null>(null);
  const [editing, setEditing] = useState<{ meal: DiaryMeal["meal"]; item: DiaryItem } | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [, start] = useTransition();
  const dayRef = useRef(day);
  const tempCount = useRef(0);
  useEffect(() => {
    dayRef.current = day;
  }, [day]);

  const save = useCallback((d: DiaryData) => {
    writeCache(d);
    if (d.day === dayRef.current) setData(d);
  }, []);

  /** Fetch fresh data for a day and keep it (also used after every change). */
  const refresh = useCallback(
    async (forDay = dayRef.current) => {
      setSyncing(true);
      try {
        save(await getDiary(forDay));
      } finally {
        setSyncing(false);
      }
    },
    [save],
  );

  // Open a day: refresh it, and warm up yesterday too (the saved copy is shown by goTo)
  useEffect(() => {
    const t = setTimeout(() => {
      refresh(day);
      const prev = shiftDay(day, -1);
      if (!readCache(prev)) getDiary(prev).then(writeCache).catch(() => {});
    }, 0);
    return () => clearTimeout(t);
  }, [day, refresh]);

  // Coming back to the app (or tab) refreshes, in case you logged elsewhere
  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  const goTo = (next: string) => {
    haptic();
    dayRef.current = next;
    setData(readCache(next)); // the saved copy of that day, instantly, if we have one
    setDay(next);
    window.history.replaceState(null, "", next === today ? "/diary" : `/diary?day=${next}`);
  };

  /** Apply a change to the screen right away, then run the server action and refresh. */
  const change = (apply: (d: DiaryData) => DiaryData, action: () => Promise<unknown>) => {
    setData((d) => (d ? apply(d) : d));
    start(async () => {
      try {
        await action();
      } finally {
        await refresh();
      }
    });
  };
  const setMealItems = (d: DiaryData, meal: DiaryMeal["meal"], fn: (items: DiaryItem[]) => DiaryItem[]) => ({
    ...d,
    meals: d.meals.map((m) => (m.meal === meal ? { ...m, items: fn(m.items) } : m)),
  });

  const quickAdd = (meal: DiaryMeal, food: FoodCandidate, servings: number) => {
    haptic("success");
    const tempId = `temp-${++tempCount.current}`;
    setData((d) => (d ? setMealItems(d, meal.meal, (items) => [...items, { id: tempId, servings, food }]) : d));
    start(async () => {
      const r = await quickRelog({ foodId: food.id!, servings, day, meal: meal.meal });
      await refresh();
      if ("entryId" in r && r.entryId) {
        setToast({
          message: `${food.name} → ${meal.label}`,
          action: { label: "Undo", onClick: () => change((d) => setMealItems(d, meal.meal, (items) => items.filter((i) => i.id !== r.entryId)), () => deleteDiaryEntry(r.entryId!)) },
        });
      }
    });
  };

  if (!data) {
    return (
      <div className="space-y-4 px-5" aria-busy="true" aria-label="Loading diary">
        <Header day={day} today={today} goTo={goTo} syncing />
        <div className="skeleton h-80 rounded-2xl" />
        <div className="skeleton h-28 rounded-2xl" />
        <div className="skeleton h-28 rounded-2xl" />
      </div>
    );
  }

  const targets = dayTargets(data);
  const eaten = sumTotals(data.meals.flatMap((m) => m.items));
  const verified = verifiedShare(data.meals);
  const nothingLogged = data.meals.every((m) => m.items.length === 0);

  return (
    <div className="pb-6">
      <div className="px-5"><Header day={day} today={today} goTo={goTo} syncing={syncing} /></div>

      {/* Search sits at the top: the most common thing to do here */}
      <button onClick={() => setAdding(data.meals.find((m) => m.meal === mealNow())!)}
        className="mx-5 mb-4 flex w-[calc(100%-2.5rem)] items-center gap-2 rounded-xl border border-rack-line bg-rack-raised px-4 py-3 text-left text-chalk-muted">
        <Search size={18} aria-hidden /> Search or scan a food
      </button>

      {targets ? (
        <section className="mx-5 rounded-2xl bg-rack-raised p-5" aria-label="Day summary">
          <CalorieRing eaten={eaten.calories} goal={targets.calories} />
          <dl className="mt-4 mb-5 grid grid-cols-4 text-center">
            <Stat label="Goal" value={fmt(data.baseGoal!.calories)} />
            <Stat label="Exercise" value={`+${fmt(data.exercise.calories)}`} accent />
            <Stat label="Food" value={fmt(eaten.calories)} />
            <Stat label="Remaining" value={fmt(targets.calories - eaten.calories)} />
          </dl>
          <MacroBars eaten={eaten} goal={targets} showCalories={false} />
          {verified !== null && (
            <p className={`mt-4 flex items-center gap-1.5 text-sm ${verified >= 0.8 ? "text-plate-green" : "text-plate-yellow"}`}>
              <ShieldCheck size={16} aria-hidden /> {Math.round(verified * 100)}% verified
              {verified < 0.999 && <span className="text-chalk-muted">, AI estimates tagged</span>}
            </p>
          )}
        </section>
      ) : (
        <Link href="/profile#goals" className="mx-5 flex items-center gap-3 rounded-2xl border border-plate-yellow/50 bg-plate-yellow/10 p-4">
          <Target className="text-plate-yellow" size={24} aria-hidden />
          <span><span className="block font-semibold">Set your daily targets</span><span className="text-sm text-chalk-muted">See what&apos;s left each day.</span></span>
        </Link>
      )}

      {nothingLogged && (
        <button onClick={() => change((d) => d, () => copyWholeDay(shiftDay(day, -1), day))}
          className="mx-5 mt-4 flex w-[calc(100%-2.5rem)] items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-rack-line py-3 font-medium text-chalk-muted">
          <Copy size={16} aria-hidden /> Repeat yesterday&apos;s whole day
        </button>
      )}

      {data.meals.map((m) => {
        const mealCalories = sumTotals(m.items).calories;
        const loggedIds = new Set(m.items.map((i) => i.food.id));
        const picks = data.quick[m.meal].filter((p) => p.food.id && !loggedIds.has(p.food.id)).slice(0, 5);
        return (
          <section key={m.meal} className="mx-5 mt-4 overflow-hidden rounded-2xl bg-rack-raised" aria-label={m.label}>
            <div className="flex items-baseline justify-between px-5 pt-4 pb-2">
              <h2 className="font-display text-2xl font-semibold">{m.label}</h2>
              <span className="font-display text-lg font-semibold text-chalk-muted tabular-nums">{fmt(mealCalories)}</span>
            </div>
            {m.items.length > 0 && (
              <ul className="divide-y divide-rack-line border-y border-rack-line">
                {m.items.map((item) => (
                  <li key={item.id}>
                    <button onClick={() => setEditing({ meal: m.meal, item })} disabled={item.id.startsWith("temp-")}
                      className="flex w-full items-center gap-3 px-5 py-3 text-left active:bg-rack-line/40">
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate font-medium">{item.food.name}</span>
                          {item.food.source === "AI_ESTIMATE" && <span className="shrink-0 rounded-full bg-plate-yellow/20 px-1.5 py-0.5 text-[10px] font-semibold text-plate-yellow">AI est.</span>}
                        </span>
                        <span className="block truncate text-sm text-chalk-muted">
                          {[item.food.brand, `${+item.servings.toFixed(2)} × ${item.food.servingLabel ?? "serving"}`].filter(Boolean).join(", ")}
                        </span>
                      </span>
                      <span className="font-display text-lg font-semibold tabular-nums">{fmt(itemNutrients(item).calories)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* One tap: what you usually have for this meal */}
            {picks.length > 0 && (
              <div className="-mb-1 flex gap-2 overflow-x-auto px-5 pt-3 pb-1" aria-label={`Usual for ${m.label}`}>
                {picks.map((p) => (
                  <button key={p.food.id} onClick={() => quickAdd(m, p.food, p.servings)}
                    className="flex shrink-0 items-center gap-1.5 rounded-full bg-rack py-1.5 pr-3 pl-2 text-sm active:scale-95">
                    <Plus size={14} className="text-plate-blue" aria-hidden />
                    <span className="max-w-36 truncate">{p.food.name}</span>
                    <span className="text-xs text-chalk-muted tabular-nums">{fmt(p.food.calories * p.servings)}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between px-3 py-2">
              <button onClick={() => setAdding(m)} className="flex items-center gap-1.5 rounded-lg px-2 py-2 font-medium text-plate-blue">
                <Plus size={18} aria-hidden /> Add food
              </button>
              {m.items.length > 0 ? (
                <button onClick={() => {
                  const name = window.prompt("Name this meal so you can log it in one tap", `My ${m.label.toLowerCase()}`);
                  if (name) start(async () => { const r = await saveMealFromDay(day, m.meal, name); setToast({ message: r.error ?? `Saved "${name}" for Quick log` }); });
                }} className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm text-chalk-muted">
                  <Bookmark size={15} aria-hidden /> Save as meal
                </button>
              ) : (
                <button onClick={() => change((d) => d, async () => { const r = await copyMealFromDay(shiftDay(day, -1), day, m.meal); if (r.error) setToast({ message: r.error }); })}
                  className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm text-chalk-muted">
                  <Copy size={15} aria-hidden /> Copy yesterday
                </button>
              )}
            </div>
          </section>
        );
      })}

      <ExerciseCard day={day} exercise={data.exercise} onChanged={() => refresh()} />

      <Water
        ml={data.waterMl}
        goalMl={data.baseGoal?.waterMl ?? 2500}
        imperial={data.imperial}
        onChange={(delta) => change((d) => ({ ...d, waterMl: Math.max(0, d.waterMl + delta) }), () => addWater(day, delta))}
      />

      {adding && <AddFoodPanel meal={adding.meal} mealLabel={adding.label} day={day} onClose={() => { setAdding(null); refresh(); }} />}
      {editing && (
        <FoodSheet
          food={editing.item.food}
          initialServings={editing.item.servings}
          confirmLabel="Update"
          onClose={() => setEditing(null)}
          onConfirm={(servings) => {
            const { meal, item } = editing;
            setEditing(null);
            change((d) => setMealItems(d, meal, (items) => items.map((i) => (i.id === item.id ? { ...i, servings } : i))), () => updateDiaryEntry(item.id, servings));
          }}
          onDelete={() => {
            const { meal, item } = editing;
            setEditing(null);
            change((d) => setMealItems(d, meal, (items) => items.filter((i) => i.id !== item.id)), () => deleteDiaryEntry(item.id));
          }}
        />
      )}
      <Toast toast={toast} onDone={() => setToast(null)} />
    </div>
  );
}

/** The meal that fits the time of day, for the top search box. */
function mealNow(): DiaryMeal["meal"] {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  if (h >= 4 && h < 10.5) return "BREAKFAST";
  if (h >= 10.5 && h < 15) return "LUNCH";
  if (h >= 17 && h < 21.5) return "DINNER";
  return "SNACKS";
}

function Header({ day, today, goTo, syncing }: { day: string; today: string; goTo: (d: string) => void; syncing: boolean }) {
  return (
    <header className="flex items-end justify-between pb-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.5rem)" }}>
      <h1 className="font-display text-4xl font-bold tracking-tight">Diary</h1>
      <nav className="flex items-center gap-1" aria-label="Change day">
        <button onClick={() => goTo(shiftDay(day, -1))} className="rounded-lg p-1.5 text-chalk-muted" aria-label="Previous day"><ChevronLeft size={22} /></button>
        <button onClick={() => goTo(today)} className="relative min-w-24 text-center font-display text-lg font-semibold">
          {dayLabel(day, today)}
          {syncing && <span className="absolute -top-1 -right-1 size-1.5 animate-pulse rounded-full bg-plate-blue" aria-label="Updating" />}
        </button>
        <button onClick={() => goTo(shiftDay(day, 1))} className="rounded-lg p-1.5 text-chalk-muted" aria-label="Next day"><ChevronRight size={22} /></button>
      </nav>
    </header>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <dd className={`font-display text-xl font-semibold tabular-nums ${accent ? "text-plate-green" : ""}`}>{value}</dd>
      <dt className="text-xs text-chalk-muted">{label}</dt>
    </div>
  );
}

function Water({ ml, goalMl, imperial, onChange }: { ml: number; goalMl: number; imperial: boolean; onChange: (deltaMl: number) => void }) {
  const glass = imperial ? 236.6 : 250;
  const glasses = Math.max(8, Math.round(goalMl / glass));
  const filled = Math.round(ml / glass);
  return (
    <section className="mx-5 mt-4 rounded-2xl bg-rack-raised p-5" aria-label="Water">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-2xl font-semibold">Water</h2>
        <p className="font-display text-lg font-semibold tabular-nums">{imperial ? `${Math.round(ml / 29.5735)} fl oz` : `${(ml / 1000).toFixed(2)} L`}</p>
      </div>
      <ol className="mt-3 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(glasses, 12)}, minmax(0, 1fr))` }} aria-label={`${filled} of ${glasses} glasses`}>
        {Array.from({ length: glasses }, (_, i) => (
          <li key={i}>
            <button onClick={() => { haptic(); onChange(i < filled ? -glass : glass); }} aria-label={i < filled ? "Remove a glass" : "Add a glass"}
              className="flex h-11 w-full items-end overflow-hidden rounded-t-sm rounded-b-xl border-2 border-rack-line">
              <span className={`w-full transition-all duration-300 ${i < filled ? "h-full bg-plate-blue" : "h-0"}`} />
            </button>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex gap-2">
        <button onClick={() => { haptic(); onChange(glass); }} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-plate-blue py-2.5 font-medium text-white">
          <Droplet size={17} aria-hidden /> Add {imperial ? "8 oz" : "250 ml"}
        </button>
        {ml > 0 && (
          <button onClick={() => onChange(-glass)} className="rounded-xl bg-rack px-4 text-chalk-muted" aria-label="Undo last glass"><Undo2 size={18} /></button>
        )}
      </div>
    </section>
  );
}
