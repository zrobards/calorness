import "server-only";
import { db } from "@/lib/db";
import { consensus, entryKey, plausible, type Entry } from "./consensus";

// Hand-typed foods become a shared community food once enough different
// people enter matching numbers for the same thing (see consensus.ts).
// Until then each person's food stays private to them.
const MIN_PEOPLE = () => Math.max(2, Number(process.env.COMMUNITY_MIN_PEOPLE) || 2);

type FoodRow = {
  id: string;
  name: string;
  brand: string | null;
  servingLabel: string | null;
  servingSize: number;
  servingUnit: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

/** Record someone's hand-typed food and promote it to a community food if others agree. Never throws. */
export async function submitFood(userId: string, food: FoodRow) {
  try {
    const key = entryKey(food);
    const entry: Entry = { userId, ...food };
    if (!key || !plausible(entry)) return;
    const values = { foodId: food.id, name: food.name, brand: food.brand, servingLabel: food.servingLabel, servingSize: food.servingSize, servingUnit: food.servingUnit, calories: food.calories, proteinG: food.proteinG, carbsG: food.carbsG, fatG: food.fatG };
    await db.foodSubmission.upsert({ where: { userId_key: { userId, key } }, update: values, create: { userId, key, ...values } });

    const others = await db.foodSubmission.findMany({ where: { key, NOT: { userId } }, orderBy: { createdAt: "desc" }, take: 200 });
    const agreed = consensus(entry, others, MIN_PEOPLE());
    if (!agreed) return;
    const data = {
      name: agreed.name,
      brand: agreed.brand,
      servingLabel: agreed.servingLabel,
      servingSize: agreed.servingSize,
      servingUnit: agreed.servingUnit,
      calories: agreed.calories,
      proteinG: agreed.proteinG,
      carbsG: agreed.carbsG,
      fatG: agreed.fatG,
      confirmations: agreed.people,
    };
    // one community food per key; it updates as more people agree
    await db.food.upsert({
      where: { source_externalId: { source: "COMMUNITY", externalId: key } },
      update: data,
      create: { ...data, source: "COMMUNITY", externalId: key },
    });
  } catch (e) {
    console.error("community food submission failed", e);
  }
}
