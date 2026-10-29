import { unstable_rethrow } from "next/navigation";

// Saving from a phone at the gym means flaky signal. A server action that
// can't reach the server throws, and an uncaught throw replaces the screen
// with the error page, losing what you typed. Wrapping calls in `safe`
// turns those failures into a normal { error } result the screen can show,
// so your work stays put and you can tap Save again.

export const OFFLINE_MESSAGE = "Couldn't save: no connection. Your changes are still here; try again when you have signal.";

export function isNetworkError(e: unknown) {
  return (typeof navigator !== "undefined" && !navigator.onLine) || e instanceof TypeError || /load failed|failed to fetch|network|fetch failed/i.test(String(e));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Call a server action without letting a lost connection crash the screen.
 * `retries` re-tries network failures (only use it for actions that are safe
 * to repeat). Next.js redirects pass through untouched.
 */
export async function safe<R>(call: () => Promise<R>, { retries = 0 }: { retries?: number } = {}): Promise<R | { error: string }> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await call();
    } catch (e) {
      unstable_rethrow(e); // let Next.js navigation (redirect after saving) work normally
      if (attempt < retries && isNetworkError(e)) {
        await sleep(700 * (attempt + 1));
        continue;
      }
      console.error(e);
      return { error: isNetworkError(e) ? OFFLINE_MESSAGE : "Something went wrong saving that. Try again." };
    }
  }
}

/** True when a result is the { error } shape from `safe` or an action. */
export const failed = (r: unknown): r is { error: string } => !!r && typeof r === "object" && "error" in r && !!(r as { error?: unknown }).error;
