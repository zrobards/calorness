"use client";

import { useRef, useState } from "react";
import { Loader2, ScanText } from "lucide-react";
import { AiProgress } from "./AiProgress";
import type { FoodCandidate } from "@/lib/nutrition/normalize";
import { haptic } from "@/lib/haptics";
import { scanLabel } from "@/app/(app)/log/actions";
import { CustomFoodForm, type FoodPrefill } from "@/components/diary/CustomFoodForm";
import { resizeImage } from "./resizeImage";

/**
 * Snap a Nutrition Facts label. The AI copies the printed numbers (not an
 * estimate), you confirm them, and the food is saved for exact logging.
 */
export function LabelScan({ className, onFood, onError, disabled }: {
  className: string;
  onFood: (food: FoodCandidate) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<FoodPrefill | null>(null);

  const onFile = async (file?: File) => {
    if (!file) return;
    setReading(true);
    setPreview(URL.createObjectURL(file));
    try {
      // Labels have small print, so keep more detail than meal photos
      const { base64, mediaType } = await resizeImage(file, 1600);
      const r = await scanLabel({ imageBase64: base64, mediaType });
      if ("error" in r && r.error) { haptic("warning"); onError(r.error); return; }
      if (!("readable" in r)) return;
      haptic("success");
      setPrefill({
        name: r.name || "Scanned food",
        brand: r.brand ?? null,
        servingLabel: r.serving_label,
        servingSize: r.serving_grams ?? null,
        calories: r.calories,
        proteinG: r.protein_g,
        carbsG: r.carbs_g,
        fatG: r.fat_g,
      });
    } catch {
      onError("Couldn't read that photo.");
    } finally {
      setReading(false);
      setPreview(null);
    }
  };

  return (
    <>
      {reading && <AiProgress task="label" photo={preview} />}
      <input ref={input} type="file" accept="image/*" capture="environment" className="sr-only" aria-hidden tabIndex={-1}
        onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
      <button type="button" disabled={disabled || reading} onClick={() => input.current?.click()} className={className}>
        {reading ? <Loader2 size={24} className="animate-spin" aria-hidden /> : <ScanText size={24} aria-hidden />}
        {reading ? "Reading…" : "Label"}
      </button>
      {prefill && (
        <CustomFoodForm title="From the label" prefill={prefill} onClose={() => setPrefill(null)}
          onCreated={(food) => { setPrefill(null); onFood(food); }} />
      )}
    </>
  );
}
