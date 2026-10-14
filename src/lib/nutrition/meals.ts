export type MealName = "BREAKFAST" | "LUNCH" | "DINNER" | "SNACKS";

/** Guess the meal from the time of day, so quick logging needs zero taps to choose it. */
export function mealForTime(date: Date): MealName {
  const h = date.getHours() + date.getMinutes() / 60;
  if (h >= 4 && h < 10.5) return "BREAKFAST";
  if (h >= 10.5 && h < 15) return "LUNCH";
  if (h >= 17 && h < 21.5) return "DINNER";
  return "SNACKS";
}

/** The phone's own calendar day as YYYY-MM-DD (not the server's). */
export function localDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
