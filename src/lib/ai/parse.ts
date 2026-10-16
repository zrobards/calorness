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
  // For packaged foods, so we can look up the real label values
  packaged: z.boolean().optional(),
  brand: z.string().max(80).nullable().optional(),
  product: z.string().max(160).nullable().optional(),
  // Set when this item is really part of another listed dish (tortillas in tacos)
  included_in: z.string().max(120).nullable().optional(),
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
            packaged: { type: "boolean", description: "True for a branded, packaged product (yogurt cup, protein bar, chips, bottled drink), whether the package is visible or named" },
            brand: { type: "string", description: "Brand for packaged products, e.g. 'Chobani'" },
            product: { type: "string", description: "Full product name including line and flavor as printed, e.g. 'Chobani Flip Key Lime Crumble'" },
            included_in: { type: "string", description: "Only if this item is an ingredient, topping, or garnish of another item in this list (e.g. corn tortillas or lime for 'Street tacos'), the name of that item. Its calories must already be counted in that item." },
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
  // Never count a dish and its own parts twice: drop items the AI marked as
  // part of another listed item (only if that item really is in the list)
  const names = new Set(parsed.data.items.map((i) => i.name.trim().toLowerCase()));
  const parts = parsed.data.items.filter((i) => i.included_in && names.has(i.included_in.trim().toLowerCase()) && i.included_in.trim().toLowerCase() !== i.name.trim().toLowerCase());
  const partNote = parts.length ? `Counted inside the dish: ${parts.map((p) => p.name.toLowerCase()).join(", ")}.` : "";
  return {
    note: [parsed.data.note, partNote].filter(Boolean).join(" ") || undefined,
    items: parsed.data.items
      .filter((i) => !parts.includes(i))
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

// ─── Nutrition label reading ──────────────────────────────────────────────

export const labelSchema = z.object({
  readable: z.boolean(),
  name: z.string().max(120).default(""),
  brand: z.string().max(120).nullable().optional(),
  serving_label: z.string().max(80).default("1 serving"),
  serving_grams: z.number().min(0).max(5000).nullable().optional(),
  calories: z.number().min(0).max(5000).default(0),
  protein_g: z.number().min(0).max(500).default(0),
  carbs_g: z.number().min(0).max(500).default(0),
  fat_g: z.number().min(0).max(500).default(0),
});
export type LabelResult = z.infer<typeof labelSchema>;

export const READ_LABEL_TOOL = {
  name: "read_label",
  description: "Copy the per-serving values exactly as printed on a Nutrition Facts label.",
  input_schema: {
    type: "object",
    properties: {
      readable: { type: "boolean", description: "False if no nutrition label is visible or it can't be read" },
      name: { type: "string", description: "Product name if visible on the package, else a short description" },
      brand: { type: "string" },
      serving_label: { type: "string", description: "Serving size as printed, like '2/3 cup (55g)'" },
      serving_grams: { type: "number", description: "Grams (or ml) per serving if printed, else omit" },
      calories: { type: "number" },
      protein_g: { type: "number" },
      carbs_g: { type: "number", description: "Total carbohydrate" },
      fat_g: { type: "number", description: "Total fat" },
    },
    required: ["readable"],
  },
} as const;

export function parseLabelResponse(body: { content?: ContentBlock[] }): LabelResult | null {
  const call = body.content?.find((b) => b.type === "tool_use" && b.name === READ_LABEL_TOOL.name);
  const parsed = labelSchema.safeParse(call?.input);
  return parsed.success ? parsed.data : null;
}
