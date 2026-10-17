import "server-only";

// One place that talks to the Claude API, so model settings and errors are
// handled the same way for photos, labels, descriptions, and Coach.

export const DEFAULTS = { vision: "claude-sonnet-5-5", text: "claude-haiku-5-5" } as const;

/**
 * Model names come from Vercel settings, where it's easy to paste stray
 * spaces, quotes, or backticks. Clean those up; anything that still doesn't
 * look like a Claude model name is ignored in favor of the default.
 */
export function cleanModel(value: string | undefined | null): string | null {
  if (!value) return null;
  const v = value.trim().replace(/^[`'"\s]+|[`'"\s]+$/g, "").toLowerCase();
  return /^claude-[a-z0-9.-]+$/.test(v) ? v : null;
}

export const visionModel = () => cleanModel(process.env.AI_VISION_MODEL) ?? DEFAULTS.vision;
export const textModel = () => cleanModel(process.env.AI_MODEL) ?? DEFAULTS.text;
export const coachModel = () => cleanModel(process.env.AI_COACH_MODEL) ?? cleanModel(process.env.AI_MODEL) ?? DEFAULTS.text;

export class ClaudeError extends Error {
  constructor(public status: number, public userMessage: string) {
    super(userMessage);
  }
}

function friendly(status: number, detail: string) {
  if (status === 401 || status === 403) return "AI setup problem: the Anthropic API key was rejected. Check ANTHROPIC_API_KEY in Vercel.";
  if (status === 429 || status === 529) return "The AI is busy right now. Try again in a minute.";
  if (status === 402 || /credit|billing|balance/i.test(detail)) return "AI setup problem: the Anthropic account is out of credit or over its spending limit.";
  if (status === 413) return "That photo is too large. Try again.";
  // Include the AI service's own reason (no secrets in it) so problems can be pinned down
  let reason = "";
  try {
    reason = String((JSON.parse(detail) as { error?: { message?: string } }).error?.message ?? "");
  } catch {}
  reason = reason.replace(/\s+/g, " ").slice(0, 140);
  return `The AI couldn't do that one (error ${status}${reason ? `: ${reason}` : ""}). Try again or search instead.`;
}

const isModelProblem = (status: number, detail: string) => status === 404 || (status === 400 && /model/i.test(detail));

/**
 * POST /v1/messages. If the configured model is the problem (misspelled or
 * not available on this account), retry once with the default so the app
 * keeps working, and log loudly so the setting gets fixed.
 */
export async function claudeMessages(body: Record<string, unknown>, fallbackModel: string, timeoutMs = 30_000): Promise<unknown> {
  const base = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";
  const send = (model: string) =>
    fetch(`${base}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY ?? "", "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ ...body, model }),
      signal: AbortSignal.timeout(timeoutMs),
    });

  const model = String(body.model);
  let res = await send(model);
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    if (isModelProblem(res.status, detail) && model !== fallbackModel) {
      console.error(`Claude model "${model}" failed (${res.status}); falling back to ${fallbackModel}. Fix the model setting in Vercel.`, detail);
      res = await send(fallbackModel);
      if (res.ok) return res.json();
      const again = await res.text().catch(() => "");
      console.error("Claude API error after fallback", res.status, again);
      throw new ClaudeError(res.status, friendly(res.status, again));
    }
    console.error("Claude API error", res.status, detail);
    throw new ClaudeError(res.status, friendly(res.status, detail));
  }
  return res.json();
}
