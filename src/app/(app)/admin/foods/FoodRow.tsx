"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, EyeOff } from "lucide-react";
import { saveFood } from "../actions";

export type AdminFood = {
  id: string;
  name: string;
  brand: string | null;
  servingLabel: string | null;
  servingSize: number;
  servingUnit: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  hidden: boolean;
  source: string;
  uses: number;
  confirmations: number | null;
  flagged: boolean;
};

const r1 = (n: number) => Math.round(n * 10) / 10;

export function FoodRow({ food }: { food: AdminFood }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(food);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(food);
  const [pending, start] = useTransition();
  const num = (k: keyof AdminFood) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: Number(e.target.value) });
  const text = (k: keyof AdminFood) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const fromMacros = Math.round(f.proteinG * 4 + f.carbsG * 4 + f.fatG * 9);

  const save = (next = f) =>
    start(async () => {
      setError(null);
      const r = await saveFood({ id: next.id, name: next.name, brand: next.brand, servingLabel: next.servingLabel, servingSize: next.servingSize, servingUnit: next.servingUnit, calories: next.calories, proteinG: next.proteinG, carbsG: next.carbsG, fatG: next.fatG, hidden: next.hidden }).catch(() => ({ error: "No connection. Try again." }));
      if ("error" in r && r.error) return setError(r.error);
      setSaved(next);
      setF(next);
      setOpen(false);
    });

  return (
    <li className={`py-2.5 ${saved.hidden ? "opacity-60" : ""}`}>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-start justify-between gap-3 text-left" aria-expanded={open}>
        <span className="min-w-0">
          <span className="block truncate font-semibold">
            {saved.hidden && <EyeOff size={14} className="mr-1 inline text-chalk-muted" aria-label="Hidden" />}
            {saved.flagged && <AlertTriangle size={14} className="mr-1 inline text-plate-red" aria-label="Calories don't match the macros" />}
            {saved.name}{saved.brand ? `, ${saved.brand}` : ""}
          </span>
          <span className="block text-xs text-chalk-muted">
            {saved.source}{saved.confirmations ? ` (${saved.confirmations} agree)` : ""} · {saved.servingLabel ?? `${r1(saved.servingSize)} ${saved.servingUnit}`} · logged {saved.uses.toLocaleString("en-US")}×
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-display text-lg font-semibold tabular-nums">{Math.round(saved.calories)}</span>
          <span className="block text-xs text-chalk-muted tabular-nums">P {r1(saved.proteinG)} C {r1(saved.carbsG)} F {r1(saved.fatG)}</span>
        </span>
      </button>

      {open && (
        <div className="mt-3 space-y-2 rounded-xl bg-rack p-3">
          <Field label="Name"><input value={f.name} onChange={text("name")} className={input} /></Field>
          <Field label="Brand"><input value={f.brand ?? ""} onChange={text("brand")} className={input} /></Field>
          <Field label="Serving, as written"><input value={f.servingLabel ?? ""} onChange={text("servingLabel")} placeholder="1 cup (240 ml)" className={input} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Serving size"><input type="number" inputMode="decimal" value={f.servingSize} onChange={num("servingSize")} className={input} /></Field>
            <Field label="Unit"><input value={f.servingUnit} onChange={text("servingUnit")} className={input} /></Field>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <Field label="Calories"><input type="number" inputMode="decimal" value={f.calories} onChange={num("calories")} className={input} /></Field>
            <Field label="Protein"><input type="number" inputMode="decimal" value={f.proteinG} onChange={num("proteinG")} className={input} /></Field>
            <Field label="Carbs"><input type="number" inputMode="decimal" value={f.carbsG} onChange={num("carbsG")} className={input} /></Field>
            <Field label="Fat"><input type="number" inputMode="decimal" value={f.fatG} onChange={num("fatG")} className={input} /></Field>
          </div>
          <p className={`text-xs ${Math.abs(fromMacros - f.calories) > Math.max(30, 0.25 * Math.max(f.calories, fromMacros)) ? "text-plate-red" : "text-chalk-muted"}`}>
            The macros add up to {fromMacros} calories.
          </p>
          {error && <p role="alert" className="text-sm text-plate-red">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button disabled={pending} onClick={() => save()} className="flex-1 rounded-xl bg-plate-blue py-2.5 font-semibold text-rack disabled:opacity-50">{pending ? "Saving…" : "Save"}</button>
            <button disabled={pending} onClick={() => save({ ...f, hidden: !saved.hidden })} className="rounded-xl bg-rack-raised px-4 py-2.5 font-semibold text-chalk-muted disabled:opacity-50">
              {saved.hidden ? "Show in search" : "Hide from search"}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

const input = "w-full rounded-lg bg-rack-raised px-3 py-2 text-base";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs text-chalk-muted">
      {label}
      <span className="mt-1 block text-chalk">{children}</span>
    </label>
  );
}
