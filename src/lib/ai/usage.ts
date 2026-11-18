import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { db } from "@/lib/db";
import { costOf, type Usage } from "./pricing";

// Who an AI call is for and what it's doing, so every call to the Claude API
// (retries included) can be recorded with its real token counts and cost.
export type AiKind = "photo" | "describe" | "label" | "shortcut" | "recheck" | "coach" | "program" | "other";
type Context = { userId: string | null; kind: AiKind };

const store = new AsyncLocalStorage<Context>();

/** Run AI work on someone's behalf; calls inside are recorded under them. */
export function withAi<T>(userId: string | null, kind: AiKind, fn: () => Promise<T>): Promise<T> {
  return store.run({ userId, kind }, fn);
}

/** Save one API call's usage. Never throws: tracking must not break the app. */
export async function recordUsage(model: string, usage: Usage | undefined, ms: number, status: number) {
  const ctx = store.getStore() ?? { userId: null, kind: "other" as const };
  try {
    const c = costOf(model, usage);
    await db.aiUsage.create({
      data: {
        userId: ctx.userId,
        kind: ctx.kind,
        model,
        inputTokens: c.input,
        outputTokens: c.output,
        cacheReadTokens: c.read,
        cacheWriteTokens: c.write,
        costUsd: c.costUsd,
        savedUsd: c.savedUsd,
        ms: Math.round(ms),
        status,
      },
    });
  } catch (e) {
    console.error("couldn't record AI usage", e);
  }
}
