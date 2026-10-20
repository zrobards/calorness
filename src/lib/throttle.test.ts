import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// In-memory stand-in for the AuthThrottle table
const rows = new Map<string, { key: string; failures: number; windowStart: Date; lockedUntil: Date | null }>();
vi.mock("@/lib/db", () => ({
  db: {
    authThrottle: {
      findUnique: async ({ where }: { where: { key: string } }) => rows.get(where.key) ?? null,
      upsert: async ({ where, update, create }: { where: { key: string }; update: object; create: { key: string; failures: number; windowStart: Date; lockedUntil: Date | null } }) => {
        const cur = rows.get(where.key);
        rows.set(where.key, cur ? { ...cur, ...update } : create);
      },
      deleteMany: async ({ where }: { where: { key: string } }) => rows.delete(where.key),
    },
  },
}));

import { clearFailures, isLocked, MAX_FAILURES, recordFailure } from "./throttle";

describe("login throttle", () => {
  beforeEach(() => rows.clear());

  it("locks after too many wrong passwords, then unlocks after 15 minutes", async () => {
    const t0 = new Date("2026-10-20T12:00:00Z");
    for (let i = 0; i < MAX_FAILURES - 1; i++) await recordFailure("pw:a@b.com", t0);
    expect(await isLocked("pw:a@b.com", t0)).toBe(false);
    await recordFailure("pw:a@b.com", t0);
    expect(await isLocked("pw:a@b.com", t0)).toBe(true);
    expect(await isLocked("pw:a@b.com", new Date(t0.getTime() + 16 * 60_000))).toBe(false);
  });

  it("starts a fresh count after the window and resets on success", async () => {
    const t0 = new Date("2026-10-20T12:00:00Z");
    for (let i = 0; i < MAX_FAILURES - 1; i++) await recordFailure("pw:c@d.com", t0);
    await recordFailure("pw:c@d.com", new Date(t0.getTime() + 20 * 60_000)); // new window
    expect(await isLocked("pw:c@d.com", new Date(t0.getTime() + 20 * 60_000))).toBe(false);
    await clearFailures("pw:c@d.com");
    expect(rows.has("pw:c@d.com")).toBe(false);
  });
});
