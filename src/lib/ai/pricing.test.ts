import { describe, expect, it } from "vitest";
import { costOf } from "./pricing";

describe("costOf", () => {
  it("prices Sonnet 5.5 calls, with cheap cache reads", () => {
    const c = costOf("claude-sonnet-5-5", { input_tokens: 1_000_000, output_tokens: 100_000, cache_read_input_tokens: 1_000_000 });
    expect(c.costUsd).toBeCloseTo(2 + 1 + 0.1, 6);
    // without the cache those 1M tokens would have cost $2
    expect(c.savedUsd).toBeCloseTo(1.9, 6);
  });
  it("counts a cache write's small premium against savings", () => {
    const c = costOf("claude-sonnet-5-5", { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 1_000_000 });
    expect(c.costUsd).toBeCloseTo(2.5, 6);
    expect(c.savedUsd).toBeCloseTo(-0.5, 6);
  });
  it("uses Haiku 5.5's higher rate for prompts over 100K tokens", () => {
    expect(costOf("claude-haiku-5-5", { input_tokens: 50_000 }).costUsd).toBeCloseTo(0.005, 8);
    expect(costOf("claude-haiku-5-5", { input_tokens: 200_000 }).costUsd).toBeCloseTo(0.1, 8);
  });
  it("never treats an unknown model as free", () => {
    const c = costOf("claude-something-new", { input_tokens: 1_000_000 });
    expect(c.known).toBe(false);
    expect(c.costUsd).toBeGreaterThan(0);
  });
});
