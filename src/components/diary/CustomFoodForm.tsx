"use client";

import { useState, useTransition } from "react";
import type { FoodCandidate } from "@/lib/nutrition/normalize";
import { createCustomFood, updateCustomFood } from "@/app/(app)/diary/actions";
import { Sheet } from "./Sheet";

const field = "mt-1 w-full rounded-xl border border-rack-line bg-rack px-3 py-2.5 text-chalk focus:border-plate-yellow focus:outline-none";
const label = "block text-sm font-medium text-chalk-muted";

export type FoodPrefill = { name?: string; brand?: string | null; servingLabel?: string; servingSize?: number | null; calories?: number; proteinG?: number; carbsG?: number; fatG?: number };

export function CustomFoodForm({
  barcode,
  prefill,
  foodId,
  title = foodId ? "Edit food" : "Create a food",
  onCreated,
  onClose,
}: {
  barcode?: string;
  prefill?: FoodPrefill;
  foodId?: string; // editing one of your own foods
  title?: string;
  onCreated: (food: FoodCandidate) => void;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Sheet title={title} onClose={onClose}>
      {prefill && !foodId && title === "From the label" && (
        <p className="mt-1 text-sm text-chalk-muted">Read from the label. Check it matches, then save. Label foods are shared (name and numbers only) so everyone&apos;s search gets better.</p>
      )}
      {prefill?.brand && !foodId && title !== "From the label" && <p className="mt-1 text-sm text-chalk-muted">Tip: copy the numbers from the restaurant&apos;s app or website for an exact match.</p>}
      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
          start(async () => {
            const result = foodId ? await updateCustomFood(foodId, data) : await createCustomFood(data);
            if ("error" in result && result.error) setError(result.error);
            else if ("food" in result && result.food) onCreated(result.food);
          });
        }}
      >
        {barcode && <input type="hidden" name="barcode" value={barcode} />}
        {title === "From the label" && !foodId && <input type="hidden" name="fromLabel" value="true" />}
        <label className={label}>Name<input defaultValue={prefill?.name ?? undefined} name="name" required className={field} placeholder="Protein bar" /></label>
        <label className={label}>Brand (optional)<input defaultValue={prefill?.brand ?? undefined} name="brand" className={field} /></label>
        <div className="grid grid-cols-[1.4fr_1fr] gap-2">
          <label className={label}>Serving<input defaultValue={prefill?.servingLabel ?? undefined} name="servingLabel" required className={field} placeholder="1 bar" /></label>
          <label className={label}>Weight (g, optional)<input defaultValue={prefill?.servingSize ?? undefined} name="servingSize" type="number" inputMode="decimal" step="any" className={field} /></label>
        </div>
        <label className={label}>
          Calories per serving
          <input defaultValue={prefill?.calories ?? undefined} name="calories" type="number" inputMode="decimal" step="any" required className={`${field} font-display text-xl`} />
        </label>
        <div className="grid grid-cols-3 gap-2">
          <label className={label}>Protein (g)<input defaultValue={prefill?.proteinG ?? undefined} name="proteinG" type="number" inputMode="decimal" step="any" required className={field} /></label>
          <label className={label}>Carbs (g)<input defaultValue={prefill?.carbsG ?? undefined} name="carbsG" type="number" inputMode="decimal" step="any" required className={field} /></label>
          <label className={label}>Fat (g)<input defaultValue={prefill?.fatG ?? undefined} name="fatG" type="number" inputMode="decimal" step="any" required className={field} /></label>
        </div>
        {error && <p role="alert" className="text-sm text-plate-red">{error}</p>}
        <button disabled={pending} className="w-full rounded-xl bg-plate-red py-3.5 font-display text-xl font-semibold text-white disabled:opacity-60">
          {pending ? "Saving…" : "Save food"}
        </button>
      </form>
    </Sheet>
  );
}
