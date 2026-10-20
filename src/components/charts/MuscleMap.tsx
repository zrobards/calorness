import { MUSCLE_LABELS, type MuscleRegion } from "@/lib/fitness/muscles";

// A stylized front and back body. Each muscle region lights up in plate red
// in proportion to how many sets it got. Body parts that aren't tracked
// (head, hands, feet) are drawn in the base color.

type Shape =
  | { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number; rotate?: number }
  | { kind: "rect"; x: number; y: number; w: number; h: number; r: number }
  | { kind: "path"; d: string };

const mirror = (s: Shape): Shape => {
  if (s.kind === "ellipse") return { ...s, cx: 120 - s.cx, rotate: s.rotate ? -s.rotate : undefined };
  if (s.kind === "rect") return { ...s, x: 120 - s.x - s.w };
  return s;
};
const pair = (s: Shape) => [s, mirror(s)];

const FRONT: [MuscleRegion, Shape[]][] = [
  ["neck", [{ kind: "rect", x: 53, y: 30, w: 14, h: 10, r: 4 }]],
  ["shoulders", pair({ kind: "ellipse", cx: 36, cy: 52, rx: 10, ry: 9, rotate: -20 })],
  ["chest", pair({ kind: "path", d: "M60 47 L60 74 Q49 77 42 70 Q38 60 44 50 Q51 45 60 47 Z" })],
  ["biceps", pair({ kind: "ellipse", cx: 29, cy: 76, rx: 6, ry: 13, rotate: 10 })],
  ["forearms", pair({ kind: "ellipse", cx: 22, cy: 106, rx: 5.5, ry: 15, rotate: 12 })],
  ["abdominals", [{ kind: "rect", x: 50, y: 77, w: 20, h: 42, r: 6 }]],
  ["abductors", pair({ kind: "ellipse", cx: 41, cy: 126, rx: 5, ry: 10 })],
  ["adductors", pair({ kind: "ellipse", cx: 55, cy: 143, rx: 4, ry: 12, rotate: -8 })],
  ["quadriceps", pair({ kind: "ellipse", cx: 46, cy: 153, rx: 8.5, ry: 25, rotate: 6 })],
  ["calves", pair({ kind: "ellipse", cx: 47, cy: 208, rx: 6, ry: 19, rotate: 3 })],
];

const BACK: [MuscleRegion, Shape[]][] = [
  ["neck", [{ kind: "rect", x: 53, y: 30, w: 14, h: 8, r: 4 }]],
  ["traps", [{ kind: "path", d: "M60 36 L76 46 L66 64 L60 70 L54 64 L44 46 Z" }]],
  ["shoulders", pair({ kind: "ellipse", cx: 36, cy: 52, rx: 10, ry: 9, rotate: -20 })],
  ["triceps", pair({ kind: "ellipse", cx: 29, cy: 76, rx: 6, ry: 13, rotate: 10 })],
  ["forearms", pair({ kind: "ellipse", cx: 22, cy: 106, rx: 5.5, ry: 15, rotate: 12 })],
  ["lats", pair({ kind: "path", d: "M44 58 Q40 78 49 98 L57 92 L56 70 Z" })],
  ["middle back", pair({ kind: "path", d: "M58 66 L58 90 L54 92 L53 70 Z" })],
  ["lower back", [{ kind: "rect", x: 52, y: 95, w: 16, h: 20, r: 5 }]],
  ["glutes", pair({ kind: "ellipse", cx: 51, cy: 128, rx: 9.5, ry: 11 })],
  ["hamstrings", pair({ kind: "ellipse", cx: 47, cy: 162, rx: 8, ry: 21, rotate: 4 })],
  ["calves", pair({ kind: "ellipse", cx: 47, cy: 207, rx: 7, ry: 17, rotate: 3 })],
];

function ShapeEl({ s, fill, opacity, stroke }: { s: Shape; fill: string; opacity: number; stroke?: string }) {
  const extra = stroke ? { stroke, strokeWidth: 1.6 } : {};
  if (s.kind === "ellipse")
    return (
      <ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} fill={fill} opacity={opacity} {...extra}
        transform={s.rotate ? `rotate(${s.rotate} ${s.cx} ${s.cy})` : undefined} />
    );
  if (s.kind === "rect") return <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r} fill={fill} opacity={opacity} {...extra} />;
  return <path d={s.d} fill={fill} opacity={opacity} {...extra} />;
}

