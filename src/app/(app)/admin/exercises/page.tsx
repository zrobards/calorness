import type { Metadata } from "next";
import { requireAdmin } from "@/lib/adminData";
import { db } from "@/lib/db";
import { communityExercises } from "@/lib/exerciseLibrary";
import { Card } from "../ui";
import { CommunityExercises, LibraryExerciseRow, NewExercise } from "./ExerciseRows";

export const metadata: Metadata = { title: "Exercises" };

export default async function ExercisesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const q = (await searchParams).q?.trim().slice(0, 80) ?? "";
  const [community, library, libraryCount, customCount] = await Promise.all([
    q ? Promise.resolve([]) : communityExercises(30),
    db.exercise.findMany({
      where: { createdById: null, ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { aliases: { has: q.toLowerCase() } }] } : {}) },
      orderBy: q ? { name: "asc" } : { workoutExercises: { _count: "desc" } },
      take: q ? 40 : 20,
      select: { id: true, name: true, aliases: true, primaryMuscles: true, secondaryMuscles: true, equipment: true, category: true, _count: { select: { workoutExercises: true } } },
    }),
    db.exercise.count({ where: { createdById: null } }),
    db.exercise.count({ where: { createdById: { not: null } } }),
  ]);
  const options = q ? [] : await db.exercise.findMany({ where: { createdById: null }, orderBy: { name: "asc" }, select: { id: true, name: true } });

  return (
    <div className="space-y-4 px-5">
      <form className="flex gap-2" role="search">
        <input name="q" defaultValue={q} placeholder="Search the library" aria-label="Search exercises" className="min-w-0 flex-1 rounded-xl bg-rack-raised px-4 py-2.5 text-base" />
        <button className="rounded-xl bg-plate-blue px-4 font-semibold text-rack">Search</button>
      </form>
      <p className="-mt-2 text-xs text-chalk-muted">{libraryCount.toLocaleString("en-US")} in the library · {customCount.toLocaleString("en-US")} people made themselves</p>

      {!q && (
        <Card title="Made by people">
          <p className="mb-2 text-sm text-chalk-muted">
            Exercises people added for themselves, grouped by name. Once 3 different people make the same one, it joins the library on its own.
            Add one now, or fold it into a library exercise it duplicates. Either way their copies switch over, history included.
          </p>
          <CommunityExercises groups={community} library={options} />
        </Card>
      )}

      <Card title={q ? `Library results for “${q}”` : "Library, most used"} action={!q ? <NewExercise /> : undefined}>
        {library.length === 0 && <p className="text-sm text-chalk-muted">No matches.</p>}
        <ul className="divide-y divide-rack-line">
          {library.map((e) => <LibraryExerciseRow key={e.id} exercise={{ ...e, uses: e._count.workoutExercises }} />)}
        </ul>
      </Card>
    </div>
  );
}
