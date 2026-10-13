// The database stores metric. These convert for display and input.
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
