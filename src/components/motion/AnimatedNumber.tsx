"use client";

import { useEffect, useRef, useState } from "react";

// Last value shown for each number, so revisiting a page doesn't replay a
// count-up from zero. Numbers only animate when they actually change
// (log a meal and "calories left" ticks down).
const lastShown = new Map<string, number>();

export function AnimatedNumber({
  value,
  id,
  duration = 600,
  decimals = 0,
}: {
  value: number;
  /** Stable name for this number, e.g. "calories-left". Without it, it counts up once. */
  id?: string;
  duration?: number;
  decimals?: number;
}) {
  const [shown, setShown] = useState(() => (id && lastShown.has(id) ? lastShown.get(id)! : value));
  const from = useRef(shown);

  useEffect(() => {
    const start = performance.now();
    const startValue = from.current;
    if (id) lastShown.set(id, value);
    if (startValue === value || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      from.current = value;
      const f = requestAnimationFrame(() => setShown(value));
      return () => cancelAnimationFrame(f);
    }
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(startValue + (value - startValue) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, id]);

  return (
    <span className="tabular-nums">
      {shown.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
    </span>
  );
}
