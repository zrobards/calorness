import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { QuickLogClient } from "@/components/log/QuickLogClient";
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

  const [recent, diary, active, routines, savedMeals] = await Promise.all([
    getRecentFoods(user.id),
    getDiaryDay(user.id, today, timeZone),
    getActiveWorkout(user.id),
    db.routine.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, workouts: { orderBy: { startedAt: "desc" }, take: 1, select: { startedAt: true } } },
    }),
    getSavedMeals(user.id),
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

  // The routine you haven't done for the longest time is probably next
  const nextRoutine =
    routines
      .map((r) => ({ id: r.id, name: r.name, last: r.workouts[0]?.startedAt.getTime() ?? 0 }))
      .sort((a, b) => a.last - b.last)[0] ?? null;

  return (
    <>
      <PageHeader title="Quick log" />
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
