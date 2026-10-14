import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

const shift = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export function dayLabel(day: string, today: string) {
  if (day === today) return "Today";
  if (day === shift(today, -1)) return "Yesterday";
  if (day === shift(today, 1)) return "Tomorrow";
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

export function DayNav({ day, today }: { day: string; today: string }) {
  return (
    <nav className="flex items-center gap-1" aria-label="Change day">
      <Link href={`/diary?day=${shift(day, -1)}`} className="rounded-lg p-1.5 text-chalk-muted hover:text-chalk" aria-label="Previous day">
        <ChevronLeft size={22} />
      </Link>
      <Link href="/diary" className="min-w-24 text-center font-display text-lg font-semibold">
        {dayLabel(day, today)}
      </Link>
      <Link href={`/diary?day=${shift(day, 1)}`} className="rounded-lg p-1.5 text-chalk-muted hover:text-chalk" aria-label="Next day">
        <ChevronRight size={22} />
      </Link>
    </nav>
  );
}

export { shift as shiftDay };
