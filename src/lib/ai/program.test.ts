import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/training", () => ({ getExerciseOptions: async () => [] }));
import { programInput, repairProgram } from "./program";

describe("repairProgram", () => {
  it("fixes the near-misses models send instead of throwing the program away", () => {
    const fromModel = {
      name: "Climb + Lift",
      summary: "Climb Tue/Sat, lift Mon/Wed/Fri.",
      days: JSON.stringify([
        { name: "Climb A", activity: "Bouldering, 60-90 min", exercises: [] },
        { name: "Lower", exercises: [{ exercise: "Back Squat", sets: "4", rep_min: "5", rep_max: "8", rest_seconds: "3" }, { exercise: "Leg Extension", sets: 14, reps: 12 }] },
      ]),
    };
    const fixed = repairProgram(fromModel);
    const parsed = programInput.safeParse(fixed);
    expect(parsed.success).toBe(true);
    const lower = parsed.data!.days[1].exercises;
    expect(lower[0]).toMatchObject({ sets: 4, rep_min: 5, rep_max: 8, rest_seconds: 180 }); // "3" meant 3 minutes
    expect(lower[1]).toMatchObject({ sets: 10, rep_min: 12, rep_max: 12 }); // 14 sets capped; single "reps"
    expect(parsed.data!.days[0].activity).toBe("Bouldering, 60-90 min");
  });

  it("still rejects a day with nothing in it", () => {
    expect(programInput.safeParse(repairProgram({ name: "X", days: [{ name: "Empty" }] })).success).toBe(false);
  });
});
