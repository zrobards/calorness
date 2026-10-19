import { describe, expect, it } from "vitest";
import { dayTargets, sumTotals, verifiedShare, type DiaryData } from "./diaryData";

const food = (calories: number, source: "USDA" | "AI_ESTIMATE" = "USDA") => ({
  source, externalId: "x", barcode: null, name: "x", brand: null, servingSize: 100, servingUnit: "g", servingLabel: null,
  calories, proteinG: 10, carbsG: 20, fatG: 5, fiberG: null, sugarG: null, sodiumMg: null,
});

describe("diary math", () => {
  it("sums servings", () => {
    expect(sumTotals([{ id: "1", servings: 2, food: food(100) }, { id: "2", servings: 0.5, food: food(200) }])).toEqual({ calories: 300, proteinG: 25, carbsG: 50, fatG: 12.5 });
  });
  it("adds exercise to the targets", () => {
    const d = { baseGoal: { calories: 2000, proteinG: 150, carbsG: 200, fatG: 70, waterMl: 2500 }, exercise: { items: [], net: 400, credit: 75, calories: 300 } } as unknown as DiaryData;
    expect(dayTargets(d)).toMatchObject({ calories: 2300, proteinG: 150, carbsG: 253, fatG: 80 });
  });
  it("measures how much is verified", () => {
    expect(verifiedShare([{ meal: "LUNCH", label: "Lunch", items: [{ id: "1", servings: 1, food: food(300) }, { id: "2", servings: 1, food: food(100, "AI_ESTIMATE") }] }])).toBe(0.75);
  });
});
