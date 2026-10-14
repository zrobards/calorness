import { describe, expect, it } from "vitest";
import { hashApiKey, newApiKey, readApiKey, summaryText } from "./apiKeys";

describe("API keys", () => {
  it("creates long random keys and stores only a hash", () => {
    const a = newApiKey();
    const b = newApiKey();
    expect(a.key).toMatch(/^cal_[A-Za-z0-9_-]{43}$/);
    expect(a.key).not.toBe(b.key);
    expect(a.hash).toBe(hashApiKey(a.key));
    expect(a.hash).not.toContain(a.key);
    expect(a.prefix).toBe(a.key.slice(0, 10));
  });

  it("reads keys from an Authorization header", () => {
    const { key } = newApiKey();
    expect(readApiKey(`Bearer ${key}`)).toBe(key);
    expect(readApiKey(key)).toBe(key);
    expect(readApiKey("Bearer nope")).toBeNull();
    expect(readApiKey(null)).toBeNull();
  });
});

describe("summaryText", () => {
  it("lists what was logged and what's left", () => {
    expect(
      summaryText({ meal: "Lunch", items: [{ name: "Chicken", calories: 280 }, { name: "Rice", calories: 242.4 }], caloriesLeft: 1247 }),
    ).toBe("Lunch: Chicken (280), Rice (242). 522 cal. 1,247 left today.");
  });

  it("says when you're over", () => {
    expect(summaryText({ meal: "Dinner", items: [{ name: "Pizza", calories: 900 }], caloriesLeft: -150 })).toContain("150 over today.");
  });
});
