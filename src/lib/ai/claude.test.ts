import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { cleanModel } from "./claude";

describe("cleanModel", () => {
  it("accepts proper names and tidies pasted ones", () => {
    expect(cleanModel("claude-sonnet-5-5")).toBe("claude-sonnet-5-5");
    expect(cleanModel(" `claude-sonnet-5-5` ")).toBe("claude-sonnet-5-5");
    expect(cleanModel('"Claude-Sonnet-5-5"')).toBe("claude-sonnet-5-5");
  });
  it("ignores things that aren't model names", () => {
    expect(cleanModel("sonnet")).toBeNull();
    expect(cleanModel("claude sonnet 5.5")).toBeNull();
    expect(cleanModel("")).toBeNull();
  });
});
