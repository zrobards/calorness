"use client";

import { useState, useTransition } from "react";
import { resolveReport } from "@/app/(app)/feed/actions";

type Row = { id: string; reason: string; createdAt: string; reporter: string | null; reported: string | null; post: string | null; hasPost: boolean };

/** Reports from the feed: hide the post, or dismiss. */
export function Reports({ reports }: { reports: Row[] }) {
  const [left, setLeft] = useState(reports);
  const [pending, start] = useTransition();
  if (!left.length) return <p className="text-sm text-chalk-muted">No open reports.</p>;
  return (
    <ul className="space-y-3">
      {left.map((r) => (
        <li key={r.id} className="rounded-xl bg-rack p-3 text-sm">
          <p><b>@{r.reported ?? "?"}</b> reported by @{r.reporter ?? "?"} · {new Date(r.createdAt).toLocaleDateString()}</p>
          <p className="mt-1">{r.reason}</p>
          {r.post && <p className="mt-1 line-clamp-3 text-chalk-muted">{r.post}</p>}
          <div className="mt-2 flex gap-2">
            {r.hasPost && <button disabled={pending} onClick={() => start(async () => { await resolveReport(r.id, true); setLeft((l) => l.filter((x) => x.id !== r.id)); })} className="rounded-lg bg-plate-red px-3 py-1.5 font-semibold text-white">Hide post</button>}
            <button disabled={pending} onClick={() => start(async () => { await resolveReport(r.id, false); setLeft((l) => l.filter((x) => x.id !== r.id)); })} className="rounded-lg bg-rack-raised px-3 py-1.5 font-semibold">Dismiss</button>
          </div>
        </li>
      ))}
    </ul>
  );
}
