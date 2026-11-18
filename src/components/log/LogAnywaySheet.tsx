"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { Sheet } from "@/components/diary/Sheet";
import { haptic } from "@/lib/haptics";
import { failed } from "@/lib/safeAction";
import { searchFoods } from "@/app/(app)/diary/actions";
import { addDiaryEntry, quickAddCalories } from "@/lib/clientActions";
import type { FoodCandidate } from "@/lib/nutrition/normalize";

const field = "w-full rounded-xl border border-rack-line bg-rack px-3 py-2.5 text-base text-chalk tabular-nums focus:border-plate-yellow focus:outline-none";

/**
 * When the AI can't work out a photo or description, the meal still gets
 * logged: pick a close match from the food database, or type the calories.
 * No dead-end error messages.
 */
export function LogAnywaySheet({ text, photo, day, meal, mealLabel, reason, onRetry, onLogged, onClose }: {
  text?: string;
  photo?: string | null;
  day: string;
  meal: string;
  mealLabel: string;
  reason: string;
  onRetry: () => void;
  onLogged: (message: string) => void;
  onClose: () => void;
}) {
  const [matches, setMatches] = useState<FoodCandidate[] | null>(text && text.trim().length >= 2 ? null : []);
  const [name, setName] = useState(text?.trim().slice(0, 80) || "");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Close matches from the database for what they typed
  useEffect(() => {
    if (!text || text.trim().length < 2) return;
    let alive = true;
    searchFoods(text.trim().slice(0, 80), "all")
      .then(({ foods }) => alive && setMatches(foods.slice(0, 5)))
      .catch(() => alive && setMatches([]));
    return () => { alive = false; };
  }, [text]);

  const logMatch = (food: FoodCandidate) => start(async () => {
    const r = await addDiaryEntry({ food, day, meal, servings: 1 });
    if (failed(r)) return setError(r.error);
    haptic("success");
    onLogged(`${food.name}, ${Math.round(food.calories)} cal → ${mealLabel}`);
  });
  const quickAdd = () => start(async () => {
    setError(null);
    const cal = Number(calories);
    if (!(cal > 0)) return setError("Enter about how many calories it was.");
    const r = await quickAddCalories({ name: name.trim() || `${mealLabel} meal`, calories: cal, proteinG: Number(protein) || 0, day, meal });
    if (failed(r)) return setError(r.error);
    haptic("success");
    onLogged(`${name.trim() || mealLabel}, ${cal} cal → ${mealLabel}`);
  });

  return (
    <Sheet title="Log it another way" onClose={onClose}>
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {photo && <img src={photo} alt="" className="size-14 shrink-0 rounded-xl object-cover" />}
        <p className="text-sm text-chalk-muted">{reason} You can still log it in a few seconds.</p>
      </div>

      {text && (
        <section className="mt-4" aria-label="Close matches">
          <h3 className="text-sm font-semibold">1. Pick the closest match</h3>
          {matches === null ? (
            <p className="mt-2 flex items-center gap-2 text-sm text-chalk-muted"><Loader2 size={14} className="animate-spin" /> Looking…</p>
          ) : matches.length ? (
            <ul className="mt-2 divide-y divide-rack-line overflow-hidden rounded-xl bg-rack">
              {matches.map((f, i) => (
                <li key={`${f.externalId ?? f.id ?? f.name}-${i}`}>
                  <button disabled={pending} onClick={() => logMatch(f)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-rack-line/40">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{f.name}</span>
                      <span className="block truncate text-xs text-chalk-muted">{[f.brand, f.servingLabel].filter(Boolean).join(", ")}</span>
                    </span>
                    <span className="font-display text-lg font-semibold tabular-nums">{Math.round(f.calories)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-chalk-muted">No close matches.</p>
          )}
        </section>
      )}

      <section className="mt-4" aria-label="Quick add">
        <h3 className="text-sm font-semibold">{text ? "2. " : ""}Or just enter the calories</h3>
        <div className="mt-2 space-y-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={`${mealLabel} (what was it?)`} aria-label="What you ate" className={field} />
          <div className="grid grid-cols-2 gap-2">
            <input value={calories} onChange={(e) => setCalories(e.target.value)} type="number" inputMode="numeric" placeholder="Calories" aria-label="Calories" className={field} />
            <input value={protein} onChange={(e) => setProtein(e.target.value)} type="number" inputMode="numeric" placeholder="Protein g (optional)" aria-label="Protein grams" className={field} />
          </div>
          <button onClick={quickAdd} disabled={pending} className="w-full rounded-xl bg-plate-red py-3 font-semibold text-white disabled:opacity-60">
            {pending ? "Logging…" : `Log to ${mealLabel}`}
          </button>
        </div>
      </section>

      {error && <p role="alert" className="mt-3 text-sm text-plate-red">{error}</p>}

      <button onClick={onRetry} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-rack py-2.5 text-sm font-medium text-chalk-muted">
        <RotateCcw size={14} aria-hidden /> Try the AI again
      </button>
    </Sheet>
  );
}
