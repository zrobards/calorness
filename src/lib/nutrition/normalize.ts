// Turns raw USDA and Open Food Facts API responses into one consistent shape.
// Both APIs report nutrients per 100 g (or 100 ml); we convert to "per
// serving" using the label's serving size when there is one.

export type FoodSourceName = "USDA" | "OPEN_FOOD_FACTS" | "CUSTOM";

export type FoodCandidate = {
  id?: string; // set when the food is already saved in our database
  source: FoodSourceName;
  externalId: string | null;
  barcode: string | null;
  name: string;
  brand: string | null;
  servingSize: number;
  servingUnit: string;
  servingLabel: string | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  sugarG: number | null;
  sodiumMg: number | null;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/** USDA brand names come in ALL CAPS; make them readable. */
export function tidyName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (trimmed !== trimmed.toUpperCase()) return trimmed;
  return trimmed.toLowerCase().replace(/(^|[\s(\-/&])([a-z])/g, (_, sep, c) => sep + c.toUpperCase());
}

function perServing(per100: Record<string, number | null>, servingSize: number) {
  const f = servingSize / 100;
  const scale = (v: number | null) => (v === null ? null : round1(v * f));
  return {
    calories: Math.round((per100.calories ?? 0) * f),
    proteinG: scale(per100.proteinG) ?? 0,
    carbsG: scale(per100.carbsG) ?? 0,
    fatG: scale(per100.fatG) ?? 0,
    fiberG: scale(per100.fiberG),
    sugarG: scale(per100.sugarG),
    sodiumMg: per100.sodiumMg === null ? null : Math.round(per100.sodiumMg * f),
  };
}

// ─── USDA FoodData Central ────────────────────────────────────────────────

export type UsdaFood = {
  fdcId: number;
  description: string;
  dataType?: string;
  brandOwner?: string;
  brandName?: string;
  gtinUpc?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  foodNutrients: { nutrientId: number; value?: number; unitName?: string }[];
};

const USDA_IDS = { energy: 1008, energyAtwaterSpecific: 2048, energyAtwaterGeneral: 2047, protein: 1003, fat: 1004, carbs: 1005, fiber: 1079, sugar: 2000, sodium: 1093 };

export function normalizeUsda(food: UsdaFood): FoodCandidate | null {
  const get = (id: number) => {
    const n = food.foodNutrients.find((x) => x.nutrientId === id && typeof x.value === "number");
    if (!n) return null;
    // A few records report energy in kJ instead of kcal
    return n.unitName?.toUpperCase() === "KJ" ? n.value! / 4.184 : n.value!;
  };
  const calories = get(USDA_IDS.energy) ?? get(USDA_IDS.energyAtwaterSpecific) ?? get(USDA_IDS.energyAtwaterGeneral);
  const proteinG = get(USDA_IDS.protein);
  const carbsG = get(USDA_IDS.carbs);
  const fatG = get(USDA_IDS.fat);
  if (calories === null && proteinG === null && carbsG === null && fatG === null) return null;

  const unit = (food.servingSizeUnit ?? "").toLowerCase();
  const metricUnit = unit === "g" || unit === "grm" ? "g" : unit === "ml" || unit === "mlt" ? "ml" : null;
  const hasServing = !!food.servingSize && food.servingSize > 0 && metricUnit !== null;
  const servingSize = hasServing ? round1(food.servingSize!) : 100;
  const servingUnit = hasServing ? metricUnit! : "g";
  const household = food.householdServingFullText?.trim();
  const servingLabel = hasServing
    ? household ? `${household.toLowerCase()} (${servingSize} ${servingUnit})` : `${servingSize} ${servingUnit}`
    : "100 g";

  return {
    source: "USDA",
    externalId: String(food.fdcId),
    barcode: food.gtinUpc ? normalizeBarcode(food.gtinUpc) : null,
    name: tidyName(food.description),
    brand: food.brandName || food.brandOwner ? tidyName(food.brandName || food.brandOwner!) : null,
    servingSize,
    servingUnit,
    servingLabel,
    ...perServing(
      { calories, proteinG, carbsG, fatG, fiberG: get(USDA_IDS.fiber), sugarG: get(USDA_IDS.sugar), sodiumMg: get(USDA_IDS.sodium) },
      servingSize,
    ),
  };
}

// ─── Open Food Facts ──────────────────────────────────────────────────────

export type OffProduct = {
  code: string;
  product_name?: string;
  brands?: string | string[];
  serving_size?: string;
  serving_quantity?: number | string;
  serving_quantity_unit?: string;
  nutriments?: Record<string, number | string | undefined>;
};

export function normalizeOff(p: OffProduct): FoodCandidate | null {
  const n = p.nutriments ?? {};
  const num = (k: string) => {
    const v = n[k];
    const x = typeof v === "string" ? Number(v) : v;
    return typeof x === "number" && Number.isFinite(x) ? x : null;
  };
  const kj = num("energy_100g");
  const calories = num("energy-kcal_100g") ?? (kj !== null ? kj / 4.184 : null);
  const proteinG = num("proteins_100g");
  const carbsG = num("carbohydrates_100g");
  const fatG = num("fat_100g");
  const name = p.product_name?.trim();
  if (!name || (calories === null && proteinG === null && carbsG === null && fatG === null)) return null;

  const qty = Number(p.serving_quantity);
  const hasServing = Number.isFinite(qty) && qty > 0;
  const servingSize = hasServing ? round1(qty) : 100;
  const servingUnit = (p.serving_quantity_unit ?? "g").toLowerCase() === "ml" ? "ml" : "g";
  const sodiumG = num("sodium_100g");
  const brand = Array.isArray(p.brands) ? p.brands[0] : p.brands?.split(",")[0];

  return {
    source: "OPEN_FOOD_FACTS",
    externalId: p.code,
    barcode: normalizeBarcode(p.code),
    name: tidyName(name),
    brand: brand?.trim() ? tidyName(brand) : null,
    servingSize,
    servingUnit,
    servingLabel: hasServing ? (p.serving_size?.trim() || `${servingSize} ${servingUnit}`) : `100 ${servingUnit}`,
    ...perServing(
      { calories, proteinG, carbsG, fatG, fiberG: num("fiber_100g"), sugarG: num("sugars_100g"), sodiumMg: sodiumG === null ? null : sodiumG * 1000 },
      servingSize,
    ),
  };
}

/** Normalize a scanned barcode so UPC-A (12 digits) and EAN-13 (13 digits) match. */
export function normalizeBarcode(code: string): string {
  const digits = code.replace(/\D/g, "");
  return digits.length === 12 ? `0${digits}` : digits;
}
