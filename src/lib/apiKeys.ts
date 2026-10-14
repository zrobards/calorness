import { createHash, randomBytes } from "node:crypto";

// Keys look like "cal_" + 43 random characters (256 bits). With that much
// randomness a plain SHA-256 hash is safe to store (no need for bcrypt).
export function newApiKey() {
  const key = `cal_${randomBytes(32).toString("base64url")}`;
  return { key, prefix: key.slice(0, 10), hash: hashApiKey(key) };
}

export function hashApiKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

/** Pull the key out of "Authorization: Bearer cal_…" (or a bare key). */
export function readApiKey(header: string | null): string | null {
  if (!header) return null;
  const key = header.replace(/^Bearer\s+/i, "").trim();
  return /^cal_[A-Za-z0-9_-]{40,}$/.test(key) ? key : null;
}

export type ShortcutItem = { name: string; calories: number };

/** The text the phone shows in its notification after logging. */
export function summaryText(input: {
  meal: string;
  items: ShortcutItem[];
  caloriesLeft: number | null;
}) {
  const total = input.items.reduce((s, i) => s + i.calories, 0);
  const list = input.items.map((i) => `${i.name} (${Math.round(i.calories)})`).join(", ");
  const left =
    input.caloriesLeft === null
      ? ""
      : input.caloriesLeft >= 0
        ? ` ${Math.round(input.caloriesLeft).toLocaleString("en-US")} left today.`
        : ` ${Math.round(-input.caloriesLeft).toLocaleString("en-US")} over today.`;
  return `${input.meal}: ${list}. ${Math.round(total).toLocaleString("en-US")} cal.${left}`;
}
