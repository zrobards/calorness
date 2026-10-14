// Hand-built SVG bar chart: no chart library, full control over the look.
export function BarChart({
  data,
  highlightLast = true,
  formatValue = (v) => String(Math.round(v)),
  label,
  target,
}: {
  data: { label: string; value: number }[];
  highlightLast?: boolean;
  formatValue?: (v: number) => string;
  label: string;
  target?: number; // draws a dashed goal line
}) {
  const W = 320;
  const H = 150;
  const top = 22;
  const bottom = 22;
  const max = Math.max(1, target ?? 0, ...data.map((d) => d.value)) * (target ? 1.08 : 1);
  const slot = W / data.length;
  const barW = Math.min(26, slot * 0.58);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={label}>
      {target !== undefined && target > 0 && (
        <g>
          <line x1="0" x2={W} y1={H - bottom - ((H - top - bottom) * target) / max} y2={H - bottom - ((H - top - bottom) * target) / max}
            stroke="var(--color-plate-yellow)" strokeDasharray="4 4" strokeWidth="1.5" />
          <text x={W} y={H - bottom - ((H - top - bottom) * target) / max - 4} textAnchor="end" fontSize="9" fill="var(--color-plate-yellow)">
            Goal {formatValue(target)}
          </text>
        </g>
      )}
      {/* baseline */}
      <line x1="0" x2={W} y1={H - bottom} y2={H - bottom} stroke="var(--color-rack-line)" />
      {data.map((d, i) => {
        const h = ((H - top - bottom) * d.value) / max;
        const x = i * slot + (slot - barW) / 2;
        const y = H - bottom - h;
        const isLast = highlightLast && i === data.length - 1;
        return (
          <g key={i}>
            <rect
              x={x}
              y={d.value > 0 ? y : H - bottom - 2}
              width={barW}
              height={d.value > 0 ? h : 2}
              rx={Math.min(6, barW / 3)}
              fill={isLast ? "var(--color-plate-red)" : "var(--color-chalk-muted)"}
              opacity={isLast ? 1 : d.value > 0 ? 0.55 : 0.3}
            />
            {d.value > 0 && (
              <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize="10" fill="var(--color-chalk)" className="font-display" fontWeight={600}>
                {formatValue(d.value)}
              </text>
            )}
            <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--color-chalk-muted)">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
