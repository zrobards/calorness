"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getExerciseOptions } from "@/lib/training";
import { searchByName } from "@/components/train/muscleFilters";
import { expandQuery, normalize, textMatch } from "@/lib/nutrition/searchText";

export type SearchHit = { group: string; title: string; detail?: string; href: string };

/** Your own things that match: programs, routines, exercises, foods, past Coach chats. */
export async function searchEverything(query: string): Promise<SearchHit[]> {
  const user = await requireUser();
  const q = z.string().trim().min(2).max(60).safeParse(query);
  if (!q.success) return [];
  const words = normalize(expandQuery(q.data)).split(" ").filter((w) => w.length > 1);
  const like = (field: string) => ({ AND: words.map((w) => ({ [field]: { contains: w, mode: "insensitive" as const } })) });

  const [programs, routines, exercises, foods, chats] = await Promise.all([
    db.program.findMany({ where: { userId: user.id, ...like("name") }, take: 5, select: { id: true, name: true, pinned: true } }),
    db.routine.findMany({ where: { userId: user.id, ...like("name") }, take: 6, select: { id: true, name: true, program: { select: { name: true } } } }),
    getExerciseOptions(user.id).then((all) => searchByName(all, q.data).slice(0, 6)),
    db.food.findMany({
      where: { OR: [{ createdById: user.id }, { diaryEntries: { some: { userId: user.id } } }], AND: words.map((w) => ({ OR: [{ name: { contains: w, mode: "insensitive" as const } }, { brand: { contains: w, mode: "insensitive" as const } }] })) },
      take: 12,
      select: { name: true, brand: true, calories: true, servingLabel: true },
    }),
    db.coachConversation.findMany({ where: { userId: user.id, ...like("title") }, orderBy: { updatedAt: "desc" }, take: 4, select: { id: true, title: true } }),
  ]);

  const seen = new Set<string>();
  const foodHits = foods
    .filter((f) => textMatch(q.data, f) >= 0.6 && !seen.has(f.name.toLowerCase()) && !!seen.add(f.name.toLowerCase()))
    .slice(0, 5);

  return [
    ...programs.map((p) => ({ group: "Programs", title: p.name, detail: p.pinned ? "Running now" : "Program", href: "/train#library-heading" })),
    ...routines.map((r) => ({ group: "Routines", title: r.name, detail: r.program?.name ?? "Single routine", href: `/train/routines/${r.id}` })),
    ...exercises.map((e) => ({ group: "Exercises", title: e.name, detail: e.primaryMuscles.join(", "), href: `/train/exercises/${e.slug}` })),
    ...foodHits.map((f) => ({ group: "Your foods", title: f.name, detail: [f.brand, `${Math.round(f.calories)} cal`, f.servingLabel].filter(Boolean).join(", "), href: `/diary/add?q=${encodeURIComponent(f.name)}` })),
    ...chats.map((c) => ({ group: "Coach chats", title: c.title, href: `/coach?c=${c.id}` })),
  ];
}
