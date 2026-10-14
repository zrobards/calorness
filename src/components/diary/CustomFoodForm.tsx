"use client";

import { useState, useTransition } from "react";
import type { FoodCandidate } from "@/lib/nutrition/normalize";
import { createCustomFood } from "@/app/(app)/diary/actions";
import { Sheet } from "./Sheet";

const field = "mt-1 w-full rounded-xl border border-rack-line bg-rack px-3 py-2.5 text-chalk focus:border-plate-yellow focus:outline-none";
const label = "block text-sm font-medium text-chalk-muted";

export function CustomFoodForm({ barcode, onCreated, onClose }: { barcode?: string; onCreated: (food: FoodCandidate) => void; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Sheet title="Create a food" onClose={onClose}>
      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
          start(async () => {
            const result = await createCustomFood(data);
            if ("error" in result && result.error) setError(result.error);
            else if ("food" in result && result.food) onCreated(result.food);
          });
        }}
      >
        {barcode && <input type="hidden" name="barcode" value={barcode} />}
        <label className={label}>Name<input name="name" required className={field} placeholder="Protein bar" /></label>
        <label className={label}>Brand (optional)<input name="brand" className={field} /></label>
        <div className="grid grid-cols-[1.4fr_1fr] gap-2">
          <label className={label}>Serving<input name="servingLabel" required className={field} placeholder="1 bar" /></label>
          <label className={label}>Weight (g, optional)<input name="servingSize" type="number" inputMode="decimal" step="any" className={field} /></label>
        </div>
        <label className={label}>
          Calories per serving
          <input name="calories" type="number" inputMode="decimal" step="any" required className={`${field} font-display text-xl`} />
        </label>
        <div className="grid grid-cols-3 gap-2">
          <label className={label}>Protein (g)<input name="proteinG" type="number" inputMode="decimal" step="any" required className={field} /></label>
          <label className={label}>Carbs (g)<input name="carbsG" type="number" inputMode="decimal" step="any" required className={field} /></label>
          <label className={label}>Fat (g)<input name="fatG" type="number" inputMode="decimal" step="any" required className={field} /></label>
        </div>
        {error && <p role="alert" className="text-sm text-plate-red">{error}</p>}
        <button disabled={pending} className="w-full rounded-xl bg-plate-red py-3.5 font-display text-xl font-semibold text-white disabled:opacity-60">
          {pending ? "Saving…" : "Save food"}
        </button>
      </form>
    </Sheet>
  );
}
