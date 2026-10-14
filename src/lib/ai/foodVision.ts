import "server-only";
import { LOG_FOODS_TOOL, parseLogFoodsResponse, type AiFoodResult } from "./parse";

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
}): Promise<AiFoodResult | { error: string }> {
  if (!aiConfigured()) return { error: "AI logging isn't set up yet. Add ANTHROPIC_API_KEY in Vercel." };

  const content: unknown[] = [];
  if (input.image) {
    content.push({ type: "image", source: { type: "base64", media_type: input.image.mediaType, data: input.image.base64 } });
  }
  content.push({
    type: "text",
    text: input.text?.trim()
      ? `Log this meal: ${input.text.trim()}`
      : "Log the food in this photo.",
  });

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
