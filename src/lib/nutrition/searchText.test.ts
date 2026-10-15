import { describe, expect, it } from "vitest";
import { brandInQuery, compact, expandQuery, groupKey, normalize, textMatch } from "./searchText";

describe("food search text", () => {
  it("normalizes punctuation, apostrophes, and case", () => {
    expect(normalize("Chick-fil-A® Nuggets (8 ct)")).toBe("chick fil a nuggets 8 ct");
    expect(compact("McDonald's")).toBe("mcdonalds");
  });

  it("expands brand spellings people actually type", () => {
    expect(expandQuery("chickfila nuggets")).toBe("chick-fil-a nuggets");
    expect(expandQuery("chick fil a nuggets")).toBe("chick-fil-a nuggets");
    expect(expandQuery("mcdonalds fries")).toBe("mcdonald's fries");
    expect(expandQuery("greek yogurt")).toBe("greek yogurt");
    expect(expandQuery("chikfila nugets")).toBe("chick-fil-a nugets"); // brand typo fixed
  });

  it("matches no matter how the brand is written", () => {
    const food = { name: "Chick-fil-A Nuggets, 8 Count", brand: null };
    expect(textMatch("chickfila nuggets", food)).toBeGreaterThan(0.9);
    expect(textMatch("chick fil a nugget", food)).toBeGreaterThan(0.9);
    expect(textMatch("chikfila nugets", food)).toBeGreaterThan(0.6); // typos
    expect(textMatch("mcdonalds nuggets", food)).toBeLessThan(0.6);
  });
});

describe("duplicates and brands", () => {
  it("groups the same food written different ways", () => {
    const a = groupKey({ name: "Chick-fil-A Sauce, 16 Fl Oz", brand: "Chick-Fil-A" });
    const b = groupKey({ name: "Chick Fil A Sauce", brand: null });
    const c = groupKey({ name: "Sauce", brand: "Chick-fil-A" });
    expect(a).toBe("sauce");
    expect(b).toBe("sauce");
    expect(c).toBe("sauce");
    expect(groupKey({ name: "Polynesian Sauce", brand: "Chick-fil-A" })).not.toBe("sauce");
  });

  it("finds the brand in a search", () => {
    expect(brandInQuery("chickfila nuggets")).toBe("Chick-fil-A");
    expect(brandInQuery("greek yogurt")).toBeNull();
  });
});
