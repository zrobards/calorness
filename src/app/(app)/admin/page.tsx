import type { Metadata } from "next";
import Link from "next/link";
import { Reports } from "./Reports";
import { getMetrics, requireAdmin } from "@/lib/adminData";
import { db } from "@/lib/db";
import { Bars, Card, pct, Stat, Stats, Tiles } from "./ui";

export const metadata: Metadata = { title: "Admin" };

const SOURCE_LABEL: Record<string, string> = {
  USDA: "USDA database",
  OPEN_FOOD_FACTS: "Open Food Facts (barcodes)",
  CUSTOM: "Their own foods and label scans",
  AI_ESTIMATE: "AI estimates",
  COMMUNITY: "Community foods",
};

export default async function AdminPage() {
  await requireAdmin();
  const [m, reportRows, topSearches, dbMs] = await Promise.all([
    getMetrics(),
    db.report.findMany({ where: { resolved: false }, orderBy: { createdAt: "desc" }, take: 50, include: { reporter: { select: { handle: true } }, post: { select: { data: true } } } }),
    db.searchPick.groupBy({ by: ["query"], _sum: { count: true }, orderBy: { _sum: { count: "desc" } }, take: 10 }),
    measureDb(),
  ]);
  const reportedUsers = await db.user.findMany({ where: { id: { in: reportRows.map((r) => r.userId).filter((x): x is string => !!x) } }, select: { id: true, handle: true } });
  const logTotal = m.logMix.reduce((s, x) => s + x.n, 0);
  const dbRegion = (() => {
    try {
      const host = new URL(process.env.DATABASE_URL ?? "").hostname; // e.g. ep-x.us-east-2.aws.neon.tech
      return host.match(/\.(\w+-\w+-\d)\./)?.[1] ?? host.split(".").slice(1, 3).join(".");
    } catch {
      return "unknown";
    }
  })();

  return (
    <div className="space-y-4 px-5">
      <Tiles
        items={[
          { label: "Accounts", value: m.users.toLocaleString("en-US"), sub: `+${m.new7} this week, +${m.new30} in 30 days`, tone: "yellow" },
          { label: "Active today", value: m.dau.toLocaleString("en-US"), sub: `${m.wau} this week, ${m.mau} this month` },
          { label: "Came back after week 1", value: pct(m.retention.retained, m.retention.cohort), sub: m.retention.cohort ? `${m.retention.retained} of ${m.retention.cohort} who joined 2–8 weeks ago` : "Needs people who joined 2+ weeks ago" },
          { label: "Daily habit", value: pct(m.dau, m.mau), sub: "of this month's active people use it each day", tone: "blue" },
        ]}
      />

      {m.openReports > 0 && (
        <Card title={`Feed reports (${m.openReports})`}>
          <Reports
            reports={reportRows.map((r) => ({
              id: r.id,
              reason: r.reason,
              createdAt: r.createdAt.toISOString(),
              reporter: r.reporter.handle,
              reported: reportedUsers.find((u) => u.id === r.userId)?.handle ?? null,
              post: r.post ? JSON.stringify(r.post.data).slice(0, 240) : null,
              hasPost: !!r.post,
            }))}
          />
        </Card>
      )}

      <Card title="Activity">
        <div className="space-y-5">
          <Bars label="Active people" points={m.activePerDay} />
          <Bars label="Foods logged" points={m.foodsPerDay} />
          <Bars label="Workouts finished" points={m.workoutsPerDay} />
          <Bars label="Sign-ups" points={m.signupsPerDay} />
        </div>
        <p className="mt-3 text-xs text-chalk-muted">Active means they logged food, a workout, an activity, or their weight. Days are in UTC.</p>
      </Card>

      <Card title="How people log food" action={<span className="text-xs text-chalk-muted">30 days</span>}>
        <Stats>
          {m.logMix.length === 0 && <p className="py-2 text-sm text-chalk-muted">No food logged yet.</p>}
          {m.logMix.map((x) => <Stat key={x.source} label={SOURCE_LABEL[x.source] ?? x.source} value={`${pct(x.n, logTotal)} · ${x.n.toLocaleString("en-US")}`} />)}
        </Stats>
        <p className="mt-2 text-xs text-chalk-muted">The more that comes from the database instead of AI estimates, the cheaper and more accurate logging gets. <Link href="/admin/foods" className="text-plate-blue">Manage foods</Link></p>
      </Card>

      <Card title="Community">
        <Stats>
          <Stat label="People with a profile" value={m.community.profiles} />
          <Stat label="Posts this week" value={m.community.posts7} />
          <Stat label="Props this week" value={m.community.props7} />
          <Stat label="Follows" value={m.community.follows} hint={m.community.pending ? `${m.community.pending} waiting for approval` : undefined} />
        </Stats>
      </Card>

      <Card title="Top searches">
        <Stats>
          {topSearches.length === 0 && <p className="py-2 text-sm text-chalk-muted">None yet.</p>}
          {topSearches.map((s) => <Stat key={s.query} label={`“${s.query}”`} value={s._sum.count ?? 0} />)}
        </Stats>
      </Card>

      <Card title="Speed">
        <Stats>
          <Stat label="Database round trip (average of 5)" value={`${dbMs} ms`} />
          <Stat label="App server region (Vercel)" value={process.env.VERCEL_REGION ?? "local"} />
          <Stat label="Database region (Neon)" value={dbRegion} />
        </Stats>
        <p className="pt-2 text-xs text-chalk-muted">
          Over ~20 ms means the app and database are far apart: set the Vercel function region to match the database (Vercel → Settings → Functions → Region).
        </p>
      </Card>

      <p className="text-sm text-chalk-muted">
        To browse every table, open the Neon console (Vercel → Storage → your database → Open in Neon → Tables).
      </p>
    </div>
  );
}

async function measureDb() {
  const times: number[] = [];
  for (let i = 0; i < 5; i++) {
    const t = performance.now();
    await db.$queryRaw`SELECT 1`;
    times.push(performance.now() - t);
  }
  return Math.round(times.slice(1).reduce((a, b) => a + b, 0) / 4); // skip the first (connection warm-up)
}
