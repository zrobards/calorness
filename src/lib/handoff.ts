// Pure rules for the sign-in handoff, kept separate so they can be unit tested.

export const HANDOFF_TTL_MS = 10 * 60 * 1000;

export type HandoffRequest = {
  userId: string | null;
  approvedAt: Date | null;
  consumedAt: Date | null;
  expiresAt: Date;
};

export function handoffStatus(req: HandoffRequest | null, now: Date): "missing" | "expired" | "used" | "pending" | "approved" {
  if (!req) return "missing";
  if (req.consumedAt) return "used";
  if (req.expiresAt.getTime() <= now.getTime()) return "expired";
  if (req.approvedAt && req.userId) return "approved";
  return "pending";
}

/** A 4-digit code that's easy to compare at a glance. */
export function displayCode(randomInt: (max: number) => number): string {
  return String(randomInt(10000)).padStart(4, "0");
}
