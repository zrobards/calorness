import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getFinishedWorkout } from "@/lib/training";
import { findNewRecords } from "@/lib/fitness/strength";
import { sendPush } from "@/lib/push";

// Community: opt-in profiles, following with approval, and a feed that only
// approved followers can see. Posts are snapshots, so editing or deleting a
// workout or program later doesn't change what was shared. Bodyweight and
// food are never shared.

const RESERVED = new Set(["admin", "calorness", "support", "help", "settings", "feed", "me", "you", "null", "undefined", "anthropic", "claude"]);

/** Lowercase 3–20 letters, numbers, underscores or dots; not reserved. */
export function checkHandle(raw: string): { handle: string } | { error: string } {
  const handle = raw.trim().replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9_.]{3,20}$/.test(handle)) return { error: "Use 3–20 letters, numbers, underscores, or dots." };
  if (/^[._]|[._]$|\.\./.test(handle)) return { error: "Usernames can't start or end with a dot or underscore." };
  if (RESERVED.has(handle)) return { error: "That username is reserved. Try another." };
  return { handle };
}

export async function isBlockedEitherWay(a: string, b: string) {
  return !!(await db.block.findFirst({ where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] }, select: { id: true } }));
}

/** You see someone's posts if it's you, or they approved your follow (and nobody blocked anybody). */
export async function canSeePosts(viewerId: string, ownerId: string) {
  if (viewerId === ownerId) return true;
  if (await isBlockedEitherWay(viewerId, ownerId)) return false;
  return !!(await db.follow.findFirst({ where: { followerId: viewerId, followingId: ownerId, status: "ACCEPTED" }, select: { id: true } }));
}

/** Make a post if the person has a profile and shares this kind of thing. Never fails the caller. */
export async function post(userId: string, kind: "WORKOUT" | "PROGRAM" | "RECAP", key: string, data: Prisma.InputJsonValue) {
  try {
    const user = await db.user.findUnique({ where: { id: userId }, select: { handle: true, shareWorkouts: true, shareRecaps: true } });
    if (!user?.handle) return null;
    if (kind === "WORKOUT" && !user.shareWorkouts) return null;
    if (kind === "RECAP" && !user.shareRecaps) return null;
    return await db.post.upsert({ where: { userId_key: { userId, key } }, update: kind === "PROGRAM" ? { data, createdAt: new Date(), hidden: false } : {}, create: { userId, kind, key, data } });
  } catch (e) {
    console.error("couldn't create post", e);
    return null;
  }
}

export type WorkoutPostData = {
  name: string;
  minutes: number;
  sets: number;
  volumeKg: number;
  exercises: { name: string; sets: number; bestKg: number | null; bestReps: number | null }[];
  records: string[];
};

/** A finished workout, as it appears in the feed (with any new records). */
export async function postWorkout(userId: string, workoutId: string) {
  const data = await getFinishedWorkout(userId, workoutId);
  if (!data) return null;
  const { workout, records } = data;
  const exercises = workout.exercises.map((e) => {
    const done = e.sets.filter((s) => s.completed && s.type !== "WARMUP" && (s.reps ?? 0) > 0);
    const top = done.filter((s) => s.weightKg).sort((a, b) => (b.weightKg ?? 0) - (a.weightKg ?? 0))[0];
    return { name: e.exercise.name, sets: done.length, bestKg: top?.weightKg ?? null, bestReps: (top ?? done[0])?.reps ?? null };
  }).filter((e) => e.sets > 0);
  const recordNames = workout.exercises
    .filter((e) => records[e.exerciseId]?.heaviestKg > 0 && findNewRecords(records[e.exerciseId], e.sets).length > 0)
    .map((e) => e.exercise.name);
  const body: WorkoutPostData = {
    name: workout.name,
    minutes: Math.max(1, Math.round(workout.durationMs / 60000)),
    sets: workout.setCount,
    volumeKg: Math.round(workout.volumeKg),
    exercises: exercises.slice(0, 8),
    records: recordNames,
  };
  return post(userId, "WORKOUT", `workout:${workoutId}`, body);
}

export type ProgramPostData = {
  name: string;
  summary: string | null;
  routines: { name: string; notes: string | null; exercises: { exerciseId: string | null; name: string; sets: number; repMin: number | null; repMax: number | null; restSeconds: number }[] }[];
};

/** Share a program; others who follow you can copy it with one tap. */
export async function postProgram(userId: string, programId: string) {
  const p = await db.program.findFirst({
    where: { id: programId, userId },
    include: { routines: { orderBy: { position: "asc" }, include: { exercises: { orderBy: { order: "asc" }, include: { exercise: { select: { id: true, name: true, createdById: true } } } } } } },
  });
  if (!p) return { error: "That program is gone." };
  const body: ProgramPostData = {
    name: p.name,
    summary: p.summary,
    routines: p.routines.map((r) => ({
      name: r.name,
      notes: r.notes,
      exercises: r.exercises.map((e) => ({
        // someone's own custom exercises can't be copied (they're private), only shown by name
        exerciseId: e.exercise.createdById ? null : e.exercise.id,
        name: e.exercise.name,
        sets: e.targetSets,
        repMin: e.targetRepsMin,
        repMax: e.targetRepsMax,
        restSeconds: e.restSeconds,
      })),
    })),
  };
  const made = await post(userId, "PROGRAM", `program:${programId}`, body);
  return made ? { ok: true as const } : { error: "Set up your profile on the Feed tab first." };
}

