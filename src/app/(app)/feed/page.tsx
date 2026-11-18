import type { Metadata } from "next";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getFeed } from "@/lib/community";
import { getUnitSystem } from "@/lib/training";
import { FollowRequests, PeopleSearch, PostCard, ProfileSetup, ShareProfileLink } from "@/components/feed/Feed";

export const metadata: Metadata = { title: "Feed" };

export default async function FeedPage() {
  const user = await requireUser();
  const me = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { handle: true } });
  const siteUrl = (process.env.NEXTAUTH_URL ?? "https://calorness.vercel.app").replace(/\/$/, "");

  // Not on the feed yet: one short form
  if (!me.handle) {
    return (
      <>
        <PageHeader title="Feed" />
        <div className="mx-5 rounded-2xl bg-rack-raised p-5">
          <Users className="text-plate-yellow" size={28} aria-hidden />
          <h2 className="mt-2 text-xl font-bold">Train with your friends</h2>
          <p className="mt-1 text-sm text-chalk-muted">Pick a username. Friends ask to follow you, and only people you approve see your workouts, records, and the programs you choose to share.</p>
          <div className="mt-4"><ProfileSetup /></div>
        </div>
      </>
    );
  }

  const [posts, requests, unitSystem, following] = await Promise.all([
    getFeed(user.id),
    db.follow.findMany({ where: { followingId: user.id, status: "PENDING" }, orderBy: { createdAt: "desc" }, select: { id: true, follower: { select: { handle: true, bio: true } } } }),
    getUnitSystem(user.id),
    db.follow.count({ where: { followerId: user.id, status: "ACCEPTED" } }),
  ]);

  return (
    <>
      <PageHeader title="Feed" />
      <div className="mx-5 space-y-4 pb-6">
        <FollowRequests requests={requests.filter((r) => r.follower.handle).map((r) => ({ id: r.id, handle: r.follower.handle!, bio: r.follower.bio }))} />
        <PeopleSearch />
        {following === 0 && (
          <div className="rounded-2xl border border-dashed border-rack-line p-5 text-center">
            <p className="font-semibold">Your feed fills up as friends approve you</p>
            <p className="mt-1 text-sm text-chalk-muted">Search their username above, or send them your profile so they can follow you.</p>
            <div className="mt-3 flex justify-center"><ShareProfileLink url={`${siteUrl}/u/${me.handle}`} /></div>
          </div>
        )}
        {posts.map((p) => <PostCard key={p.id} post={p} imperial={unitSystem === "IMPERIAL"} />)}
        {posts.length === 0 && <p className="text-center text-sm text-chalk-muted">Finish a workout and it shows up here for your followers.</p>}
      </div>
    </>
  );
}
