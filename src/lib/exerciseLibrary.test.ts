import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ updateTag: () => {} }));
vi.mock("@/lib/db", () => ({ db: {} }));
import { exerciseKey } from "./exerciseLibrary";

describe("exerciseKey", () => {
  it("groups the same exercise typed different ways", () => {
    expect(exerciseKey("Cable  Y-Raise!")).toBe("cable y raise");
    expect(exerciseKey("cable y raise")).toBe("cable y raise");
    expect(exerciseKey("Pallof Press")).not.toBe(exerciseKey("Pallof Hold"));
  });
});
