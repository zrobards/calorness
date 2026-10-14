import { describe, expect, it } from "vitest";
import { parseLogFoodsResponse } from "./parse";

const item = { name: "Scrambled eggs", portion: "2 large eggs", grams: 120.4, calories: 182.6, protein_g: 12.44, carbs_g: 1.6, fat_g: 13.9, confidence: "high" };

describe("parseLogFoodsResponse", () => {
  it("reads the tool call and rounds the numbers", () => {
    const result = parseLogFoodsResponse({
      content: [
        { type: "text" },
        { type: "tool_use", name: "log_foods", input: { items: [item], note: "Assumed cooked in butter." } },
      ],
    });
    expect(result?.items[0]).toMatchObject({ grams: 120, calories: 183, protein_g: 12.4 });
    expect(result?.note).toBe("Assumed cooked in butter.");
  });

  it("drops rows with no nutrition", () => {
    const result = parseLogFoodsResponse({
      content: [{ type: "tool_use", name: "log_foods", input: { items: [item, { ...item, name: "Water", calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }] } }],
    });
    expect(result?.items).toHaveLength(1);
  });

  it("returns null for malformed replies", () => {
    expect(parseLogFoodsResponse({ content: [{ type: "text" }] })).toBeNull();
    expect(parseLogFoodsResponse({ content: [{ type: "tool_use", name: "log_foods", input: { items: [{ name: "x" }] } }] })).toBeNull();
  });
});
