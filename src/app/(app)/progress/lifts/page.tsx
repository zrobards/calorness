import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getAllLifts, getUnitSystem } from "@/lib/training";
import { LiftsList } from "./LiftsList";

export const metadata: Metadata = { title: "All lifts" };

export default async function LiftsPage() {
  const user = await requireUser();
  const [lifts, unitSystem] = await Promise.all([getAllLifts(user.id), getUnitSystem(user.id)]);
  return (
    <div className="pb-8" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}>
      <div className="px-5">
        <Link href="/progress" className="-ml-1 inline-flex items-center gap-1 py-2 text-sm font-medium text-chalk-muted">
          <ChevronLeft size={18} aria-hidden /> Progress
        </Link>
        <h1 className="font-display text-4xl font-bold tracking-tight">All lifts</h1>
        <p className="text-sm text-chalk-muted">Every exercise you&apos;ve logged. Tap one for its full history.</p>
      </div>
      <LiftsList lifts={lifts} imperial={unitSystem === "IMPERIAL"} />
    </div>
  );
}
