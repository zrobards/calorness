import { describe, expect, it } from "vitest";
import {
  bestSet,
  estimateOneRepMax,
  findNewRecords,
  totalVolumeKg,
} from "./strength";

describe("estimateOneRepMax", () => {
  it("returns the weight itself for a single rep", () => {
    expect(estimateOneRepMax(100, 1)).toBe(100);
  });

  it("applies the Epley formula", () => {
    // 100 × (1 + 5/30) = 116.67
    expect(estimateOneRepMax(100, 5)).toBeCloseTo(116.67, 2);
  });

  it("caps reps at 12 so high-rep sets don't inflate the estimate", () => {
    expect(estimateOneRepMax(50, 25)).toBe(estimateOneRepMax(50, 12));
  });

  it("returns 0 for empty input", () => {
    expect(estimateOneRepMax(0, 5)).toBe(0);
    expect(estimateOneRepMax(100, 0)).toBe(0);
  });
});

describe("totalVolumeKg", () => {
  it("sums weight × reps and skips warm-ups and incomplete sets", () => {
    const volume = totalVolumeKg([
      { weightKg: 40, reps: 10, type: "WARMUP" },
      { weightKg: 100, reps: 5 },
      { weightKg: 100, reps: 5 },
      { weightKg: 100, reps: 3, completed: false },
    ]);
    expect(volume).toBe(1000);
  });
});

describe("bestSet", () => {
  it("picks the set with the highest estimated 1RM", () => {
    const result = bestSet([
      { weightKg: 100, reps: 5 }, // 116.7
      { weightKg: 110, reps: 2 }, // 117.3
      { weightKg: 90, reps: 8 }, // 114.0
    ]);
    expect(result?.set.weightKg).toBe(110);
  });

  it("returns null when nothing qualifies", () => {
    expect(bestSet([{ weightKg: null, reps: 5 }])).toBeNull();
  });
});

describe("findNewRecords", () => {
  const previous = { heaviestKg: 100, bestE1rmKg: 116, bestSetVolumeKg: 800 };

  it("detects each kind of PR independently", () => {
    expect(findNewRecords(previous, [{ weightKg: 102.5, reps: 1 }])).toEqual([
      "heaviestKg",
    ]);
    expect(
      findNewRecords(previous, [{ weightKg: 90, reps: 10 }]).sort(),
    ).toEqual(["bestE1rmKg", "bestSetVolumeKg"]);
  });

  it("ignores warm-up sets", () => {
    expect(
      findNewRecords(previous, [{ weightKg: 140, reps: 1, type: "WARMUP" }]),
    ).toEqual([]);
  });
});
