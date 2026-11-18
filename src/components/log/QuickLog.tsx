"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Camera, ChevronRight, Dumbbell, ImageUp, Mic, Play, Plus, Search, Sparkles } from "lucide-react";
import type { FoodCandidate } from "@/lib/nutrition/normalize";
import type { AiFoodItem } from "@/lib/ai/parse";
import type { GroundedItem } from "@/lib/ai/ground";
import { localDay, mealForTime, type MealName } from "@/lib/nutrition/meals";
import { haptic } from "@/lib/haptics";
import { lookupBarcode, searchFoods } from "@/app/(app)/diary/actions";
import { CustomFoodForm, type FoodPrefill } from "@/components/diary/CustomFoodForm";
import { addDiaryEntry, deleteDiaryEntry } from "@/lib/clientActions";
import { aiEstimate } from "@/app/(app)/log/actions";
import { logAiItems, quickRelog } from "@/lib/clientActions";
import { deleteDiaryEntries, deleteSavedMeal, logSavedMeal } from "@/lib/clientActions";
import { startWorkout } from "@/app/(app)/train/actions";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import { Toast, type ToastData } from "@/components/motion/Toast";
import { PlateBurst } from "@/components/motion/PlateBurst";
import { BarcodeScanner } from "@/components/diary/BarcodeScanner";
import { FoodSheet } from "@/components/diary/FoodSheet";
import { LogAnywaySheet } from "./LogAnywaySheet";
import { AiReviewSheet, type ReviewedItem } from "./AiReviewSheet";
import { AiProgress, type AiTask } from "./AiProgress";
import { AddFoodPanel } from "@/components/diary/AddFoodPanel";
import { resizeImage } from "./resizeImage";
import { findBarcode } from "./findBarcode";

const MEAL_ORDER: MealName[] = ["BREAKFAST", "LUNCH", "DINNER", "SNACKS"];
const MEAL_LABELS: Record<MealName, string> = { BREAKFAST: "Breakfast", LUNCH: "Lunch", DINNER: "Dinner", SNACKS: "Snacks" };

type Recent = { food: FoodCandidate; servings: number; count: number };
type SpeechRecognitionLike = { lang: string; interimResults: boolean; onresult: (e: { results: { 0: { transcript: string } }[] }) => void; onend: () => void; start: () => void; stop: () => void };

