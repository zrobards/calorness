"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { haptic } from "@/lib/haptics";

// The two things that tick every second live in their own small components,
// so the clock doesn't re-render every set row (which made typing laggy).

export const nowMs = () => Date.now();

export function formatClock(ms: number) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0");
  return h ? `${h}:${mm}:${String(s).padStart(2, "0")}` : `${mm}:${String(s).padStart(2, "0")}`;
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(nowMs);
  useEffect(() => {
    const t = setInterval(() => setNow(nowMs()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** "12:34" since the workout started. */
export function ElapsedClock({ startedAt }: { startedAt: string }) {
  const now = useNow(1000);
  return <>{formatClock(Math.max(0, now - new Date(startedAt).getTime()))}</>;
}

/** The floating rest timer. Calls onDone a moment after it reaches zero. */
export function RestTimer({ endsAt, total, onAdjust, onSkip, onDone }: {
  endsAt: number;
  total: number;
  onAdjust: (seconds: number) => void;
  onSkip: () => void;
  onDone: () => void;
}) {
  const now = useNow(250);
  const left = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const done = left === 0;

  useEffect(() => {
    if (!done) return;
    haptic("warning");
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, [done, onDone]);

  const r = 26;
  const circumference = 2 * Math.PI * r;
  const progress = total > 0 ? left / total : 0;
  return (
    <div className="fixed inset-x-0 z-30 px-3" style={{ bottom: "calc(env(safe-area-inset-bottom) + 4.75rem + var(--music-dock-h, 0px))" }}
      role="timer" aria-live="polite" aria-label={done ? "Rest over" : `Rest ${left} seconds left`}>
      <div className={`mx-auto flex max-w-md items-center gap-4 rounded-2xl border px-4 py-3 shadow-2xl ${done ? "border-plate-green bg-plate-green/20" : "border-rack-line bg-rack-raised"}`}>
        <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden className="-rotate-90">
          <circle cx="32" cy="32" r={r} fill="none" stroke="var(--color-rack-line)" strokeWidth="6" />
          <circle cx="32" cy="32" r={r} fill="none" stroke="var(--color-plate-blue)" strokeWidth="6" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)}
            className="transition-[stroke-dashoffset] duration-300 ease-linear" />
        </svg>
        <div className="flex-1">
          <p className="text-xs text-chalk-muted">{done ? "Rest over" : "Resting"}</p>
          <p className="font-display text-4xl leading-none font-bold tabular-nums">{done ? "Go" : formatClock(left * 1000)}</p>
        </div>
        {!done && (
          <>
            <button onClick={() => onAdjust(-15)} className="rounded-lg bg-rack px-2.5 py-2 text-sm font-medium" aria-label="15 seconds less">−15</button>
            <button onClick={() => onAdjust(15)} className="rounded-lg bg-rack px-2.5 py-2 text-sm font-medium" aria-label="15 seconds more">+15</button>
          </>
        )}
        <button onClick={onSkip} className="p-1.5 text-chalk-muted" aria-label="Close rest timer"><X size={20} /></button>
      </div>
    </div>
  );
}
