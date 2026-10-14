import "server-only";
import { db } from "@/lib/db";
import { hashApiKey, readApiKey } from "@/lib/apiKeys";

/** Find the user behind a shortcut key in the Authorization header. */
export async function userFromApiKey(req: Request) {
  const key = readApiKey(req.headers.get("authorization"));
  if (!key) return null;
  const row = await db.apiKey.findUnique({
    where: { hash: hashApiKey(key) },
    include: { user: { select: { id: true, name: true, timeZone: true, unitSystem: true } } },
  });
  if (!row) return null;
  await db.apiKey.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } });
  return row.user;
}

export const plainText = (body: string, status = 200) =>
  new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
