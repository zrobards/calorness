// Hand-built SVG line chart with a soft fill under the line.
export function LineChart({
  points,
  color = "var(--color-plate-blue)",
  label,
  formatValue = (v) => String(Math.round(v)),
  id,
}: {
  points: { x: number; y: number; label?: string }[];
  color?: string;
  label: string;
  formatValue?: (v: number) => string;
  id: string; // unique per chart so gradient ids don't collide
}) {
  const W = 320;
  const H = 150;
  const pad = { top: 16, bottom: 22, left: 6, right: 38 };
  if (points.length === 0) return null;

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const [minX, maxX] = [Math.min(...xs), Math.max(...xs)];
  let [minY, maxY] = [Math.min(...ys), Math.max(...ys)];
  const spread = Math.max(maxY - minY, maxY * 0.04, 1);
  minY -= spread * 0.25;
  maxY += spread * 0.25;

  const sx = (x: number) => pad.left + ((x - minX) / Math.max(1, maxX - minX)) * (W - pad.left - pad.right);
  const sy = (y: number) => pad.top + (1 - (y - minY) / (maxY - minY)) * (H - pad.top - pad.bottom);

  const path = points.map((p, i) => `${i ? "L" : "M"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ");
  const area = `${path} L${sx(maxX)},${H - pad.bottom} L${sx(minX)},${H - pad.bottom} Z`;
  const last = points[points.length - 1];
  const gridValues = [maxY - spread * 0.25, (maxY + minY) / 2, minY + spread * 0.25];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={label}>
      <defs>
        <linearGradient id={`fill-${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {gridValues.map((v) => (
        <g key={v}>
          <line x1={pad.left} x2={W - pad.right} y1={sy(v)} y2={sy(v)} stroke="var(--color-rack-line)" strokeDasharray="2 4" />
          <text x={W - pad.right + 4} y={sy(v) + 3} fontSize="9" fill="var(--color-chalk-muted)">
            {formatValue(v)}
          </text>
        </g>
      ))}
      <path d={area} fill={`url(#fill-${id})`} />
      <path d={path} pathLength={1} className="animate-draw" fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {points.length < 30 &&
        points.map((p, i) => <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="2.5" fill={color} />)}
      <circle cx={sx(last.x)} cy={sy(last.y)} r="5" fill={color} stroke="var(--color-rack-raised)" strokeWidth="2" />
      {points[0].label && (
        <text x={pad.left} y={H - 6} fontSize="10" fill="var(--color-chalk-muted)">{points[0].label}</text>
      )}
      {last.label && points.length > 1 && (
        <text x={W - pad.right} y={H - 6} fontSize="10" textAnchor="end" fill="var(--color-chalk-muted)">{last.label}</text>
      )}
    </svg>
  );
}
