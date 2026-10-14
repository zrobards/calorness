import type { Metadata } from "next";
import Link from "next/link";
import { Dumbbell, ShieldCheck, Target } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { MacroBars } from "@/components/MacroBars";
import { CalorieRing } from "@/components/diary/CalorieRing";
import { DayNav, shiftDay } from "@/components/diary/DayNav";
import { MealSection } from "@/components/diary/MealSection";
import { WaterCard } from "@/components/diary/WaterCard";
import { CopyDayButton } from "@/components/diary/CopyDayButton";
import { requireUser } from "@/lib/auth";
import { getDiaryDay, toCandidate } from "@/lib/nutrition/diary";
import { getUnitSystem } from "@/lib/training";
import { userToday } from "@/lib/userPrefs";
import { compactNumber, displayWeight, weightUnit } from "@/lib/fitness/units";

export const metadata: Metadata = { title: "Diary" };

export default async function DiaryPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const user = await requireUser();
  const { today, timeZone } = await userToday(user.id);
  const { day: dayParam } = await searchParams;
  const day = dayParam && /^\d{4}-\d{2}-\d{2}$/.test(dayParam) ? dayParam : today;

  const [diary, unitSystem] = await Promise.all([getDiaryDay(user.id, day, timeZone), getUnitSystem(user.id)]);
  const { goal, totals, meals, workouts } = diary;

  return (
    <>
      <PageHeader title="Diary">
        <DayNav day={day} today={today} />
      </PageHeader>

      {goal ? (
        <section className="animate-rise mx-5 rounded-2xl bg-rack-raised p-5" aria-label="Day summary">
          <CalorieRing eaten={totals.calories} goal={goal.calories} />
          <dl className="mt-4 mb-5 grid grid-cols-3 text-center">
            <div><dd className="font-display text-xl font-semibold tabular-nums">{goal.calories.toLocaleString("en-US")}</dd><dt className="text-xs text-chalk-muted">Goal</dt></div>
            <div><dd className="font-display text-xl font-semibold tabular-nums">{Math.round(totals.calories).toLocaleString("en-US")}</dd><dt className="text-xs text-chalk-muted">Food</dt></div>
            <div><dd className="font-display text-xl font-semibold tabular-nums">{Math.round(goal.calories - totals.calories).toLocaleString("en-US")}</dd><dt className="text-xs text-chalk-muted">Remaining</dt></div>
          </dl>
          <MacroBars eaten={totals} goal={goal} />
          {diary.verified !== null && (
            <p className={`mt-4 flex items-center gap-2 text-sm ${diary.verified >= 0.8 ? "text-plate-green" : "text-plate-yellow"}`}>
              <ShieldCheck size={16} aria-hidden />
              {Math.round(diary.verified * 100)}% verified
              <span className="text-chalk-muted">
                {diary.verified >= 0.999 ? "(all from labels, barcodes, or the food database)" : "(the rest is AI estimates, tagged below)"}
              </span>
            </p>
          )}
        </section>
      ) : (
        <EmptyState Icon={Target} title="Set your daily targets">
          Add a calorie and macro goal to see what&apos;s left each day. You can still log food without one.{" "}
          <Link href="/profile#goals" className="font-medium text-chalk underline underline-offset-4">Set goals</Link>
        </EmptyState>
      )}

      {/* Where training and nutrition meet */}
      {workouts.length > 0 && (
        <Link href={`/train/history/${workouts[0].id}`} className="mx-5 mt-4 flex items-center gap-3 rounded-2xl border border-plate-blue/40 bg-plate-blue/10 px-5 py-3.5">
          <Dumbbell className="shrink-0 text-plate-blue" size={22} aria-hidden />
          <span className="text-sm">
            <span className="block font-medium">Training day: {workouts.map((w) => w.name).join(", ")}</span>
            <span className="text-chalk-muted">
              {compactNumber(displayWeight(workouts.reduce((s, w) => s + w.volumeKg, 0), unitSystem))} {weightUnit(unitSystem)} lifted.
              {goal ? ` Hitting ${goal.proteinG}g protein today helps you recover.` : ""}
            </span>
          </span>
        </Link>
      )}

      {meals.every((m) => m.items.length === 0) && <CopyDayButton fromDay={shiftDay(day, -1)} toDay={day} />}

      {meals.map((m, index) => (
        <MealSection
          key={m.meal}
          index={index}
          meal={m.meal}
          label={m.label}
          day={day}
          yesterday={shiftDay(day, -1)}
          calories={m.totals.calories}
          items={m.items.map((i) => ({ id: i.id, servings: i.servings, food: toCandidate(i.food), calories: i.nutrients.calories }))}
        />
      ))}

      <WaterCard day={day} ml={diary.waterMl} goalMl={goal?.waterMl ?? 2500} imperial={unitSystem === "IMPERIAL"} />
      <div className="h-4" />
    </>
  );
}