function mirroredPath(d: string) {
  // flip x coordinates around the body's center line (x = 60)
  return d.replace(/(-?\d+(?:\.\d+)?)\s(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${120 - Number(x)} ${y}`);
}

function Body({ regions, sets, max, title, className = "h-64 w-auto", caption = true, onSelect, selected }: {
  regions: [MuscleRegion, Shape[]][];
  sets: Record<MuscleRegion, number>;
  max: number;
  title: string;
  className?: string;
  caption?: boolean;
  onSelect?: (m: MuscleRegion) => void; // makes each muscle tappable
  selected?: MuscleRegion | null;
}) {
  return (
    <figure className="flex flex-col items-center">
      <svg viewBox="0 0 120 236" className={className} role="img" aria-label={`${title} muscle map`}>
        {/* silhouette */}
        <g fill="var(--color-rack-line)">
          <circle cx="60" cy="17" r="12" />
          <path d="M40 42 Q60 34 80 42 L86 60 L92 92 L100 128 L94 130 L84 96 L80 120 L82 232 L66 232 L62 140 L58 140 L54 232 L38 232 L40 120 L36 96 L26 130 L20 128 L28 92 L34 60 Z" />
        </g>
        {regions.map(([muscle, shapes]) => {
          const value = sets[muscle];
          const lit = value > 0;
          const isSelected = selected === muscle;
          const group = shapes.map((s, i) => {
            const shape = s.kind === "path" && i === 1 ? { ...s, d: mirroredPath(s.d) } : s;
            return (
              <ShapeEl
                key={`${muscle}-${i}`}
                s={shape}
                fill={isSelected ? "var(--color-plate-yellow)" : lit ? "var(--color-plate-red)" : "#3d5165"}
                opacity={isSelected ? 1 : lit ? 0.35 + 0.65 * Math.min(1, value / max) : 1}
                stroke={isSelected ? "var(--color-chalk)" : undefined}
              />
            );
          });
          if (!onSelect) return group;
          const label = `${MUSCLE_LABELS[muscle]}: ${Number.isInteger(value) ? value : value.toFixed(1)} sets`;
          return (
            <g key={muscle} role="button" tabIndex={0} aria-label={label} aria-pressed={isSelected} className="cursor-pointer outline-none"
              onClick={() => onSelect(muscle)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect(muscle))}>
              <title>{label}</title>
              {group}
            </g>
          );
        })}
      </svg>
      {caption && <figcaption className="mt-1 text-xs text-chalk-muted">{title}</figcaption>}
    </figure>
  );
}

export function MuscleMap({ sets, onSelect, selected }: { sets: Record<MuscleRegion, number>; onSelect?: (m: MuscleRegion) => void; selected?: MuscleRegion | null }) {
  const max = Math.max(10, ...Object.values(sets)); // ~10 sets/week reads as fully trained
  const ranked = (Object.entries(sets) as [MuscleRegion, number][])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <div className="flex justify-center gap-2">
        <Body regions={FRONT} sets={sets} max={max} title="Front" onSelect={onSelect} selected={selected} />
        <Body regions={BACK} sets={sets} max={max} title="Back" onSelect={onSelect} selected={selected} />
      </div>
      {ranked.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
          {ranked.slice(0, onSelect ? 17 : 8).map(([m, v]) => (
            <li key={m}>
              {onSelect ? (
                <button onClick={() => onSelect(m)} aria-pressed={selected === m}
                  className={`-mx-2 flex w-[calc(100%+1rem)] items-center justify-between rounded-lg px-2 py-1 text-left ${selected === m ? "bg-plate-yellow/20" : "active:bg-rack-line/40"}`}>
                  <span>{MUSCLE_LABELS[m]}</span>
                  <span className="font-display font-semibold tabular-nums">{Number.isInteger(v) ? v : v.toFixed(1)} sets ›</span>
                </button>
              ) : (
                <span className="flex items-center justify-between">
                  <span>{MUSCLE_LABELS[m]}</span>
                  <span className="font-display font-semibold tabular-nums">{Number.isInteger(v) ? v : v.toFixed(1)} sets</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Stand-in for exercises without a photo: a small figure with the main
 * muscles lit, shown from whichever side those muscles are on.
 */
export function MuscleFigure({ muscles, className = "h-full w-auto" }: { muscles: string[]; className?: string }) {
  const sets = Object.fromEntries([...FRONT, ...BACK].map(([m]) => [m, 0])) as Record<MuscleRegion, number>;
  for (const m of muscles) if (m in sets) sets[m as MuscleRegion] = 10;
  const onBack = BACK.some(([m]) => sets[m] > 0) && !FRONT.some(([m]) => sets[m] > 0);
  return <Body regions={onBack ? BACK : FRONT} sets={sets} max={10} title={onBack ? "Back" : "Front"} className={className} caption={false} />;
}
