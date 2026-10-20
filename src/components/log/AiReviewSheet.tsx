"use client";

import { round1 } from "@/lib/fitness/units";
import { useState } from "react";
import { BadgeCheck, ChevronDown, Loader2, Minus, Plus, RefreshCw, Sparkles, X } from "lucide-react";
import type { GroundedItem } from "@/lib/ai/ground";
import type { AiFoodItem } from "@/lib/ai/parse";
import { Sheet } from "@/components/diary/Sheet";
import { MacroSplit } from "@/components/diary/MacroSplit";
import { haptic } from "@/lib/haptics";

const CONFIDENCE = {
  high: { dot: "bg-plate-green", label: "Confident" },
  medium: { dot: "bg-plate-yellow", label: "Best guess" },
  low: { dot: "bg-plate-red", label: "Check this one" },
} as const;

type ReviewItem = GroundedItem & {
  servings: number;
  key: string;
  chosen: number | null; // which database match is in use, if any
  edited?: boolean; // the user typed their own numbers
};
export type ReviewedItem = AiFoodItem & {
  match?: { food: NonNullable<GroundedItem["matches"]>[number]["food"]; servings: number };
  edited?: boolean;
};

let nextKey = 0;
// Strong matches are applied automatically; weaker ones are offered to pick from
const toReview = (i: GroundedItem): ReviewItem => ({
  ...i,
  servings: 1,
  key: `i${nextKey++}`,
  chosen: i.matches?.[0] && i.matches[0].score >= 0.75 ? 0 : null,
});

/** The amounts as the user currently sees them (servings applied), for logging or re-checking. */
function applyServings(i: ReviewItem): ReviewedItem {
  const s = i.servings;
  const m = i.chosen !== null ? i.matches?.[i.chosen]?.food : undefined;
  if (m) {
    return {
      name: m.name,
      portion: s === 1 ? (m.servingLabel ?? "1 serving") : `${s} × ${m.servingLabel ?? "serving"}`,
      grams: Math.round(m.servingSize * s),
      calories: Math.round(m.calories * s),
      protein_g: round1(m.proteinG * s),
      carbs_g: round1(m.carbsG * s),
      fat_g: round1(m.fatG * s),
      confidence: "high",
      match: { food: m, servings: s },
    };
  }
  return {
    edited: i.edited,
    name: i.name.trim(),
    portion: s === 1 ? i.portion : `${s} × ${i.portion}`,
    grams: Math.round(i.grams * s),
    calories: Math.round(i.calories * s),
    protein_g: round1(i.protein_g * s),
    carbs_g: round1(i.carbs_g * s),
    fat_g: round1(i.fat_g * s),
    confidence: i.confidence,
  };
}

/**
 * Check the AI's estimate before saving. Three ways to make it accurate:
 * quick amount buttons, editing any number directly, or telling the AI what
 * it got wrong and letting it look at the photo again.
 */
