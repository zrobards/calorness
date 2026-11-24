import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isDay, isMonth, summarize } from "@/lib/calendar";
import { getMonth } from "@/lib/calendarData";
import { getUnitSystem } from "@/lib/training";
import { userToday } from "@/lib/userPrefs";
import { CalendarView } from "./CalendarView";

export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string; day?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const { today, timeZone } = await userToday(user.id);
  // ?day=2026-11-03 opens that day; ?month=2026-10 opens that month
  const month = isMonth(sp.month) ? sp.month : isDay(sp.day) ? sp.day.slice(0, 7) : today.slice(0, 7);
  const [days, goal, unitSystem] = await Promise.all([
    getMonth(user.id, month, timeZone),
    db.goal.findUnique({ where: { userId: user.id }, select: { calories: true, proteinG: true, carbsG: true, fatG: true } }),
    getUnitSystem(user.id),
  ]);
  const selected = isDay(sp.day) && sp.day.startsWith(month) ? sp.day : today.startsWith(month) ? today : null;

  return (
    <>
      <PageHeader title="Calendar" />
      <CalendarView
        key={month}
        month={month}
        today={today}
        initialDay={selected}
        days={days}
        summary={summarize(days, goal?.calories ?? null)}
        goal={goal}
        imperial={unitSystem === "IMPERIAL"}
      />
    </>
  );
}
