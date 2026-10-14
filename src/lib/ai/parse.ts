import { z } from "zod";

// What we ask Claude to return for a photo or description of a meal.
export const aiFoodItemSchema = z.object({
  name: z.string().min(1).max(120),
  portion: z.string().max(80), // e.g. "1 cup", "2 large eggs"
  grams: z.number().min(0).max(5000),
  calories: z.number().min(0).max(5000),
  protein_g: z.number().min(0).max(500),
  carbs_g: z.number().min(0).max(500),
  fat_g: z.number().min(0).max(500),
  confidence: z.enum(["high", "medium", "low"]),
});

export const aiFoodResultSchema = z.object({
  items: z.array(aiFoodItemSchema).max(15),
  note: z.string().max(300).optional(),
});

export type AiFoodItem = z.infer<typeof aiFoodItemSchema>;
export type AiFoodResult = z.infer<typeof aiFoodResultSchema>;

/** JSON Schema version, sent to Claude as a tool so its reply comes back structured. */
export const LOG_FOODS_TOOL = {
  name: "log_foods",
  description: "Record each distinct food or drink in the meal with estimated nutrition for the portion shown or described.",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Plain food name, like 'Scrambled eggs' or 'Chipotle chicken burrito bowl'" },
            portion: { type: "string", description: "Human-friendly portion, like '2 large eggs' or '1 bowl'" },
            grams: { type: "number", description: "Estimated weight of the portion in grams" },
            calories: { type: "number" },
            protein_g: { type: "number" },
            carbs_g: { type: "number" },
            fat_g: { type: "number" },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
          },
          required: ["name", "portion", "grams", "calories", "protein_g", "carbs_g", "fat_g", "confidence"],
        },
      },
      note: { type: "string", description: "Optional one-sentence note, e.g. what was assumed about oil or sauces" },
    },
    required: ["items"],
  },
} as const;

type ContentBlock = { type: string; name?: string; input?: unknown };

/** Pull the tool call out of a Messages API response and validate it. */
export function parseLogFoodsResponse(body: { content?: ContentBlock[] }): AiFoodResult | null {
  const call = body.content?.find((b) => b.type === "tool_use" && b.name === LOG_FOODS_TOOL.name);
  if (!call) return null;
  const parsed = aiFoodResultSchema.safeParse(call.input);
  if (!parsed.success) return null;
  // Round to sensible precision and drop empty rows
  return {
    note: parsed.data.note,
    items: parsed.data.items
      .filter((i) => i.calories > 0 || i.protein_g > 0 || i.carbs_g > 0 || i.fat_g > 0)
      .map((i) => ({
        ...i,
        grams: Math.round(i.grams),
        calories: Math.round(i.calories),
        protein_g: Math.round(i.protein_g * 10) / 10,
        carbs_g: Math.round(i.carbs_g * 10) / 10,
        fat_g: Math.round(i.fat_g * 10) / 10,
      })),
  };
}
