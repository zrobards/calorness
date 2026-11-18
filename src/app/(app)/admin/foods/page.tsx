import type { Metadata } from "next";
import { requireAdmin } from "@/lib/adminData";
import { db } from "@/lib/db";
import { macroCheck } from "@/lib/nutrition/quality";
import { Card } from "../ui";
import { FoodRow, type AdminFood } from "./FoodRow";
import { ApproveButton } from "./ApproveButton";

export const metadata: Metadata = { title: "Foods" };

const SOURCE: Record<string, string> = { USDA: "USDA", OPEN_FOOD_FACTS: "Open Food Facts", CUSTOM: "Label scan", AI_ESTIMATE: "AI", COMMUNITY: "Community" };

// Only foods everyone can see are listed: the shared database, community
// foods, and shared label scans. People's private foods never show here.
const visible = { OR: [{ createdById: null }, { shared: true }] };

export default async function FoodsPage({ searchParams }: { searchParams: Promise<{ q?: string; hidden?: string }> }) {
  await requireAdmin();
  const { q: raw, hidden } = await searchParams;
  const q = raw?.trim().slice(0, 80) ?? "";
  const [foods, scans, totals, groups] = await Promise.all([
    db.food.findMany({
      where: {
        ...visible,
        ...(hidden ? { hidden: true } : {}),
        ...(q ? { AND: [{ OR: [{ name: { contains: q, mode: "insensitive" as const } }, { brand: { contains: q, mode: "insensitive" as const } }, { barcode: q }] }] } : {}),
      },
      orderBy: q || hidden ? [{ diaryEntries: { _count: "desc" } }, { name: "asc" }] : { diaryEntries: { _count: "desc" } },
      take: 40,
      include: { _count: { select: { diaryEntries: true } } },
    }),
    q || hidden ? Promise.resolve([]) : db.food.findMany({ where: { shared: true }, orderBy: { createdAt: "desc" }, take: 8, include: { _count: { select: { diaryEntries: true } } } }),
    Promise.all([db.food.count({ where: { source: "COMMUNITY" } }), db.food.count({ where: { shared: true } }), db.food.count({ where: { hidden: true } }), db.foodSubmission.count()]),
    // Foods people typed by hand, grouped; the ones that haven't become a community food yet
    q || hidden ? Promise.resolve([]) : db.foodSubmission.groupBy({ by: ["key"], _count: true, _min: { calories: true }, _max: { calories: true }, orderBy: { _count: { key: "desc" } }, take: 60 }),
  ]);
  const promoted = new Set((await db.food.findMany({ where: { source: "COMMUNITY", externalId: { in: groups.map((g) => g.key) } }, select: { externalId: true } })).map((f) => f.externalId));
  const waiting = groups.filter((g) => !promoted.has(g.key)).slice(0, 15);
  const names = new Map((await db.foodSubmission.findMany({ where: { key: { in: waiting.map((w) => w.key) } }, distinct: ["key"], select: { key: true, name: true, brand: true, servingLabel: true } })).map((s) => [s.key, s]));

  const toRow = (f: (typeof foods)[number]): AdminFood => ({
    id: f.id,
    name: f.name,
    brand: f.brand,
    servingLabel: f.servingLabel,
    servingSize: f.servingSize,
    servingUnit: f.servingUnit,
    calories: f.calories,
    proteinG: f.proteinG,
    carbsG: f.carbsG,
    fatG: f.fatG,
    hidden: f.hidden,
    source: SOURCE[f.source] ?? f.source,
    uses: f._count.diaryEntries,
    confirmations: f.confirmations,
    flagged: macroCheck(f).flagged,
  });

  return (
    <div className="space-y-4 px-5">
      <form className="flex gap-2" role="search">
        <input name="q" defaultValue={q} placeholder="Search shared foods, brands, or a barcode" aria-label="Search foods"
          className="min-w-0 flex-1 rounded-xl bg-rack-raised px-4 py-2.5 text-base" />
        <button className="rounded-xl bg-plate-blue px-4 font-semibold text-rack">Search</button>
      </form>
      <p className="-mt-2 text-xs text-chalk-muted">
        {totals[0].toLocaleString("en-US")} community foods · {totals[1].toLocaleString("en-US")} shared label scans · {totals[3].toLocaleString("en-US")} hand-typed entries ·{" "}
        <a href={hidden ? "/admin/foods" : "/admin/foods?hidden=1"} className="text-plate-blue">{hidden ? "show all" : `${totals[2]} hidden`}</a>
      </p>

      {waiting.length > 0 && (
        <Card title="Typed by several people">
          <p className="mb-2 text-sm text-chalk-muted">
            Foods people entered by hand. One becomes a shared community food on its own once 2 people&rsquo;s numbers agree. These haven&rsquo;t agreed yet; approve one to share the typical numbers now.
          </p>
          <ul className="divide-y divide-rack-line">
            {waiting.map((w) => {
              const n = names.get(w.key);
              return (
                <li key={w.key} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{n?.name ?? w.key}{n?.brand ? `, ${n.brand}` : ""}</p>
                    <p className="text-xs text-chalk-muted">
                      {w._count} {w._count === 1 ? "person" : "people"} · {Math.round(w._min.calories ?? 0)}{w._max.calories !== w._min.calories ? `–${Math.round(w._max.calories ?? 0)}` : ""} cal{n?.servingLabel ? ` per ${n.servingLabel}` : ""}
                    </p>
                  </div>
                  <ApproveButton submissionKey={w.key} />
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Card title={q ? `Results for “${q}”` : hidden ? "Hidden foods" : "Most logged"}>
        {foods.length === 0 && <p className="text-sm text-chalk-muted">Nothing found. USDA and Open Food Facts foods appear here once someone logs them.</p>}
        <ul className="divide-y divide-rack-line">{foods.map((f) => <FoodRow key={f.id} food={toRow(f)} />)}</ul>
      </Card>

      {scans.length > 0 && (
        <Card title="Newest label scans">
          <p className="mb-1 text-sm text-chalk-muted">Copied from Nutrition Facts labels and shared with everyone. Worth a quick look.</p>
          <ul className="divide-y divide-rack-line">{scans.map((f) => <FoodRow key={f.id} food={toRow(f)} />)}</ul>
        </Card>
      )}

      <p className="text-xs text-chalk-muted">
        Editing a food&rsquo;s numbers also updates past diary entries that used it. Hiding keeps it in those diaries but takes it out of search.
      </p>
    </div>
  );
}
