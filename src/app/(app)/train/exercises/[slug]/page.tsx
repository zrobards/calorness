import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { LineChart } from "@/components/charts/LineChart";
import { titleCase } from "@/components/train/muscleFilters";
import { requireUser } from "@/lib/auth";
import { exerciseImageUrl, getExerciseDetail, getUnitSystem } from "@/lib/training";
import { displayWeight, weightUnit } from "@/lib/fitness/units";
import { formatDay } from "@/lib/fitness/dates";
import { DeleteExerciseButton } from "./DeleteExerciseButton";

export const metadata: Metadata = { title: "Exercise" };

export default async function ExerciseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const { slug } = await params;
  const [data, unitSystem] = await Promise.all([getExerciseDetail(user.id, slug), getUnitSystem(user.id)]);
  if (!data) notFound();
  const { exercise, sessions } = data;
  const unit = weightUnit(unitSystem);
  const w = (kg: number) => displayWeight(kg, unitSystem);

  const bestEver = sessions.reduce((max, s) => Math.max(max, s.best?.e1rm ?? 0), 0);
  const heaviest = sessions.reduce((max, s) => Math.max(max, ...s.sets.map((x) => x.weightKg ?? 0)), 0);

  return (
    <div className="px-5 pb-6" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}>
      <Link href="/train/exercises" className="-ml-1 inline-flex items-center gap-1 py-2 text-sm font-medium text-chalk-muted">
        <ChevronLeft size={18} aria-hidden /> Exercises
      </Link>
      <h1 className="mt-2 font-display text-4xl leading-none font-bold tracking-tight">{exercise.name}</h1>
      <p className="mt-2 text-chalk-muted">
        {titleCase(exercise.primaryMuscles.join(", "))}
        {exercise.equipment ? `, ${exercise.equipment}` : ""}
        {exercise.level ? `, ${exercise.level}` : ""}
      </p>

      {exercise.images.length > 0 && (
        <div className="mt-5 grid grid-cols-2 gap-2 overflow-hidden rounded-2xl">
          {exercise.images.map((img, i) => (
            <Image key={img} src={exerciseImageUrl(img)!} alt={`${exercise.name}, ${i === 0 ? "start" : "end"} position`}
              width={300} height={300} unoptimized className="aspect-square w-full bg-chalk object-cover" />
          ))}
        </div>
      )}

      {sessions.length > 0 ? (
        <section className="mt-6 rounded-2xl bg-rack-raised p-5" aria-label="Your progress">
          <dl className="grid grid-cols-3 gap-2">
            <div><dt className="text-xs text-chalk-muted">Best est. 1RM</dt><dd className="font-display text-2xl font-bold tabular-nums">{Math.round(w(bestEver))} {unit}</dd></div>
            <div><dt className="text-xs text-chalk-muted">Heaviest</dt><dd className="font-display text-2xl font-bold tabular-nums">{w(heaviest)} {unit}</dd></div>
            <div><dt className="text-xs text-chalk-muted">Sessions</dt><dd className="font-display text-2xl font-bold tabular-nums">{sessions.length}</dd></div>
          </dl>
          {sessions.length > 1 && (
            <div className="mt-4">
              <p className="mb-1 text-sm text-chalk-muted">Estimated 1RM over time</p>
              <LineChart
                id="e1rm"
                label={`Estimated one-rep max for ${exercise.name}`}
                points={sessions.map((s) => ({ x: s.workout.startedAt.getTime(), y: w(s.best!.e1rm), label: formatDay(s.workout.startedAt, { month: "short", day: "numeric" }) }))}
              />
            </div>
          )}
        </section>
      ) : (
        <p className="mt-6 rounded-2xl border border-dashed border-rack-line p-5 text-chalk-muted">
          Log this exercise in a workout and your best sets and progress chart will appear here.
        </p>
      )}

      {exercise.createdById === user.id && (
        <div className="mt-6">
          <DeleteExerciseButton id={exercise.id} />
        </div>
      )}

      {exercise.instructions.length > 0 && (
        <section className="mt-6">
          <h2 className="font-display text-2xl font-semibold">How to do it</h2>
          <ol className="mt-3 space-y-3">
            {exercise.instructions.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-rack-raised font-display font-bold">{i + 1}</span>
                <p className="leading-relaxed text-chalk/90">{step}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
