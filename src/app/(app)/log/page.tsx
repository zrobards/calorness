import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { QuickLogClient } from "@/components/log/QuickLogClient";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { aiConfigured } from "@/lib/ai/foodVision";
import { getDiaryDay, getRecentFoods } from "@/lib/nutrition/diary";
import { getActiveWorkout } from "@/lib/training";
import { APP_TIME_ZONE } from "@/lib/fitness/dates";

export const metadata: Metadata = { title: "Quick log" };

export default async function QuickLogPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const user = await requireUser();
  const { mode } = await searchParams;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: APP_TIME_ZONE });

  const [recent, diary, active, routines] = await Promise.all([
    getRecentFoods(user.id),
    getDiaryDay(user.id, today),
    getActiveWorkout(user.id),
    db.routine.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, workouts: { orderBy: { startedAt: "desc" }, take: 1, select: { startedAt: true } } },
    }),
  ]);

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
