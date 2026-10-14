import { describe, expect, it } from "vitest";
import { matchesFilter, searchByName } from "./muscleFilters";

const items = [
  { name: "Reverse Grip Triceps Pushdown" },
  { name: "Triceps Pushdown - Rope Attachment" },
  { name: "Triceps Pushdown" },
  { name: "Barbell Bench Press - Medium Grip" },
];

describe("searchByName", () => {
  it("puts the closest match first", () => {
    expect(searchByName(items, "triceps pushdown")[0].name).toBe("Triceps Pushdown");
  });

  it("requires every word to match", () => {
    expect(searchByName(items, "bench rope")).toEqual([]);
  });

  it("returns everything for an empty query", () => {
    expect(searchByName(items, "  ")).toHaveLength(4);
  });
});

describe("matchesFilter", () => {
  it("groups back muscles together", () => {
    expect(matchesFilter(["lats"], 2)).toBe(true);
    expect(matchesFilter(["chest"], 2)).toBe(false);
  });
});
