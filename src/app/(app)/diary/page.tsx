import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { userToday } from "@/lib/userPrefs";
import { DiaryView } from "@/components/diary/DiaryView";

export const metadata: Metadata = { title: "Diary" };

// The page itself only works out which day to show. DiaryView paints the
// copy saved on the phone instantly and refreshes it from the server.
export default async function DiaryPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const user = await requireUser();
  const [{ today }, { day: dayParam }] = await Promise.all([userToday(user.id), searchParams]);
  const day = dayParam && /^\d{4}-\d{2}-\d{2}$/.test(dayParam) ? dayParam : today;
  return <DiaryView key={day} initialDay={day} today={today} />;
}
