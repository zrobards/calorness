import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { buildPrompt } from "./foodVision";

const item = { name: "White rice", portion: "1 cup", grams: 186, calories: 242, protein_g: 4.4, carbs_g: 53, fat_g: 0.4, confidence: "medium" as const };

describe("buildPrompt", () => {
  it("asks about the photo when there's no text", () => {
    expect(buildPrompt({ image: {} })).toBe("Log the food in this photo.");
  });

  it("treats text as details when there's also a photo", () => {
    expect(buildPrompt({ image: {}, text: "cooked in olive oil" })).toContain("Details from the user about this photo: cooked in olive oil");
  });

  it("includes the previous estimate and the correction when re-checking", () => {
    const p = buildPrompt({ image: {}, previous: [item], correction: "it was 2 cups of rice" });
    expect(p).toContain("White rice, 1 cup (186 g): 242 cal");
    expect(p).toContain('"it was 2 cups of rice"');
    expect(p).toContain("complete corrected list");
  });
});
