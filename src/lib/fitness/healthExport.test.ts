import { describe, expect, it } from "vitest";
import { fromHealthAutoExport, isHealthAutoExport } from "./healthExport";

const sample = {
  data: {
    metrics: [
      { name: "step_count", units: "count", data: [{ date: "2026-10-25 00:00:00 -0400", qty: 9120 }, { date: "2026-10-26 00:00:00 -0400", qty: 4000 }, { date: "2026-10-26 13:00:00 -0400", qty: 1500 }] },
      { name: "active_energy", units: "kJ", data: [{ date: "2026-10-26 00:00:00 -0400", qty: 2092 }] },
      { name: "walking_speed", units: "mi/hr", data: [{ date: "2026-10-26 00:00:00 -0400", qty: 3.0 }, { date: "2026-10-26 12:00:00 -0400", qty: 3.2 }] },
      { name: "walking_running_distance", units: "km", data: [{ date: "2026-10-26 00:00:00 -0400", qty: 4.2 }] },
      { name: "heart_rate", units: "count/min", data: [{ date: "2026-10-26 00:00:00 -0400", Avg: 70 }] },
    ],
    workouts: [],
  },
};

describe("Health Auto Export", () => {
  it("recognizes its format", () => {
    expect(isHealthAutoExport(sample)).toBe(true);
    expect(isHealthAutoExport({ steps: 100 })).toBe(false);
  });
  it("turns metrics into daily totals with units", () => {
    const days = fromHealthAutoExport(sample);
    expect(days.map((d) => d.day)).toEqual(["2026-10-25", "2026-10-26"]);
    const today = days[1];
    expect(today.steps).toBe(5500); // hourly samples added up
    expect(today.activeCalories).toBeCloseTo(500); // 2092 kJ
    expect(today.walkingSpeed).toBeCloseTo(3.1); // averaged
    expect(today.speedUnit).toBe("mph");
    expect(today.distance).toBe(4.2);
    expect(today.distanceUnit).toBe("km");
    expect(today).not.toHaveProperty("heartRate"); // only the metrics we use
  });
});
