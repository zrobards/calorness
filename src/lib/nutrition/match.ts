// Matching an AI-identified product ("Chobani Flip Key Lime Crumble") to
// real database entries, so packaged foods use label values, not guesses.

const STOP = new Set(["the", "a", "an", "and", "with", "of", "in", "greek", "yogurt", "oz", "g", "ml", "flavored", "style", "inc", "co", "llc"]);

export function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9& ]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

/** 0–1: how well a database entry matches what the AI saw. Brand + flavor words matter most. */
export function matchScore(wanted: { brand?: string | null; product: string }, candidate: { brand: string | null; name: string }) {
  const want = new Set(tokens(`${wanted.brand ?? ""} ${wanted.product}`));
  const have = new Set(tokens(`${candidate.brand ?? ""} ${candidate.name}`));
  if (want.size === 0 || have.size === 0) return 0;
  let shared = 0;
  for (const t of want) if (have.has(t)) shared++;
  const coverage = shared / want.size; // did we find the words the AI read?
  const precision = shared / have.size; // and not much else?
  const brandOk = !wanted.brand || tokens(wanted.brand).every((t) => have.has(t));
  return (0.7 * coverage + 0.3 * precision) * (brandOk ? 1 : 0.5);
}

export function rankMatches<T extends { brand: string | null; name: string }>(
  wanted: { brand?: string | null; product: string },
  candidates: T[],
  limit = 3,
) {
  return candidates
    .map((c) => ({ c, score: matchScore(wanted, c) }))
    .filter((x) => x.score >= 0.45)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
