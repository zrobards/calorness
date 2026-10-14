import "server-only";
import { db } from "@/lib/db";
import type { AiFoodItem } from "@/lib/ai/parse";
import { dayToDate, type MealName } from "@/lib/nutrition/diary";
import { dayInZone, hourInZone } from "@/lib/time";
import { mealForTime } from "@/lib/nutrition/meals";

/** Save AI-estimated foods and log each one. Shared by the app and the phone shortcut. */
export async function saveAiItems(userId: string, day: string, meal: MealName, items: AiFoodItem[]) {
  await db.$transaction(
    items.map((i) =>
      db.diaryEntry.create({
        data: {
          user: { connect: { id: userId } },
          date: dayToDate(day),
          meal,
          servings: 1,
          food: {
            create: {
              source: "AI_ESTIMATE",
              name: i.name,
              servingSize: i.grams || 1,
              servingUnit: i.grams ? "g" : "serving",
              servingLabel: i.portion,
              calories: i.calories,
              proteinG: i.protein_g,
              carbsG: i.carbs_g,
              fatG: i.fat_g,
              createdBy: { connect: { id: userId } },
            },
          },
        },
      }),
    ),
  );
}

/** "Now" in the app's time zone, for requests that don't say which day or meal. */
export function nowInZone(timeZone: string, now = new Date()) {
  const hour = hourInZone(now, timeZone);
  const local = new Date(2000, 0, 1, Math.floor(hour), Math.round((hour % 1) * 60));
  return { day: dayInZone(now, timeZone), meal: mealForTime(local) };
}
