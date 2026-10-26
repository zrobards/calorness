import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Target } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { QuickLogClient } from "@/components/log/QuickLogClient";
import { TodayCard } from "@/components/log/TodayCard";
import { getTodaySummary, nudge } from "@/lib/activitySummary";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { aiConfigured } from "@/lib/ai/foodVision";
import { getDiaryDay, getRecentFoods, getSavedMeals } from "@/lib/nutrition/diary";
import { suggestFits } from "@/lib/nutrition/fits";
import { getActiveWorkout } from "@/lib/training";
import { userToday } from "@/lib/userPrefs";

export const metadata: Metadata = { title: "Quick log" };

export default async function QuickLogPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const user = await requireUser();
  const { mode } = await searchParams;
  const { today, timeZone } = await userToday(user.id);

  const [recent, diary, active, routines, savedMeals, summary] = await Promise.all([
    getRecentFoods(user.id),
    getDiaryDay(user.id, today, timeZone),
    getActiveWorkout(user.id),
    db.routine.findMany({
      where: { userId: user.id },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, program: { select: { pinned: true } }, workouts: { orderBy: { startedAt: "desc" }, take: 1, select: { startedAt: true } } },
    }),
    getSavedMeals(user.id),
    getTodaySummary(user.id),
  ]);

  // Foods you usually eat, at your usual amount, that fit what's left today
  const left = diary.goal
    ? {
        calories: diary.goal.calories - diary.totals.calories,
        proteinG: diary.goal.proteinG - diary.totals.proteinG,
        carbsG: diary.goal.carbsG - diary.totals.carbsG,
        fatG: diary.goal.fatG - diary.totals.fatG,
      }
    : null;
  const fits = left
    ? suggestFits(
        left,
        recent
          .filter((r) => r.food.id)
          .map((r) => ({
            id: r.food.id!,
            name: r.food.name,
            servings: r.servings,
            calories: r.food.calories * r.servings,
            proteinG: r.food.proteinG * r.servings,
            carbsG: r.food.carbsG * r.servings,
            fatG: r.food.fatG * r.servings,
          })),
      )
    : [];

  // With an active program, next is the routine after the one you did last
  // (in program order, wrapping around). Otherwise, the one done longest ago.
  const inProgram = routines.filter((r) => r.program?.pinned);
  const last = (r: (typeof routines)[number]) => r.workouts[0]?.startedAt.getTime() ?? 0;
  const nextRoutine = (() => {
    if (inProgram.length) {
      const latest = inProgram.reduce((best, r, i) => (last(r) > last(inProgram[best]) ? i : best), 0);
      const r = last(inProgram[latest]) === 0 ? inProgram[0] : inProgram[(latest + 1) % inProgram.length];
      return { id: r.id, name: r.name };
    }
    const r = [...routines].sort((a, b) => last(a) - last(b))[0];
    return r ? { id: r.id, name: r.name } : null;
  })();

  return (
    <>
      <PageHeader title="Quick log" />
      {/* New here? One step makes everything else work */}
      {!diary.goal && (
        <Link href="/profile#goals" className="animate-rise mx-5 mb-5 flex items-center gap-3 rounded-2xl border border-plate-yellow/50 bg-plate-yellow/10 p-4">
          <Target className="shrink-0 text-plate-yellow" size={26} aria-hidden />
          <span className="flex-1">
            <span className="block font-display text-xl font-semibold">Set your daily targets</span>
            <span className="text-sm text-chalk-muted">Takes a minute. Then Calorness shows what&apos;s left and what fits.</span>
          </span>
          <ChevronRight className="text-chalk-muted" aria-hidden />
        </Link>
      )}
      {/* Activity rings, streaks, and a nudge: the reason to open the app every day */}
      <div className="px-5">
        <TodayCard s={summary} message={nudge(summary)} />
      </div>
      <QuickLogClient
        mode={mode}
        aiReady={aiConfigured()}
        recent={recent.filter((r) => r.food.id)}
        savedMeals={savedMeals}
        fits={fits}
        left={left}
        active={active ? { id: active.id, name: active.name } : null}
        nextRoutine={nextRoutine ? { id: nextRoutine.id, name: nextRoutine.name } : null}
        today={{
          calories: Math.round(diary.totals.calories),
          goal: diary.goal?.calories ?? null,
          proteinG: Math.round(diary.totals.proteinG),
          proteinGoal: diary.goal?.proteinG ?? null,
        }}
      />
    </>
  );
}
