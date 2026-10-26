import Link from "next/link";
import { Flame, HeartPulse, Zap } from "lucide-react";
import type { TodaySummary } from "@/lib/activitySummary";
import { progress } from "@/lib/fitness/activity";
import { ActivityRings } from "@/components/charts/ActivityRings";

const RED = "var(--color-plate-red)", GREEN = "var(--color-plate-green)", BLUE = "var(--color-plate-blue)";

/** Quick log's top card: activity rings, streaks, and one line of encouragement. */
export function TodayCard({ s, message }: { s: TodaySummary; message: string }) {
  return (
    <Link href="/progress/activity" className="animate-rise mt-4 flex items-center gap-4 rounded-2xl bg-rack-raised p-4" aria-label="Today's activity">
      <ActivityRings
        size={84}
        rings={[
          { value: progress(s.activeCalories.value, s.activeCalories.goal), color: RED, label: "Active calories" },
          { value: progress(s.steps.value, s.steps.goal), color: GREEN, label: "Steps" },
          { value: progress(s.exerciseMinutes.value, s.exerciseMinutes.goal), color: BLUE, label: "Exercise minutes" },
        ]}
      />
      <div className="min-w-0 flex-1">
        {s.healthConnected ? (
          <dl className="grid grid-cols-3 gap-1 text-center">
            <Stat label="Move" value={s.activeCalories.value} color="text-plate-red" />
            <Stat label="Steps" value={s.steps.value} color="text-plate-green" />
            <Stat label="Exercise" value={s.exerciseMinutes.value} color="text-plate-blue" />
          </dl>
        ) : (
          <p className="flex items-center gap-1.5 text-sm font-medium text-plate-blue"><HeartPulse size={16} aria-hidden /> Connect Apple Health for steps and active calories</p>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-semibold">
          <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 ${s.logStreak ? "bg-plate-yellow/20 text-plate-yellow" : "bg-rack text-chalk-muted"}`}>
            <Flame size={12} aria-hidden /> {s.logStreak ? `${s.logStreak}-day logging streak` : "Log today to start a streak"}
          </span>
          {s.activeStreak > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-plate-green/20 px-2 py-0.5 text-plate-green"><Zap size={12} aria-hidden /> {s.activeStreak} active {s.activeStreak === 1 ? "day" : "days in a row"}</span>
          )}
        </div>
        <p className="mt-1.5 truncate text-xs text-chalk-muted">{message}</p>
      </div>
    </Link>
  );
}

function Stat({ label, value, color }: { label: string; value: number | null; color: string }) {
  return (
    <div>
      <dd className={`font-display text-lg leading-tight font-bold tabular-nums ${color}`}>{value === null ? "—" : value.toLocaleString("en-US")}</dd>
      <dt className="text-[10px] text-chalk-muted uppercase">{label}</dt>
    </div>
  );
}
