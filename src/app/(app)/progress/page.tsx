import type { Metadata } from "next";
import { Collapsible } from "@/components/ui/Collapsible";
import Link from "next/link";
import { ChevronRight, Settings, Sparkles } from "lucide-react";
import { TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { BarChart } from "@/components/charts/BarChart";
import { LineChart } from "@/components/charts/LineChart";
import { MuscleExplorer } from "@/components/charts/MuscleExplorer";
import { requireUser } from "@/lib/auth";
import { getProgress, getUnitSystem } from "@/lib/training";
import { getCalorieWeek } from "@/lib/nutrition/diary";
import { db } from "@/lib/db";
import { compactNumber, displayWeight, weightUnit } from "@/lib/fitness/units";
import { formatDay } from "@/lib/fitness/dates";
import { userToday } from "@/lib/userPrefs";
import { BodyweightForm } from "./BodyweightForm";
import { getTodaySummary } from "@/lib/activitySummary";

export const metadata: Metadata = { title: "You" };

export default async function ProgressPage() {
  const user = await requireUser();
  const now = new Date();
  const { today } = await userToday(user.id, now);
  const [progress, unitSystem, calorieWeek, goal, summary, me, workoutCount] = await Promise.all([
    getProgress(user.id, now),
    getUnitSystem(user.id),
    getCalorieWeek(user.id, today),
    db.goal.findUnique({ where: { userId: user.id }, select: { calories: true } }),
    getTodaySummary(user.id),
    db.user.findUniqueOrThrow({ where: { id: user.id }, select: { name: true, email: true, handle: true, _count: { select: { followers: { where: { status: "ACCEPTED" } }, following: { where: { status: "ACCEPTED" } } } } } }),
    db.workout.count({ where: { userId: user.id, endedAt: { not: null } } }),
  ]);
  const loggedDays = calorieWeek.filter((d) => d.calories > 0);
  const unit = weightUnit(unitSystem);
  const w = (kg: number) => displayWeight(kg, unitSystem);
  const { weeks, bodyweights, topLifts } = progress;
  const hasTraining = topLifts.length > 0;
  // This week at a glance
  const thisWeek = weeks.at(-1)!, lastWeek = weeks.at(-2)!;
  const avgCal = loggedDays.length ? Math.round(loggedDays.reduce((s, d) => s + d.calories, 0) / loggedDays.length) : null;
  const recentBw = bodyweights.filter((b) => b.date.getTime() >= now.getTime() - 14 * 86_400_000);
  const bwChange = recentBw.length > 1 ? w(recentBw.at(-1)!.weightKg) - w(recentBw[0].weightKg) : null;
  const tiles = [
    { label: "Workouts this week", value: String(thisWeek.workouts), note: `${lastWeek.workouts} last week` },
    { label: "Logging streak", value: `${summary.logStreak} ${summary.logStreak === 1 ? "day" : "days"}`, note: summary.activeStreak > 1 ? `${summary.activeStreak} active days in a row` : summary.activeStreak === 1 ? "Active today" : "Keep it going today" },
    { label: "Avg calories", value: avgCal ? avgCal.toLocaleString("en-US") : "—", note: goal?.calories ? `Target ${Math.round(goal.calories).toLocaleString("en-US")}` : "Last 7 days" },
    { label: "Weight, 2 weeks", value: bwChange === null ? "—" : `${bwChange > 0 ? "+" : ""}${bwChange.toFixed(1)} ${unit}`, note: bodyweights.length ? `Now ${w(bodyweights.at(-1)!.weightKg)} ${unit}` : "Log a weigh-in below" },
  ];

  return (
    <>
      <PageHeader title="You">
        <Link href="/profile" className="rounded-xl bg-rack-raised p-2.5 text-chalk-muted" aria-label="Settings"><Settings size={20} /></Link>
      </PageHeader>

      {/* Who you are, then how the week is going */}
      <section aria-label="Your profile" className="mx-5 mb-4 flex items-center gap-4">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-plate-yellow text-2xl font-extrabold text-rack" aria-hidden>
          {(me.name ?? me.email ?? "?").trim().charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xl font-bold">{me.handle ? `@${me.handle}` : me.name ?? "Lifter"}</span>
          <span className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-chalk-muted">
            <span><b className="text-chalk">{workoutCount}</b> workouts</span>
            {me.handle ? (
              <Link href={`/u/${me.handle}`}><b className="text-chalk">{me._count.followers}</b> followers · <b className="text-chalk">{me._count.following}</b> following</Link>
            ) : (
              <span><b className="text-chalk">{summary.logStreak}</b>-day streak</span>
            )}
          </span>
        </span>
      </section>

      {/* The week at a glance; everything else opens on tap */}
      <section aria-label="This week" className="mx-5 grid grid-cols-2 gap-3">
        {tiles.map((t, i) => (
          <div key={t.label} className="animate-rise rounded-2xl bg-rack-raised p-4" style={{ "--i": i } as React.CSSProperties}>
            <p className="text-xs text-chalk-muted">{t.label}</p>
            <p className="mt-0.5 font-display text-3xl leading-tight font-bold tabular-nums">{t.value}</p>
            <p className="text-xs text-chalk-muted">{t.note}</p>
          </div>
        ))}
      </section>

      <nav aria-label="More progress" className="mx-5 mt-3 grid grid-cols-2 gap-3">
        <Link href="/progress/lifts" className="flex items-center justify-between rounded-2xl bg-rack-raised px-4 py-3.5 font-semibold">All lifts <ChevronRight size={18} className="text-chalk-muted" aria-hidden /></Link>
        <Link href="/progress/activity" className="flex items-center justify-between rounded-2xl bg-rack-raised px-4 py-3.5 font-semibold">Activity <ChevronRight size={18} className="text-chalk-muted" aria-hidden /></Link>
        <Link href="/coach" className="col-span-2 flex items-center justify-between rounded-2xl bg-rack-raised px-4 py-3.5 font-semibold">
          <span className="flex items-center gap-2"><Sparkles size={18} className="text-plate-yellow" aria-hidden /> Ask Coach</span>
          <ChevronRight size={18} className="text-chalk-muted" aria-hidden />
        </Link>
      </nav>
      <div className="mb-1" />

      {!hasTraining && (
        <div className="mb-4">
          <EmptyState Icon={TrendingUp} title="Nothing to chart yet">
            Finish a workout and your muscle map, weekly volume, and best lifts appear here.{" "}
            <Link href="/train" className="font-medium text-chalk underline underline-offset-4">Go to Train</Link>
          </EmptyState>
        </div>
      )}

      {hasTraining && (
        <>
          <Card title="Muscles" subtitle="Working sets per muscle. Tap one to see which sets counted." open>
            <MuscleExplorer contributions={progress.contributions} windows={progress.windows} imperial={unitSystem === "IMPERIAL"} />
          </Card>

          <Card title="Weekly volume" subtitle={`Total ${unit} lifted, last 8 weeks`}>
            <BarChart
              label="Weekly training volume for the last 8 weeks"
              formatValue={(v) => compactNumber(v)}
              data={weeks.map((wk) => ({
                label: formatDay(wk.weekStart, { month: "numeric", day: "numeric", timeZone: "UTC" }),
                value: w(wk.volumeKg),
              }))}
            />
          </Card>

          <Card title="Best lifts" subtitle="Your strongest by estimated one-rep max. Every lift is one tap away.">
            <ol className="space-y-3">
              {topLifts.map((l, i) => (
                <li key={l.slug}>
                  <Link href={`/train/exercises/${l.slug}`} className="flex items-center gap-3">
                    <span className={`flex size-9 shrink-0 items-center justify-center rounded-full border-4 border-rack font-display font-bold text-rack ${["bg-plate-blue", "bg-plate-blue", "bg-plate-yellow", "bg-plate-green", "bg-chalk-muted"][i]}`}>
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{l.name}</span>
                      <span className="text-sm text-chalk-muted">{w(l.weightKg)} {unit} × {l.reps}</span>
                    </span>
                    <span className="font-display text-2xl font-bold tabular-nums">
                      {Math.round(w(l.e1rmKg))}<span className="ml-1 text-sm font-semibold text-chalk-muted">{unit}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
            <Link href="/progress/lifts" className="mt-4 flex items-center justify-between rounded-xl bg-rack px-4 py-3 font-medium">
              See all your lifts <span className="text-sm text-chalk-muted">Search, sort, filter ›</span>
            </Link>
          </Card>
        </>
      )}

      {loggedDays.length > 0 && (
        <Card
          title="Calories, last 7 days"
          subtitle={`Averaging ${Math.round(loggedDays.reduce((s, d) => s + d.calories, 0) / loggedDays.length).toLocaleString("en-US")} on days you logged`}
        >
          <BarChart
            label="Calories eaten each day for the last 7 days"
            target={goal?.calories}
            formatValue={(v) => compactNumber(v)}
            data={calorieWeek.map((d) => ({ label: formatDay(d.date, { weekday: "short", timeZone: "UTC" }), value: Math.round(d.calories) }))}
          />
        </Card>
      )}

      <Card title="Bodyweight" subtitle={bodyweights.length ? `Last ${bodyweights.length} weigh-ins` : "Log your weight to see the trend"}>
        {bodyweights.length > 1 && (
          <div className="mb-4">
            <LineChart
              id="bodyweight"
              color="var(--color-plate-green)"
              label="Bodyweight trend"
              formatValue={(v) => v.toFixed(0)}
              points={bodyweights.map((b) => ({ x: b.date.getTime(), y: w(b.weightKg), label: formatDay(b.date, { month: "short", day: "numeric", timeZone: "UTC" }) }))}
            />
          </div>
        )}
        {bodyweights.length > 0 && (
          <p className="mb-4 font-display text-4xl font-bold tabular-nums">
            {w(bodyweights.at(-1)!.weightKg)} <span className="text-lg font-semibold text-chalk-muted">{unit}</span>
          </p>
        )}
        <BodyweightForm unit={unit} />
      </Card>
    </>
  );
}

/** Every chart can be folded away; it remembers your choice. */
function Card({ title, subtitle, children, open = false }: { title: string; subtitle: string; children: React.ReactNode; open?: boolean }) {
  return (
    <div className="mb-1">
      <Collapsible id={`chart-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} title={title} summary={subtitle} defaultOpen={open}>
        <p className="mt-3 mb-3 text-sm text-chalk-muted">{subtitle}</p>
        {children}
      </Collapsible>
    </div>
  );
}
