"use client";

import { useState } from "react";
import type { FoodCandidate } from "@/lib/nutrition/normalize";
import { MacroSplit } from "./MacroSplit";
import { Sheet } from "./Sheet";

const SOURCE_LABEL = { USDA: "USDA", OPEN_FOOD_FACTS: "Open Food Facts", CUSTOM: "Your food", AI_ESTIMATE: "AI estimate" } as const;

/**
 * Choose how much you ate. Amount can be in servings, or in grams/ml when
 * the serving has a weight. Everything is converted to "servings" for saving.
 */
export function FoodSheet({
  food,
  initialServings = 1,
  confirmLabel,
  pending,
  onConfirm,
  onClose,
  onDelete,
}: {
  food: FoodCandidate;
  initialServings?: number;
  confirmLabel: string;
  pending?: boolean;
  onConfirm: (servings: number) => void;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const weighable = food.servingUnit === "g" || food.servingUnit === "ml";
  const [mode, setMode] = useState<"servings" | "weight">("servings");
  const [amount, setAmount] = useState(String(initialServings));

  const value = Number(amount);
  const servings = !Number.isFinite(value) || value <= 0 ? 0 : mode === "servings" ? value : value / food.servingSize;
  const scaled = {
    calories: food.calories * servings,
    proteinG: food.proteinG * servings,
    carbsG: food.carbsG * servings,
    fatG: food.fatG * servings,
  };

  const switchMode = (next: "servings" | "weight") => {
    if (next === mode) return;
    setAmount(String(Math.round((next === "weight" ? servings * food.servingSize : servings) * 100) / 100 || ""));
    setMode(next);
  };

  return (
    <Sheet title={food.name} onClose={onClose}>
      <p className="mt-1 text-sm text-chalk-muted">
        {[food.brand, SOURCE_LABEL[food.source]].filter(Boolean).join(", ")}
      </p>

      <div className="mt-5 flex items-end gap-3">
        <label className="flex-1 text-sm font-medium text-chalk-muted">
          Amount
          <input
            type="number" inputMode="decimal" step="any" min="0" value={amount} autoFocus
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 w-full rounded-xl border border-rack-line bg-rack px-3 py-3 font-display text-2xl font-bold text-chalk tabular-nums focus:border-plate-yellow focus:outline-none"
          />
        </label>
        <div className="flex rounded-xl border border-rack-line p-1" role="group" aria-label="Unit">
          <button onClick={() => switchMode("servings")} aria-pressed={mode === "servings"}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${mode === "servings" ? "bg-chalk text-rack" : "text-chalk-muted"}`}>
            Servings
          </button>
          {weighable && (
            <button onClick={() => switchMode("weight")} aria-pressed={mode === "weight"}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${mode === "weight" ? "bg-chalk text-rack" : "text-chalk-muted"}`}>
              {food.servingUnit}
            </button>
          )}
        </div>
      </div>
      <p className="mt-2 text-sm text-chalk-muted">1 serving = {food.servingLabel ?? `${food.servingSize} ${food.servingUnit}`}</p>

      <div className="mt-5 flex items-baseline justify-between border-t border-rack-line pt-4">
        <span className="text-chalk-muted">Calories</span>
        <span className="font-display text-4xl font-bold text-plate-red tabular-nums">{Math.round(scaled.calories)}</span>
      </div>
      <div className="mt-3">
        <MacroSplit {...scaled} />
      </div>

      <div className="mt-6 flex gap-3">
        {onDelete && (
          <button onClick={onDelete} disabled={pending} className="rounded-xl border border-rack-line px-4 py-3.5 font-medium text-chalk-muted hover:text-plate-red">
            Delete
          </button>
        )}
        <button
          onClick={() => servings > 0 && onConfirm(Math.round(servings * 1000) / 1000)}
          disabled={pending || servings <= 0}
          className="flex-1 rounded-xl bg-plate-red py-3.5 font-display text-xl font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}
