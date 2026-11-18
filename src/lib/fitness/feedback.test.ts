import { describe, expect, it } from "vitest";
import { exerciseFeedback, fuelNote, pushPullNote } from "./feedback";

const show = (kg: number) => kg * 2.2046;
const ex = (weightKg: number, reps: number[], repMax?: number) => ({ name: "Bench", muscles: ["chest"], repMax, sets: reps.map((r) => ({ weightKg, reps: r })) });

describe("workout feedback", () => {
  it("celebrates a new best", () => {
    expect(exerciseFeedback(ex(80, [8]), [95, 96], show, "lb")?.title).toMatch(/new best/);
  });
  it("flags a drop", () => {
    expect(exerciseFeedback(ex(60, [6]), [95], show, "lb")?.tone).toBe("fix");
  });
  it("flags three sessions at the same level", () => {
    expect(exerciseFeedback(ex(80, [8]), [101.3, 101.3, 90], show, "lb")?.title).toMatch(/stuck/);
  });
  it("says go heavier when every set hits the top of the range", () => {
    expect(exerciseFeedback(ex(60, [12, 12, 12], 12), [86, 84], show, "lb")?.title).toMatch(/heavier/);
  });
  it("says nothing the first time", () => {
    expect(exerciseFeedback(ex(80, [8]), [], show, "lb")).toBeNull();
  });
  it("counts climbing as pulling", () => {
    const sets = [...Array(8)].map(() => ({ muscles: ["chest"] })).concat([...Array(6)].map(() => ({ muscles: ["lats"] })));
    expect(pushPullNote(sets, 0)).toBeNull();
    expect(pushPullNote(sets, 120)?.title).toMatch(/Pulling/);
  });
  it("warns when undereating while trying to gain", () => {
    expect(fuelNote("gain", 2300, 2950, 5)?.title).toMatch(/Not eating enough/);
    expect(fuelNote("lose", 1800, 2300, 5)).toBeNull();
    expect(fuelNote("gain", 2300, 2950, 1)).toBeNull();
  });
});
