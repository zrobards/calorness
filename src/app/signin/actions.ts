"use server";

import { randomBytes, randomInt } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { displayCode, handoffStatus, HANDOFF_TTL_MS } from "@/lib/handoff";

const idSchema = z.string().min(30).max(64);

/** Called by the home-screen app before it opens the browser to sign in. */
export async function createHandoff() {
  const id = randomBytes(32).toString("base64url");
  const code = displayCode(randomInt);
  // Tidy up old requests while we're here
  await db.loginRequest.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await db.loginRequest.create({ data: { id, code, expiresAt: new Date(Date.now() + HANDOFF_TTL_MS) } });
  return { id, code };
}

/** The app polls this until the browser side approves. */
export async function handoffState(id: string) {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return "missing" as const;
  const req = await db.loginRequest.findUnique({ where: { id: parsed.data } });
  return handoffStatus(req, new Date());
}

/** Browser side: the signed-in user confirms the app should be signed in too. */
export async function approveHandoff(id: string) {
  const user = await requireUser();
  const reqId = idSchema.parse(id);
  const req = await db.loginRequest.findUnique({ where: { id: reqId } });
  if (handoffStatus(req, new Date()) !== "pending") return { error: "This sign-in link expired. Start again from the app." };
  await db.loginRequest.update({ where: { id: reqId }, data: { userId: user.id, approvedAt: new Date() } });
  return { ok: true };
}
