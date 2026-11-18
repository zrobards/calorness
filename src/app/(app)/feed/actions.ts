"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canSeePosts, checkHandle, copyProgram, postProgram, requestFollow } from "@/lib/community";
import { sendPush } from "@/lib/push";

const refresh = () => {
  revalidatePath("/feed");
  revalidatePath("/progress");
  revalidatePath("/profile");
};

/** Create or update your community profile (username, bio, what you share). */
export async function saveCommunityProfile(input: { handle: string; bio: string; shareWorkouts: boolean; shareRecaps: boolean }) {
  const user = await requireUser();
  const h = checkHandle(input.handle);
  if ("error" in h) return h;
  const bio = z.string().trim().max(160, "Keep your bio under 160 characters.").safeParse(input.bio);
  if (!bio.success) return { error: bio.error.issues[0].message };
  const taken = await db.user.findFirst({ where: { handle: h.handle, NOT: { id: user.id } }, select: { id: true } });
  if (taken) return { error: `@${h.handle} is taken. Try another.` };
  await db.user.update({ where: { id: user.id }, data: { handle: h.handle, bio: bio.data || null, shareWorkouts: !!input.shareWorkouts, shareRecaps: !!input.shareRecaps } });
  refresh();
  return { ok: true as const, handle: h.handle };
}

/** Leave the community: profile, posts, follows, and props are removed. */
export async function removeCommunityProfile() {
  const user = await requireUser();
  await db.$transaction([
    db.post.deleteMany({ where: { userId: user.id } }),
    db.follow.deleteMany({ where: { OR: [{ followerId: user.id }, { followingId: user.id }] } }),
    db.postProp.deleteMany({ where: { userId: user.id } }),
    db.user.update({ where: { id: user.id }, data: { handle: null, bio: null } }),
  ]);
  refresh();
  return { ok: true as const };
}

/** Find people by username (they must have a profile). */
export async function searchPeople(query: string) {
  const user = await requireUser();
  const q = query.trim().replace(/^@/, "").toLowerCase();
  if (q.length < 2) return [];
  const blocks = await db.block.findMany({ where: { OR: [{ blockerId: user.id }, { blockedId: user.id }] }, select: { blockerId: true, blockedId: true } });
  const hidden = new Set(blocks.flatMap((b) => [b.blockerId, b.blockedId]));
  const people = await db.user.findMany({
    where: { handle: { startsWith: q }, NOT: { id: user.id } },
    select: { id: true, handle: true, bio: true, followers: { where: { followerId: user.id }, select: { status: true } } },
    take: 10,
    orderBy: { handle: "asc" },
  });
  return people.filter((p) => !hidden.has(p.id)).map((p) => ({ handle: p.handle!, bio: p.bio, status: p.followers[0]?.status ?? null }));
}

export async function follow(handle: string) {
  const user = await requireUser();
  const r = await requestFollow(user.id, z.string().min(1).max(40).parse(handle));
  refresh();
  return r;
}

/** Unfollow, or cancel a request you sent. */
export async function unfollow(handle: string) {
  const user = await requireUser();
  const target = await db.user.findUnique({ where: { handle: handle.toLowerCase() }, select: { id: true } });
  if (target) await db.follow.deleteMany({ where: { followerId: user.id, followingId: target.id } });
  refresh();
  return { ok: true as const };
}

/** Approve or decline a follow request. */
export async function answerRequest(followId: string, approve: boolean) {
  const user = await requireUser();
  const f = await db.follow.findFirst({ where: { id: followId, followingId: user.id, status: "PENDING" }, include: { following: { select: { handle: true } } } });
  if (!f) return { ok: true as const };
  if (approve) {
    await db.follow.update({ where: { id: f.id }, data: { status: "ACCEPTED" } });
    await sendPush(f.followerId, { title: "Follow request approved", body: `@${f.following.handle} approved you. Their posts are in your feed now.`, url: "/feed", tag: "follow" }).catch(() => 0);
  } else await db.follow.delete({ where: { id: f.id } });
  refresh();
  return { ok: true as const };
}