/** Copy a shared program into your own programs, switched on. */
export async function copyProgram(viewerId: string, postId: string) {
  const p = await db.post.findUnique({ where: { id: postId } });
  if (!p || p.hidden || p.kind !== "PROGRAM" || !(await canSeePosts(viewerId, p.userId))) return { error: "That program isn't available." };
  const data = p.data as unknown as ProgramPostData;
  await db.program.updateMany({ where: { userId: viewerId }, data: { pinned: false } });
  const program = await db.program.create({
    data: { userId: viewerId, name: data.name.slice(0, 60), summary: data.summary, pinned: true, position: await db.program.count({ where: { userId: viewerId } }) },
  });
  let skipped = 0;
  for (const [i, r] of data.routines.entries()) {
    const rows = r.exercises.filter((e) => e.exerciseId);
    skipped += r.exercises.length - rows.length;
    const exist = await db.exercise.findMany({ where: { id: { in: rows.map((e) => e.exerciseId!) }, createdById: null }, select: { id: true } });
    const ok = new Set(exist.map((e) => e.id));
    await db.routine.create({
      data: {
        userId: viewerId,
        programId: program.id,
        name: r.name.slice(0, 60),
        notes: r.notes,
        position: i,
        exercises: {
          create: rows.filter((e) => ok.has(e.exerciseId!)).map((e, order) => ({
            exerciseId: e.exerciseId!,
            order,
            targetSets: e.sets,
            targetRepsMin: e.repMin,
            targetRepsMax: e.repMax,
            restSeconds: e.restSeconds,
          })),
        },
      },
    });
  }
  return { ok: true as const, skipped };
}

/** Ask to follow someone; they get a notification to approve it. */
export async function requestFollow(followerId: string, handle: string) {
  const target = await db.user.findUnique({ where: { handle: handle.toLowerCase() }, select: { id: true } });
  if (!target || target.id === followerId) return { error: "Couldn't find that person." };
  if (await isBlockedEitherWay(followerId, target.id)) return { error: "Couldn't find that person." };
  const me = await db.user.findUnique({ where: { id: followerId }, select: { handle: true } });
  if (!me?.handle) return { error: "Set up your profile first, so they know who's asking." };
  const existing = await db.follow.findUnique({ where: { followerId_followingId: { followerId, followingId: target.id } } });
  if (existing) return { ok: true as const, status: existing.status };
  await db.follow.create({ data: { followerId, followingId: target.id } });
  await sendPush(target.id, { title: "New follow request", body: `@${me.handle} wants to follow you.`, url: "/feed", tag: "follow" }).catch(() => 0);
  return { ok: true as const, status: "PENDING" as const };
}

export type FeedPost = {
  id: string;
  kind: "WORKOUT" | "PROGRAM" | "RECAP";
  data: unknown;
  createdAt: string;
  handle: string;
  mine: boolean;
  props: number;
  propped: boolean;
};

/** Posts from you and the people who approved your follow, newest first. */
export async function getFeed(viewerId: string, opts: { onlyUserId?: string; before?: Date } = {}): Promise<FeedPost[]> {
  const follows = await db.follow.findMany({ where: { followerId: viewerId, status: "ACCEPTED" }, select: { followingId: true } });
  const blocks = await db.block.findMany({ where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] }, select: { blockerId: true, blockedId: true } });
  const blocked = new Set(blocks.flatMap((b) => [b.blockerId, b.blockedId]).filter((id) => id !== viewerId));
  let ids = [viewerId, ...follows.map((f) => f.followingId)].filter((id) => !blocked.has(id));
  if (opts.onlyUserId) ids = ids.includes(opts.onlyUserId) ? [opts.onlyUserId] : [];
  if (!ids.length) return [];
  const posts = await db.post.findMany({
    where: { userId: { in: ids }, hidden: false, user: { handle: { not: null } }, ...(opts.before ? { createdAt: { lt: opts.before } } : {}) },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { user: { select: { handle: true } }, _count: { select: { props: true } }, props: { where: { userId: viewerId }, select: { userId: true } } },
  });
  return posts.map((p) => ({
    id: p.id,
    kind: p.kind,
    data: p.data,
    createdAt: p.createdAt.toISOString(),
    handle: p.user.handle!,
    mine: p.userId === viewerId,
    props: p._count.props,
    propped: p.props.length > 0,
  }));
}

/** Weekly recap (Sundays) and streak milestones, run by the daily job. */
export async function postRecaps(user: { id: string; timeZone: string }, now: Date, summary: { logStreak: number; activeStreak: number }) {
  const local = new Date(now.toLocaleString("en-US", { timeZone: user.timeZone }));
  const day = local.toISOString().slice(0, 10);
  for (const n of [7, 14, 30, 60, 100, 200, 365]) {
    if (summary.logStreak === n) await post(user.id, "RECAP", `streak:${n}:${day}`, { type: "streak", days: n });
  }
  if (local.getDay() !== 0) return;
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const [workouts, climbs] = await Promise.all([
    db.workout.count({ where: { userId: user.id, endedAt: { not: null }, startedAt: { gte: weekAgo } } }),
    db.activityEntry.count({ where: { userId: user.id, date: { gte: weekAgo } } }),
  ]);
  if (workouts + climbs === 0) return;
  await post(user.id, "RECAP", `week:${day}`, { type: "week", workouts, activities: climbs, logStreak: summary.logStreak, activeStreak: summary.activeStreak });
}
