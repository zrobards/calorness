import "server-only";
import { normalizeBarcode, normalizeOff, normalizeUsda, type FoodCandidate, type OffProduct, type UsdaFood } from "./normalize";

// Open Food Facts asks every app to identify itself
const OFF_HEADERS = { "User-Agent": "Calorness/0.1 (https://github.com/zrobards/calorness)" };
const OFF_FIELDS = "code,product_name,brands,serving_size,serving_quantity,serving_quantity_unit,nutriments";

// Free key from https://fdc.nal.usda.gov/api-key-signup. DEMO_KEY works but
// only allows a handful of searches per hour.
const usdaKey = () => process.env.USDA_API_KEY || "DEMO_KEY";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null; // one source failing shouldn't break search
  }
}

async function usdaSearch(query: string, dataType: string, pageSize: number) {
  const params = new URLSearchParams({ api_key: usdaKey(), query, pageSize: String(pageSize), dataType });
  const data = await fetchJson<{ foods?: UsdaFood[] }>(`https://api.nal.usda.gov/fdc/v1/foods/search?${params}`);
  return (data?.foods ?? []).map(normalizeUsda).filter((f): f is FoodCandidate => f !== null);
}

/**
 * Generic foods ("Yogurt, Greek, plain, nonfat") come first, then branded
 * products. In one combined search, branded items crowd the generic ones out.
 */
export async function searchUsda(query: string): Promise<FoodCandidate[]> {
  const [generic, branded] = await Promise.all([
    // Survey (FNDDS) adds restaurant and fast-food items with lab-based values
    usdaSearch(query, "Foundation,SR Legacy,Survey (FNDDS)", 8),
    usdaSearch(query, "Branded", 20),
  ]);
  return [...generic, ...branded];
}

export async function searchOpenFoodFacts(query: string): Promise<FoodCandidate[]> {
  const params = new URLSearchParams({ q: query, page_size: "20", fields: OFF_FIELDS, langs: "en" });
  const data = await fetchJson<{ hits?: OffProduct[] }>(`https://search.openfoodfacts.org/search?${params}`, { headers: OFF_HEADERS });
  return (data?.hits ?? []).map(normalizeOff).filter((f): f is FoodCandidate => f !== null);
}

export async function lookupBarcodeOnline(code: string): Promise<FoodCandidate | null> {
  const barcode = normalizeBarcode(code);
  const off = await fetchJson<{ status?: number; product?: OffProduct }>(
    `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=${OFF_FIELDS}`,
    { headers: OFF_HEADERS },
  );
  if (off?.status === 1 && off.product) {
    const food = normalizeOff({ ...off.product, code: barcode });
    if (food) return food;
  }
  // Fall back to USDA's branded foods, which are indexed by UPC
  const usda = await searchUsda(barcode.replace(/^0/, ""));
  return usda.find((f) => f.barcode === barcode) ?? null;
}
