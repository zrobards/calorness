"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";

// What the AI is doing while you wait, step by step, so it's obvious the
// app is working. The steps advance on a timer that matches how long each
// part usually takes; the last one waits until the answer arrives.
const STEPS = {
  photo: ["Uploading your photo", "Finding each food", "Estimating portions", "Checking the nutrition database", "Adding it up"],
  describe: ["Reading what you ate", "Working out portions", "Checking the nutrition database", "Adding it up"],
  label: ["Uploading the label", "Reading the numbers", "Double-checking"],
  recheck: ["Taking your note into account", "Re-estimating", "Adding it up"],
  barcode: ["Looking up the barcode"],
  program: ["Reading your goals", "Choosing exercises", "Setting sets, reps, and rest", "Balancing the week", "Matching to the exercise library"],
  programPaste: ["Reading your program", "Matching exercises to the library", "Filling in sets, reps, and rest"],
  programRevise: ["Reading your change", "Rewriting the program", "Matching to the exercise library"],
} as const;
export type AiTask = keyof typeof STEPS;

export function AiProgress({ task, photo, onCancel }: { task: AiTask; photo?: string | null; onCancel?: () => void }) {
  const steps = STEPS[task];
  const [step, setStep] = useState(0);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const tick = setInterval(() => setSeconds((s) => s + 1), 1000);
    const advance = setInterval(() => setStep((s) => Math.min(steps.length - 1, s + 1)), 2200);
    return () => {
      clearInterval(tick);
      clearInterval(advance);
    };
  }, [steps.length]);

  return (
    <div className="animate-fade fixed inset-0 z-50 flex flex-col items-center justify-center bg-rack/95 px-8 backdrop-blur" role="status" aria-live="polite">
      {photo ? (
        <div className="relative size-44 overflow-hidden rounded-3xl shadow-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element -- a local data: URL preview */}
          <img src={photo} alt="" className="size-full object-cover" />
          <div className="ai-scan absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-plate-yellow/50 to-transparent" aria-hidden />
        </div>
      ) : (
        <div className="relative flex size-24 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-plate-red/25" aria-hidden />
          <Loader2 size={44} className="animate-spin text-plate-red" aria-hidden />
        </div>
      )}

      <ol className="mt-8 w-full max-w-xs space-y-2.5">
        {steps.map((s, i) => (
          <li key={s} className={`flex items-center gap-3 transition-opacity ${i > step ? "opacity-35" : "opacity-100"}`}>
            <span className={`flex size-6 shrink-0 items-center justify-center rounded-full ${i < step ? "bg-plate-green text-white" : i === step ? "bg-plate-red text-white" : "bg-rack-line"}`}>
              {i < step ? <Check size={14} strokeWidth={3} aria-hidden /> : i === step ? <Loader2 size={14} className="animate-spin" aria-hidden /> : null}
            </span>
            <span className={i === step ? "font-semibold" : ""}>{s}</span>
          </li>
        ))}
      </ol>
      <p className="mt-6 text-sm text-chalk-muted tabular-nums">
        {task.startsWith("program") ? (seconds < 30 ? "Usually 15 to 30 seconds" : `${seconds} s, almost there`) : seconds < 15 ? "Usually 5 to 15 seconds" : `${seconds} s, almost there`}
      </p>
      {onCancel && (
        <button onClick={onCancel} className="mt-4 flex items-center gap-1.5 rounded-full bg-rack-raised px-4 py-2 text-sm text-chalk-muted">
          <X size={16} aria-hidden /> Cancel
        </button>
      )}
    </div>
  );
}
