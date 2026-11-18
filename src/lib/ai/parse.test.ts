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

describe("double counting", () => {
  it("drops ingredients the AI marked as part of a listed dish", () => {
    const tacos = { ...item, name: "Street tacos", portion: "3 tacos", grams: 300, calories: 480, confidence: "medium" };
    const tortillas = { ...item, name: "Corn tortillas", portion: "3", grams: 75, calories: 150, included_in: "Street tacos" };
    const lime = { ...item, name: "Lime", portion: "2 wedges", grams: 15, calories: 5, included_in: "street tacos" };
    const result = parseLogFoodsResponse({ content: [{ type: "tool_use", name: "log_foods", input: { items: [tacos, tortillas, lime] } }] });
    expect(result?.items.map((i) => i.name)).toEqual(["Street tacos"]);
    expect(result?.note).toContain("corn tortillas, lime");
  });

  it("keeps items that point at a dish that isn't in the list", () => {
    const salsa = { ...item, name: "Salsa", calories: 20, included_in: "Burrito" };
    expect(parseLogFoodsResponse({ content: [{ type: "tool_use", name: "log_foods", input: { items: [salsa] } }] })?.items).toHaveLength(1);
  });
});

describe("long AI text is shortened, not rejected", () => {
  const call = (input: unknown) => ({ content: [{ type: "tool_use", name: "log_foods", input }] });
  it("keeps the answer when the portion description runs long (real Haiku output)", () => {
    const r = parseLogFoodsResponse(call({
      items: [{ name: "Chipotle chicken burrito bowl", portion: "1 bowl with white rice, black beans, chicken, fresh tomato salsa, cheese, lettuce", grams: 610, calories: 760, protein_g: 41, carbs_g: 83, fat_g: 27, confidence: "medium", packaged: false }],
      note: "x".repeat(400),
    }) as never);
    expect(r?.items).toHaveLength(1);
    expect(r!.items[0].portion.length).toBeLessThanOrEqual(80);
    expect(r!.items[0].portion.endsWith("…")).toBe(true);
    expect(r!.note!.length).toBeLessThanOrEqual(300);
  });
  it("keeps the answer when confidence is an unexpected word", () => {
    const r = parseLogFoodsResponse(call({ items: [{ name: "Apple", portion: "1 medium", grams: 182, calories: 95, protein_g: 0.5, carbs_g: 25, fat_g: 0.3, confidence: "very high" }] }) as never);
    expect(r?.items[0].confidence).toBe("medium");
  });
});
