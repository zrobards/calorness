"use client";

import { useState } from "react";
import { Minus, Plus, Sparkles, X } from "lucide-react";
import type { AiFoodItem } from "@/lib/ai/parse";
import { Sheet } from "@/components/diary/Sheet";
import { MacroSplit } from "@/components/diary/MacroSplit";

const CONFIDENCE_COLOR = { high: "bg-plate-green", medium: "bg-plate-yellow", low: "bg-plate-red" } as const;

export type ReviewItem = AiFoodItem & { servings: number; key: string };

/** Check the AI's guesses before saving: adjust amounts, remove mistakes, log all. */
export function AiReviewSheet({
  items: initial,
  note,
  photo,
  mealLabel,
  pending,
  onConfirm,
  onClose,
}: {
  items: AiFoodItem[];
  note?: string;
  photo?: string | null;
  mealLabel: string;
  pending: boolean;
  onConfirm: (items: ReviewItem[]) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<ReviewItem[]>(() => initial.map((i, k) => ({ ...i, servings: 1, key: String(k) })));
  const total = items.reduce(
    (t, i) => ({
      calories: t.calories + i.calories * i.servings,
      proteinG: t.proteinG + i.protein_g * i.servings,
      carbsG: t.carbsG + i.carbs_g * i.servings,
      fatG: t.fatG + i.fat_g * i.servings,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
  const setServings = (key: string, d: number) =>
    setItems((xs) => xs.map((x) => (x.key === key ? { ...x, servings: Math.max(0.25, Math.round((x.servings + d) * 4) / 4) } : x)));

  return (
    <Sheet title="Here's what I see" onClose={onClose}>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-chalk-muted">
        <Sparkles size={15} className="text-plate-yellow" aria-hidden /> AI estimate. Adjust anything that looks off.
      </p>
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element -- a local preview of the user's own photo
        <img src={photo} alt="Your meal" className="mt-4 h-36 w-full rounded-2xl object-cover" />
      )}

      <ul className="mt-4 space-y-2">
        {items.map((i, idx) => (
          <li key={i.key} className="animate-rise rounded-2xl bg-rack p-3" style={{ "--i": idx } as React.CSSProperties}>
            <div className="flex items-start gap-2">
              <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${CONFIDENCE_COLOR[i.confidence]}`} title={`${i.confidence} confidence`} aria-label={`${i.confidence} confidence`} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{i.name}</p>
                <p className="text-sm text-chalk-muted">
                  {i.servings === 1 ? i.portion : `${i.servings} × ${i.portion}`}, P {Math.round(i.protein_g * i.servings)} C {Math.round(i.carbs_g * i.servings)} F {Math.round(i.fat_g * i.servings)}
                </p>
              </div>
              <span className="font-display text-xl font-bold tabular-nums">{Math.round(i.calories * i.servings)}</span>
              <button onClick={() => setItems((xs) => xs.filter((x) => x.key !== i.key))} className="-mr-1 p-1 text-chalk-muted" aria-label={`Remove ${i.name}`}>
                <X size={18} />
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2 pl-4">
              <button onClick={() => setServings(i.key, -0.25)} className="rounded-lg bg-rack-raised p-1.5" aria-label="Less"><Minus size={16} /></button>
              <span className="w-14 text-center text-sm tabular-nums">{i.servings}×</span>
              <button onClick={() => setServings(i.key, 0.25)} className="rounded-lg bg-rack-raised p-1.5" aria-label="More"><Plus size={16} /></button>
            </div>
          </li>
        ))}
      </ul>
      {note && <p className="mt-3 text-sm text-chalk-muted">{note}</p>}

      <div className="mt-5 flex items-baseline justify-between border-t border-rack-line pt-4">
        <span className="text-chalk-muted">Total</span>
        <span className="font-display text-4xl font-bold text-plate-red tabular-nums">{Math.round(total.calories)}</span>
      </div>
      <div className="mt-3"><MacroSplit {...total} /></div>

      <button
        onClick={() => onConfirm(items)}
        disabled={pending || items.length === 0}
        className="mt-6 w-full rounded-xl bg-plate-red py-3.5 font-display text-xl font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Logging…" : `Log ${items.length} ${items.length === 1 ? "item" : "items"} to ${mealLabel}`}
      </button>
    </Sheet>
  );
}
