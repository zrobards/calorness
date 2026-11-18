import type { Metadata } from "next";
import { getCosts, requireAdmin } from "@/lib/adminData";
import { coachModel, fastModel, textModel, visionModel } from "@/lib/ai/claude";
import { AiCheck } from "../AiCheck";
import { Bars, Card, pct, Stat, Stats, Tiles, usd } from "../ui";

export const metadata: Metadata = { title: "AI costs" };

const KIND: Record<string, string> = {
  photo: "Meal photos",
  describe: "Typed meals",
  recheck: "“Not quite right” re-checks",
  label: "Label scans",
  shortcut: "iPhone Shortcut",
  coach: "Coach chats",
  program: "Program builder",
  other: "Other",
};

export default async function CostsPage() {
  await requireAdmin();
  const c = await getCosts();
  const month = c.month;
  const cachedShare = pct(month.cached, month.input);

  return (
    <div className="space-y-4 px-5">
      <Tiles
        items={[
          { label: "Last 24 hours", value: usd(c.day.cost), sub: `${c.day.calls.toLocaleString("en-US")} AI calls`, tone: "yellow" },
          { label: "Last 30 days", value: usd(month.cost), sub: `${usd(c.week.cost)} in the last 7` },
          { label: "Per active person", value: c.perActiveUser === null ? "–" : usd(c.perActiveUser), sub: `a month, across ${c.mau} active` },
          { label: "Saved by caching", value: usd(Math.max(0, month.saved)), sub: `${cachedShare} of prompt tokens came from cache`, tone: "blue" },
        ]}
      />

      <Card title="Spend by day">
        <Bars label="AI cost" points={c.perDay} format={usd} />
        {c.perActiveUser !== null && (
          <p className="mt-3 text-sm text-chalk-muted">
            At this rate, 1,000 active people would cost about <b className="text-chalk">{usd(c.perActiveUser * 1000)}</b> a month, and 10,000 about <b className="text-chalk">{usd(c.perActiveUser * 10000)}</b>.
          </p>
        )}
      </Card>

      <Card title="By feature" action={<span className="text-xs text-chalk-muted">30 days</span>}>
        {c.byKind.length === 0 && <p className="text-sm text-chalk-muted">No AI calls recorded yet. Costs start counting from this update.</p>}
        <ul className="divide-y divide-rack-line">
          {c.byKind.map((k) => (
            <li key={k.kind} className="py-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-semibold">{KIND[k.kind] ?? k.kind}</span>
                <span className="font-display text-lg font-semibold tabular-nums">{usd(k.cost)}</span>
              </div>
              <p className="text-xs text-chalk-muted">
                {k.requests ? `${k.requests.toLocaleString("en-US")} requests, ` : ""}{k.calls.toLocaleString("en-US")} AI calls · {usd(k.calls ? k.cost / k.calls : 0)} each · {(k.ms / 1000).toFixed(1)} s avg
                {k.errors > 0 && <span className="text-plate-red"> · {k.errors} failed ({pct(k.errors, k.calls)})</span>}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-chalk-muted">One request can take more than one call when the first try is slow or busy and the app retries.</p>
      </Card>

      <Card title="By model" action={<span className="text-xs text-chalk-muted">30 days</span>}>
        <Stats>
          {c.byModel.map((m) => (
            <Stat key={m.model} label={m.model} hint={`${m.calls.toLocaleString("en-US")} calls · ${fmtTokens(m.input + m.cached)} in (${pct(m.cached, m.input + m.cached)} cached) · ${fmtTokens(m.output)} out`} value={usd(m.cost)} />
          ))}
        </Stats>
        <p className="mt-2 text-xs text-chalk-muted">
          In use now: photos {visionModel()}, typed meals {textModel()}, Coach and programs {coachModel()}, backup {fastModel()}.
        </p>
      </Card>

      <Card title="Biggest users" action={<span className="text-xs text-chalk-muted">30 days</span>}>
        <Stats>
          {c.topUsers.length === 0 && <p className="py-2 text-sm text-chalk-muted">None yet.</p>}
          {c.topUsers.map((u, i) => <Stat key={i} label={u.who} hint={`${u.calls} calls`} value={usd(u.cost)} />)}
        </Stats>
      </Card>

      <Card title="Reliability" action={<span className="text-xs text-chalk-muted">30 days</span>}>
        <Stats>
          <Stat label="Calls that failed" value={`${pct(month.errors, month.calls)} · ${month.errors}`} hint="Busy, slow, or rejected. The app retries and offers other ways to log." />
          <Stat label="Average answer time" value={`${(month.ms / 1000).toFixed(1)} s`} />
        </Stats>
      </Card>

      <AiCheck />

      <p className="text-xs text-chalk-muted">
        Costs come from the token counts Anthropic reports on every call, priced from Anthropic&rsquo;s price list. Your Anthropic console is the final bill.
      </p>
    </div>
  );
}

function fmtTokens(n: number) {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}K` : String(n);
}
