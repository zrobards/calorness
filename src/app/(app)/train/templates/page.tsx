import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { TEMPLATES } from "@/lib/templates";
import { TemplateCard } from "./TemplateCard";

export const metadata: Metadata = { title: "Programs" };

export default async function TemplatesPage() {
  await requireUser();
  return (
    <div className="px-5 pb-6" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}>
      <Link href="/train" className="-ml-1 inline-flex items-center gap-1 py-2 text-sm font-medium text-chalk-muted">
        <ChevronLeft size={18} aria-hidden /> Train
      </Link>
      <h1 className="font-display text-4xl font-bold tracking-tight">Programs</h1>
      <p className="mt-1 text-chalk-muted">Proven plans. Add one and its workouts appear in your routines, ready to start.</p>
      <Link href="/train/programs/build" className="mt-4 flex items-center justify-between rounded-2xl bg-plate-yellow/10 px-4 py-3 ring-1 ring-plate-yellow/40">
        <span className="font-semibold">Want one made for you? Build it with AI</span>
        <span aria-hidden>›</span>
      </Link>
      <ul className="mt-5 space-y-3">
        {TEMPLATES.map((t, i) => (
          <li key={t.id} className="animate-rise" style={{ "--i": i } as React.CSSProperties}>
            <TemplateCard template={t} />
          </li>
        ))}
      </ul>
    </div>
  );
}
