import { describe, expect, it } from "vitest";
import { muscleBreakdown, setsPerMuscle } from "./muscles";
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

describe("muscleBreakdown", () => {
  const bench = { workoutId: "w1", workoutName: "Push", date: "2026-10-19T15:00:00Z", exercise: "Bench Press", primaryMuscles: ["chest"], secondaryMuscles: ["triceps", "shoulders"], sets: [{ weightKg: 60, reps: 8, type: "NORMAL" }, { weightKg: 60, reps: 7, type: "NORMAL" }, { weightKg: 60, reps: 6, type: "NORMAL" }] };
  const pushdown = { ...bench, exercise: "Triceps Pushdown", primaryMuscles: ["triceps"], secondaryMuscles: [], sets: [{ weightKg: 20, reps: 12, type: "NORMAL" }, { weightKg: 20, reps: 10, type: "NORMAL" }] };
  const old = { ...bench, date: "2026-10-01T15:00:00Z" };

  it("counts primary sets fully and secondary as half, with the sets behind them", () => {
    const { totals, entries } = muscleBreakdown([bench, pushdown, old], new Date("2026-10-13"), new Date("2026-10-20"));
    expect(totals.chest).toBe(3);
    expect(totals.triceps).toBe(3.5); // 2 pushdown + half of 3 bench
    expect(entries.triceps.map((e) => [e.exercise, e.role, e.counted])).toEqual([["Bench Press", "secondary", 1.5], ["Triceps Pushdown", "primary", 2]].sort(() => 0));
    expect(entries.chest[0].sets).toHaveLength(3);
  });

  it("leaves out workouts outside the window", () => {
    expect(muscleBreakdown([old], new Date("2026-10-13"), new Date("2026-10-20")).totals.chest).toBe(0);
  });
});
