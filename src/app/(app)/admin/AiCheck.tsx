"use client";

import { useState, useTransition } from "react";
import { checkAi } from "./actions";

type Result = Awaited<ReturnType<typeof checkAi>>[number];

/** Owner tool: confirm the AI key and each model setting actually work. */
export function AiCheck() {
  const [results, setResults] = useState<Result[] | null>(null);
  const [pending, start] = useTransition();
  return (
    <section className="rounded-2xl bg-rack-raised p-5">
      <h2 className="font-display text-2xl font-semibold">AI check</h2>
      <p className="mt-1 text-sm text-chalk-muted">Sends a tiny test request with each model setting. Use it after changing anything in Vercel.</p>
      <button disabled={pending} onClick={() => start(async () => setResults(await checkAi()))}
        className="mt-3 w-full rounded-xl bg-chalk py-2.5 font-semibold text-rack disabled:opacity-60">
        {pending ? "Checking…" : "Run AI check"}
      </button>
      {results && (
        <ul className="mt-3 space-y-2 text-sm">
          {results.map((r) => (
            <li key={r.name} className={`rounded-xl p-3 ${r.ok ? "bg-plate-green/15" : "bg-plate-red/15"}`}>
              <p className="font-semibold">{r.ok ? "✓" : "✗"} {r.name}</p>
              <p className="break-all text-chalk-muted">Setting: <code>{r.value}</code>{r.ignored && " (not a valid model name, so the app uses the default)"}</p>
              {r.value !== r.inUse && <p className="text-chalk-muted">Actually used: <code>{r.inUse}</code></p>}
              {!r.ok && <p className="mt-1 break-all">Error {r.status}: {r.detail}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