/** Stop someone from following you (without blocking). */
export async function removeFollower(handle: string) {
  const user = await requireUser();
  const them = await db.user.findUnique({ where: { handle: handle.toLowerCase() }, select: { id: true } });
  if (them) await db.follow.deleteMany({ where: { followerId: them.id, followingId: user.id } });
  refresh();
  return { ok: true as const };
}

/** Block: removes follows both ways; neither of you can find or see the other. */
export async function blockPerson(handle: string) {
  const user = await requireUser();
  const them = await db.user.findUnique({ where: { handle: handle.toLowerCase() }, select: { id: true } });
  if (!them || them.id === user.id) return { ok: true as const };
  await db.$transaction([
    db.follow.deleteMany({ where: { OR: [{ followerId: user.id, followingId: them.id }, { followerId: them.id, followingId: user.id }] } }),
    db.block.upsert({ where: { blockerId_blockedId: { blockerId: user.id, blockedId: them.id } }, update: {}, create: { blockerId: user.id, blockedId: them.id } }),
  ]);
  refresh();
  return { ok: true as const };
}

export async function unblockPerson(handle: string) {
  const user = await requireUser();
  const them = await db.user.findUnique({ where: { handle: handle.toLowerCase() }, select: { id: true } });
  if (them) await db.block.deleteMany({ where: { blockerId: user.id, blockedId: them.id } });
  refresh();
  return { ok: true as const };
}

/** Report a post or a person to the app owner. */
export async function report(input: { postId?: string; handle?: string; reason: string }) {
  const user = await requireUser();
  const reason = z.string().trim().min(1, "Say briefly what's wrong.").max(300).safeParse(input.reason);
  if (!reason.success) return { error: reason.error.issues[0].message };
  const target = input.handle ? await db.user.findUnique({ where: { handle: input.handle.toLowerCase() }, select: { id: true } }) : null;
  const p = input.postId ? await db.post.findUnique({ where: { id: input.postId }, select: { id: true, userId: true } }) : null;
  await db.report.create({ data: { reporterId: user.id, postId: p?.id ?? null, userId: p?.userId ?? target?.id ?? null, reason: reason.data } });
  return { ok: true as const };
}

/** One tap to cheer someone's post (tap again to take it back). */
export async function toggleProps(postId: string) {
  const user = await requireUser();
  const p = await db.post.findUnique({ where: { id: postId }, select: { userId: true, hidden: true } });
  if (!p || p.hidden || !(await canSeePosts(user.id, p.userId))) return { error: "That post isn't available." };
  const existing = await db.postProp.findUnique({ where: { postId_userId: { postId, userId: user.id } } });
  if (existing) await db.postProp.delete({ where: { postId_userId: { postId, userId: user.id } } });
  else await db.postProp.create({ data: { postId, userId: user.id } });
  return { ok: true as const, propped: !existing };
}

export async function deletePost(postId: string) {
  const user = await requireUser();
  await db.post.deleteMany({ where: { id: postId, userId: user.id } });
  refresh();
  return { ok: true as const };
}

export async function shareProgram(programId: string) {
  const user = await requireUser();
  const r = await postProgram(user.id, z.string().min(1).parse(programId));
  refresh();
  return r;
}

export async function copySharedProgram(postId: string) {
  const user = await requireUser();
  const r = await copyProgram(user.id, z.string().min(1).parse(postId));
  revalidatePath("/train");
  return r;
}

// ─── Owner tools (reports) ─────────────────────────────────────────────────

export async function resolveReport(reportId: string, hidePost: boolean) {
  const user = await requireUser();
  const { isAdmin } = await import("@/lib/admin");
  const me = await db.user.findUnique({ where: { id: user.id }, select: { email: true } });
  if (!isAdmin(me?.email)) return { error: "Not allowed." };
  const r = await db.report.update({ where: { id: reportId }, data: { resolved: true } });
  if (hidePost && r.postId) await db.post.update({ where: { id: r.postId }, data: { hidden: true } });
  revalidatePath("/admin");
  return { ok: true as const };
}
