import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Trophy } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getFinishedWorkout, getUnitSystem } from "@/lib/training";
import { bestSet, findNewRecords, type PersonalRecords } from "@/lib/fitness/strength";
import { displayWeight, weightUnit } from "@/lib/fitness/units";
import { formatDay, formatDuration } from "@/lib/fitness/dates";
import { DeleteWorkoutButton } from "./DeleteWorkoutButton";
import { PlateBurst } from "@/components/motion/PlateBurst";
import { AnimatedNumber } from "@/components/motion/AnimatedNumber";
import { reopenWorkout } from "../../actions";
import { Pencil, RotateCcw } from "lucide-react";

export const metadata: Metadata = { title: "Workout" };

const RECORD_LABELS: Record<keyof PersonalRecords, { label: string; color: string }> = {
  heaviestKg: { label: "Heaviest weight", color: "bg-plate-red" },
  bestE1rmKg: { label: "Best estimated 1RM", color: "bg-plate-blue" },
  bestSetVolumeKg: { label: "Best set volume", color: "bg-plate-yellow" },
};

export default async function WorkoutDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ finished?: string }>;
}) {
  const user = await requireUser();
  const [{ id }, { finished }] = await Promise.all([params, searchParams]);
  const [data, unitSystem] = await Promise.all([getFinishedWorkout(user.id, id), getUnitSystem(user.id)]);
  if (!data) notFound();
  const { workout, records } = data;
  const unit = weightUnit(unitSystem);
  const w = (kg: number) => displayWeight(kg, unitSystem);

  // A PR only counts if you had history to beat; first-ever sessions set a baseline
  const prs = workout.exercises.flatMap((e) => {
    const previous = records[e.exerciseId];
    const hasHistory = previous.heaviestKg > 0;
    return hasHistory ? findNewRecords(previous, e.sets).map((kind) => ({ exercise: e, kind })) : [];
  });
  const prExercises = workout.exercises
    .map((exercise) => ({ exercise, kinds: prs.filter((p) => p.exercise.id === exercise.id).map((p) => p.kind) }))
    .filter((e) => e.kinds.length > 0);
  const justFinished = finished === "1";

  return (
    <div className="px-5" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}>
      <Link href="/train" className="-ml-1 inline-flex items-center gap-1 py-2 text-sm font-medium text-chalk-muted">
        <ChevronLeft size={18} aria-hidden /> Train
      </Link>

      {justFinished && (
        <p className="mt-4 font-display text-xl font-semibold text-plate-green">Workout complete</p>
      )}
      <h1 className="mt-1 font-display text-5xl leading-none font-bold tracking-tight">{workout.name}</h1>
      <p className="mt-2 text-chalk-muted">{formatDay(workout.startedAt, { weekday: "long", month: "long", day: "numeric" })}</p>

      <dl className="mt-6 grid grid-cols-3 gap-2">
        {[
          { label: "Duration", value: formatDuration(workout.durationMs) },
          { label: `Volume (${unit})`, value: <AnimatedNumber value={Math.round(w(workout.volumeKg))} /> },
          { label: "Sets", value: <AnimatedNumber value={workout.setCount} duration={600} /> },
        ].map((s, i) => (
          <div key={s.label} className="animate-rise rounded-2xl bg-rack-raised px-3 py-4 text-center" style={{ "--i": i } as React.CSSProperties}>
            <dd className="font-display text-3xl font-bold tabular-nums">{s.value}</dd>
            <dt className="mt-1 text-xs text-chalk-muted">{s.label}</dt>
          </div>
        ))}
      </dl>

      {prs.length > 0 && (
        <section className="animate-rise mt-6 overflow-hidden rounded-2xl border border-plate-yellow/40 bg-plate-yellow/10 p-5" style={{ "--i": 3 } as React.CSSProperties} aria-label="Personal records">
          <h2 className="flex items-center gap-2 font-display text-2xl font-semibold">
            <Trophy className="text-plate-yellow" size={24} aria-hidden />
            {prs.length} new {prs.length === 1 ? "record" : "records"}
          </h2>
          <ul className="mt-3 space-y-3">
            {prExercises.map(({ exercise, kinds }) => (
              <li key={exercise.id}>
                <p className="font-medium">{exercise.exercise.name}</p>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {kinds.map((kind) => (
                    <li key={kind} className="flex items-center gap-1.5 rounded-full bg-rack/60 py-1 pr-3 pl-1.5 text-sm">
                      <span className={`size-3.5 rounded-full border-[3px] border-rack ${RECORD_LABELS[kind].color}`} aria-hidden />
                      {RECORD_LABELS[kind].label}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ul className="mt-6 space-y-3">
        {workout.exercises.map((e) => {
          const best = bestSet(e.sets);
          let n = 0;
          return (
            <li key={e.id} className="rounded-2xl bg-rack-raised p-4">
              <Link href={`/train/exercises/${e.exercise.slug}`} className="font-display text-xl font-semibold text-plate-blue">
                {e.exercise.name}
              </Link>
              <ol className="mt-2 space-y-1 text-sm">
                {e.sets.map((s) => {
                  const label = s.type === "WARMUP" ? "W" : s.type === "DROP" ? "D" : s.type === "FAILURE" ? "F" : String(++n);
                  const isBest = best?.set === s;
                  return (
                    <li key={s.id} className="flex items-center gap-3 tabular-nums">
                      <span className="w-5 text-center font-display font-bold text-chalk-muted">{label}</span>
                      <span className={isBest ? "font-semibold" : ""}>
                        {w(s.weightKg ?? 0)} {unit} × {s.reps}
                      </span>
                      {isBest && <span className="rounded-full bg-plate-blue/20 px-2 py-0.5 text-xs text-plate-blue">Best set</span>}
                    </li>
                  );
                })}
              </ol>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Link href={`/train/history/${workout.id}/edit`} className="flex items-center justify-center gap-2 rounded-xl bg-rack-raised py-3 font-medium">
          <Pencil size={17} aria-hidden /> Edit sets
        </Link>
        <form action={reopenWorkout.bind(null, workout.id)}>
          <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-rack-raised py-3 font-medium">
            <RotateCcw size={17} aria-hidden /> Keep going
          </button>
        </form>
      </div>
      <p className="mt-2 text-center text-xs text-chalk-muted">Ended early? &ldquo;Keep going&rdquo; reopens it so you can log more sets.</p>

      <div className="mt-8 mb-6 flex justify-center">
        <DeleteWorkoutButton id={workout.id} />
      </div>
      {justFinished && <PlateBurst />}
    </div>
  );
}