export function QuickLog({
  mode,
  recent,
  today,
  active,
  nextRoutine,
  aiReady,
  savedMeals,
  fits,
}: {
  savedMeals: { id: string; name: string; itemCount: number; calories: number; proteinG: number }[];
  fits: { id: string; name: string; servings: number; calories: number; proteinG: number }[];
  left: { calories: number; proteinG: number; carbsG: number; fatG: number } | null;
  mode?: string;
  recent: Recent[];
  today: { calories: number; goal: number | null; proteinG: number; proteinGoal: number | null };
  active: { id: string; name: string } | null;
  nextRoutine: { id: string; name: string } | null;
  aiReady: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const [meal, setMeal] = useState<MealName>(() => mealForTime(new Date()));
  const [day] = useState(() => localDay(new Date()));
  const [scanning, setScanning] = useState(mode === "scan");
  const [text, setText] = useState("");
  const textRef = useRef<HTMLInputElement>(null);
  const [matches, setMatches] = useState<FoodCandidate[] | null>(null);
  const [labelPrefill, setLabelPrefill] = useState<FoodPrefill | null>(null);
  const [listening, setListening] = useState(false);
  // What the AI is working on, shown full-screen. Set OUTSIDE transitions:
  // state set inside startTransition only shows once the whole action ends,
  // which is why the old spinner often never appeared.
  const [progress, setProgress] = useState<{ task: AiTask; photo?: string | null } | null>(null);
  const runId = useRef(0); // lets Cancel ignore an answer that arrives later
  const [fallback, setFallback] = useState<{ input: { imageBase64?: string; mediaType?: string; text?: string }; photo: string | null; reason: string } | null>(null);
  const [review, setReview] = useState<{
    items: GroundedItem[];
    note?: string;
    photo?: string | null;
    // kept so the AI can look again when you correct it
    source: { imageBase64?: string; mediaType?: string; text?: string };
    version: number;
  } | null>(null);
  const [refining, setRefining] = useState(false);
  const [barcodeFood, setBarcodeFood] = useState<FoodCandidate | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [celebrate, setCelebrate] = useState(0);
  const [searching, setSearching] = useState(false);
  const closeSearch = useCallback(() => { setSearching(false); router.refresh(); }, [router]);
  const [pending, start] = useTransition();
  const clearToast = useCallback(() => setToast(null), []);

  const [speechSupported] = useState(() => "webkitSpeechRecognition" in window || "SpeechRecognition" in window);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  // Highlight the camera when opened from the "Snap a meal" home-screen shortcut
  useEffect(() => {
    if (mode === "snap") fileRef.current?.focus();
  }, [mode]);

  const runAi = async (input: { imageBase64?: string; mediaType?: string; text?: string }, photo?: string | null) => {
    const id = ++runId.current;
    setProgress({ task: input.imageBase64 ? "photo" : "describe", photo });
    const result = await aiEstimate(input).catch(() => ({ error: "Couldn't reach the AI. Check your connection and try again." }));
    if (id !== runId.current) return; // cancelled
    setProgress(null);
    if ("error" in result) {
      // Never a dead end: offer the quickest other ways to log it
      haptic("warning");
      setFallback({ input, photo: photo ?? null, reason: result.error ?? "The AI couldn't work that out." });
      return;
    }
    haptic("success");
    if ("label" in result && result.label) {
      // It was a Nutrition Facts label: confirm the printed numbers, then log
      const l = result.label;
      setLabelPrefill({ name: l.name || "Scanned food", brand: l.brand ?? null, servingLabel: l.serving_label, servingSize: l.serving_grams ?? null, calories: l.calories, proteinG: l.protein_g, carbsG: l.carbs_g, fatG: l.fat_g });
      return;
    }
    setReview({ items: result.items, note: result.note, photo, source: input, version: 0 });
  };

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    haptic();
    // show the photo right away while it's prepared and analyzed
    const preview = URL.createObjectURL(file);
    setProgress({ task: "photo", photo: preview });
    // A barcode in the shot means exact label values, so check for one first
    const code = await findBarcode(file);
    if (code) {
      const { food } = await lookupBarcode(code).catch(() => ({ food: null }));
      if (food) {
        setProgress(null);
        haptic("success");
        setToast({ message: "Found the barcode, using the exact label values." });
        setBarcodeFood(food);
        return;
      }
    }
    try {
      const { base64, mediaType } = await resizeImage(file);
      runAi({ imageBase64: base64, mediaType }, `data:${mediaType};base64,${base64}`);
    } catch {
      setProgress(null);
      setToast({ message: "Couldn't read that photo. Try another one." });
    } finally {
      setTimeout(() => URL.revokeObjectURL(preview), 30_000);
    }
  };

  // As you type, foods from the database that match; Enter asks the AI instead
  useEffect(() => {
    const q = text.trim();
    let alive = true;
    const t = setTimeout(async () => {
      if (q.length < 2) { setMatches(null); return; }
      const local = await searchFoods(q, "local").catch(() => ({ foods: [] as FoodCandidate[] }));
      if (alive && local.foods.length) setMatches(local.foods.slice(0, 4));
      const all = await searchFoods(q, "all").catch(() => ({ foods: [] as FoodCandidate[] }));
      // one row per food, even when it comes from several sources
      const seen = new Set<string>();
      const unique = (all.foods.length ? all.foods : local.foods).filter((f) => { const k = `${f.name}|${f.brand ?? ""}`.toLowerCase(); return !seen.has(k) && !!seen.add(k); });
      if (alive) setMatches(unique.slice(0, 4));
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [text]);

  const describe = () => {
    const q = text.trim();
    if (!q) return textRef.current?.focus();
    (document.activeElement as HTMLElement | null)?.blur?.();
    setMatches(null);
    runAi({ text: q });
  };

  const listen = () => {
    const Ctor = (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike });
    const Rec = Ctor.SpeechRecognition ?? Ctor.webkitSpeechRecognition;
    if (!Rec) return;
    if (listening) return recognitionRef.current?.stop();
    const rec = new Rec();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.onresult = (e) => setText(Array.from(e.results).map((r) => r[0].transcript).join(" "));
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    haptic();
    rec.start();
  };

  const refine = async (correction: string, current: AiFoodItem[]) => {
    if (!review) return;
    setRefining(true);
    setProgress({ task: "recheck", photo: review.photo });
    const result = await aiEstimate({ ...review.source, previous: current, correction }).catch(() => ({ error: "Couldn't reach the AI. Try again." }));
    setProgress(null);
    setRefining(false);
    if ("error" in result) {
      haptic("warning");
      return setToast({ message: result.error ?? "Something went wrong. Try again." });
    }
    if (!("items" in result)) return;
    haptic("success");
    setReview((r) => r && { ...r, items: result.items, note: result.note, version: r.version + 1 });
  };

  const logReviewed = (items: ReviewedItem[]) =>
    start(async () => {
      const result = await logAiItems({ day, meal, items });
      if ("error" in result && result.error) return setToast({ message: result.error });
      setReview(null);
      setCelebrate((c) => c + 1);
      setToast({ message: `Logged ${items.length} ${items.length === 1 ? "item" : "items"} to ${MEAL_LABELS[meal]}` });
      router.refresh();
    });

  const relogById = (food: { id: string; name: string; servings: number }) =>
    start(async () => {
      haptic("success");
      const result = await quickRelog({ foodId: food.id, servings: food.servings, day, meal });
      if ("error" in result) return setToast({ message: result.error ?? "Couldn't log that." });
      setToast({
        message: `${food.name}, ${result.calories} cal → ${MEAL_LABELS[meal]}`,
        action: { label: "Undo", onClick: () => start(async () => { await deleteDiaryEntry(result.entryId); router.refresh(); }) },
      });
      router.refresh();
    });

  const logMeal = (m: { id: string; name: string }) =>
    start(async () => {
      haptic("success");
      const r = await logSavedMeal(m.id, day, meal);
      if ("error" in r) return setToast({ message: r.error ?? "Couldn't log that." });
      setToast({
        message: `${m.name}, ${r.calories} cal → ${MEAL_LABELS[meal]}`,
        action: { label: "Undo", onClick: () => start(async () => { await deleteDiaryEntries(r.entryIds); router.refresh(); }) },
      });
      router.refresh();
    });

  const onBarcode = useCallback((code: string) => {
    setScanning(false);
    setProgress({ task: "barcode" });
    lookupBarcode(code)
      .then(({ food, barcode }) => {
        setProgress(null);
        if (food) setBarcodeFood(food);
        else setToast({ message: `No match for ${barcode}. Snap a photo of it instead.` });
      })
      .catch(() => {
        setProgress(null);
        setToast({ message: "Couldn't look that up: no connection. Try again when you have signal." });
      });
  }, []);

  const caloriesLeft = today.goal ? Math.round(today.goal - today.calories) : null;
  const [showAll, setShowAll] = useState(false);
  type QuickItem = { kind: "meal" | "food"; id: string; name: string; servings: number; calories: number; proteinG: number; note: string; fits?: boolean };
  const fitIds = new Set(fits.map((f) => f.id));
  const seen = new Set<string>();
  const quickAdd: QuickItem[] = [
    ...savedMeals.map((m) => ({ kind: "meal" as const, id: m.id, name: m.name, servings: 1, calories: m.calories, proteinG: m.proteinG, note: `Saved meal, ${m.itemCount} ${m.itemCount === 1 ? "item" : "items"}` })),
    // foods that fit what's left come first, then the rest of your recent foods
    ...fits.map((f) => ({ kind: "food" as const, id: f.id, name: f.name, servings: f.servings, calories: Math.round(f.calories), proteinG: Math.round(f.proteinG), note: "Fits what's left today", fits: true })),
    ...recent.filter((r) => r.food.id && !fitIds.has(r.food.id)).map((r) => ({
      kind: "food" as const, id: r.food.id!, name: r.food.name, servings: r.servings,
      calories: Math.round(r.food.calories * r.servings), proteinG: Math.round(r.food.proteinG * r.servings),
      note: r.count > 1 ? `Logged ${r.count} times` : "Recent",
    })),
    // the same food logged from different sources shows up once
  ].filter((q) => {
    const key = `${q.kind}-${q.name.trim().toLowerCase()}`;
    return !seen.has(key) && !!seen.add(key);
  });

  return (
    <div className="px-5 pb-2">
      {/* Today at a glance */}
      <div className="animate-rise flex items-end justify-between" style={{ "--i": 0 } as React.CSSProperties}>
        <div>
          <p className="text-sm text-chalk-muted">{caloriesLeft !== null ? (caloriesLeft >= 0 ? "Calories left today" : "Over today by") : "Eaten today"}</p>
          <p className="font-display text-5xl leading-none font-bold">
            <AnimatedNumber id="calories-left" value={caloriesLeft !== null ? Math.abs(caloriesLeft) : today.calories} />
          </p>
        </div>
        {today.proteinGoal && (
          <div className="text-right">
            <p className="text-sm text-chalk-muted">Protein</p>
            <p className="font-display text-2xl font-bold text-plate-blue">
              <AnimatedNumber id="protein-eaten" value={today.proteinG} />
              <span className="text-base text-chalk-muted">/{today.proteinGoal}g</span>
            </p>
          </div>
        )}
      </div>

      {/* Which meal this goes to; guessed from the time, one tap to change */}
      <div className="animate-rise mt-5 flex gap-2 overflow-x-auto" style={{ "--i": 1 } as React.CSSProperties} role="radiogroup" aria-label="Meal">
        {MEAL_ORDER.map((m) => (
          <button key={m} role="radio" aria-checked={meal === m} onClick={() => { haptic(); setMeal(m); }}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${meal === m ? "bg-chalk text-rack" : "bg-rack-raised text-chalk-muted"}`}>
            {MEAL_LABELS[m]}
          </button>
        ))}
      </div>

      {/* One way in: a camera that figures out meal vs. label vs. barcode, and one text box */}
      <div className="animate-rise mt-4 overflow-hidden rounded-3xl bg-rack-raised" style={{ "--i": 2 } as React.CSSProperties}>
        <input ref={fileRef} id="snap-camera" type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { onPhoto(e.target.files?.[0]); e.target.value = ""; }} disabled={!aiReady} />
        <input ref={libraryRef} id="snap-library" type="file" accept="image/*" className="sr-only" onChange={(e) => { onPhoto(e.target.files?.[0]); e.target.value = ""; }} disabled={!aiReady} />
        <div className={`relative h-36 bg-plate-red text-white ${mode === "snap" || mode === "scan" ? "ring-4 ring-plate-yellow ring-inset" : ""}`}>
          <label htmlFor="snap-camera" className="absolute inset-0 flex cursor-pointer flex-col justify-end p-5">
            <span className="absolute -top-16 -right-16 size-56 rounded-full border-[18px] border-white/10" aria-hidden />
            <Camera size={34} strokeWidth={2.2} aria-hidden />
            <span className="mt-2 font-display text-3xl leading-none font-bold">Snap it</span>
            <span className="mt-1 text-sm text-white">{aiReady ? "A meal, a nutrition label, or a barcode" : "Add an AI key to turn this on"}</span>
          </label>
          <label htmlFor="snap-library" className="absolute top-4 right-4 flex cursor-pointer items-center gap-1.5 rounded-full bg-black/25 px-3.5 py-2 text-sm font-semibold backdrop-blur">
            <ImageUp size={17} aria-hidden /> Upload
          </label>
        </div>
        <form className="flex items-center gap-2 p-3" onSubmit={(e) => { e.preventDefault(); describe(); }}>
          <input ref={textRef} value={text} onChange={(e) => setText(e.target.value)} maxLength={500} autoFocus={mode === "describe"}
            placeholder="Or type what you ate" aria-label="What you ate" enterKeyHint="go"
            className="min-w-0 flex-1 rounded-xl border border-rack-line bg-rack px-3.5 py-3 text-base focus:border-plate-yellow focus:outline-none" />
          {speechSupported && (
            <button type="button" onClick={listen} aria-pressed={listening} aria-label={listening ? "Stop listening" : "Say it instead"}
              className={`rounded-xl p-3 ${listening ? "animate-pulse bg-plate-red text-white" : "bg-rack text-chalk-muted"}`}><Mic size={20} /></button>
          )}
        </form>
        {text.trim().length >= 2 && (
          <div className="border-t border-rack-line">
            {aiReady && (
              <button onClick={describe} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-rack-line/40">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-plate-yellow/20 text-plate-yellow" aria-hidden><Sparkles size={16} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">Count &ldquo;{text.trim()}&rdquo;</span>
                  <span className="block text-xs text-chalk-muted">AI works out the calories, even for a whole meal</span>
                </span>
              </button>
            )}
            {matches?.map((f, i) => (
              <button key={`${f.externalId ?? f.id ?? f.name}-${i}`} onClick={() => setBarcodeFood(f)} className="flex w-full items-center gap-3 border-t border-rack-line px-4 py-3 text-left active:bg-rack-line/40">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-rack text-chalk-muted" aria-hidden><Search size={15} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{f.name}</span>
                  <span className="block truncate text-xs text-chalk-muted">{[f.brand, f.servingLabel].filter(Boolean).join(", ")}</span>
                </span>
                <span className="font-display text-lg font-semibold tabular-nums">{Math.round(f.calories)}</span>
              </button>
            ))}
            {matches === null && <p className="border-t border-rack-line px-4 py-3 text-sm text-chalk-muted">Searching foods…</p>}
          </div>
        )}
      </div>

      {/* Quick add: saved meals, foods that fit what's left, and recent foods, in one list */}
      {quickAdd.length > 0 && (
        <section className="animate-rise mt-7" style={{ "--i": 4 } as React.CSSProperties} aria-labelledby="quick-heading">
          <div className="flex items-baseline justify-between">
            <h2 id="quick-heading" className="font-display text-2xl font-semibold">Quick add</h2>
            <span className="text-xs text-chalk-muted">One tap → {MEAL_LABELS[meal]}</span>
          </div>
          <ul className="mt-3 divide-y divide-rack-line overflow-hidden rounded-2xl bg-rack-raised">
            {quickAdd.slice(0, showAll ? 20 : 6).map((q) => (
              <li key={`${q.kind}-${q.id}`} className="flex items-center">
                <button
                  onClick={() => (q.kind === "meal" ? logMeal(q) : relogById(q))}
                  disabled={pending}
                  className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left active:bg-rack-line/50"
                >
                  <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${q.kind === "meal" ? "bg-plate-blue/20 text-plate-blue" : q.fits ? "bg-plate-green/20 text-plate-green" : "bg-rack text-chalk-muted"}`} aria-hidden>
                    {q.kind === "meal" ? <Bookmark size={16} /> : <Plus size={16} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{q.name}</span>
                    <span className="block truncate text-xs text-chalk-muted">{q.note}</span>
                  </span>
                  <span className="text-right">
                    <span className="block font-display text-lg leading-tight font-bold tabular-nums">{q.calories}</span>
                    <span className="block text-xs text-plate-blue tabular-nums">{q.proteinG}g P</span>
                  </span>
                </button>
                {q.kind === "meal" && (
                  <button onClick={() => confirm(`Delete saved meal “${q.name}”?`) && start(async () => { await deleteSavedMeal(q.id); router.refresh(); })}
                    className="px-3 py-3 text-chalk-muted" aria-label={`Delete ${q.name}`}>×</button>
                )}
              </li>
            ))}
          </ul>
          {quickAdd.length > 6 && (
            <button onClick={() => setShowAll((v) => !v)} className="mt-2 w-full text-sm font-medium text-plate-blue">
              {showAll ? "Show less" : `Show ${Math.min(20, quickAdd.length) - 6} more`}
            </button>
          )}
        </section>
      )}

      {/* Training, one tap away */}
      <section className="animate-rise mt-7" style={{ "--i": 5 } as React.CSSProperties}>
        {active ? (
          <Link href={`/train/workout/${active.id}`} className="flex items-center gap-4 rounded-3xl bg-plate-green p-5 text-white">
            <Dumbbell size={28} aria-hidden />
            <span className="flex-1"><span className="block font-display text-2xl font-bold">Back to {active.name}</span><span className="text-sm opacity-90">Workout in progress</span></span>
            <ChevronRight aria-hidden />
          </Link>
        ) : (
          <form action={startWorkout.bind(null, nextRoutine?.id ?? null)}>
            <button className="flex w-full items-center gap-4 rounded-3xl bg-rack-raised p-5 text-left">
              <span className="flex size-12 items-center justify-center rounded-full bg-plate-green text-white"><Play size={22} fill="currentColor" aria-hidden /></span>
              <span className="flex-1">
                <span className="block font-display text-2xl font-bold">{nextRoutine ? `Start ${nextRoutine.name}` : "Start a workout"}</span>
                <span className="text-sm text-chalk-muted">{nextRoutine ? "Your next routine in rotation" : "Empty workout, add exercises as you go"}</span>
              </span>
            </button>
          </form>
        )}
      </section>

      {fallback && (
        <LogAnywaySheet
          text={fallback.input.text}
          photo={fallback.photo}
          day={day}
          meal={meal}
          mealLabel={MEAL_LABELS[meal]}
          reason={fallback.reason}
          onRetry={() => { const f = fallback; setFallback(null); void runAi(f.input, f.photo); }}
          onLogged={(message) => { setFallback(null); setCelebrate((c) => c + 1); setToast({ message }); router.refresh(); }}
          onClose={() => setFallback(null)}
        />
      )}
      {progress && (
        <AiProgress
          task={progress.task}
          photo={progress.photo}
          onCancel={progress.task === "photo" || progress.task === "describe" ? () => { runId.current++; setProgress(null); } : undefined}
        />
      )}

      {labelPrefill && (
        <CustomFoodForm title="From the label" prefill={labelPrefill} onClose={() => setLabelPrefill(null)}
          onCreated={(food) => { setLabelPrefill(null); setBarcodeFood(food); }} />
      )}

      {review && (
        <AiReviewSheet
          key={review.version}
          items={review.items}
          note={review.note}
          photo={review.photo}
          mealLabel={MEAL_LABELS[meal]}
          pending={pending}
          refining={refining}
          onConfirm={logReviewed}
          onRefine={refine}
          onClose={() => setReview(null)}
        />
      )}
      {scanning && <BarcodeScanner onDetected={onBarcode} onClose={() => setScanning(false)} />}
      {barcodeFood && (
        <FoodSheet food={barcodeFood} confirmLabel={`Add to ${MEAL_LABELS[meal]}`} pending={pending} onClose={() => setBarcodeFood(null)}
          onConfirm={(servings) => start(async () => {
            await addDiaryEntry({ food: barcodeFood, day, meal, servings });
            haptic("success");
            setBarcodeFood(null);
            setToast({ message: `${barcodeFood.name} → ${MEAL_LABELS[meal]}` });
            router.refresh();
          })} />
      )}
      {searching && <AddFoodPanel meal={meal} mealLabel={MEAL_LABELS[meal]} day={day} onClose={closeSearch} />}
      {celebrate > 0 && <PlateBurst key={celebrate} />}
      <Toast toast={toast} onDone={clearToast} />
    </div>
  );
}
