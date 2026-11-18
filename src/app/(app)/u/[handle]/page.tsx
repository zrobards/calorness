import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Lock } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canSeePosts, getFeed, isBlockedEitherWay } from "@/lib/community";
import { getUnitSystem } from "@/lib/training";
import { Avatar, FollowButton, PostCard, ShareProfileLink } from "@/components/feed/Feed";
import { ProfileMenu } from "./ProfileMenu";

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  return { title: `@${(await params).handle}` };
}

export default async function ProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const user = await requireUser();
  const handle = decodeURIComponent((await params).handle).toLowerCase().replace(/^@/, "");
  const them = await db.user.findUnique({ where: { handle }, select: { id: true, handle: true, bio: true } });
  if (!them || (await isBlockedEitherWay(user.id, them.id))) notFound();
  const mine = them.id === user.id;
  const [rel, followers, following, workouts, visible, unitSystem] = await Promise.all([
    db.follow.findUnique({ where: { followerId_followingId: { followerId: user.id, followingId: them.id } }, select: { status: true } }),
    db.follow.count({ where: { followingId: them.id, status: "ACCEPTED" } }),
    db.follow.count({ where: { followerId: them.id, status: "ACCEPTED" } }),
    db.workout.count({ where: { userId: them.id, endedAt: { not: null } } }),
    canSeePosts(user.id, them.id),
    getUnitSystem(user.id),
  ]);
  const posts = visible ? await getFeed(user.id, { onlyUserId: them.id }) : [];
  const siteUrl = (process.env.NEXTAUTH_URL ?? "https://calorness.vercel.app").replace(/\/$/, "");

  return (
    <div className="px-5 pb-8" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}>
      <div className="flex items-center justify-between">
        <Link href="/feed" className="-ml-1 inline-flex items-center gap-1 py-2 text-sm font-medium text-chalk-muted"><ChevronLeft size={18} aria-hidden /> Feed</Link>
        {!mine && <ProfileMenu handle={them.handle!} />}
      </div>
      <div className="mt-2 flex items-center gap-4">
        <Avatar handle={them.handle!} size={64} />
        <div className="grid flex-1 grid-cols-3 text-center">
          {[["Workouts", workouts], ["Followers", followers], ["Following", following]].map(([l, n]) => (
            <div key={l}><b className="block text-lg tabular-nums">{n}</b><span className="text-xs text-chalk-muted">{l}</span></div>
          ))}
        </div>
      </div>
      <h1 className="mt-3 text-xl font-bold">@{them.handle}</h1>
      {them.bio && <p className="mt-0.5 text-sm text-chalk-muted">{them.bio}</p>}
      <div className="mt-3">{mine ? <ShareProfileLink url={`${siteUrl}/u/${them.handle}`} /> : <FollowButton handle={them.handle!} status={rel?.status ?? null} />}</div>

      <div className="mt-6 space-y-4">
        {!visible ? (
          <div className="rounded-2xl border border-dashed border-rack-line p-6 text-center text-chalk-muted">
            <Lock className="mx-auto" size={22} aria-hidden />
            <p className="mt-2">{rel?.status === "PENDING" ? "Waiting for them to approve you." : "Follow to see their workouts and programs."}</p>
          </div>
        ) : posts.length ? (
          posts.map((p) => <PostCard key={p.id} post={p} imperial={unitSystem === "IMPERIAL"} />)
        ) : (
          <p className="text-center text-sm text-chalk-muted">No posts yet.</p>
        )}
      </div>
    </div>
  );
}
