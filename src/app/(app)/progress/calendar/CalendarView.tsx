"use client";

import Link from "next/link";
import { useState } from "react";
import { Camera, ChevronLeft, ChevronRight, Dumbbell, Flame, Scale } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { calorieStatus, shiftMonth, type CalendarDay, type CalorieStatus, type MonthSummary } from "@/lib/calendar";
import { displayWeight } from "@/lib/fitness/units";

const STATUS: Record<CalorieStatus, { dot: string; label: string }> = {
  none: { dot: "", label: "Nothing logged" },
  under: { dot: "bg-plate-yellow", label: "Under target" },
  on: { dot: "bg-plate-green", label: "On target" },
  over: { dot: "bg-plate-red", label: "Over target" },
};
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

type Goal = { calories: number; proteinG: number; carbsG: number; fatG: number } | null;

export function CalendarView({
  month,
  today,
  initialDay,
  days,
  summary,
  goal,
  imperial,
}: {
  month: string;
  today: string;
  initialDay: string | null;
  days: CalendarDay[];
  summary: MonthSummary;
  goal: Goal;
  imperial: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(initialDay);
  const unit = imperial ? "lb" : "kg";
  const w = (kg: number) => displayWeight(kg, imperial ? "IMPERIAL" : "METRIC");
  const first = new Date(`${month}-01T12:00:00Z`);
  const lead = first.getUTCDay(); // blank cells before the 1st (weeks start Sunday)
  const title = first.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const isFuture = (d: string) => d > today;
  const day = days.find((d) => d.day === selected) ?? null;
  const next = shiftMonth(month, 1);

  return (
    <div className="px-5 pb-8">
      {/* Month and its totals */}
      <div className="flex items-center justify-between">
        <Link href={`/progress/calendar?month=${shiftMonth(month, -1)}`} scroll={false} className="rounded-xl bg-rack-raised p-2.5 text-chalk-muted" aria-label="Previous month">
          <ChevronLeft size={20} />
        </Link>
        <h2 className="font-display text-2xl font-semibold">{title}</h2>
        {next <= today.slice(0, 7) ? (
          <Link href={`/progress/calendar?month=${next}`} scroll={false} className="rounded-xl bg-rack-raised p-2.5 text-chalk-muted" aria-label="Next month">
            <ChevronRight size={20} />
          </Link>
        ) : (
          <span className="size-10" aria-hidden />
        )}
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Tile label="Days logged" value={String(summary.daysLogged)} />
        <Tile label="Avg calories" value={summary.avgCalories?.toLocaleString("en-US") ?? "–"} />
        <Tile label="Avg protein" value={summary.avgProteinG === null ? "–" : `${summary.avgProteinG} g`} />
        <Tile label="On target" value={goal ? `${summary.daysOnTarget} days` : "–"} tone="green" />
        <Tile label="Workouts" value={String(summary.workouts + summary.activities)} tone="blue" />
        <Tile label="Weight" value={summary.weightChangeKg === null ? "–" : `${summary.weightChangeKg > 0 ? "+" : ""}${(imperial ? summary.weightChangeKg / 0.45359237 : summary.weightChangeKg).toFixed(1)} ${unit}`} />
      </dl>

      {/* The grid */}
      <div className="mt-4 rounded-2xl bg-rack-raised p-2">
        <div className="grid grid-cols-7 text-center text-xs font-semibold text-chalk-muted" aria-hidden>
          {WEEKDAYS.map((d, i) => <span key={i} className="py-1.5">{d}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1" role="group" aria-label={title}>
          {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} aria-hidden />)}
          {days.map((d) => {
            const status = calorieStatus(d.calories, goal?.calories ?? null);
            const trained = d.workouts.length + d.activities.length > 0;
            const on = d.day === selected;
            const future = isFuture(d.day);
            const label = [
              new Date(`${d.day}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }),
              d.calories ? `${d.calories} calories, ${STATUS[status].label.toLowerCase()}` : "nothing logged",
              trained ? `trained` : null,
              d.weightKg !== null ? "weigh-in" : null,
              d.photoIds.length ? "progress photo" : null,
            ].filter(Boolean).join(", ");
            return (
              <button
                key={d.day}
                disabled={future}
                onClick={() => { haptic(); setSelected(d.day); }}
                aria-pressed={on}
                aria-label={label}
                className={`relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm font-semibold tabular-nums transition-colors ${
                  on ? "bg-plate-blue text-rack" : d.day === today ? "bg-rack text-plate-yellow ring-1 ring-plate-yellow/60" : future ? "text-chalk-muted/40" : "hover:bg-rack"
                }`}
              >
                {Number(d.day.slice(8))}
                <span className="mt-1 flex h-1.5 items-center gap-0.5" aria-hidden>
                  {status !== "none" && <span className={`size-1.5 rounded-full ${on ? "bg-rack" : STATUS[status].dot}`} />}
                  {trained && <span className={`h-1.5 w-2.5 rounded-full ${on ? "bg-rack" : "bg-plate-blue"}`} />}
                  {(d.weightKg !== null || d.photoIds.length > 0) && <span className={`size-1.5 rounded-full ${on ? "bg-rack/60" : "bg-chalk-muted"}`} />}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <ul className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-chalk-muted" aria-label="Legend">
        <li className="flex items-center gap-1"><span className="size-2 rounded-full bg-plate-green" aria-hidden /> On target</li>
        <li className="flex items-center gap-1"><span className="size-2 rounded-full bg-plate-yellow" aria-hidden /> Under</li>
        <li className="flex items-center gap-1"><span className="size-2 rounded-full bg-plate-red" aria-hidden /> Over</li>
        <li className="flex items-center gap-1"><span className="h-2 w-3 rounded-full bg-plate-blue" aria-hidden /> Trained</li>
        <li className="flex items-center gap-1"><span className="size-2 rounded-full bg-chalk-muted" aria-hidden /> Weigh-in or photo</li>
      </ul>

      {/* The day you tapped */}
      {day ? <DayDetail day={day} goal={goal} unit={unit} w={w} /> : <p className="mt-6 text-center text-sm text-chalk-muted">Tap a day to see it.</p>}
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: "green" | "blue" }) {
  return (
    <div className="rounded-xl bg-rack-raised px-2 py-2">
      <dt className="text-[11px] text-chalk-muted">{label}</dt>
      <dd className={`font-display text-lg font-bold whitespace-nowrap tabular-nums ${tone === "green" ? "text-plate-green" : tone === "blue" ? "text-plate-blue" : ""}`}>{value}</dd>
    </div>
  );
}

function DayDetail({ day, goal, unit, w }: { day: CalendarDay; goal: Goal; unit: string; w: (kg: number) => number }) {
  const status = calorieStatus(day.calories, goal?.calories ?? null);
  const date = new Date(`${day.day}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
  const macros = [
    { label: "Protein", value: day.proteinG, target: goal?.proteinG, color: "bg-plate-blue" },
    { label: "Carbs", value: day.carbsG, target: goal?.carbsG, color: "bg-plate-yellow" },
    { label: "Fat", value: day.fatG, target: goal?.fatG, color: "bg-plate-red" },
  ];
  const nothing = !day.foods && !day.workouts.length && !day.activities.length && day.weightKg === null && !day.photoIds.length;

  return (
    <section aria-label={date} className="animate-rise mt-4 rounded-2xl bg-rack-raised p-4">
      <h3 className="font-display text-xl font-semibold">{date}</h3>
      {nothing && <p className="mt-1 text-sm text-chalk-muted">Nothing logged this day.</p>}

      {day.foods > 0 && (
        <div className="mt-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-chalk-muted">Calories</span>
            <span className="font-display text-2xl font-bold tabular-nums">
              {day.calories.toLocaleString("en-US")}
              {goal && <span className="text-sm font-medium text-chalk-muted"> / {goal.calories.toLocaleString("en-US")}</span>}
            </span>
          </div>
          {goal && (
            <>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-rack">
                <div className={`h-full rounded-full ${STATUS[status].dot}`} style={{ width: `${Math.min(100, (day.calories / goal.calories) * 100)}%` }} />
              </div>
              <p className="mt-1 text-xs text-chalk-muted">{STATUS[status].label}</p>
            </>
          )}
          <div className="mt-3 grid grid-cols-3 gap-3">
            {macros.map((m) => (
              <div key={m.label}>
                <p className="text-xs text-chalk-muted">{m.label}</p>
                <p className="font-display text-lg font-semibold tabular-nums">
                  {m.value} g{m.target ? <span className="text-xs font-medium text-chalk-muted"> / {m.target}</span> : null}
                </p>
                {m.target ? (
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-rack">
                    <div className={`h-full rounded-full ${m.color}`} style={{ width: `${Math.min(100, (m.value / m.target) * 100)}%` }} />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {(day.workouts.length > 0 || day.activities.length > 0) && (
        <ul className="mt-4 space-y-1.5">
          {day.workouts.map((x) => (
            <li key={x.id}>
              <Link href={`/train/history/${x.id}`} className="flex items-center gap-2.5 rounded-xl bg-rack px-3 py-2.5">
                <Dumbbell size={17} className="text-plate-blue" aria-hidden />
                <span className="min-w-0 flex-1 truncate font-medium">{x.name}</span>
                <span className="text-sm text-chalk-muted">{x.minutes} min</span>
                <ChevronRight size={16} className="text-chalk-muted" aria-hidden />
              </Link>
            </li>
          ))}
          {day.activities.map((a, i) => (
            <li key={i} className="flex items-center gap-2.5 rounded-xl bg-rack px-3 py-2.5">
              <Flame size={17} className="text-plate-red" aria-hidden />
              <span className="min-w-0 flex-1 truncate font-medium">{a.name}</span>
              <span className="text-sm text-chalk-muted">{a.minutes} min · {a.calories} cal</span>
            </li>
          ))}
        </ul>
      )}

      {(day.weightKg !== null || day.photoIds.length > 0) && (
        <div className="mt-4 flex items-center gap-3">
          {day.weightKg !== null && (
            <span className="flex items-center gap-1.5 rounded-xl bg-rack px-3 py-2 text-sm font-semibold">
              <Scale size={16} className="text-chalk-muted" aria-hidden /> {w(day.weightKg)} {unit}
            </span>
          )}
          {day.photoIds.slice(0, 3).map((id) => (
            <Link key={id} href={`/progress/photos?photo=${id}`} className="block size-14 overflow-hidden rounded-xl bg-rack" aria-label="Open progress photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/photos/${id}?size=thumb`} alt="" className="size-full object-cover" />
            </Link>
          ))}
          {day.photoIds.length === 0 && (
            <Link href={`/progress/photos?add=${day.day}`} className="flex items-center gap-1 text-sm font-medium text-plate-blue"><Camera size={15} aria-hidden /> Add photo</Link>
          )}
        </div>
      )}

      <Link href={`/diary?day=${day.day}`} className="mt-4 flex items-center justify-between rounded-xl bg-rack px-4 py-3 text-sm font-semibold">
        Open this day in the diary <ChevronRight size={16} className="text-chalk-muted" aria-hidden />
      </Link>
    </section>
  );
}
