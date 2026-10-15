"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Barcode, Loader2, PenLine, Search } from "lucide-react";
import type { FoodCandidate } from "@/lib/nutrition/normalize";
import { macroCheck } from "@/lib/nutrition/quality";
import { addDiaryEntry, lookupBarcode, searchFoods } from "@/app/(app)/diary/actions";
import { FoodSheet } from "./FoodSheet";
import { BarcodeScanner } from "./BarcodeScanner";
import { CustomFoodForm } from "./CustomFoodForm";

type Tab = "search" | "recent" | "mine";

export function FoodAdder({
  meal,
  mealLabel,
  day,
  recent,
  mine,
}: {
  meal: string;
  mealLabel: string;
  day: string;
  recent: { food: FoodCandidate; servings: number; count: number }[];
  mine: FoodCandidate[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(recent.length ? "recent" : "search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<{ food: FoodCandidate; servings: number } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [creating, setCreating] = useState<{ barcode?: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [added, setAdded] = useState<string[]>([]);
  const [pending, start] = useTransition();

  // Search 400 ms after typing stops, so we don't call the APIs on every keystroke
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setSearching(true);
      const { foods } = await searchFoods(q);
      if (!cancelled) {
        setResults(foods);
        setSearching(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const onDetected = useCallback(
    (code: string) => {
      setScanning(false);
      start(async () => {
        const { food, barcode } = await lookupBarcode(code);
        if (food) setSelected({ food, servings: 1 });
        else {
          setNotice(`No match for barcode ${barcode}. Add it as your own food and it'll scan next time.`);
          setCreating({ barcode });
        }
      });
    },
    [],
  );

  const confirm = (servings: number) =>
    start(async () => {
      if (!selected) return;
      const result = await addDiaryEntry({ food: selected.food, day, meal, servings });
      if (result.error) return setNotice(result.error);
      setAdded((a) => [...a, selected.food.name]);
      setSelected(null);
      router.refresh();
    });

  const list = tab === "search" ? results : tab === "recent" ? recent.map((r) => r.food) : mine;

  return (
    <div>
      <div className="px-5">
        <label className="relative block">
          <Search size={18} className="absolute top-1/2 left-3 -translate-y-1/2 text-chalk-muted" aria-hidden />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); if (e.target.value.trim().length >= 2) setTab("search"); }}
            placeholder="Search foods and brands"
            aria-label="Search foods"
            className="w-full rounded-xl border border-rack-line bg-rack-raised py-3 pr-10 pl-10 focus:border-plate-yellow focus:outline-none"
          />
          {searching && <Loader2 size={18} className="absolute top-1/2 right-3 -translate-y-1/2 animate-spin text-chalk-muted" aria-label="Searching" />}
        </label>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={() => setScanning(true)} className="flex items-center justify-center gap-2 rounded-xl bg-plate-blue py-3 font-display text-lg font-semibold text-white">
            <Barcode size={20} aria-hidden /> Scan barcode
          </button>
          <button onClick={() => setCreating({})} className="flex items-center justify-center gap-2 rounded-xl bg-rack-raised py-3 font-display text-lg font-semibold">
            <PenLine size={18} aria-hidden /> Create food
          </button>
        </div>

        <div className="mt-4 flex gap-5 border-b border-rack-line" role="tablist">
          {([["search", "Search"], ["recent", "Recent"], ["mine", "My foods"]] as const).map(([id, name]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              className={`-mb-px border-b-2 pb-2 font-medium ${tab === id ? "border-plate-red text-chalk" : "border-transparent text-chalk-muted"}`}>
              {name}
            </button>
          ))}
        </div>
      </div>

      {added.length > 0 && (
        <p className="mx-5 mt-3 rounded-xl bg-plate-green/15 px-4 py-2 text-sm" aria-live="polite">
          Added to {mealLabel}: {added.join(", ")}
        </p>
      )}
      {notice && <p className="mx-5 mt-3 rounded-xl border border-plate-yellow/40 px-4 py-2 text-sm">{notice}</p>}

      <ul className="mt-2 px-5">
        {list.map((f, i) => (
          <li key={`${f.source}-${f.externalId ?? f.id}-${i}`}>
            <button
              onClick={() => setSelected({ food: f, servings: tab === "recent" ? recent[i]?.servings ?? 1 : 1 })}
              className="flex w-full items-center gap-3 border-b border-rack-line py-3 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate font-medium">{f.name}</span>
                  {macroCheck(f).flagged && <span className="shrink-0 text-xs text-plate-yellow" title="Numbers don't add up">⚠ check</span>}
                  {f.calories > 900 && <span className="shrink-0 rounded-full bg-plate-yellow/15 px-1.5 text-[10px] font-semibold text-plate-yellow">big serving</span>}
                </span>
                <span className="block truncate text-sm text-chalk-muted">
                  {[f.brand, f.servingLabel].filter(Boolean).join(", ")}
                </span>
              </span>
              <span className="text-right">
                <span className="block font-display text-lg font-semibold tabular-nums">{Math.round(f.calories)}</span>
                <span className="block text-xs text-chalk-muted">P {Math.round(f.proteinG)} C {Math.round(f.carbsG)} F {Math.round(f.fatG)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {list.length === 0 && (
        <p className="px-5 py-10 text-center text-chalk-muted">
          {tab === "search"
            ? query.trim().length < 2 ? "Type at least two letters to search." : searching ? "Searching…" : `No foods found for “${query}”. Try fewer words, or create it.`
            : tab === "recent" ? "Foods you log show up here for quick re-adding." : "Foods you create show up here."}
        </p>
      )}

      {selected && (
        <FoodSheet food={selected.food} initialServings={selected.servings} confirmLabel={`Add to ${mealLabel}`} pending={pending}
          onConfirm={confirm} onClose={() => setSelected(null)} />
      )}
      {scanning && <BarcodeScanner onDetected={onDetected} onClose={() => setScanning(false)} />}
      {creating && (
        <CustomFoodForm barcode={creating.barcode} onClose={() => setCreating(null)}
          onCreated={(food) => { setCreating(null); setNotice(null); setSelected({ food, servings: 1 }); }} />
      )}
    </div>
  );
}
