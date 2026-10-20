// The database stores metric. These convert for display and input.
/** Round to one decimal place (12.345 → 12.3). */
export const round1 = (n: number) => Math.round(n * 10) / 10;

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;
export const ML_PER_FL_OZ = 29.5735;

export const lbToKg = (lb: number) => lb * KG_PER_LB;
export const kgToLb = (kg: number) => kg / KG_PER_LB;
export const inToCm = (inches: number) => inches * CM_PER_IN;
export const cmToIn = (cm: number) => cm / CM_PER_IN;
export const flOzToMl = (oz: number) => oz * ML_PER_FL_OZ;
export const mlToFlOz = (ml: number) => ml / ML_PER_FL_OZ;

/** Round to the nearest increment, e.g. 2.5 lb plates or 1.25 kg plates. */
export function roundTo(value: number, increment: number) {
  return Math.round(value / increment) * increment;
}

export type UnitSystem = "IMPERIAL" | "METRIC";

export const weightUnit = (u: UnitSystem): "lb" | "kg" => (u === "IMPERIAL" ? "lb" : "kg");

/** Stored kg → number shown to the user, rounded to a sensible precision. */
export function displayWeight(kg: number, u: UnitSystem): number {
  const value = u === "IMPERIAL" ? kgToLb(kg) : kg;
  return Math.round(value * 10) / 10;
}

/** Number typed by the user → kg for storage. */
export function toKg(value: number, u: UnitSystem): number {
  return u === "IMPERIAL" ? lbToKg(value) : value;
}

/** Compact big numbers for stat tiles: 12,450 → "12.5k". */
export function compactNumber(n: number): string {
  if (n >= 100_000) return `${Math.round(n / 1000)}k`;
  if (n >= 10_000) return `${Math.round(n / 100) / 10}k`;
  return Math.round(n).toLocaleString("en-US");
}
