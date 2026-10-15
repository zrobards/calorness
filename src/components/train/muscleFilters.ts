export const MUSCLE_FILTERS = [
  { label: "All", muscles: [] as string[] },
  { label: "Chest", muscles: ["chest"] },
  { label: "Back", muscles: ["lats", "middle back", "lower back", "traps"] },
  { label: "Shoulders", muscles: ["shoulders"] },
  { label: "Arms", muscles: ["biceps", "triceps", "forearms"] },
  { label: "Legs", muscles: ["quadriceps", "hamstrings", "glutes", "calves", "adductors", "abductors"] },
  { label: "Core", muscles: ["abdominals"] },
];

export function matchesFilter(primaryMuscles: string[], filterIndex: number) {
  const f = MUSCLE_FILTERS[filterIndex];
  return f.muscles.length === 0 || primaryMuscles.some((m) => f.muscles.includes(m));
}

export function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Search by name: every typed word must appear. Ranked so the most likely
 * match comes first: names starting with the query, then names whose words
 * start with the query words, then shorter (simpler) names.
 */
export function searchByName<T extends { name: string; aliases?: string[] }>(items: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length === 0) return items;
  const scored: { item: T; score: number }[] = [];
  for (const item of items) {
    const name = item.name.toLowerCase();
    // Short words must start a word ("rdl" shouldn't match "hurdle"); longer ones can match anywhere
    const hits = (text: string) =>
      words.every((w) => (w.length <= 3 ? text.split(/[\s\-/(),]+/).some((t) => t.startsWith(w)) : text.includes(w)));
    // Also match other names people use ("pec deck" finds Butterfly)
    const alias = (item.aliases ?? []).map((a) => a.toLowerCase()).find(hits);
    if (!hits(name) && !alias) continue;
    const nameWords = name.split(/[\s\-/(),]+/);
    let score = name.length;
    if (name.startsWith(q) || alias === q) score -= 1000;
    else if (alias?.startsWith(q)) score -= 600;
    score -= 100 * words.filter((w) => nameWords.some((nw) => nw.startsWith(w))).length;
    scored.push({ item, score });
  }
  return scored.sort((a, b) => a.score - b.score).map((s) => s.item);
}
