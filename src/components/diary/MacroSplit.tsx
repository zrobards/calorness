import { KCAL_PER_GRAM } from "@/lib/fitness/nutrition";

/** Where a food's calories come from, as one bar split by plate color. */
export function MacroSplit({ proteinG, carbsG, fatG }: { proteinG: number; carbsG: number; fatG: number }) {
  const p = proteinG * KCAL_PER_GRAM.protein;
  const c = carbsG * KCAL_PER_GRAM.carbs;
  const f = fatG * KCAL_PER_GRAM.fat;
  const total = p + c + f || 1;
  const parts = [
    { label: "Protein", grams: proteinG, kcal: p, color: "bg-plate-blue" },
    { label: "Carbs", grams: carbsG, kcal: c, color: "bg-plate-yellow" },
    { label: "Fat", grams: fatG, kcal: f, color: "bg-plate-green" },
  ];
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-rack-line" aria-hidden>
        {parts.map((x) => (
          <span key={x.label} className={x.color} style={{ width: `${(x.kcal / total) * 100}%` }} />
        ))}
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        {parts.map((x) => (
          <div key={x.label}>
            <dd className="font-display text-2xl font-bold tabular-nums">{Math.round(x.grams * 10) / 10}g</dd>
            <dt className="flex items-center justify-center gap-1.5 text-xs text-chalk-muted">
              <span className={`size-2 rounded-full ${x.color}`} aria-hidden />
              {x.label} {Math.round((x.kcal / total) * 100)}%
            </dt>
          </div>
        ))}
      </dl>
    </div>
  );
}
