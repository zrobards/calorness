import { describe, expect, it } from "vitest";
import { suggestNext } from "./progression";

const sets = (...pairs: [number, number][]) => pairs.map(([weight, reps]) => ({ weight, reps, type: "NORMAL" }));

describe("suggestNext", () => {
  it("adds a rep while you're inside the rep range", () => {
    const s = suggestNext({ previous: sets([185, 8], [185, 8], [185, 7]), repMin: 8, repMax: 12, unit: "lb", equipment: "barbell" });
    expect(s.map((x) => `${x.weight}x${x.reps}`)).toEqual(["185x9", "185x9", "185x8"]);
  });

  it("adds weight once every working set hits the top of the range", () => {
    const s = suggestNext({ previous: sets([185, 12], [185, 12], [185, 12]), repMin: 8, repMax: 12, unit: "lb", equipment: "barbell" });
    expect(s.every((x) => x.weight === 190 && x.reps === 8 && x.reason === "add-weight")).toBe(true);
  });

  it("leaves warm-ups alone", () => {
    const s = suggestNext({ previous: [{ weight: 95, reps: 10, type: "WARMUP" }, ...sets([185, 12])], repMin: 8, repMax: 12, unit: "lb", equipment: "barbell" });
    expect(s[0]).toEqual({ weight: 95, reps: 10, reason: "repeat" });
    expect(s[1].weight).toBe(190);
  });

  it("uses kilogram plates in metric", () => {
    const s = suggestNext({ previous: sets([100, 12]), repMin: 8, repMax: 12, unit: "kg", equipment: "barbell" });
    expect(s[0].weight).toBe(102.5);
  });

  it("returns nothing without history", () => {
    expect(suggestNext({ previous: [], unit: "lb", equipment: null })).toEqual([]);
  });
});
