import { describe, expect, it } from "vitest";
import { calorieStatus, daysOfMonth, shiftMonth, summarize, type CalendarDay } from "./calendar";

const day = (d: string, over: Partial<CalendarDay> = {}): CalendarDay => ({ day: d, calories: 0, proteinG: 0, carbsG: 0, fatG: 0, foods: 0, workouts: [], activities: [], weightKg: null, photoIds: [], ...over });

describe("calendar", () => {
  it("rates a day's calories against the target (within 10% is on target)", () => {
    expect(calorieStatus(0, 2500)).toBe("none");
    expect(calorieStatus(2000, 2500)).toBe("under");
    expect(calorieStatus(2300, 2500)).toBe("on");
    expect(calorieStatus(2700, 2500)).toBe("on");
    expect(calorieStatus(2800, 2500)).toBe("over");
    expect(calorieStatus(1800, null)).toBe("on");
  });
  it("knows how many days each month has, leap years included", () => {
    expect(daysOfMonth("2026-02")).toHaveLength(28);
    expect(daysOfMonth("2028-02")).toHaveLength(29);
    expect(daysOfMonth("2026-11").at(-1)).toBe("2026-11-30");
  });
  it("moves between months across years", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
  it("sums up a month", () => {
    const s = summarize(
      [
        day("2026-11-01", { calories: 2400, proteinG: 150, weightKg: 64 }),
        day("2026-11-02", { calories: 3000, proteinG: 170, workouts: [{ id: "w", name: "Upper", minutes: 60 }] }),
        day("2026-11-03"),
        day("2026-11-04", { weightKg: 64.5, activities: [{ name: "Climbing", minutes: 90, calories: 400 }] }),
      ],
      2500,
    );
    expect(s).toEqual({ daysLogged: 2, avgCalories: 2700, avgProteinG: 160, daysOnTarget: 1, workouts: 1, activities: 1, weightChangeKg: 0.5 });
  });
});
