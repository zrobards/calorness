import { describe, expect, it } from "vitest";
import { distanceToMeters, healthNumber, mpsToDisplay, progress, speedToMps, streak } from "./activity";

describe("reading Apple Health values", () => {
  it("handles plain numbers, thousands separators, units, and lists", () => {
    expect(healthNumber(8345)).toBe(8345);
    expect(healthNumber("8,345")).toBe(8345);
    expect(healthNumber("512 kcal")).toBe(512);
    expect(healthNumber("120\n300\n92")).toBe(512); // one sample per line
    expect(healthNumber([3.0, 3.2], "avg")).toBeCloseTo(3.1);
    expect(healthNumber("")).toBeNull();
  });
  it("converts walking speed and distance from whatever unit they arrive in", () => {
    expect(speedToMps("3.1 mph")).toBeCloseTo(1.386, 3);
    expect(speedToMps("5 km/h")).toBeCloseTo(1.389, 3);
    expect(speedToMps(5, undefined, false)).toBeCloseTo(1.389, 3); // metric user, no unit
    expect(mpsToDisplay(speedToMps("3.1 mph")!, true)).toBeCloseTo(3.1);
    expect(distanceToMeters("2.5 mi")).toBeCloseTo(4023.36);
    expect(distanceToMeters("4 km")).toBe(4000);
  });
});

describe("streaks and goals", () => {
  it("counts days in a row, without breaking on an unfinished today", () => {
    expect(streak(["2026-10-24", "2026-10-25", "2026-10-26"], "2026-10-26")).toBe(3);
    expect(streak(["2026-10-24", "2026-10-25"], "2026-10-26")).toBe(2);
    expect(streak(["2026-10-22", "2026-10-25"], "2026-10-26")).toBe(1);
    expect(streak([], "2026-10-26")).toBe(0);
  });
  it("caps progress at the goal", () => {
    expect(progress(4000, 8000)).toBe(0.5);
    expect(progress(12000, 8000)).toBe(1);
    expect(progress(null, 8000)).toBe(0);
  });
});
