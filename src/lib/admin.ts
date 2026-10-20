/** Owner-only pages and tools: emails listed in ADMIN_EMAILS (comma-separated). */
export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase());
}
