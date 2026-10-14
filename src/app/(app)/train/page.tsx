import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ClipboardList, Library, Play, Plus } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/lib/auth";
import { getActiveWorkout, getRecentWorkouts, getRoutines, getThisWeek, getUnitSystem } from "@/lib/training";
import { compactNumber, displayWeight, weightUnit } from "@/lib/fitness/units";
import { APP_TIME_ZONE, formatDay, formatDuration, isoDay } from "@/lib/fitness/dates";
import { startWorkout } from "./actions";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";

export const metadata: Metadata = { title: "Train" };

export default async function TrainPage() {
  const user = await requireUser();
  const now = new Date();
  const [active, routines, recent, week, unitSystem] = await Promise.all([
    getActiveWorkout(user.id),
    getRoutines(user.id),
    getRecentWorkouts(user.id, 5),
    getThisWeek(user.id, now),
    getUnitSystem(user.id),
  ]);
  const unit = weightUnit(unitSystem);
  const maxDay = Math.max(1, ...week.days.map((d) => d.volumeKg));
  const todayIso = now.toLocaleDateString("en-CA", { timeZone: APP_TIME_ZONE }); // YYYY-MM-DD
  const todayIndex = week.days.findIndex((d) => isoDay(d.date) === todayIso);

  return (
    <>
      <PageHeader title="Train">
        <Link href="/train/exercises" className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-chalk-muted hover:text-chalk">
          <Library size={18} aria-hidden /> Exercises
        </Link>
      </PageHeader>

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
        <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-rack-line pt-4">
          <div>
            <dt className="text-xs text-chalk-muted">Volume</dt>
            <dd className="font-display text-3xl font-bold tabular-nums">
              <AnimatedNumber value={Math.round(displayWeight(week.volumeKg, unitSystem))} /> <span className="text-base font-semibold text-chalk-muted">{unit}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-chalk-muted">Working sets</dt>
            <dd className="font-display text-3xl font-bold tabular-nums"><AnimatedNumber value={week.sets} duration={600} /></dd>
          </div>
        </dl>
      </section>

      {!active && (
        <form action={startWorkout.bind(null, null)} className="mx-5 mt-4">
          <button className="flex w-full items-center justify-center gap-2 rounded-2xl bg-plate-red py-4 font-display text-xl font-semibold text-white">
            <Play size={20} fill="currentColor" aria-hidden /> Start empty workout
          </button>
        </form>
      )}

      <section className="mt-8" aria-labelledby="routines-heading">
        <div className="flex items-center justify-between px-5">
          <h2 id="routines-heading" className="font-display text-2xl font-semibold">Routines</h2>
          <Link href="/train/routines/new" className="flex items-center gap-1 text-sm font-medium text-plate-blue">
            <Plus size={17} aria-hidden /> New routine
          </Link>
        </div>
        {routines.length === 0 ? (
          <Link href="/train/routines/new" className="mx-5 mt-3 flex items-center gap-4 rounded-2xl border-2 border-dashed border-rack-line p-5 hover:border-plate-blue">
            <ClipboardList className="shrink-0 text-chalk-muted" size={28} aria-hidden />
            <span>
              <span className="block font-display text-lg font-semibold">Build your first routine</span>
              <span className="text-sm text-chalk-muted">Save a workout you repeat, like Push, Pull, or Legs, and start it in one tap.</span>
            </span>
          </Link>
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
