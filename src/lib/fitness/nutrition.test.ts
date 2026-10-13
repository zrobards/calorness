import { describe, expect, it } from "vitest";
import {
  bmrMifflinStJeor,
  caloriesFromMacros,
  macroTargets,
  scaleNutrients,
  tdee,
} from "./nutrition";
import { kgToLb, lbToKg, roundTo } from "./units";

describe("bmrMifflinStJeor", () => {
  it("matches the published equation for men and women", () => {
    const body = { weightKg: 80, heightCm: 180, ageYears: 20 };
    // 10*80 + 6.25*180 - 5*20 = 1825
    expect(bmrMifflinStJeor({ ...body, sex: "male" })).toBe(1830);
    expect(bmrMifflinStJeor({ ...body, sex: "female" })).toBe(1664);
  });
});

describe("tdee", () => {
  it("multiplies BMR by the activity factor", () => {
    expect(tdee(2000, "moderate")).toBe(3100);
  });
});

describe("macroTargets", () => {
  it("builds targets whose macros add back up to the calorie goal", () => {
    const t = macroTargets({ maintenanceKcal: 2800, weightKg: 80, goal: "MAINTAIN" });
    expect(t.calories).toBe(2800);
    expect(t.proteinG).toBe(144);
    // rounding can drift a few calories, but never more than ~10
    expect(Math.abs(caloriesFromMacros(t) - t.calories)).toBeLessThan(10);
  });

  it("raises protein and lowers calories when cutting", () => {
    const cut = macroTargets({ maintenanceKcal: 2800, weightKg: 80, goal: "LOSE" });
    expect(cut.calories).toBe(2300);
    expect(cut.proteinG).toBe(176);
  });
});

describe("scaleNutrients", () => {
  it("multiplies every nutrient by servings", () => {
    const food = { calories: 200, proteinG: 10, carbsG: 20, fatG: 8 };
    expect(scaleNutrients(food, 1.5)).toEqual({
      calories: 300,
      proteinG: 15,
      carbsG: 30,
      fatG: 12,
    });
  });
});

describe("unit conversion", () => {
  it("round-trips pounds and kilograms", () => {
    expect(kgToLb(lbToKg(225))).toBeCloseTo(225, 10);
    expect(lbToKg(100)).toBeCloseTo(45.359, 3);
  });

  it("rounds to plate increments", () => {
    expect(roundTo(137.3, 2.5)).toBe(137.5);
  });
});
