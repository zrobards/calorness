import "server-only";
import { Prisma } from "@prisma/client";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

// Numbers for the owner's admin screens. Nothing here is shown to anyone else.

export async function requireAdmin() {
  const user = await requireUser();
  if (!isAdmin(user.email)) notFound();
  return user;
}

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY);

// Someone "was active" when they logged food, a workout, an activity, or their weight
const EVENTS = Prisma.sql`
  SELECT "userId", "createdAt" AS at FROM "DiaryEntry" WHERE "createdAt" > now() - interval '90 days'
  UNION ALL SELECT "userId", "startedAt" FROM "Workout" WHERE "startedAt" > now() - interval '90 days'
  UNION ALL SELECT "userId", "createdAt" FROM "ActivityEntry" WHERE "createdAt" > now() - interval '90 days'
  UNION ALL SELECT "userId", "date"::timestamp FROM "BodyweightEntry" WHERE "date" > now() - interval '90 days'`;

export type DayPoint = { day: string; value: number };

/** Fill in missing days with 0, oldest first. */
function series(rows: { day: Date | string; n: bigint | number }[], days: number): DayPoint[] {
  const byDay = new Map(rows.map((r) => [new Date(r.day).toISOString().slice(0, 10), Number(r.n)]));
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.now() - (days - 1 - i) * DAY).toISOString().slice(0, 10);
    return { day: d, value: byDay.get(d) ?? 0 };
  });
}

export async function getMetrics() {
  const [users, new7, new30, active, retention, foodsPerDay, workoutsPerDay, activePerDay, signupsPerDay, logMix, community, openReports] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: ago(7) } } }),
    db.user.count({ where: { createdAt: { gte: ago(30) } } }),
    db.$queryRaw<{ dau: bigint; wau: bigint; mau: bigint }[]>`
      WITH events AS (${EVENTS})
      SELECT count(DISTINCT "userId") FILTER (WHERE at > now() - interval '1 day') AS dau,
             count(DISTINCT "userId") FILTER (WHERE at > now() - interval '7 days') AS wau,
             count(DISTINCT "userId") FILTER (WHERE at > now() - interval '30 days') AS mau
      FROM events`,
    // Of people who joined 2–8 weeks ago, how many came back after their first week
    db.$queryRaw<{ cohort: bigint; retained: bigint }[]>`
      WITH events AS (${EVENTS})
      SELECT count(*) AS cohort,
             count(*) FILTER (WHERE EXISTS (SELECT 1 FROM events e WHERE e."userId" = u.id AND e.at >= u."createdAt" + interval '7 days')) AS retained
      FROM "User" u
      WHERE u."createdAt" BETWEEN now() - interval '56 days' AND now() - interval '14 days'`,
    db.$queryRaw<{ day: Date; n: bigint }[]>`SELECT date_trunc('day', "createdAt") AS day, count(*) AS n FROM "DiaryEntry" WHERE "createdAt" > now() - interval '14 days' GROUP BY 1`,
    db.$queryRaw<{ day: Date; n: bigint }[]>`SELECT date_trunc('day', "startedAt") AS day, count(*) AS n FROM "Workout" WHERE "endedAt" IS NOT NULL AND "startedAt" > now() - interval '14 days' GROUP BY 1`,
    db.$queryRaw<{ day: Date; n: bigint }[]>`WITH events AS (${EVENTS}) SELECT date_trunc('day', at) AS day, count(DISTINCT "userId") AS n FROM events WHERE at > now() - interval '14 days' GROUP BY 1`,
    db.$queryRaw<{ day: Date; n: bigint }[]>`SELECT date_trunc('day', "createdAt") AS day, count(*) AS n FROM "User" WHERE "createdAt" > now() - interval '14 days' GROUP BY 1`,
    // How people log food (last 30 days), by where the food came from
    db.$queryRaw<{ source: string; n: bigint }[]>`
      SELECT f."source"::text AS source, count(*) AS n FROM "DiaryEntry" d JOIN "Food" f ON f.id = d."foodId"
      WHERE d."createdAt" > now() - interval '30 days' GROUP BY 1 ORDER BY 2 DESC`,
    Promise.all([
      db.user.count({ where: { handle: { not: null } } }),
      db.post.count({ where: { createdAt: { gte: ago(7) } } }),
      db.follow.count({ where: { status: "ACCEPTED" } }),
      db.follow.count({ where: { status: "PENDING" } }),
      db.postProp.count({ where: { createdAt: { gte: ago(7) } } }),
    ]),
    db.report.count({ where: { resolved: false } }),
  ]);
  const a = active[0];
  const r = retention[0];
  return {
    users,
    new7,
    new30,
    dau: Number(a?.dau ?? 0),
    wau: Number(a?.wau ?? 0),
    mau: Number(a?.mau ?? 0),
    retention: { cohort: Number(r?.cohort ?? 0), retained: Number(r?.retained ?? 0) },
    foodsPerDay: series(foodsPerDay, 14),
    workoutsPerDay: series(workoutsPerDay, 14),
    activePerDay: series(activePerDay, 14),
    signupsPerDay: series(signupsPerDay, 14),
    logMix: logMix.map((m) => ({ source: m.source, n: Number(m.n) })),
    community: { profiles: community[0], posts7: community[1], follows: community[2], pending: community[3], props7: community[4] },
    openReports,
  };
}

