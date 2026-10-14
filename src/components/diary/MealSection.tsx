"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Bookmark, Copy, Plus } from "lucide-react";
import type { FoodCandidate } from "@/lib/nutrition/normalize";
import { copyMealFromDay, deleteDiaryEntry, saveMealFromDay, updateDiaryEntry } from "@/app/(app)/diary/actions";
import { FoodSheet } from "./FoodSheet";

type Item = { id: string; servings: number; food: FoodCandidate; calories: number };

export function MealSection({
  meal,
  label,
  day,
  yesterday,
  calories,
  items,
  index = 0,
}: {
  index?: number;
  meal: string;
  label: string;
  day: string;
  yesterday: string;
  calories: number;
  items: Item[];
}) {
  const [editing, setEditing] = useState<Item | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <section className="animate-rise mx-5 mt-4 rounded-2xl bg-rack-raised" style={{ "--i": index + 1 } as React.CSSProperties} aria-label={label}>
      <div className="flex items-baseline justify-between px-5 pt-4 pb-2">
        <h2 className="font-display text-2xl font-semibold">{label}</h2>
        <span className="font-display text-lg font-semibold tabular-nums text-chalk-muted">{Math.round(calories)}</span>
      </div>

      {items.length > 0 && (
        <ul className="divide-y divide-rack-line border-y border-rack-line">
          {items.map((item) => (
            <li key={item.id}>
              <button onClick={() => setEditing(item)} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-rack-line/40">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate font-medium">{item.food.name}</span>
                    {item.food.source === "AI_ESTIMATE" && (
                      <span className="shrink-0 rounded-full bg-plate-yellow/20 px-1.5 py-0.5 text-[10px] font-semibold text-plate-yellow">AI est.</span>
                    )}
                  </span>
                  <span className="block truncate text-sm text-chalk-muted">
                    {[item.food.brand, `${formatServings(item.servings)} × ${item.food.servingLabel ?? "serving"}`].filter(Boolean).join(", ")}
                  </span>
                </span>
                <span className="font-display text-lg font-semibold tabular-nums">{Math.round(item.calories)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between px-3 py-2">
        <Link href={`/diary/add?meal=${meal}&day=${day}`} className="flex items-center gap-1.5 rounded-lg px-2 py-2 font-medium text-plate-blue">
          <Plus size={18} aria-hidden /> Add food
        </Link>
        {items.length > 0 && (
          <button
            disabled={pending}
            onClick={() => {
              const name = window.prompt("Name this meal so you can log it in one tap", `My ${label.toLowerCase()}`);
              if (name) start(async () => { const r = await saveMealFromDay(day, meal, name); setMessage(r.error ?? `Saved “${name}”. Find it on Quick log.`); });
            }}
            className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm text-chalk-muted hover:text-chalk"
          >
            <Bookmark size={15} aria-hidden /> Save as meal
          </button>
        )}
        {items.length === 0 && (
          <button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await copyMealFromDay(yesterday, day, meal);
                setMessage(r.error ?? null);
              })
            }
            className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm text-chalk-muted hover:text-chalk"
          >
            <Copy size={15} aria-hidden /> {pending ? "Copying…" : "Copy yesterday"}
          </button>
        )}
      </div>
      {message && <p className="px-5 pb-3 text-sm text-chalk-muted">{message}</p>}

      {editing && (
        <FoodSheet
          food={editing.food}
          initialServings={editing.servings}
          confirmLabel="Update"
          pending={pending}
          onClose={() => setEditing(null)}
          onConfirm={(servings) => start(async () => { await updateDiaryEntry(editing.id, servings); setEditing(null); })}
          onDelete={() => start(async () => { await deleteDiaryEntry(editing.id); setEditing(null); })}
        />
      )}
    </section>
  );
}

function formatServings(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}
