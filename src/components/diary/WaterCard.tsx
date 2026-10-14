"use client";

import { useOptimistic, useTransition } from "react";
import { Droplet, Undo2 } from "lucide-react";
import { addWater } from "@/app/(app)/diary/actions";

export function WaterCard({ day, ml, goalMl, imperial }: { day: string; ml: number; goalMl: number; imperial: boolean }) {
  const glassMl = imperial ? 236.6 : 250; // one 8 oz glass or a 250 ml glass
  const [optimisticMl, setOptimisticMl] = useOptimistic(ml);
  const [, start] = useTransition();
  const glasses = Math.max(8, Math.round(goalMl / glassMl));
  const filled = Math.round(optimisticMl / glassMl);
  const amount = imperial ? `${Math.round(optimisticMl / 29.5735)} fl oz` : `${(optimisticMl / 1000).toFixed(2).replace(/0$/, "")} L`;

  const change = (delta: number) =>
    start(async () => {
      setOptimisticMl(Math.max(0, optimisticMl + (delta < 0 ? -glassMl : delta)));
      await addWater(day, delta);
    });

  return (
    <section className="mx-5 mt-4 rounded-2xl bg-rack-raised p-5" aria-label="Water">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-2xl font-semibold">Water</h2>
        <p className="font-display text-lg font-semibold tabular-nums">{amount}</p>
      </div>
      <ol className="mt-3 grid grid-cols-8 gap-1.5" aria-label={`${filled} of ${glasses} glasses`}>
        {Array.from({ length: glasses }, (_, i) => (
          <li key={i}>
            <button
              onClick={() => change(i < filled ? -glassMl : glassMl)}
              className="flex h-11 w-full items-end overflow-hidden rounded-b-xl rounded-t-sm border-2 border-rack-line"
              aria-label={i < filled ? "Remove a glass" : "Add a glass"}
            >
              <span className={`w-full transition-all duration-300 ${i < filled ? "h-full bg-plate-blue" : "h-0"}`} />
            </button>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex gap-2">
        <button onClick={() => change(glassMl)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-plate-blue py-2.5 font-medium text-white">
          <Droplet size={17} aria-hidden /> Add {imperial ? "8 oz" : "250 ml"}
        </button>
        {optimisticMl > 0 && (
          <button onClick={() => change(-1)} className="rounded-xl bg-rack px-4 text-chalk-muted" aria-label="Undo last glass">
            <Undo2 size={18} />
          </button>
        )}
      </div>
    </section>
  );
}
