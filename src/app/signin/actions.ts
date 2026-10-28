"use server";

import { randomBytes, randomInt } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { DEMO_EMAIL, requireUser } from "@/lib/auth";
import { displayCode, handoffStatus, HANDOFF_TTL_MS } from "@/lib/handoff";
import { emailSchema, hashPassword, passwordSchema, verifyPassword } from "@/lib/password";
import { isLocked, recordFailure } from "@/lib/throttle";

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

// ─── Email + password accounts ────────────────────────────────────────────

const signUpSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(60),
  email: emailSchema,
  password: passwordSchema,
});

/** Create an account. The client signs in right after with the same details. */
export async function signUp(input: { name: string; email: string; password: string }) {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your details." };
  const { name, email, password } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing?.passwordHash) return { error: "There's already an account with that email. Sign in instead." };
  if (existing) {
    // Created through GitHub. Don't let someone attach a password just by
    // knowing the email; the owner can add one from Profile after signing in.
    return { error: "That email signs in with GitHub. Use GitHub, then add a password in Profile." };
  }
  await db.user.create({ data: { name, email, passwordHash: await hashPassword(password) } });
  return { ok: true };
}

/** Signed-in users (e.g. from GitHub) can add or change a password. */
export async function setPassword(password: string, current?: string) {
  const user = await requireUser();
  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Choose another password." };
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { email: true, passwordHash: true } });
  // Changing an existing password needs the current one, so someone holding
  // your unlocked phone can't lock you out (wrong guesses are rate limited)
  if (row.passwordHash) {
    const key = `pw:${row.email}`;
    if (await isLocked(key)) return { error: "Too many wrong passwords. Try again in 15 minutes." };
    if (!current || !(await verifyPassword(current, row.passwordHash))) {
      await recordFailure(key);
      return { error: "Your current password isn't right." };
    }
  }
  if (!row.email) return { error: "Your account has no email address, so a password can't be added." };
  if (row.email === DEMO_EMAIL) return { error: "The shared demo account can't have a password." };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(parsed.data) } });
  return { ok: true, email: row.email };
}
