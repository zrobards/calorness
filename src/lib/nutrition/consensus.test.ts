import { describe, expect, it } from "vitest";
import { agree, consensus, correctionFactor, entryKey, plausible, type Entry } from "./consensus";

const nuggets = (userId: string, calories = 130, protein = 25, servingLabel = "8 count"): Entry => ({
  userId, name: "Grilled Nuggets", brand: "Chick-fil-A", servingLabel, servingSize: 1, servingUnit: "serving", calories, proteinG: protein, carbsG: 1, fatG: 3,
});

describe("entryKey", () => {
  it("treats different spellings of the same branded food as one", () => {
    expect(entryKey({ name: "Grilled Nuggets", brand: "Chick-fil-A" })).toBe(entryKey({ name: "grilled nugget", brand: "chickfila" }));
    expect(entryKey({ name: "Grilled Nuggets", brand: "Chick-fil-A" })).not.toBe(entryKey({ name: "Grilled Nuggets", brand: null }));
  });
});

describe("consensus", () => {
  it("needs two different people who agree", () => {
    expect(consensus(nuggets("a"), [])).toBeNull();
    expect(consensus(nuggets("a"), [nuggets("a", 131)])).toBeNull(); // same person twice doesn't count
    const c = consensus(nuggets("a"), [nuggets("b", 132, 25)]);
    expect(c?.people).toBe(2);
    expect(c?.calories).toBe(131);
  });

  it("ignores entries that disagree or describe a different serving", () => {
    expect(consensus(nuggets("a"), [nuggets("b", 200)])).toBeNull();
    expect(consensus(nuggets("a"), [nuggets("b", 130, 25, "12 count")])).toBeNull();
  });

  it("uses the median so one typo can't skew the shared numbers", () => {
    const c = consensus(nuggets("a", 130), [nuggets("b", 128), nuggets("c", 140), nuggets("d", 1300)]);
    expect(c?.people).toBe(3);
    expect(c?.calories).toBe(130);
  });

  it("compares weighed foods per 100 g", () => {
    const rice = (userId: string, g: number, cal: number): Entry => ({ userId, name: "Rice", brand: null, servingLabel: null, servingSize: g, servingUnit: "g", calories: cal, proteinG: (2.7 * g) / 100, carbsG: (28 * g) / 100, fatG: (0.3 * g) / 100 });
    expect(agree(rice("a", 100, 130), rice("b", 200, 262))).toBe(true);
  });

  it("rejects impossible entries", () => {
    expect(plausible({ ...nuggets("a"), calories: 900, proteinG: 2, carbsG: 2, fatG: 2 })).toBe(false);
  });
});

describe("correctionFactor", () => {
  const c = (userId: string, ai: number, final: number) => ({ userId, aiCalories: ai, finalCalories: final, aiProteinG: 30, finalProteinG: 30 * (final / ai) });

  it("adjusts when several people consistently correct in the same direction", () => {
    const f = correctionFactor([c("a", 600, 720), c("b", 650, 760), c("c", 580, 690)]);
    expect(f?.calories).toBeCloseTo(1.18, 1);
    expect(f?.people).toBe(3);
  });

  it("stays out of it with too few people, small differences, or mixed signals", () => {
    expect(correctionFactor([c("a", 600, 720), c("b", 600, 720)])).toBeNull();
    expect(correctionFactor([c("a", 600, 620), c("b", 600, 610), c("c", 600, 615)])).toBeNull();
    expect(correctionFactor([c("a", 600, 800), c("b", 600, 450), c("c", 600, 780), c("d", 600, 420)])).toBeNull();
  });

  it("limits the adjustment to ±40%", () => {
    expect(correctionFactor([c("a", 300, 900), c("b", 300, 950), c("c", 300, 1000)])?.calories).toBe(1.4);
  });
});
