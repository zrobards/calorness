import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ClipboardList, Flame, LayoutGrid, Library, Play, Plus, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/lib/auth";
import { getActiveWorkout, getRecentWorkouts, getRoutines, getThisWeek, getUnitSystem } from "@/lib/training";
import { compactNumber, displayWeight, weightUnit } from "@/lib/fitness/units";
import { formatDay, formatDuration, isoDay } from "@/lib/fitness/dates";
import { userToday } from "@/lib/userPrefs";
import { startWorkout } from "./actions";
import { db } from "@/lib/db";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";

export const metadata: Metadata = { title: "Train" };

export default async function TrainPage() {
  const user = await requireUser();
  const now = new Date();
  const [active, routines, recent, week, unitSystem, { today: todayIso }, injuries, activities] = await Promise.all([
    getActiveWorkout(user.id),
    getRoutines(user.id),
    getRecentWorkouts(user.id, 5),
    getThisWeek(user.id, now),
    getUnitSystem(user.id),
    userToday(user.id, now),
    db.coachNote.findMany({ where: { userId: user.id, active: true, kind: "injury" }, select: { id: true, text: true } }),
    db.activityEntry.findMany({ where: { userId: user.id }, orderBy: { startedAt: "desc" }, take: 5 }),
  ]);
  const weekStartDay = isoDay(week.days[0].date);
  const activeCalories = activities.filter((a) => isoDay(a.date) >= weekStartDay).reduce((s, a) => s + a.caloriesTotal, 0);
  const unit = weightUnit(unitSystem);
  const maxDay = Math.max(1, ...week.days.map((d) => d.volumeKg));
  const todayIndex = week.days.findIndex((d) => isoDay(d.date) === todayIso);

  return (
    <>
      <PageHeader title="Train">
        <div className="flex items-center gap-1">
          <Link href="/coach" className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-plate-yellow">
            <Sparkles size={18} aria-hidden /> Coach
          </Link>
          <Link href="/train/exercises" className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-chalk-muted hover:text-chalk">
            <Library size={18} aria-hidden /> Exercises
          </Link>
        </div>
      </PageHeader>

      {/* Anything Coach is keeping in mind about pain or injuries */}
      {injuries.length > 0 && (
        <Link href="/coach" className="mx-5 mb-4 flex items-start gap-3 rounded-2xl border border-plate-yellow/40 bg-plate-yellow/10 px-4 py-3 text-sm">
          <Sparkles size={18} className="mt-0.5 shrink-0 text-plate-yellow" aria-hidden />
          <span className="flex-1">
            {injuries.map((n) => <span key={n.id} className="block">{n.text}</span>)}
            <span className="text-chalk-muted">Tap to talk it through with Coach</span>
          </span>
        </Link>
      )}

      {active && (
        <Link
          href={`/train/workout/${active.id}`}
          className="mx-5 mb-4 flex items-center gap-3 rounded-2xl bg-plate-green px-5 py-4 text-white"
        >
          <span className="relative flex size-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60 motion-reduce:hidden" />
            <span className="relative inline-flex size-3 rounded-full bg-white" />
          </span>
          <span className="flex-1">
            <span className="block font-display text-xl font-semibold">Resume {active.name}</span>
            <span className="text-sm opacity-90">In progress</span>
          </span>
          <ChevronRight aria-hidden />
        </Link>
      )}

      {/* This week: each day is a bar sleeve; training days get a plate sized by volume */}
      <section className="animate-rise mx-5 rounded-2xl bg-rack-raised p-5" aria-label="This week">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-2xl font-semibold">This week</h2>
          <p className="text-sm text-chalk-muted">{week.workouts} {week.workouts === 1 ? "workout" : "workouts"}</p>
        </div>
        <ol className="mt-5 grid grid-cols-7 items-end gap-1">
          {week.days.map((d, i) => {
            const size = d.volumeKg > 0 ? 18 + 22 * (d.volumeKg / maxDay) : 0;
            return (
              <li key={i} className="flex flex-col items-center gap-2">
                <div className="flex h-11 items-center justify-center">
                  {d.workouts > 0 ? (
                    <span className="animate-plate-on rounded-full border-4 border-[#a8302c] bg-plate-red" style={{ width: size, height: size, "--i": i } as React.CSSProperties} aria-label={`${formatDay(d.date, { weekday: "long", timeZone: "UTC" })}: trained`} />
                  ) : (
                    <span className="h-1.5 w-5 rounded-full bg-rack-line" />
                  )}
                </div>
                <span className={`text-xs ${i === todayIndex ? "font-semibold text-chalk" : "text-chalk-muted"}`}>
                  {formatDay(d.date, { weekday: "narrow", timeZone: "UTC" })}
                </span>
              </li>
            );
          })}
        </ol>
        <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-rack-line pt-4">
          <div>
            <dt className="text-xs text-chalk-muted">Volume</dt>
            <dd className="font-display text-3xl font-bold tabular-nums">
              <AnimatedNumber id="week-volume" value={Math.round(displayWeight(week.volumeKg, unitSystem))} /> <span className="text-base font-semibold text-chalk-muted">{unit}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-chalk-muted">Working sets</dt>
            <dd className="font-display text-3xl font-bold tabular-nums"><AnimatedNumber id="week-sets" value={week.sets} /></dd>
          </div>
          <div>
            <dt className="text-xs text-chalk-muted">Cardio</dt>
            <dd className="font-display text-3xl font-bold tabular-nums">
              <AnimatedNumber id="week-cardio" value={activeCalories} /> <span className="text-base font-semibold text-chalk-muted">cal</span>
            </dd>
          </div>
        </dl>
      </section>

      <div className="mx-5 mt-4 grid grid-cols-[1.4fr_1fr] gap-3">
        {!active ? (
          <form action={startWorkout.bind(null, null)}>
            <button className="flex w-full items-center justify-center gap-2 rounded-2xl bg-plate-red py-4 font-display text-lg font-semibold text-white">
              <Play size={18} fill="currentColor" aria-hidden /> Start workout
            </button>
          </form>
        ) : <span />}
        <Link href="/train/cardio/new" className="flex items-center justify-center gap-2 rounded-2xl bg-rack-raised py-4 font-display text-lg font-semibold">
          <Flame size={18} className="text-plate-red" aria-hidden /> Log cardio
        </Link>
      </div>

      <section className="mt-8" aria-labelledby="routines-heading">
        <div className="flex items-center justify-between px-5">
          <h2 id="routines-heading" className="font-display text-2xl font-semibold">Routines</h2>
          <div className="flex items-center gap-3">
            <Link href="/train/templates" className="flex items-center gap-1 text-sm font-medium text-plate-blue">
              <LayoutGrid size={16} aria-hidden /> Programs
            </Link>
            <Link href="/train/routines/new" className="flex items-center gap-1 text-sm font-medium text-plate-blue">
              <Plus size={17} aria-hidden /> New
            </Link>
          </div>
        </div>
        {routines.length === 0 ? (
          <div className="mx-5 mt-3 grid grid-cols-2 gap-3">
            <Link href="/train/templates" className="rounded-2xl bg-plate-blue/15 p-4 ring-1 ring-plate-blue/40">
              <LayoutGrid className="text-plate-blue" size={24} aria-hidden />
              <span className="mt-2 block font-display text-lg font-semibold">Pick a program</span>
              <span className="text-sm text-chalk-muted">Push/Pull/Legs, 5×5, and more, ready to go</span>
            </Link>
            <Link href="/train/routines/new" className="rounded-2xl border-2 border-dashed border-rack-line p-4">
              <ClipboardList className="text-chalk-muted" size={24} aria-hidden />
              <span className="mt-2 block font-display text-lg font-semibold">Build your own</span>
              <span className="text-sm text-chalk-muted">Pick the exercises yourself</span>
            </Link>
          </div>
        ) : (
          <ul className="mt-3 space-y-3 px-5">
            {routines.map((r) => (
              <li key={r.id} className="rounded-2xl bg-rack-raised p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/train/routines/${r.id}`} className="min-w-0">
                    <h3 className="truncate font-display text-xl font-semibold">{r.name}</h3>
                    <p className="mt-0.5 line-clamp-2 text-sm text-chalk-muted">
                      {r.exercises.map((e) => e.exercise.name).join(", ")}
                    </p>
                  </Link>
                  <form action={startWorkout.bind(null, r.id)}>
                    <button className="flex items-center gap-1.5 rounded-xl bg-chalk px-4 py-2 font-display text-lg font-semibold text-rack" aria-label={`Start ${r.name}`}>
                      <Play size={15} fill="currentColor" aria-hidden /> Start
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {activities.length > 0 && (
        <section className="mt-8" aria-labelledby="cardio-heading">
          <h2 id="cardio-heading" className="px-5 font-display text-2xl font-semibold">Recent cardio</h2>
          <ul className="mx-5 mt-3 divide-y divide-rack-line rounded-2xl bg-rack-raised">
            {activities.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                <Flame size={18} className="shrink-0 text-plate-red" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{a.name}</span>
                  <span className="text-sm text-chalk-muted">{formatDay(a.date, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}, {Math.round(a.durationMin)} min</span>
                </span>
                <span className="font-display text-lg font-semibold tabular-nums">{a.caloriesTotal}<span className="ml-1 text-xs text-chalk-muted">cal</span></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8 mb-4" aria-labelledby="history-heading">
        <h2 id="history-heading" className="px-5 font-display text-2xl font-semibold">History</h2>
        {recent.length === 0 ? (
          <p className="mx-5 mt-2 text-chalk-muted">Finished workouts show up here with their volume and personal records.</p>
        ) : (
          <ul className="mt-3 space-y-3 px-5">
            {recent.map((w) => (
              <li key={w.id}>
                <Link href={`/train/history/${w.id}`} className="block rounded-2xl bg-rack-raised p-4 hover:bg-rack-line/60">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="truncate font-display text-xl font-semibold">{w.name}</h3>
                    <span className="shrink-0 text-sm text-chalk-muted">{formatDay(w.startedAt)}</span>
                  </div>
                  <p className="mt-1 text-sm text-chalk-muted">
                    {formatDuration(w.durationMs)}, {compactNumber(displayWeight(w.volumeKg, unitSystem))} {unit}, {w.setCount} sets
                  </p>
                  <p className="mt-1 truncate text-sm">{w.exercises.map((e) => e.exercise.name).join(", ")}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
