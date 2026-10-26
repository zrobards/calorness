import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/training", () => ({ getExerciseOptions: async () => [] }));
import { stripNulls } from "./coach";
import { programInput } from "./program";

describe("coach tool input", () => {
  it("drops the nulls models send for 'not set', so valid answers aren't rejected", () => {
    const fromModel = { name: "Push", days: [{ name: "Push", exercises: [{ exercise: "Pec Deck", sets: 3, rep_min: 10, rep_max: 12, rest_seconds: 60, note: null }] }], summary: null };
    expect(programInput.safeParse(fromModel).success).toBe(false); // what used to happen
    expect(programInput.safeParse(stripNulls(fromModel)).success).toBe(true);
  });
});
