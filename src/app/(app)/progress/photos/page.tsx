import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dataKey } from "@/lib/dataKey";
import { isDay } from "@/lib/calendar";
import { displayWeight } from "@/lib/fitness/units";
import { getUnitSystem } from "@/lib/training";
import { userToday } from "@/lib/userPrefs";
import { PhotosView } from "./PhotosView";

export const metadata: Metadata = { title: "Progress photos" };

export default async function PhotosPage({ searchParams }: { searchParams: Promise<{ photo?: string; add?: string }> }) {
  const user = await requireUser();
  const [sp, { today }, unitSystem, photos, weighIns, me] = await Promise.all([
    searchParams,
    userToday(user.id),
    getUnitSystem(user.id),
    db.progressPhoto.findMany({ where: { userId: user.id }, orderBy: [{ day: "desc" }, { createdAt: "desc" }], select: { id: true, day: true, width: true, height: true, visibility: true, note: true } }),
    db.bodyweightEntry.findMany({ where: { userId: user.id }, orderBy: { date: "desc" }, select: { date: true, weightKg: true } }),
    db.user.findUniqueOrThrow({ where: { id: user.id }, select: { handle: true } }),
  ]);
  const d = (x: Date) => x.toISOString().slice(0, 10);
  const view = {
    photos: photos.map((p) => ({ id: p.id, day: d(p.day), width: p.width, height: p.height, visibility: p.visibility, note: p.note })),
    weighIns: weighIns.map((w) => ({ day: d(w.date), weight: displayWeight(w.weightKg, unitSystem) })),
  };

  return (
    <>
      <PageHeader title="Progress" />
      <PhotosView
        // starts over when photos are added or removed (not when one's sharing changes, so its view stays open)
        key={dataKey(view.photos.map((p) => p.id))}
        {...view}
        today={today}
        unit={unitSystem === "IMPERIAL" ? "lb" : "kg"}
        hasProfile={!!me.handle}
        openPhoto={sp.photo ?? null}
        addDay={isDay(sp.add) ? sp.add : null}
      />
    </>
  );
}
