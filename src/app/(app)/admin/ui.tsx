// Small building blocks shared by the admin screens.
import type { DayPoint } from "@/lib/adminData";

export function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-rack-raised p-5">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-2xl font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Stats({ children }: { children: React.ReactNode }) {
  return <dl className="divide-y divide-rack-line">{children}</dl>;
}

export function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 text-sm">
      <dt className="min-w-0 text-chalk-muted">
        {label}
        {hint && <span className="block text-xs">{hint}</span>}
      </dt>
      <dd className="shrink-0 font-display text-lg font-semibold tabular-nums">{typeof value === "number" ? value.toLocaleString("en-US") : value}</dd>
    </div>
  );
}

/** Big number tiles, two per row. */
export function Tiles({ items }: { items: { label: string; value: string; sub?: string; tone?: "yellow" | "blue" }[] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {items.map((t) => (
        <div key={t.label} className="rounded-2xl bg-rack-raised px-4 py-3">
          <p className="text-xs text-chalk-muted">{t.label}</p>
          <p className={`font-display text-2xl font-bold whitespace-nowrap tabular-nums ${t.tone === "yellow" ? "text-plate-yellow" : t.tone === "blue" ? "text-plate-blue" : ""}`}>{t.value}</p>
          {t.sub && <p className="text-xs text-chalk-muted">{t.sub}</p>}
        </div>
      ))}
    </div>
  );
}

/** Last 14 days as bars, today on the right. */
export function Bars({ points, label, format = (n) => n.toLocaleString("en-US") }: { points: DayPoint[]; label: string; format?: (n: number) => string }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const total = points.reduce((s, p) => s + p.value, 0);
  return (
    <figure>
      <figcaption className="flex items-baseline justify-between text-sm">
        <span className="font-semibold">{label}</span>
        <span className="text-xs text-chalk-muted">14 days: {format(total)}</span>
      </figcaption>
      <div className="mt-2 flex h-16 items-end gap-1" role="img" aria-label={`${label}, last 14 days: ${points.map((p) => format(p.value)).join(", ")}`}>
        {points.map((p, i) => (
          <div key={p.day} title={`${p.day}: ${format(p.value)}`}
            className={`flex-1 rounded-t-sm ${i === points.length - 1 ? "bg-plate-blue" : "bg-rack-line"}`}
            style={{ height: `${Math.max(4, (p.value / max) * 100)}%` }} />
        ))}
      </div>
    </figure>
  );
}

export const usd = (n: number) => (n === 0 ? "$0" : n < 0.01 ? `$${n.toFixed(4)}` : n < 10 ? `$${n.toFixed(2)}` : `$${Math.round(n).toLocaleString("en-US")}`);
export const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : "–");
