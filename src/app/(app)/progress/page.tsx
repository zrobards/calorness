import type { Metadata } from "next";
import { Collapsible } from "@/components/ui/Collapsible";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
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

export const metadata: Metadata = { title: "Progress" };

export default async function ProgressPage() {
  const user = await requireUser();
  const now = new Date();
  const { today } = await userToday(user.id, now);
  const [progress, unitSystem, calorieWeek, goal] = await Promise.all([
    getProgress(user.id, now),
    getUnitSystem(user.id),
    getCalorieWeek(user.id, today),
    db.goal.findUnique({ where: { userId: user.id }, select: { calories: true } }),
  ]);
  const loggedDays = calorieWeek.filter((d) => d.calories > 0);
  const unit = weightUnit(unitSystem);
  const w = (kg: number) => displayWeight(kg, unitSystem);
  const { weeks, bodyweights, topLifts } = progress;
  const hasTraining = topLifts.length > 0;

  return (
    <>
      <PageHeader title="Progress" />
      <Link href="/progress/activity" className="animate-rise mx-5 mb-4 flex items-center justify-between rounded-2xl bg-rack-raised px-5 py-4">
        <span>
          <span className="block font-display text-xl font-semibold">Activity</span>
          <span className="text-sm text-chalk-muted">Steps, active calories, walking speed, and goals</span>
        </span>
        <ChevronRight className="text-chalk-muted" aria-hidden />
      </Link>

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
          <Card title="Muscles" subtitle="Working sets per muscle. Tap one to see which sets counted.">
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
                    <span className={`flex size-9 shrink-0 items-center justify-center rounded-full border-4 border-rack font-display font-bold text-white ${["bg-plate-red", "bg-plate-blue", "bg-plate-yellow", "bg-plate-green", "bg-chalk-muted"][i]}`}>
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
function Card({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <Collapsible id={`chart-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`} title={title} summary={subtitle} defaultOpen>
        <p className="mt-3 mb-3 text-sm text-chalk-muted">{subtitle}</p>
        {children}
      </Collapsible>
    </div>
  );
}
