// Support for the "Health Auto Export" iPhone app, which can send Apple
// Health data to a web address on a schedule. Its REST automations post JSON
// like: { data: { metrics: [ { name: "step_count", units: "count",
//   data: [ { date: "2026-10-26 00:00:00 -0400", qty: 8345 } ] } ] } }
// This turns that into the same per-day shape the Shortcut sends.

type Point = { date?: string; qty?: number; Avg?: number; avg?: number };
type Metric = { name?: string; units?: string; data?: Point[] };

export function isHealthAutoExport(body: unknown): boolean {
  const m = (body as { data?: { metrics?: unknown } })?.data?.metrics;
  return Array.isArray(m);
}

const FIELD: Record<string, { key: string; avg?: boolean }> = {
  step_count: { key: "steps" },
  active_energy: { key: "activeCalories" },
  apple_exercise_time: { key: "exerciseMinutes" },
  walking_running_distance: { key: "distance" },
  walking_speed: { key: "walkingSpeed", avg: true },
  resting_heart_rate: { key: "restingHeartRate", avg: true },
  flights_climbed: { key: "flights" },
};

/** Per-day totals in the /api/health format, with units spelled out. */
export function fromHealthAutoExport(body: unknown) {
  const metrics = ((body as { data: { metrics: Metric[] } }).data.metrics ?? []) as Metric[];
  const days = new Map<string, Record<string, unknown>>();
  for (const m of metrics) {
    const f = FIELD[(m.name ?? "").toLowerCase()];
    if (!f || !Array.isArray(m.data)) continue;
    const units = (m.units ?? "").toLowerCase();
    const byDay = new Map<string, number[]>();
    for (const p of m.data) {
      const day = (p.date ?? "").slice(0, 10);
      const v = p.qty ?? p.Avg ?? p.avg;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || typeof v !== "number" || !Number.isFinite(v)) continue;
      byDay.set(day, [...(byDay.get(day) ?? []), v]);
    }
    for (const [day, values] of byDay) {
      let v = f.avg ? values.reduce((a, b) => a + b, 0) / values.length : values.reduce((a, b) => a + b, 0);
      if (f.key === "activeCalories" && units === "kj") v /= 4.184; // kilojoules to calories
      const row = days.get(day) ?? { day };
      row[f.key] = v;
      if (f.key === "distance") row.distanceUnit = units.startsWith("km") ? "km" : units === "m" ? "m" : "mi";
      if (f.key === "walkingSpeed") row.speedUnit = units.startsWith("km") ? "km/h" : units === "m/s" ? "m/s" : "mph";
      days.set(day, row);
    }
  }
  return [...days.values()].sort((a, b) => String(a.day).localeCompare(String(b.day)));
}