export async function getCosts() {
  const since30 = ago(30);
  const [windows, byKind, byModel, perDay, topUsers, mauRow] = await Promise.all([
    db.$queryRaw<{ w: string; cost: number; saved: number; calls: bigint; errors: bigint; ms: number; input: bigint; cached: bigint }[]>`
      SELECT w, coalesce(sum("costUsd"), 0)::float AS cost, coalesce(sum("savedUsd"), 0)::float AS saved, count(u.id) AS calls,
             count(u.id) FILTER (WHERE status <> 200) AS errors, coalesce(avg(ms) FILTER (WHERE status = 200), 0)::float AS ms,
             coalesce(sum("inputTokens" + "cacheReadTokens" + "cacheWriteTokens"), 0) AS input, coalesce(sum("cacheReadTokens"), 0) AS cached
      FROM (VALUES ('day', interval '1 day'), ('week', interval '7 days'), ('month', interval '30 days')) AS v(w, len)
      LEFT JOIN "AiUsage" u ON u."createdAt" > now() - v.len
      GROUP BY w`,
    db.aiUsage.groupBy({ by: ["kind"], where: { createdAt: { gte: since30 } }, _sum: { costUsd: true, savedUsd: true }, _count: true, _avg: { ms: true } }),
    db.aiUsage.groupBy({ by: ["model"], where: { createdAt: { gte: since30 } }, _sum: { costUsd: true, inputTokens: true, outputTokens: true, cacheReadTokens: true }, _count: true }),
    db.$queryRaw<{ day: Date; n: number }[]>`SELECT date_trunc('day', "createdAt") AS day, sum("costUsd")::float AS n FROM "AiUsage" WHERE "createdAt" > now() - interval '14 days' GROUP BY 1`,
    db.aiUsage.groupBy({ by: ["userId"], where: { createdAt: { gte: since30 }, userId: { not: null } }, _sum: { costUsd: true }, _count: true, orderBy: { _sum: { costUsd: "desc" } }, take: 10 }),
    db.$queryRaw<{ mau: bigint }[]>`WITH events AS (${EVENTS}) SELECT count(DISTINCT "userId") AS mau FROM events WHERE at > now() - interval '30 days'`,
  ]);
  // Errors per kind (grouped separately; Prisma can't filter inside a groupBy count)
  const errorsByKind = await db.aiUsage.groupBy({ by: ["kind"], where: { createdAt: { gte: since30 }, status: { not: 200 } }, _count: true });
  // Requests people made (one request can be several API calls when it retries)
  const requestsByKind = await db.aiCall.groupBy({ by: ["kind"], where: { createdAt: { gte: since30 } }, _count: true });
  const people = await db.user.findMany({ where: { id: { in: topUsers.map((t) => t.userId!) } }, select: { id: true, handle: true, email: true } });
  const w = Object.fromEntries(windows.map((x) => [x.w, { cost: x.cost, saved: x.saved, calls: Number(x.calls), errors: Number(x.errors), ms: Math.round(x.ms), input: Number(x.input), cached: Number(x.cached) }]));
  const mau = Number(mauRow[0]?.mau ?? 0);
  return {
    day: w.day,
    week: w.week,
    month: w.month,
    mau,
    perActiveUser: mau ? w.month.cost / mau : null,
    byKind: byKind
      .map((k) => ({
        kind: k.kind,
        calls: k._count,
        requests: requestsByKind.find((r) => r.kind === k.kind)?._count ?? null,
        errors: errorsByKind.find((e) => e.kind === k.kind)?._count ?? 0,
        cost: k._sum.costUsd ?? 0,
        saved: k._sum.savedUsd ?? 0,
        ms: Math.round(k._avg.ms ?? 0),
      }))
      .sort((a, b) => b.cost - a.cost),
    byModel: byModel.map((m) => ({ model: m.model, calls: m._count, cost: m._sum.costUsd ?? 0, input: m._sum.inputTokens ?? 0, output: m._sum.outputTokens ?? 0, cached: m._sum.cacheReadTokens ?? 0 })).sort((a, b) => b.cost - a.cost),
    perDay: series(perDay.map((p) => ({ day: p.day, n: p.n })), 14),
    topUsers: topUsers.map((t) => {
      const p = people.find((x) => x.id === t.userId);
      return { who: p?.handle ? `@${p.handle}` : maskEmail(p?.email), calls: t._count, cost: t._sum.costUsd ?? 0 };
    }),
  };
}

/** "zach.robards@gmail.com" → "za…@gmail.com" */
export function maskEmail(email: string | null | undefined) {
  if (!email) return "(no email)";
  const [name, domain] = email.split("@");
  return `${name.slice(0, 2)}…@${domain ?? ""}`;
}
