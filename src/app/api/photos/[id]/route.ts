import { getOptionalUser } from "@/lib/auth";
import { canSeePosts } from "@/lib/community";
import { db } from "@/lib/db";

/*
  GET /api/photos/[id]?size=thumb — a progress photo. Only its owner can see
  it, plus (when it's set to "Followers") people whose follow they approved.
  Everyone else gets "not found", so a private photo's link reveals nothing.
*/
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const [viewer, { id }] = await Promise.all([getOptionalUser(), params]);
  const notFound = () => new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  if (!viewer) return notFound();
  const meta = await db.progressPhoto.findUnique({ where: { id }, select: { userId: true, visibility: true } });
  if (!meta) return notFound();
  const mine = meta.userId === viewer.id;
  if (!mine && !(meta.visibility === "FOLLOWERS" && (await canSeePosts(viewer.id, meta.userId)))) return notFound();

  const thumb = new URL(req.url).searchParams.get("size") === "thumb";
  const photo = await db.progressPhoto.findUnique({ where: { id }, select: thumb ? { thumb: true } : { image: true } });
  const bytes = (photo as { thumb?: Uint8Array; image?: Uint8Array } | null)?.[thumb ? "thumb" : "image"];
  if (!bytes) return notFound();
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": "image/jpeg",
      // a photo never changes (edits make a new one); kept only in this person's browser
      "cache-control": mine ? "private, max-age=31536000, immutable" : "private, max-age=300",
      "x-content-type-options": "nosniff",
    },
  });
}
