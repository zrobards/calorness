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

describe("aliases", () => {
  it("finds an exercise by another name", () => {
    const list = [{ name: "Butterfly", aliases: ["pec deck", "machine fly"] }, { name: "Pec Deck", aliases: [] }, { name: "Dumbbell Flyes" }];
    // the exact name wins, and the alias match comes right after it
    expect(searchByName(list, "pec deck").map((e) => e.name)).toEqual(["Pec Deck", "Butterfly"]);
    expect(searchByName(list, "machine fly")[0].name).toBe("Butterfly");
  });

  it("matches short words only at the start of a word", () => {
    const list = [{ name: "Romanian Deadlift", aliases: ["rdl"] }, { name: "Hurdle Hops" }];
    expect(searchByName(list, "rdl").map((e) => e.name)).toEqual(["Romanian Deadlift"]);
  });
});

describe("matchesFilter", () => {
  it("groups back muscles together", () => {
    expect(matchesFilter(["lats"], 2)).toBe(true);
    expect(matchesFilter(["chest"], 2)).toBe(false);
  });
});
