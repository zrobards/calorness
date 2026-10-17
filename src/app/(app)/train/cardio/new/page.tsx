import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getBody } from "@/lib/body";
import { userToday } from "@/lib/userPrefs";
import { displayWeight } from "@/lib/fitness/units";
import { CardioForm } from "./CardioForm";

export const metadata: Metadata = { title: "Log cardio" };

export default async function NewCardioPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const user = await requireUser();
  const { day: dayParam } = await searchParams;
  const [{ today }, body, prefs, recent] = await Promise.all([
    userToday(user.id),
    getBody(user.id),
    db.user.findUniqueOrThrow({ where: { id: user.id }, select: { unitSystem: true, exerciseCredit: true } }),
    db.activityEntry.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20, select: { activity: true } }),
  ]);
  const imperial = prefs.unitSystem === "IMPERIAL";
  return (
    <div className="px-5 pb-8" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}>
      <Link href="/train" className="-ml-1 inline-flex items-center gap-1 py-2 text-sm font-medium text-chalk-muted">
        <ChevronLeft size={18} aria-hidden /> Train
      </Link>
      <h1 className="font-display text-4xl font-bold tracking-tight">Log cardio</h1>
      <CardioForm
        day={dayParam && /^\d{4}-\d{2}-\d{2}$/.test(dayParam) ? dayParam : today}
        imperial={imperial}
        credit={prefs.exerciseCredit}
        body={{ ...body, weight: body.weightKg ? displayWeight(body.weightKg, prefs.unitSystem) : null }}
        recentKeys={[...new Set(recent.map((r) => r.activity))].slice(0, 5)}
      />
    </div>
  );
}
