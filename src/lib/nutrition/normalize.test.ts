import { describe, expect, it } from "vitest";
import { normalizeBarcode, normalizeOff, normalizeUsda, plausiblePer100, tidyName } from "./normalize";

describe("normalizeUsda", () => {
  const chobani = {
    fdcId: 2038865,
    description: "GREEK YOGURT",
    brandOwner: "Chobani, Inc.",
    servingSize: 150,
    servingSizeUnit: "g",
    householdServingFullText: "1 CONTAINER",
    foodNutrients: [
      { nutrientId: 1008, value: 80, unitName: "KCAL" },
      { nutrientId: 1003, value: 8.67, unitName: "G" },
      { nutrientId: 1005, value: 10.7, unitName: "G" },
      { nutrientId: 1004, value: 0, unitName: "G" },
      { nutrientId: 1093, value: 43, unitName: "MG" },
    ],
  };

  it("converts per-100 g values to the label serving", () => {
    const f = normalizeUsda(chobani)!;
    expect(f.servingSize).toBe(150);
    expect(f.calories).toBe(120);
    expect(f.proteinG).toBe(13);
    expect(f.sodiumMg).toBe(65);
    expect(f.servingLabel).toBe("1 container (150 g)");
  });

  it("tidies ALL CAPS names and brands", () => {
    const f = normalizeUsda(chobani)!;
    expect(f.name).toBe("Greek Yogurt");
    expect(f.brand).toBe("Chobani, Inc.");
  });

  it("falls back to 100 g when there is no serving size", () => {
    const f = normalizeUsda({ fdcId: 1, description: "Banana, raw", foodNutrients: [{ nutrientId: 2047, value: 89 }] })!;
    expect(f.servingSize).toBe(100);
    expect(f.calories).toBe(89);
    expect(f.servingLabel).toBe("100 g");
  });

  it("converts kilojoules to calories", () => {
    const f = normalizeUsda({ fdcId: 2, description: "Test", foodNutrients: [{ nutrientId: 1008, value: 418.4, unitName: "kJ" }] })!;
    expect(f.calories).toBe(100);
  });

  it("skips foods with no nutrition data", () => {
    expect(normalizeUsda({ fdcId: 3, description: "Mystery", foodNutrients: [] })).toBeNull();
  });
});

describe("normalizeOff", () => {
  it("uses the serving quantity and converts sodium to mg", () => {
    const f = normalizeOff({
      code: "0856312002771",
      product_name: "Fairlife Milk",
      brands: "Fairlife,Coca-Cola",
      serving_size: "1 cup (240 ml)",
      serving_quantity: 240,
      serving_quantity_unit: "ml",
      nutriments: { "energy-kcal_100g": 50, proteins_100g: 5.42, carbohydrates_100g: 2.5, fat_100g: 1.88, sodium_100g: 0.05 },
    })!;
    expect(f.servingSize).toBe(240);
    expect(f.servingUnit).toBe("ml");
    expect(f.calories).toBe(120);
    expect(f.proteinG).toBe(13);
    expect(f.sodiumMg).toBe(120);
    expect(f.brand).toBe("Fairlife");
    expect(f.servingLabel).toBe("1 cup (240 ml)");
  });

  it("skips products without a name or nutrients", () => {
    expect(normalizeOff({ code: "1", product_name: "", nutriments: { "energy-kcal_100g": 50 } })).toBeNull();
    expect(normalizeOff({ code: "1", product_name: "Air", nutriments: {} })).toBeNull();
  });
});

describe("helpers", () => {
  it("leaves mixed-case names alone", () => {
    expect(tidyName("Fairlife Milk")).toBe("Fairlife Milk");
  });

  it("matches UPC-A and EAN-13 barcodes", () => {
    expect(normalizeBarcode("049000028911")).toBe("0049000028911");
    expect(normalizeBarcode("0049000028911")).toBe("0049000028911");
  });
});

describe("plausiblePer100", () => {
  it("accepts real foods, including pure oil", () => {
    expect(plausiblePer100({ calories: 250, proteinG: 24, carbsG: 10, fatG: 12 })).toBe(true); // nuggets
    expect(plausiblePer100({ calories: 884, proteinG: 0, carbsG: 0, fatG: 100 })).toBe(true); // olive oil
  });
  it("rejects impossible entries", () => {
    expect(plausiblePer100({ calories: 1046, proteinG: 24, carbsG: 10, fatG: 12 })).toBe(false); // kJ typed as kcal
    expect(plausiblePer100({ calories: 250, proteinG: 80, carbsG: 60, fatG: 10 })).toBe(false); // over 100 g of macros
    expect(plausiblePer100({ calories: 900, proteinG: 24, carbsG: 10, fatG: 12 })).toBe(false); // calories way above macros
  });
  it("drops implausible Open Food Facts products during normalizing", () => {
    expect(normalizeOff({ code: "1", product_name: "Nuggets", nutriments: { "energy-kcal_100g": 2000, proteins_100g: 15, carbohydrates_100g: 15, fat_100g: 15 } })).toBeNull();
  });
});
