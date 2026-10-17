import { describe, expect, it } from "vitest";
import { ACTIVITIES, estimateBurn, exerciseCreditCalories, findActivity, metFor, restingPerMinute } from "./activities";

const zach = { weightKg: 80, heightCm: 180, age: 19, sex: "male" as const };

describe("activity catalog", () => {
  it("has unique keys and sensible METs", () => {
    expect(new Set(ACTIVITIES.map((a) => a.key)).size).toBe(ACTIVITIES.length);
    for (const a of ACTIVITIES) for (const m of Object.values(a.met)) expect(m).toBeGreaterThan(1);
  });
  it("includes the ones people ask for", () => {
    for (const key of ["rock-climbing", "bouldering", "hacky-sack", "running", "swimming", "basketball", "pickleball"]) expect(findActivity(key)).toBeDefined();
  });
  it("falls back to a defined intensity", () => {
    expect(metFor(findActivity("hacky-sack")!, "vigorous")).toBe(4.0);
  });
});

describe("estimateBurn", () => {
  it("uses MET × weight × time when that's all we have", () => {
    // 30 min hacky sack, 80 kg: 4.0 × 3.5 × 80 / 200 × 30 = 168
    const b = estimateBurn({ ...zach, minutes: 30, met: 4.0 });
    expect(b.method).toBe("met");
    expect(b.total).toBe(168);
    // net subtracts resting burn (Mifflin BMR 1835 / 1440 × 30 ≈ 38)
    expect(b.net).toBe(168 - Math.round((1835 / 1440) * 30));
  });

  it("weighs heavier people more", () => {
    const light = estimateBurn({ weightKg: 60, minutes: 60, met: 7.5 });
    const heavy = estimateBurn({ weightKg: 100, minutes: 60, met: 7.5 });
    expect(heavy.total).toBeGreaterThan(light.total);
  });

  it("uses pace when distance is known (ACSM running)", () => {
    // 5 km in 25 min = 200 m/min; VO2 = 0.2×200 + 3.5 = 43.5; ×80 kg ×5/1000 = 17.4 cal/min → 435
    const b = estimateBurn({ ...zach, minutes: 25, met: 9.8, distanceM: 5000, speedModel: "run" });
    expect(b.method).toBe("acsm");
    expect(b.total).toBe(435);
  });

  it("counts incline on a treadmill walk", () => {
    const flat = estimateBurn({ ...zach, minutes: 30, met: 6, distanceM: 2400, speedModel: "walk" });
    const hill = estimateBurn({ ...zach, minutes: 30, met: 6, distanceM: 2400, inclinePct: 12, speedModel: "walk" });
    expect(hill.total).toBeGreaterThan(flat.total * 1.8);
  });

  it("prefers heart rate when given", () => {
    const b = estimateBurn({ ...zach, minutes: 45, met: 5.8, avgHeartRate: 150 });
    expect(b.method).toBe("heart-rate");
    expect(b.total).toBeGreaterThan(400);
    expect(b.total).toBeLessThan(800);
  });
});

describe("helpers", () => {
  it("resting burn uses body stats when known", () => {
    expect(restingPerMinute(zach)).toBeCloseTo(1835 / 1440, 3);
    expect(restingPerMinute({ weightKg: 80 })).toBeCloseTo(1.4, 3);
  });
  it("applies the exercise credit percentage", () => {
    expect(exerciseCreditCalories(400, 75)).toBe(300);
    expect(exerciseCreditCalories(400, 0)).toBe(0);
  });
});
