import { describe, expect, it } from "vitest";
import { macroCheck, verifiedShare } from "./nutrition/quality";
import { suggestFits } from "./nutrition/fits";
import { dayInZone, hourInZone, isValidTimeZone, zonedDayStart } from "./time";

describe("macroCheck", () => {
  it("passes foods whose numbers add up", () => {
    expect(macroCheck({ calories: 120, proteinG: 13, carbsG: 5, fatG: 5 }).flagged).toBe(false);
  });
  it("flags foods whose numbers don't", () => {
    // the bad USDA "Greek yogurt" entry: 467 cal but macros say ~473... and a typo version
    expect(macroCheck({ calories: 467, proteinG: 3.3, carbsG: 70, fatG: 20 }).flagged).toBe(false);
    expect(macroCheck({ calories: 50, proteinG: 25, carbsG: 30, fatG: 10 }).flagged).toBe(true);
  });
});

describe("verifiedShare", () => {
  it("counts calories not from AI estimates", () => {
    expect(verifiedShare([{ calories: 300, source: "USDA" }, { calories: 100, source: "AI_ESTIMATE" }])).toBe(0.75);
    expect(verifiedShare([])).toBeNull();
  });
});

describe("suggestFits", () => {
  const foods = [
    { id: "a", name: "Greek yogurt", calories: 120, proteinG: 20, carbsG: 6, fatG: 0 },
    { id: "b", name: "Cookie", calories: 250, proteinG: 2, carbsG: 35, fatG: 12 },
    { id: "c", name: "Large pizza", calories: 2200, proteinG: 90, carbsG: 250, fatG: 90 },
  ];
  it("prefers protein-dense foods that fit", () => {
    const picks = suggestFits({ calories: 600, proteinG: 50, carbsG: 60, fatG: 20 }, foods);
    expect(picks[0].id).toBe("a");
    expect(picks.map((p) => p.id)).not.toContain("c");
  });
  it("suggests nothing when the day is done", () => {
    expect(suggestFits({ calories: 20, proteinG: 0, carbsG: 0, fatG: 0 }, foods)).toEqual([]);
  });
});

describe("time zones", () => {
  const lateNight = new Date("2026-10-15T03:30:00Z"); // 11:30 PM Oct 14 in Louisville
  it("uses the phone's zone for the day", () => {
    expect(dayInZone(lateNight, "America/New_York")).toBe("2026-10-14");
    expect(dayInZone(lateNight, "UTC")).toBe("2026-10-15");
    expect(hourInZone(lateNight, "America/New_York")).toBeCloseTo(23.5);
  });
  it("finds when a day starts, across daylight saving", () => {
    expect(zonedDayStart("2026-10-14", "America/New_York").toISOString()).toBe("2026-10-14T04:00:00.000Z");
    expect(zonedDayStart("2026-12-14", "America/New_York").toISOString()).toBe("2026-12-14T05:00:00.000Z");
    expect(zonedDayStart("2026-10-14", "America/Los_Angeles").toISOString()).toBe("2026-10-14T07:00:00.000Z");
  });
  it("validates zone names", () => {
    expect(isValidTimeZone("America/Chicago")).toBe(true);
    expect(isValidTimeZone("Mars/Base")).toBe(false);
  });
});
