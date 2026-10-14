import { describe, expect, it } from "vitest";
import { setsPerMuscle } from "./muscles";
import { compactNumber, displayWeight, toKg } from "./units";
import { startOfWeek, weeksAgo, formatDuration } from "./dates";

describe("setsPerMuscle", () => {
  it("counts primary muscles fully and secondary muscles as half", () => {
    const totals = setsPerMuscle([
      { primaryMuscles: ["chest"], secondaryMuscles: ["triceps", "shoulders"], workingSets: 4 },
      { primaryMuscles: ["triceps"], secondaryMuscles: [], workingSets: 3 },
    ]);
    expect(totals.chest).toBe(4);
    expect(totals.triceps).toBe(5);
    expect(totals.shoulders).toBe(2);
    expect(totals.quadriceps).toBe(0);
  });

  it("ignores muscle names it doesn't know", () => {
    const totals = setsPerMuscle([{ primaryMuscles: ["spleen"], secondaryMuscles: [], workingSets: 3 }]);
    expect(Object.values(totals).every((v) => v === 0)).toBe(true);
  });
});

describe("weight display", () => {
  it("round-trips a typed weight through storage", () => {
    expect(displayWeight(toKg(225, "IMPERIAL"), "IMPERIAL")).toBe(225);
    expect(displayWeight(toKg(102.5, "METRIC"), "METRIC")).toBe(102.5);
  });

  it("compacts large numbers for stat tiles", () => {
    expect(compactNumber(950)).toBe("950");
    expect(compactNumber(12_450)).toBe("12.5k");
    expect(compactNumber(250_000)).toBe("250k");
  });
});

describe("week math", () => {
  it("starts weeks on Monday", () => {
    // Sunday Oct 18 2026 belongs to the week starting Monday Oct 12
    expect(startOfWeek(new Date("2026-10-18T20:00:00Z")).toISOString()).toBe("2026-10-12T00:00:00.000Z");
  });

  it("counts whole weeks back from now", () => {
    const now = new Date("2026-10-14T12:00:00Z");
    expect(weeksAgo(new Date("2026-10-12T08:00:00Z"), now)).toBe(0);
    expect(weeksAgo(new Date("2026-10-05T08:00:00Z"), now)).toBe(1);
  });

  it("formats workout durations", () => {
    expect(formatDuration(47 * 60_000)).toBe("47m");
    expect(formatDuration(83 * 60_000)).toBe("1h 23m");
  });
});
