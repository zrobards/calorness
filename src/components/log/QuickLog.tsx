"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Barcode, Camera, ChevronRight, Dumbbell, Loader2, Mic, MessageSquareText, Play, Search } from "lucide-react";
import type { FoodCandidate } from "@/lib/nutrition/normalize";
import type { AiFoodItem } from "@/lib/ai/parse";
import { localDay, mealForTime, type MealName } from "@/lib/nutrition/meals";
import { haptic } from "@/lib/haptics";
import { addDiaryEntry, deleteDiaryEntry, lookupBarcode } from "@/app/(app)/diary/actions";
import { aiEstimate, logAiItems, quickRelog } from "@/app/(app)/log/actions";
import { startWorkout } from "@/app/(app)/train/actions";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import { Toast, type ToastData } from "@/components/motion/Toast";
import { PlateBurst } from "@/components/motion/PlateBurst";
import { BarcodeScanner } from "@/components/diary/BarcodeScanner";
import { FoodSheet } from "@/components/diary/FoodSheet";
import { Sheet } from "@/components/diary/Sheet";
import { AiReviewSheet, type ReviewItem } from "./AiReviewSheet";
import { resizeImage } from "./resizeImage";

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
}: {
  mode?: string;
  recent: Recent[];
  today: { calories: number; goal: number | null; proteinG: number; proteinGoal: number | null };
  active: { id: string; name: string } | null;
  nextRoutine: { id: string; name: string } | null;
  aiReady: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [meal, setMeal] = useState<MealName>(() => mealForTime(new Date()));
  const [day] = useState(() => localDay(new Date()));
  const [scanning, setScanning] = useState(mode === "scan");
  const [describing, setDescribing] = useState(mode === "describe");
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState<string | null>(null);
  const [review, setReview] = useState<{ items: AiFoodItem[]; note?: string; photo?: string | null } | null>(null);
  const [barcodeFood, setBarcodeFood] = useState<FoodCandidate | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [celebrate, setCelebrate] = useState(0);
  const [pending, start] = useTransition();
  const clearToast = useCallback(() => setToast(null), []);

  const [speechSupported] = useState(() => "webkitSpeechRecognition" in window || "SpeechRecognition" in window);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  // Highlight the camera when opened from the "Snap a meal" home-screen shortcut
  useEffect(() => {
    if (mode === "snap") fileRef.current?.focus();
  }, [mode]);

  const runAi = (input: { imageBase64?: string; mediaType?: string; text?: string }, photo?: string | null) =>
    start(async () => {
      setThinking(input.imageBase64 ? "Looking at your meal…" : "Reading that…");
      const result = await aiEstimate(input);
      setThinking(null);
      if ("error" in result) {
        haptic("warning");
        setToast({ message: result.error });
        return;
      }
      haptic("success");
      setReview({ items: result.items, note: result.note, photo });
    });

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    haptic();
    setThinking("Getting your photo ready…");
    try {
      const { base64, mediaType } = await resizeImage(file);
      runAi({ imageBase64: base64, mediaType }, `data:${mediaType};base64,${base64}`);
    } catch {
      setThinking(null);
      setToast({ message: "Couldn't read that photo. Try another one." });
    }
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

  const logReviewed = (items: ReviewItem[]) =>
    start(async () => {
      const result = await logAiItems({ day, meal, items });
      if ("error" in result && result.error) return setToast({ message: result.error });
      setReview(null);
      setCelebrate((c) => c + 1);
      setToast({ message: `Logged ${items.length} ${items.length === 1 ? "item" : "items"} to ${MEAL_LABELS[meal]}` });
      router.refresh();
    });

  const relog = (r: Recent) =>
    start(async () => {
      haptic("success");
      const result = await quickRelog({ foodId: r.food.id!, servings: r.servings, day, meal });
      if ("error" in result) return setToast({ message: result.error ?? "Couldn't log that." });
      setToast({
        message: `${r.food.name}, ${result.calories} cal → ${MEAL_LABELS[meal]}`,
        action: { label: "Undo", onClick: () => start(async () => { await deleteDiaryEntry(result.entryId); router.refresh(); }) },
      });
      router.refresh();
    });

  const onBarcode = useCallback((code: string) => {
    setScanning(false);
    start(async () => {
      setThinking("Looking up that barcode…");
      const { food, barcode } = await lookupBarcode(code);
      setThinking(null);
      if (food) setBarcodeFood(food);
      else setToast({ message: `No match for ${barcode}. Snap a photo of it instead.` });
    });
  }, []);

  const caloriesLeft = today.goal ? Math.round(today.goal - today.calories) : null;

  return (
    <div className="px-5 pb-6">
      {/* Today at a glance */}
      <div className="animate-rise flex items-end justify-between" style={{ "--i": 0 } as React.CSSProperties}>
        <div>
          <p className="text-sm text-chalk-muted">{caloriesLeft !== null ? (caloriesLeft >= 0 ? "Calories left today" : "Over today by") : "Eaten today"}</p>
          <p className="font-display text-5xl leading-none font-bold">
            <AnimatedNumber value={caloriesLeft !== null ? Math.abs(caloriesLeft) : today.calories} />
          </p>
        </div>
        {today.proteinGoal && (
          <div className="text-right">
            <p className="text-sm text-chalk-muted">Protein</p>
            <p className="font-display text-2xl font-bold text-plate-blue">
              <AnimatedNumber value={today.proteinG} />
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

      {/* The big one: photo → AI */}
      <label
        className={`animate-rise relative mt-4 flex h-44 cursor-pointer flex-col justify-end overflow-hidden rounded-3xl bg-plate-red p-5 text-white ${mode === "snap" ? "ring-4 ring-plate-yellow" : ""}`}
        style={{ "--i": 2 } as React.CSSProperties}
      >
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { onPhoto(e.target.files?.[0]); e.target.value = ""; }} disabled={!aiReady} />
        {/* bumper-plate rings in the corner */}
        <span className="absolute -top-16 -right-16 size-56 rounded-full border-[18px] border-white/10" aria-hidden />
        <span className="absolute -top-4 -right-4 size-28 rounded-full border-[10px] border-white/10" aria-hidden />
        <Camera size={36} strokeWidth={2.2} aria-hidden />
        <span className="mt-2 font-display text-3xl leading-none font-bold">Snap your meal</span>
        <span className="mt-1 text-sm text-white/85">{aiReady ? "AI counts the calories for you" : "Add an AI key to turn this on"}</span>
      </label>

      <div className="animate-rise mt-3 grid grid-cols-3 gap-3" style={{ "--i": 3 } as React.CSSProperties}>
        <button onClick={() => { haptic(); setScanning(true); }} className="flex flex-col items-center gap-1.5 rounded-2xl bg-plate-blue py-4 font-semibold text-white">
          <Barcode size={24} aria-hidden /> Scan
        </button>
        <button onClick={() => { haptic(); setDescribing(true); }} disabled={!aiReady} className="flex flex-col items-center gap-1.5 rounded-2xl bg-rack-raised py-4 font-semibold disabled:opacity-50">
          <MessageSquareText size={24} aria-hidden /> Describe
        </button>
        <Link href={`/diary/add?meal=${meal}&day=${day}`} className="flex flex-col items-center gap-1.5 rounded-2xl bg-rack-raised py-4 font-semibold">
          <Search size={24} aria-hidden /> Search
        </Link>
      </div>

      {/* One-tap repeats */}
      {recent.length > 0 && (
        <section className="animate-rise mt-7" style={{ "--i": 4 } as React.CSSProperties} aria-labelledby="again-heading">
          <h2 id="again-heading" className="font-display text-2xl font-semibold">Tap to log again</h2>
          <p className="text-sm text-chalk-muted">Same amount as last time, straight to {MEAL_LABELS[meal]}.</p>
          <ul className="mt-3 grid grid-cols-2 gap-2">
            {recent.slice(0, 8).map((r) => (
              <li key={r.food.id}>
                <button onClick={() => relog(r)} disabled={pending} className="flex h-full w-full flex-col items-start rounded-2xl bg-rack-raised p-3 text-left">
                  <span className="line-clamp-2 text-sm leading-snug font-medium">{r.food.name}</span>
                  <span className="mt-auto pt-1 font-display text-lg font-bold text-plate-red tabular-nums">
                    {Math.round(r.food.calories * r.servings)}<span className="ml-1 text-xs font-medium text-chalk-muted">cal</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
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

      {thinking && (
        <div className="animate-fade fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-rack/90 backdrop-blur" role="status">
          <Loader2 size={44} className="animate-spin text-plate-red" aria-hidden />
          <p className="font-display text-2xl font-semibold">{thinking}</p>
        </div>
      )}

      {describing && (
        <Sheet title="What did you eat?" onClose={() => setDescribing(false)}>
          <form className="mt-4" onSubmit={(e) => { e.preventDefault(); setDescribing(false); runAi({ text }); }}>
            <div className="relative">
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} autoFocus required maxLength={500}
                placeholder="2 scrambled eggs, a slice of toast with butter, and a black coffee"
                className="w-full resize-none rounded-2xl border border-rack-line bg-rack px-4 py-3 pr-14 text-lg focus:border-plate-yellow focus:outline-none" />
              {speechSupported && (
                <button type="button" onClick={listen} aria-pressed={listening} aria-label={listening ? "Stop listening" : "Speak instead"}
                  className={`absolute right-2 bottom-3 rounded-full p-2.5 ${listening ? "animate-pulse bg-plate-red text-white" : "bg-rack-raised text-chalk-muted"}`}>
                  <Mic size={20} />
                </button>
              )}
            </div>
            <button className="mt-4 w-full rounded-xl bg-plate-red py-3.5 font-display text-xl font-semibold text-white">Count it</button>
          </form>
        </Sheet>
      )}

      {review && (
        <AiReviewSheet {...review} mealLabel={MEAL_LABELS[meal]} pending={pending} onConfirm={logReviewed} onClose={() => setReview(null)} />
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
      {celebrate > 0 && <PlateBurst key={celebrate} />}
      <Toast toast={toast} onDone={clearToast} />
    </div>
  );
}
