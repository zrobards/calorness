import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getExerciseLibrary } from "@/lib/training";
import { ExerciseBrowser } from "./ExerciseBrowser";

export const metadata: Metadata = { title: "Exercises" };

export default async function ExercisesPage() {
  await requireUser();
  const library = await getExerciseLibrary();
  return (
    <div style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)" }}>
      <Link href="/train" className="ml-4 inline-flex items-center gap-1 py-2 text-sm font-medium text-chalk-muted">
        <ChevronLeft size={18} aria-hidden /> Train
      </Link>
      <h1 className="px-5 font-display text-4xl font-bold tracking-tight">Exercises</h1>
      <ExerciseBrowser library={library} />
    </div>
  );
}
