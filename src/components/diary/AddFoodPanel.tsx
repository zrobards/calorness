"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { FoodCandidate } from "@/lib/nutrition/normalize";
import { loadFoodAdder } from "@/app/(app)/diary/actions";
import { FoodAdder } from "./FoodAdder";

type Data = { recent: { food: FoodCandidate; servings: number; count: number }[]; mine: FoodCandidate[] };

/**
 * Add food without leaving the screen you're on: slides up over the Diary
 * or Quick log, stays open for adding several things, and closes back to
 * exactly where you were.
 */
export function AddFoodPanel({ meal, mealLabel, day, onClose }: { meal: string; mealLabel: string; day: string; onClose: () => void }) {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    let alive = true;
    loadFoodAdder().then((d) => alive && setData(d));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden"; // stop the page behind from scrolling
    return () => {
      alive = false;
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="animate-sheet fixed inset-0 z-40 overflow-y-auto bg-rack" role="dialog" aria-modal="true" aria-label={`Add to ${mealLabel}`}>
      <div className="mx-auto max-w-md pb-28" style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}>
        <div className="flex items-center justify-between px-5 pb-3">
          <h2 className="font-display text-3xl font-bold tracking-tight">Add to {mealLabel}</h2>
          <button onClick={onClose} className="-mr-2 rounded-full p-2 text-chalk-muted" aria-label="Done">
            <X size={26} />
          </button>
        </div>
        {data ? (
          <FoodAdder meal={meal} mealLabel={mealLabel} day={day} recent={data.recent} mine={data.mine} />
        ) : (
          <div className="space-y-3 px-5" aria-busy="true" aria-label="Loading">
            <div className="skeleton h-12 rounded-xl" />
            <div className="skeleton h-12 rounded-xl" />
            <div className="skeleton h-64 rounded-2xl" />
          </div>
        )}
      </div>
    </div>
  );
}
