import { AnimatedNumber } from "@/components/motion/AnimatedNumber";

// The day at a glance: a ring that fills in plate red as you eat, with the
// calories you have left in the middle.
export function CalorieRing({ eaten, goal }: { eaten: number; goal: number }) {
  const size = 200;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = goal > 0 ? eaten / goal : 0;
  const over = eaten > goal;
  const remaining = Math.round(goal - eaten);

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-rack-line)" strokeWidth={stroke} />
        {/* tick marks like the rim of a plate */}
        {Array.from({ length: 40 }, (_, i) => (
          <line
            key={i}
            x1={size / 2 + (r - stroke / 2 - 6) * Math.cos((i / 40) * 2 * Math.PI)}
            y1={size / 2 + (r - stroke / 2 - 6) * Math.sin((i / 40) * 2 * Math.PI)}
            x2={size / 2 + (r - stroke / 2 - 10) * Math.cos((i / 40) * 2 * Math.PI)}
            y2={size / 2 + (r - stroke / 2 - 10) * Math.sin((i / 40) * 2 * Math.PI)}
            stroke="var(--color-rack-line)"
            strokeWidth="2"
          />
        ))}
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={over ? "var(--color-plate-yellow)" : "var(--color-plate-red)"}
          strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, pct))}
          className="animate-ring transition-[stroke-dashoffset] duration-700 ease-out"
          style={{ "--ring-full": c } as React.CSSProperties}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-display text-5xl leading-none font-bold"><AnimatedNumber value={Math.abs(remaining)} /></span>
        <span className={`mt-1 text-sm ${over ? "text-plate-yellow" : "text-chalk-muted"}`}>{over ? "calories over" : "calories left"}</span>
      </div>
      <p className="sr-only">
        {Math.round(eaten)} of {goal} calories eaten.
      </p>
    </div>
  );
}
