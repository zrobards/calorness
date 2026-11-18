import "server-only";
import { recordUsage } from "./usage";
import type { Usage } from "./pricing";

// One place that talks to the Claude API, so model settings and errors are
// handled the same way for photos, labels, descriptions, and Coach.

// Sonnet everywhere by default: accuracy matters more than the fraction of a
// cent saved per request. Each can be overridden in Vercel.
export const DEFAULTS = { vision: "claude-sonnet-5-5", text: "claude-sonnet-5-5" } as const;

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
/** A faster model used as a second try when the main one is busy or slow. */
export const fastModel = () => cleanModel(process.env.AI_FAST_MODEL) ?? "claude-haiku-5-5";
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
 * Prompt caching: the long instructions (and tool definitions before them)
 * are identical for everyone, so Anthropic can keep them warm for a few
 * minutes and charge about a tenth for them on the next request. The model
 * reads exactly the same prompt either way, so answers don't change.
 * `conversation` also caches a growing chat (Coach), which helps when one
 * reply takes several rounds of tool calls.
 */
export function withCaching(body: Record<string, unknown>, conversation = false): Record<string, unknown> {
  const out = { ...body };
  if (typeof out.system === "string" && out.system) {
    out.system = [{ type: "text", text: out.system, cache_control: { type: "ephemeral" } }];
  }
  if (conversation) out.cache_control = { type: "ephemeral" };
  return out;
}

const stripCaching = (body: Record<string, unknown>): Record<string, unknown> => {
  const { cache_control: _top, ...rest } = body;
  void _top;
  if (Array.isArray(rest.system)) {
    rest.system = (rest.system as { text: string }[]).map((b) => b.text).join("\n\n");
  }
  return rest;
};

// If the API (or a proxy in front of it) ever rejects caching, stop asking for it
let cachingRejected = false;

/**
 * POST /v1/messages. If the configured model is the problem (misspelled or
 * not available on this account), retry once with the default so the app
 * keeps working, and log loudly so the setting gets fixed. Every call's
 * tokens and cost are recorded (see usage.ts).
 */
// Models that refused a forced tool_choice; skip forcing for them next time
const noForcedTools = new Set<string>();

export async function claudeMessages(
  body: Record<string, unknown>,
  fallbackModel: string,
  timeoutMs = 30_000,
  opts: { cacheConversation?: boolean } = {},
): Promise<unknown> {
  const base = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";
  body = cachingRejected ? body : withCaching(body, opts.cacheConversation);
  const send = async (model: string) => {
    const started = performance.now();
    try {
      const res = await fetch(`${base}/v1/messages`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY ?? "", "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ ...body, model }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const ms = performance.now() - started;
      if (!res.ok) {
        await recordUsage(model, undefined, ms, res.status);
        return { ok: false as const, status: res.status, detail: await res.text().catch(() => "") };
      }
      const json = (await res.json()) as { usage?: Usage; model?: string };
      await recordUsage(model, json.usage, ms, 200);
      return { ok: true as const, json };
    } catch (e) {
      await recordUsage(model, undefined, performance.now() - started, 0);
      throw e;
    }
  };

  const model = String(body.model);
  if (noForcedTools.has(model) && body.tool_choice) body = { ...body, tool_choice: { type: "auto" } };
  let res = await send(model);
  if (res.ok) return res.json;
  let { status, detail } = res;
  // Caching is only a discount; never let it stop a request
  if (status === 400 && /cache_control|caching/i.test(detail)) {
    console.error("Prompt caching was rejected; continuing without it.", detail.slice(0, 200));
    cachingRejected = true;
    body = stripCaching(body);
    res = await send(model);
    if (res.ok) return res.json;
    ({ status, detail } = res);
  }
  // Some newer models (which think before answering) don't allow forcing a
  // specific tool. Ask again letting the model choose; the system prompt
  // already tells it to answer with the tool.
  if (status === 400 && /tool_choice/i.test(detail) && body.tool_choice) {
    const { tool_choice: _forced, ...rest } = body;
    void _forced;
    body = { ...rest, tool_choice: { type: "auto" } };
    noForcedTools.add(model);
    res = await send(model);
    if (res.ok) return res.json;
    ({ status, detail } = res);
  }
  if (isModelProblem(status, detail) && model !== fallbackModel) {
    console.error(`Claude model "${model}" failed (${status}); falling back to ${fallbackModel}. Fix the model setting in Vercel.`, detail);
    res = await send(fallbackModel);
    if (res.ok) return res.json;
    console.error("Claude API error after fallback", res.status, res.detail);
    throw new ClaudeError(res.status, friendly(res.status, res.detail));
  }
  console.error("Claude API error", status, detail);
  throw new ClaudeError(status, friendly(status, detail));
}
