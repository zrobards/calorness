// The signature element: each number the app tracks gets its bumper-plate
// color, and fills like loading plates onto a bar.
type Macro = { label: string; eaten: number; goal: number; unit: string; color: string };

export function MacroBars({
  eaten,
  goal,
  showCalories = true,
}: {
  showCalories?: boolean; // hide when a calorie ring already shows it
  eaten: { calories: number; proteinG: number; carbsG: number; fatG: number };
  goal: { calories: number; proteinG: number; carbsG: number; fatG: number };
}) {
  const macros: Macro[] = [
    { label: "Calories", eaten: eaten.calories, goal: goal.calories, unit: "", color: "bg-plate-yellow" },
    { label: "Protein", eaten: eaten.proteinG, goal: goal.proteinG, unit: "g", color: "bg-plate-blue" },
    { label: "Carbs", eaten: eaten.carbsG, goal: goal.carbsG, unit: "g", color: "bg-plate-yellow" },
    { label: "Fat", eaten: eaten.fatG, goal: goal.fatG, unit: "g", color: "bg-plate-green" },
  ];

  return (
    <div className="space-y-4">
      {macros.filter((m) => showCalories || m.label !== "Calories").map((m) => {
        const pct = m.goal > 0 ? Math.min(100, (m.eaten / m.goal) * 100) : 0;
        const left = Math.max(0, Math.round(m.goal - m.eaten));
        return (
          <div key={m.label}>
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="font-medium">{m.label}</span>
              <span className="text-sm text-chalk-muted">
                <span className="font-display text-lg font-semibold text-chalk tabular-nums">
                  {left.toLocaleString()}
                  {m.unit}
                </span>{" "}
                left of {m.goal.toLocaleString()}
                {m.unit}
              </span>
            </div>
            <div
              className="h-3 overflow-hidden rounded-full bg-rack-line"
              role="progressbar"
              aria-label={`${m.label} eaten`}
              aria-valuenow={Math.round(m.eaten)}
              aria-valuemin={0}
              aria-valuemax={m.goal}
            >
              <div className={`animate-grow-x h-full rounded-full ${m.color}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