export function AiReviewSheet({
  items: initial,
  note,
  photo,
  mealLabel,
  pending,
  refining,
  onConfirm,
  onRefine,
  onClose,
}: {
  items: GroundedItem[];
  note?: string;
  photo?: string | null;
  mealLabel: string;
  pending: boolean;
  refining: boolean;
  onConfirm: (items: ReviewedItem[]) => void;
  onRefine: (correction: string, current: AiFoodItem[]) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<ReviewItem[]>(() => initial.map(toReview));
  const [open, setOpen] = useState<string | null>(null);
  const [correction, setCorrection] = useState("");

  const named = items.filter((i) => i.name.trim());
  const total = named.map(applyServings).reduce(
    (t, i) => ({ calories: t.calories + i.calories, proteinG: t.proteinG + i.protein_g, carbsG: t.carbsG + i.carbs_g, fatG: t.fatG + i.fat_g }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );

  const update = (key: string, patch: Partial<ReviewItem>) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  /** Typing numbers by hand: the user's numbers win over any database match. */
  const edit = (key: string, patch: Partial<ReviewItem>) => update(key, { ...patch, chosen: null, edited: true, confidence: "high" });
  const setServings = (key: string, d: number) => {
    haptic();
    setItems((xs) => xs.map((x) => (x.key === key ? { ...x, servings: Math.max(0.25, Math.round((x.servings + d) * 4) / 4) } : x)));
  };
  /** Changing the weight scales calories and macros along with it. */
  const setGrams = (item: ReviewItem, grams: number) => {
    if (!(grams > 0) || !(item.grams > 0)) return update(item.key, { grams: grams || 0 });
    const f = grams / item.grams;
    edit(item.key, {
      grams,
      calories: Math.round(item.calories * f),
      protein_g: round1(item.protein_g * f),
      carbs_g: round1(item.carbs_g * f),
      fat_g: round1(item.fat_g * f),
    });
  };
  const addItem = () => {
    const blank = toReview({ name: "", portion: "1 serving", grams: 100, calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, confidence: "high" });
    setItems((xs) => [...xs, blank]);
    setOpen(blank.key);
  };
  const num = (v: string) => Math.max(0, Number(v) || 0);

  const field = "mt-1 w-full rounded-lg border border-rack-line bg-rack-raised px-2.5 py-2 text-base text-chalk tabular-nums focus:border-plate-yellow focus:outline-none";

  return (
    <Sheet title="Here's what I see" onClose={onClose}>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-chalk-muted">
        <Sparkles size={15} className="text-plate-yellow" aria-hidden /> AI estimate. Tap any item to adjust it. Best results: shoot from above with a fork in frame.
      </p>
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element -- a local preview of the user's own photo
        <img src={photo} alt="Your meal" className="mt-4 h-36 w-full rounded-2xl object-cover" />
      )}

      <ul className={`mt-4 space-y-2 transition-opacity ${refining ? "opacity-40" : ""}`}>
        {items.map((i, idx) => {
          const shown = applyServings(i);
          const expanded = open === i.key;
          return (
            <li key={i.key} className="animate-rise rounded-2xl bg-rack" style={{ "--i": idx } as React.CSSProperties}>
              <div className="flex items-start gap-2 p-3">
                <span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${CONFIDENCE[i.confidence].dot}`} aria-hidden />
                <button onClick={() => setOpen(expanded ? null : i.key)} className="min-w-0 flex-1 text-left" aria-expanded={expanded}>
                  <span className="flex items-center gap-1 font-medium">
                    {shown.name || "New item"}
                    <ChevronDown size={15} className={`shrink-0 text-chalk-muted transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden />
                  </span>
                  <span className="block text-sm text-chalk-muted">
                    {/\d\s*g\b|\(.*\)/i.test(shown.portion) ? shown.portion : `${shown.portion}, ${shown.grams} g`}. P {Math.round(shown.protein_g)} C {Math.round(shown.carbs_g)} F {Math.round(shown.fat_g)}
                  </span>
                  <span className="sr-only">{CONFIDENCE[i.confidence].label}</span>
                </button>
                <span className="font-display text-xl font-bold tabular-nums">{shown.calories}</span>
                <button onClick={() => setItems((xs) => xs.filter((x) => x.key !== i.key))} className="-mr-1 p-1 text-chalk-muted" aria-label={`Remove ${i.name || "item"}`}>
                  <X size={18} />
                </button>
              </div>

              <div className="flex items-center gap-2 px-3 pb-3 pl-7">
                <button onClick={() => setServings(i.key, -0.25)} className="rounded-lg bg-rack-raised p-1.5" aria-label="Less"><Minus size={16} /></button>
                <span className="w-12 text-center text-sm tabular-nums">{i.servings}×</span>
                <button onClick={() => setServings(i.key, 0.25)} className="rounded-lg bg-rack-raised p-1.5" aria-label="More"><Plus size={16} /></button>
                {i.confidence === "low" && i.chosen === null && <span className="ml-auto text-xs text-plate-red">Check this one</span>}
              </div>
              {i.basis && i.chosen === null && !i.edited && (
                <p className="-mt-1 px-3 pb-3 pl-7 text-xs text-chalk-muted">
                  <span className="text-plate-green">USDA values</span> for &ldquo;{i.basis.name}&rdquo; at this portion
                </p>
              )}

              {/* Packaged food: the real product's label values instead of a guess */}
              {i.matches && i.matches.length > 0 && (
                <div className="mx-3 mb-3 rounded-xl border border-plate-green/40 bg-plate-green/10 p-2.5 text-sm">
                  {i.chosen !== null ? (
                    <div className="flex items-start gap-2">
                      <BadgeCheck size={17} className="mt-0.5 shrink-0 text-plate-green" aria-hidden />
                      <p className="min-w-0 flex-1">
                        <span className="font-semibold">Using label values</span>{" "}
                        <span className="text-chalk-muted">from {i.matches[i.chosen].food.source === "USDA" ? "USDA" : i.matches[i.chosen].food.source === "OPEN_FOOD_FACTS" ? "Open Food Facts" : "your foods"}</span>
                      </p>
                      <button onClick={() => update(i.key, { chosen: null })} className="shrink-0 font-medium text-plate-blue">Change</button>
                    </div>
                  ) : (
                    <>
                      <p className="font-semibold">Is it one of these? Tap for exact label values</p>
                      <ul className="mt-1.5 space-y-1">
                        {i.matches.map((m, mi) => (
                          <li key={mi}>
                            <button onClick={() => { haptic(); update(i.key, { chosen: mi, edited: false }); }}
                              className="flex w-full items-center gap-2 rounded-lg bg-rack px-2.5 py-2 text-left">
                              <span className="min-w-0 flex-1">
                                <span className="block truncate">{m.food.name}</span>
                                <span className="block truncate text-xs text-chalk-muted">{[m.food.brand, m.food.servingLabel].filter(Boolean).join(", ")}</span>
                              </span>
                              <span className="font-display font-bold tabular-nums">{Math.round(m.food.calories)}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-1.5 text-xs text-chalk-muted">None of these? Keep the AI estimate, or scan the barcode or label for an exact match.</p>
                    </>
                  )}
                </div>
              )}

              {expanded && (
                <div className="animate-fade grid grid-cols-2 gap-2 border-t border-rack-line p-3 text-xs text-chalk-muted">
                  <label className="col-span-2">Name<input value={i.name} onChange={(e) => update(i.key, { name: e.target.value })} className={field} placeholder="Food name" /></label>
                  <label>Portion<input value={i.portion} onChange={(e) => update(i.key, { portion: e.target.value })} className={field} /></label>
                  <label>Weight (g, scales the rest)
                    <input type="number" inputMode="decimal" value={i.grams || ""} onChange={(e) => setGrams(i, num(e.target.value))} className={field} />
                  </label>
                  <label>Calories<input type="number" inputMode="decimal" value={i.calories || ""} onChange={(e) => edit(i.key, { calories: num(e.target.value) })} className={field} /></label>
                  <label>Protein (g)<input type="number" inputMode="decimal" value={i.protein_g || ""} onChange={(e) => edit(i.key, { protein_g: num(e.target.value) })} className={field} /></label>
                  <label>Carbs (g)<input type="number" inputMode="decimal" value={i.carbs_g || ""} onChange={(e) => edit(i.key, { carbs_g: num(e.target.value) })} className={field} /></label>
                  <label>Fat (g)<input type="number" inputMode="decimal" value={i.fat_g || ""} onChange={(e) => edit(i.key, { fat_g: num(e.target.value) })} className={field} /></label>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <button onClick={addItem} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-rack-line py-2.5 text-sm font-medium text-chalk-muted">
        <Plus size={16} aria-hidden /> Add something it missed
      </button>
      {note && <p className="mt-3 text-sm text-chalk-muted">{note}</p>}

      {/* Tell the AI what it got wrong and let it look again */}
      <div className="mt-4 rounded-2xl border border-rack-line p-3">
        <label className="text-sm font-medium" htmlFor="ai-correction">Not quite right? Tell the AI</label>
        <textarea
          id="ai-correction"
          value={correction}
          onChange={(e) => setCorrection(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="It was 2 cups of rice, the chicken was fried, and no sauce"
          className="mt-2 w-full resize-none rounded-xl border border-rack-line bg-rack px-3 py-2 text-base focus:border-plate-yellow focus:outline-none"
        />
        <button
          onClick={() => { haptic(); onRefine(correction, named.map(applyServings)); }}
          disabled={refining || correction.trim().length < 3}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-rack-raised py-2.5 font-medium disabled:opacity-40"
        >
          {refining ? <Loader2 size={17} className="animate-spin" aria-hidden /> : <RefreshCw size={17} aria-hidden />}
          {refining ? "Re-checking…" : "Re-check with this"}
        </button>
      </div>

      <div className="mt-5 flex items-baseline justify-between border-t border-rack-line pt-4">
        <span className="text-chalk-muted">Total</span>
        <span className="font-display text-4xl font-bold text-plate-red tabular-nums">{Math.round(total.calories)}</span>
      </div>
      <div className="mt-3"><MacroSplit {...total} /></div>

      <button
        onClick={() => onConfirm(named.map(applyServings))}
        disabled={pending || refining || named.length === 0}
        className="mt-6 w-full rounded-xl bg-plate-red py-3.5 font-display text-xl font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Logging…" : `Log ${named.length} ${named.length === 1 ? "item" : "items"} to ${mealLabel}`}
      </button>
    </Sheet>
  );
}
