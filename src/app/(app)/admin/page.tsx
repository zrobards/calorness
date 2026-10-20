import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { AiCheck } from "./AiCheck";

export const metadata: Metadata = { title: "Data" };


// Rough cost per AI request, from Anthropic's price list (Sonnet for photos and labels)
const COST = { photo: 0.006, label: 0.008, shortcut: 0.006, recheck: 0.006, describe: 0.0003, coach: 0.001 } as Record<string, number>;

export default async function AdminPage() {
  const user = await requireUser();
  if (!isAdmin(user.email)) notFound();
  const weekAgo = sevenDaysAgo();

  const [users, activeUsers, foodsBySource, sharedFoods, cachedSearches, topSearches, topFoods, aiByKind, exercises, customExercises] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { OR: [{ diaryEntries: { some: { createdAt: { gte: weekAgo } } } }, { workouts: { some: { startedAt: { gte: weekAgo } } } }] } }),
    db.food.groupBy({ by: ["source"], _count: true }),
    db.food.count({ where: { shared: true } }),
    db.searchCache.count(),
    db.searchPick.groupBy({ by: ["query"], _sum: { count: true }, orderBy: { _sum: { count: "desc" } }, take: 12 }),
    db.diaryEntry.groupBy({ by: ["foodId"], _count: true, orderBy: { _count: { foodId: "desc" } }, take: 10 }),
    db.aiCall.groupBy({ by: ["kind"], where: { createdAt: { gte: weekAgo } }, _count: true }),
    db.exercise.count({ where: { createdById: null } }),
    db.exercise.count({ where: { createdById: { not: null } } }),
  ]);
  // How far the app server is from the database: a few ms is ideal
  const dbMs = await measureDb();
  const dbRegion = (() => {
    try {
      const host = new URL(process.env.DATABASE_URL ?? "").hostname; // e.g. ep-x.us-east-2.aws.neon.tech
      return host.match(/\.(\w+-\w+-\d)\./)?.[1] ?? host.split(".").slice(1, 3).join(".");
    } catch {
      return "unknown";
    }
  })();
  const foodNames = new Map((await db.food.findMany({ where: { id: { in: topFoods.map((f) => f.foodId) } }, select: { id: true, name: true, brand: true, source: true } })).map((f) => [f.id, f]));
  const aiCost = aiByKind.reduce((s, k) => s + (COST[k.kind] ?? 0.001) * k._count, 0);

  return (
    <div className="pb-8">
      <PageHeader title="Data" />
      <div className="space-y-4 px-5">
        <Card title="People">
          <Stat label="Accounts" value={users} />
          <Stat label="Active in the last 7 days" value={activeUsers} />
        </Card>

        <Card title="Food database">
          {foodsBySource.map((s) => (
            <Stat key={s.source} label={{ USDA: "Saved from USDA", OPEN_FOOD_FACTS: "Saved from Open Food Facts", CUSTOM: "Created by people", AI_ESTIMATE: "AI estimates (private)" }[s.source] ?? s.source} value={s._count} />
          ))}
          <Stat label="Shared label scans (verified, everyone sees)" value={sharedFoods} />
          <Stat label="Cached outside searches" value={cachedSearches} />
          <p className="pt-2 text-xs text-chalk-muted">USDA and Open Food Facts are searched live; foods are saved here once someone logs them.</p>
        </Card>

        <Card title="Top searches">
          {topSearches.length === 0 && <p className="text-sm text-chalk-muted">None yet.</p>}
          {topSearches.map((s) => <Stat key={s.query} label={`“${s.query}”`} value={s._sum.count ?? 0} />)}
        </Card>

        <Card title="Most logged foods">
          {topFoods.map((f) => {
            const food = foodNames.get(f.foodId);
            return <Stat key={f.foodId} label={food ? `${food.name}${food.brand ? `, ${food.brand}` : ""}` : "?"} value={f._count} />;
          })}
        </Card>

        <Card title="AI, last 7 days">
          {aiByKind.map((k) => <Stat key={k.kind} label={k.kind} value={k._count} />)}
          <Stat label="Estimated cost" value={`$${aiCost.toFixed(2)}`} />
        </Card>

        <Card title="Speed">
          <Stat label="Database round trip (average of 5)" value={`${dbMs} ms`} />
          <Stat label="App server region (Vercel)" value={process.env.VERCEL_REGION ?? "local"} />
          <Stat label="Database region (Neon)" value={dbRegion} />
          <p className="pt-2 text-xs text-chalk-muted">
            Every screen makes several database calls, so these should be in the same part of the country.
            If the round trip is over ~20 ms, set the Vercel function region to match the database (Vercel → Settings → Functions → Region).
          </p>
        </Card>

        <AiCheck />

        <Card title="Exercises">
          <Stat label="Library" value={exercises} />
          <Stat label="Created by people (private)" value={customExercises} />
        </Card>

        <p className="text-sm text-chalk-muted">
          To browse every table and row, open the Neon console (Vercel → Storage → your database → Open in Neon → Tables),
          or run <code>npx prisma studio</code> in the project folder with your database URL in <code>.env</code>.
        </p>
      </div>
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

function sevenDaysAgo() {
  return new Date(Date.now() - 7 * 86_400_000);
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-rack-raised p-5">
      <h2 className="mb-2 font-display text-2xl font-semibold">{title}</h2>
      <dl className="divide-y divide-rack-line">{children}</dl>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 text-sm">
      <dt className="min-w-0 truncate text-chalk-muted">{label}</dt>
      <dd className="font-display text-lg font-semibold tabular-nums">{typeof value === "number" ? value.toLocaleString("en-US") : value}</dd>
    </div>
  );
}
