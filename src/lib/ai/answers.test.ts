import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));
import { answerKey } from "./answers";

describe("answerKey (reusing a typed answer)", () => {
  it("only ignores capitals, spacing, and end punctuation", () => {
    expect(answerKey("  2 Eggs and  toast. ")).toBe(answerKey("2 eggs and toast"));
    expect(answerKey("2 eggs and toast!")).toBe("2 eggs and toast");
  });
  it("keeps every word and number, so different portions never share an answer", () => {
    expect(answerKey("2 eggs")).not.toBe(answerKey("3 eggs"));
    expect(answerKey("a big bowl of rice")).not.toBe(answerKey("a bowl of rice"));
    expect(answerKey("chicken and rice")).not.toBe(answerKey("rice and chicken"));
    expect(answerKey("1/2 cup oats")).not.toBe(answerKey("1 cup oats"));
  });
});
