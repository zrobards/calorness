// Turning what Apple Health (through an iPhone Shortcut) sends into clean
// numbers, plus streaks and goal progress for the Activity screens.

/**
 * Shortcuts send numbers in many shapes: 8345, "8,345", "3.1 mph",
 * "512 kcal", or a list of samples (one per line or an array). Sum-type
 * metrics add a list up; average-type metrics average it.
 */
export function healthNumber(v: unknown, combine: "sum" | "avg" = "sum"): number | null {
  const values: number[] = [];
  const add = (x: unknown) => {
    if (typeof x === "number" && Number.isFinite(x)) values.push(x);
    else if (typeof x === "string") {
      for (const part of x.split(/[\n;|]+/)) {
        const m = part.replace(/(\d),(\d{3})\b/g, "$1$2").replace(",", ".").match(/-?\d+(\.\d+)?/);
        if (m) values.push(parseFloat(m[0]));
      }
    } else if (Array.isArray(x)) x.forEach(add);
  };
  add(v);
  if (values.length === 0) return null;
  const total = values.reduce((a, b) => a + b, 0);
  return combine === "sum" ? total : total / values.length;
}

/** A unit written into the value ("3.1 mph") wins over the separate unit field. */
function unitFrom(v: unknown, fallback: string | undefined) {
  const s = (typeof v === "string" ? v : "").toLowerCase();
  return (s.match(/km\/h|kph|mph|m\/s|mi\b|miles?|km\b|kilometers?|\bm\b|meters?/)?.[0] ?? fallback ?? "").toLowerCase();
}

export function speedToMps(v: unknown, unit?: string, imperialDefault = true): number | null {
  const n = healthNumber(v, "avg");
  if (n === null) return null;
  const u = unitFrom(v, unit) || (imperialDefault ? "mph" : "km/h");
  if (u === "m/s") return n;
  if (u === "km/h" || u === "kph") return n / 3.6;
  return n * 0.44704; // mph
}

export function distanceToMeters(v: unknown, unit?: string, imperialDefault = true): number | null {
  const n = healthNumber(v, "sum");
  if (n === null) return null;
  const u = unitFrom(v, unit) || (imperialDefault ? "mi" : "km");
  if (u.startsWith("km") || u.startsWith("kilo")) return n * 1000;
  if (u === "m" || u.startsWith("meter")) return n;
  return n * 1609.344; // miles
}

export const mpsToDisplay = (mps: number, imperial: boolean) => (imperial ? mps / 0.44704 : mps * 3.6);
export const metersToDisplay = (m: number, imperial: boolean) => (imperial ? m / 1609.344 : m / 1000);

const shift = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/**
 * Days in a row ending today. Today not done yet doesn't break a streak:
 * if today has nothing, the count runs through yesterday.
 */
export function streak(days: Iterable<string>, today: string): number {
  const set = new Set(days);
  let day = set.has(today) ? today : shift(today, -1);
  let n = 0;
  while (set.has(day)) {
    n++;
    day = shift(day, -1);
  }
  return n;
}

/** 0–1 progress toward a goal (capped at 1). */
export const progress = (value: number | null | undefined, goal: number) => (goal > 0 ? Math.min(1, Math.max(0, (value ?? 0) / goal)) : 0);
