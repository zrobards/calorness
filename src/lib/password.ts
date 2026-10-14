import "server-only";
import bcrypt from "bcryptjs";
import { z } from "zod";

// Passwords are stored only as bcrypt hashes. Cost 12 is about 250 ms per
// check, which is slow enough to make guessing impractical.
export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(128, "That password is too long.");

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.");

export const hashPassword = (password: string) => bcrypt.hash(password, 12);

// A real hash of a random password, so failed lookups take as long as real
// checks and don't reveal which emails have accounts.
const DUMMY_HASH = "$2b$12$CwTycUXWue0Thq9StjUM0uJ8.TzdqVo6tBQ6cP8q3O0R9yBoDxF2e";

export async function verifyPassword(password: string, hash: string | null | undefined) {
  const ok = await bcrypt.compare(password, hash ?? DUMMY_HASH);
  return ok && !!hash;
}
