import "server-only";
import { db } from "@/lib/db";

/**
 * What we know about someone's body for calorie math: latest weigh-in on or
 * before the day, height, age, and sex. Anything unknown is null, and the
 * calculations fall back to simpler formulas.
 */
export type BodyStats = { weightKg: number | null; heightCm: number | null; age: number | null; sex: "male" | "female" | null };

export async function getBody(userId: string, onDay?: Date): Promise<BodyStats> {
  const [user, weight] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { heightCm: true, birthYear: true, sex: true } }),
    db.bodyweightEntry.findFirst({
      where: { userId, ...(onDay ? { date: { lte: onDay } } : {}) },
      orderBy: { date: "desc" },
      select: { weightKg: true },
    }),
  ]);
  return {
    weightKg: weight?.weightKg ?? null,
    heightCm: user.heightCm,
    age: user.birthYear ? new Date().getFullYear() - user.birthYear : null,
    sex: user.sex === "male" || user.sex === "female" ? user.sex : null,
  };
}
