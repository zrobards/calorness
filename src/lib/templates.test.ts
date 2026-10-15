import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { TEMPLATES } from "./templates";

const library = new Set(
  ["exercises.json", "exercises-extra.json"].flatMap((f) =>
    (JSON.parse(readFileSync(new URL(`../../prisma/data/${f}`, import.meta.url), "utf8")) as { name: string }[]).map((e) => e.name),
  ),
);

describe("program templates", () => {
  it("only use exercises that exist in the library", () => {
    const missing = TEMPLATES.flatMap((t) => t.routines.flatMap((r) => r.exercises.map(([name]) => name))).filter((n) => !library.has(n));
    expect(missing).toEqual([]);
  });

  it("have sensible set and rep numbers", () => {
    for (const t of TEMPLATES)
      for (const r of t.routines)
        for (const [, sets, min, max, rest] of r.exercises) {
          expect(sets).toBeGreaterThan(0);
          expect(max).toBeGreaterThanOrEqual(min);
          expect(rest).toBeLessThanOrEqual(600);
        }
  });
});
