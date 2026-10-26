// Three rings, outside in: moving (active calories), steps, and exercise
// minutes, each filling toward its goal. Hand-built SVG like the other charts.
export function ActivityRings({ rings, size = 96 }: { rings: { value: number; color: string; label: string }[]; size?: number }) {
  const stroke = size / 9;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={rings.map((r) => `${r.label} ${Math.round(r.value * 100)}%`).join(", ")}>
      {rings.map((r, i) => {
        const radius = size / 2 - stroke / 2 - i * (stroke + 2);
        const c = 2 * Math.PI * radius;
        return (
          <g key={r.label} transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={r.color} strokeOpacity={0.18} strokeWidth={stroke} />
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={r.color} strokeWidth={stroke} strokeLinecap="round"
              strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, r.value))} className="animate-ring" />
          </g>
        );
      })}
    </svg>
  );
}
