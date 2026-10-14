import "server-only";
import { LOG_FOODS_TOOL, READ_LABEL_TOOL, parseLabelResponse, parseLogFoodsResponse, type AiFoodItem, type AiFoodResult, type LabelResult } from "./parse";

// Claude reads a meal photo or a typed description and estimates nutrition.
// Needs ANTHROPIC_API_KEY (console.anthropic.com). Each photo costs a fraction
// of a cent with Haiku; set AI_MODEL to use a different Claude model.
const MODEL = () => process.env.AI_MODEL || "claude-haiku-5-5";

const SYSTEM = `You are a registered dietitian estimating nutrition for a food-logging app.
List each distinct food or drink separately. Estimate realistic portions from visual cues (plate size, utensils, packaging) or the user's words.
Use typical US restaurant or home-cooking values, and include likely cooking oil, butter, and sauces in the numbers.
If the image or text contains no food, return an empty items list. Always answer by calling the log_foods tool.`;

export function aiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function estimateFoods(input: {
  image?: { base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" };
  text?: string;
  /** A previous estimate plus the user's correction, to re-check more accurately */
  previous?: AiFoodItem[];
  correction?: string;
}): Promise<AiFoodResult | { error: string }> {
  if (!aiConfigured()) return { error: "AI logging isn't set up yet. Add ANTHROPIC_API_KEY in Vercel." };

  const content: unknown[] = [];
  if (input.image) {
    content.push({ type: "image", source: { type: "base64", media_type: input.image.mediaType, data: input.image.base64 } });
  }
  content.push({ type: "text", text: buildPrompt(input) });

  try {
    const base = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";
    const res = await fetch(`${base}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL(),
        max_tokens: 1500,
        system: SYSTEM,
        tools: [LOG_FOODS_TOOL],
        tool_choice: { type: "tool", name: LOG_FOODS_TOOL.name },
        messages: [{ role: "user", content }],
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      console.error("Claude API error", res.status, await res.text().catch(() => ""));
      return { error: "The AI couldn't read that one. Try again or search instead." };
    }
    const result = parseLogFoodsResponse(await res.json());
    if (!result) return { error: "The AI's answer didn't make sense. Try again." };
    if (result.items.length === 0) return { error: result.note || "No food found. Try a closer photo, or describe it." };
    return result;
  } catch {
    return { error: "The AI took too long to answer. Check your connection and try again." };
  }
}

/** The user-facing words we send along with the photo. Exported for tests. */
export function buildPrompt(input: { image?: unknown; text?: string; previous?: AiFoodItem[]; correction?: string }) {
  const parts: string[] = [];
  if (input.text?.trim()) parts.push(`${input.image ? "Details from the user about this photo" : "Log this meal"}: ${input.text.trim()}`);
  else parts.push("Log the food in this photo.");
  if (input.previous?.length && input.correction?.trim()) {
    const summary = input.previous
      .map((i) => `- ${i.name}, ${i.portion} (${i.grams} g): ${i.calories} cal, P ${i.protein_g} C ${i.carbs_g} F ${i.fat_g}`)
      .join("\n");
    parts.push(
      `Your previous estimate was:\n${summary}\n\nThe user says this needs fixing: "${input.correction.trim()}"\n` +
        "Trust the user's information about portions, ingredients, and cooking methods over what the photo suggests. " +
        "Return the complete corrected list, including items that didn't change.",
    );
  }
  return parts.join("\n\n");
}

/** Read a Nutrition Facts label exactly (not an estimate). */
export async function readLabel(image: { base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" }): Promise<LabelResult | { error: string }> {
  if (!aiConfigured()) return { error: "AI isn't set up yet. Add ANTHROPIC_API_KEY in Vercel." };
  try {
    const base = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";
    const res = await fetch(`${base}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL(),
        max_tokens: 800,
        system: "You read Nutrition Facts labels for a food-logging app. Copy the per-serving numbers exactly as printed. Never estimate or round differently than the label. If there's no readable label, set readable to false.",
        tools: [READ_LABEL_TOOL],
        tool_choice: { type: "tool", name: READ_LABEL_TOOL.name },
        messages: [{ role: "user", content: [
          { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.base64 } },
          { type: "text", text: "Read this nutrition label." },
        ] }],
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return { error: "Couldn't read that label. Try again with the label filling the frame." };
    const label = parseLabelResponse(await res.json());
    if (!label || !label.readable) return { error: "No nutrition label found. Get closer so the Nutrition Facts panel fills the photo." };
    return label;
  } catch {
    return { error: "The AI took too long. Check your connection and try again." };
  }
}
