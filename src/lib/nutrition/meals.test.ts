import { describe, expect, it } from "vitest";
import { localDay, mealForTime } from "./meals";

const at = (h: number, m = 0) => new Date(2026, 9, 14, h, m);

describe("mealForTime", () => {
  it("picks meals by time of day", () => {
    expect(mealForTime(at(7))).toBe("BREAKFAST");
    expect(mealForTime(at(12, 30))).toBe("LUNCH");
    expect(mealForTime(at(15, 30))).toBe("SNACKS");
    expect(mealForTime(at(19))).toBe("DINNER");
    expect(mealForTime(at(23))).toBe("SNACKS");
  });
});

describe("localDay", () => {
  it("formats the local calendar day", () => {
    expect(localDay(at(23, 59))).toBe("2026-10-14");
  });
});
