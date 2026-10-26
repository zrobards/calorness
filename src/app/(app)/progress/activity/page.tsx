import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Footprints, Gauge, HeartPulse, Route, Timer, Trophy } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getActivityHistory } from "@/lib/activityHistory";
import { progress } from "@/lib/fitness/activity";
import { BarChart } from "@/components/charts/BarChart";
import { LineChart } from "@/components/charts/LineChart";
import { ActivityRings } from "@/components/charts/ActivityRings";

export const metadata: Metadata = { title: "Activity" };

const n = (v: number | null | undefined, digits = 0) => (v == null ? "—" : v.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits }));

export default async function ActivityPage() {
  const user = await requireUser();
  const h = await getActivityHistory(user.id);
  const speedUnit = h.imperial ? "mph" : "km/h";
  const distUnit = h.imperial ? "mi" : "km";

  return (
    <div className="px-5 pb-8" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}>
      <Link href="/progress" className="-ml-1 inline-flex items-center gap-1 py-2 text-sm font-medium text-chalk-muted">
        <ChevronLeft size={18} aria-hidden /> Progress
      </Link>
      <h1 className="font-display text-4xl font-bold tracking-tight">Activity</h1>

      {!h.connected ? (
        <Link href="/profile#health" className="mt-4 flex items-start gap-3 rounded-2xl border border-plate-blue/50 bg-plate-blue/10 p-4">
          <HeartPulse className="mt-0.5 shrink-0 text-plate-blue" size={24} aria-hidden />
          <span>
            <span className="block font-display text-xl font-semibold">Connect Apple Health</span>
            <span className="text-sm text-chalk-muted">A two-minute iPhone Shortcut sends your steps, active calories, exercise minutes, walking speed, and distance here every day.</span>
          </span>
        </Link>
      ) : (
        <>
          <p className="text-sm text-chalk-muted">From Apple Health{h.lastSync ? `, last synced ${h.lastSync.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}` : ""}.</p>

          {/* Today */}
          <section className="mt-4 flex items-center gap-5 rounded-2xl bg-rack-raised p-5" aria-label="Today">
            <ActivityRings size={112} rings={[
              { value: progress(h.today?.activeCalories, h.goals.activeCalGoal), color: "var(--color-plate-red)", label: "Move" },
              { value: progress(h.today?.steps, h.goals.stepGoal), color: "var(--color-plate-green)", label: "Steps" },
              { value: progress(h.today?.exerciseMinutes, h.goals.exerciseMinGoal), color: "var(--color-plate-blue)", label: "Exercise" },
            ]} />
            <dl className="flex-1 space-y-1.5 text-sm">
              <Row color="text-plate-red" label="Move" value={`${n(h.today?.activeCalories)} / ${n(h.goals.activeCalGoal)} cal`} />
              <Row color="text-plate-green" label="Steps" value={`${n(h.today?.steps)} / ${n(h.goals.stepGoal)}`} />
              <Row color="text-plate-blue" label="Exercise" value={`${n(h.today?.exerciseMinutes)} / ${n(h.goals.exerciseMinGoal)} min`} />
            </dl>
          </section>

          {/* Key numbers */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Tile icon={<Footprints size={18} />} label="Steps, 7-day avg" value={n(h.stats.steps7)} sub={`30-day avg ${n(h.stats.steps30)}`} />
            <Tile icon={<HeartPulse size={18} />} label="Active cal, 7-day avg" value={n(h.stats.cal7)} sub={`30-day avg ${n(h.stats.cal30)}`} />
            <Tile icon={<Gauge size={18} />} label="Walking speed" value={h.stats.speedNow ? `${n(h.stats.speedNow, 1)} ${speedUnit}` : "—"}
              sub={h.stats.speedChange !== null ? `${h.stats.speedChange >= 0 ? "▲" : "▼"} ${Math.abs(Math.round(h.stats.speedChange * 100))}% over the month` : "Sync a few days to see a trend"} />
            <Tile icon={<Route size={18} />} label="Distance, last 7 days" value={`${n(h.stats.distance7 ? (h.imperial ? h.stats.distance7 / 1609.344 : h.stats.distance7 / 1000) : null, 1)} ${distUnit}`} sub="Walking and running" />
            <Tile icon={<Timer size={18} />} label="Exercise, 7-day avg" value={`${n(h.stats.exercise7)} min`} sub={`Goal ${h.goals.exerciseMinGoal} min a day`} />
            <Tile icon={<Trophy size={18} />} label="Step goal hit" value={`${h.stats.stepGoalDays} of ${h.stats.daysSynced} days`}
              sub={h.stats.stepStreak > 1 ? `${h.stats.stepStreak} days in a row now` : h.stats.bestSteps ? `Best: ${n(h.stats.bestSteps.steps)}` : ""} />
          </div>

          <Card title="Steps" subtitle="Last 30 days, dashed line is your goal">
            <BarChart label="Daily steps" data={h.chart.map((d) => ({ label: d.label, value: d.steps }))} target={h.goals.stepGoal} highlightLast formatValue={(v) => v.toLocaleString("en-US")} />
          </Card>
          <Card title="Active calories" subtitle={h.goals.useHealthCalories ? "These count toward your exercise calories in the Diary" : "Shown for reference; the Diary uses your logged workouts"}>
            <BarChart label="Daily active calories" data={h.chart.map((d) => ({ label: d.label, value: d.activeCalories }))} target={h.goals.activeCalGoal} highlightLast />
          </Card>
          {h.chart.some((d) => d.speed) && (
            <Card title={`Walking speed (${speedUnit})`} subtitle="Your average pace when walking. A faster everyday pace is a strong sign of fitness.">
              <LineChart id="walking-speed" label="Walking speed" color="var(--color-plate-yellow)"
                points={h.chart.map((d, i) => ({ x: i, y: d.speed ?? NaN, label: d.label })).filter((p) => !Number.isNaN(p.y))} formatValue={(v) => v.toFixed(1)} />
            </Card>
          )}
          {h.chart.some((d) => d.restingHr) && (
            <Card title="Resting heart rate" subtitle={`7-day average ${n(h.stats.restingHr)} bpm. Lower over time usually means better fitness.`}>
              <LineChart id="resting-hr" label="Resting heart rate" color="var(--color-plate-red)"
                points={h.chart.map((d, i) => ({ x: i, y: d.restingHr ?? NaN, label: d.label })).filter((p) => !Number.isNaN(p.y))} />
            </Card>
          )}
        </>
      )}
      <p className="mt-6 text-center text-sm"><Link href="/profile#activity-goals" className="text-plate-blue">Change activity goals</Link></p>
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className={`font-semibold ${color}`}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function Tile({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl bg-rack-raised p-4">
      <p className="flex items-center gap-1.5 text-xs text-chalk-muted">{icon} {label}</p>
      <p className="mt-1 font-display text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-chalk-muted">{sub}</p>}
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 rounded-2xl bg-rack-raised p-5">
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      <p className="mb-3 text-sm text-chalk-muted">{subtitle}</p>
      {children}
    </section>
  );
}
