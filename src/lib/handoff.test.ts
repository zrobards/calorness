import { describe, expect, it } from "vitest";
import { displayCode, handoffStatus, HANDOFF_TTL_MS } from "./handoff";

const now = new Date("2026-10-14T12:00:00Z");
const base = { userId: null, approvedAt: null, consumedAt: null, expiresAt: new Date(now.getTime() + HANDOFF_TTL_MS) };

describe("handoffStatus", () => {
  it("is pending until approved", () => {
    expect(handoffStatus(base, now)).toBe("pending");
    expect(handoffStatus({ ...base, userId: "u1", approvedAt: now }, now)).toBe("approved");
  });

  it("can only be used once", () => {
    expect(handoffStatus({ ...base, userId: "u1", approvedAt: now, consumedAt: now }, now)).toBe("used");
  });

  it("expires, even if approved", () => {
    const later = new Date(now.getTime() + HANDOFF_TTL_MS + 1);
    expect(handoffStatus({ ...base, userId: "u1", approvedAt: now }, later)).toBe("expired");
  });

  it("handles unknown requests", () => {
    expect(handoffStatus(null, now)).toBe("missing");
  });
});

describe("displayCode", () => {
  it("always has four digits", () => {
    expect(displayCode(() => 7)).toBe("0007");
    expect(displayCode(() => 4821)).toBe("4821");
  });
});
