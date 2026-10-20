import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { FoodAdder } from "@/components/diary/FoodAdder";
import { requireUser } from "@/lib/auth";
import { getMyFoods, getRecentFoods, MEAL_LABELS, MEALS, type MealName } from "@/lib/nutrition/diary";
import { userToday } from "@/lib/userPrefs";
import { dayLabel } from "@/lib/fitness/dates";

export const metadata: Metadata = { title: "Add food" };

export default async function AddFoodPage({ searchParams }: { searchParams: Promise<{ meal?: string; day?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const { today } = await userToday(user.id);
  const meal: MealName = MEALS.includes(params.meal as MealName) ? (params.meal as MealName) : "SNACKS";
  const day = params.day && /^\d{4}-\d{2}-\d{2}$/.test(params.day) ? params.day : today;
  const [recent, mine] = await Promise.all([getRecentFoods(user.id), getMyFoods(user.id)]);

  return (
    <div style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}>
      <Link href={`/diary?day=${day}`} className="ml-4 inline-flex items-center gap-1 py-2 text-sm font-medium text-chalk-muted">
        <ChevronLeft size={18} aria-hidden /> Diary
      </Link>
      <h1 className="px-5 font-display text-4xl font-bold tracking-tight">Add to {MEAL_LABELS[meal]}</h1>
      <p className="mb-4 px-5 text-chalk-muted">{dayLabel(day, today)}</p>
      <FoodAdder meal={meal} mealLabel={MEAL_LABELS[meal]} day={day} recent={recent} mine={mine} />
    </div>
  );
}
