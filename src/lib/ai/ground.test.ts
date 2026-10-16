import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/nutrition/diary", () => ({ searchSavedFoods: async () => [] }));
vi.mock("@/lib/nutrition/sources", () => ({
  searchUsda: async () => [],
  searchOpenFoodFacts: async () => [],
  // USDA reference: cooked white rice, 130 cal per 100 g
  searchUsdaGeneric: async () => [
    { source: "USDA", externalId: "1", barcode: null, name: "Rice, white, cooked", brand: null, servingSize: 100, servingUnit: "g", servingLabel: "100 g", calories: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3, fiberG: null, sugarG: null, sodiumMg: null },
  ],
}));

import { groundItems } from "./ground";

const rice = { name: "White rice", portion: "1 cup", grams: 186, calories: 300, protein_g: 5, carbs_g: 60, fat_g: 1, confidence: "medium" as const };

describe("groundItems", () => {
  it("uses USDA calories per gram at the AI's portion for unpackaged food", async () => {
    const [r] = await groundItems("u1", [rice]);
    expect(r.calories).toBe(242); // 186 g × 1.30 cal/g, not the AI's 300
    expect(r.carbs_g).toBe(52.1);
    expect(r.basis?.name).toBe("Rice, white, cooked");
  });

  it("keeps the AI's numbers when the match is clearly a different food", async () => {
    const [r] = await groundItems("u1", [{ ...rice, name: "Fried rice with pork", calories: 900 }]);
    expect(r.basis).toBeUndefined();
  });
});
