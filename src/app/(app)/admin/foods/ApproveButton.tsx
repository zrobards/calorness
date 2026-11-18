"use client";

import { useState, useTransition } from "react";
import { approveSubmission } from "../actions";

export function ApproveButton({ submissionKey }: { submissionKey: string }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  if (done) return <span className="shrink-0 text-sm font-semibold text-plate-green">Shared</span>;
  return (
    <button disabled={pending} onClick={() => start(async () => {
        const r = await approveSubmission(submissionKey).catch(() => ({ error: "No connection. Try again." }));
        if ("error" in r && r.error) alert(r.error);
        else setDone(true);
      })}
      className="shrink-0 rounded-full bg-rack px-3 py-1.5 text-sm font-semibold text-plate-blue disabled:opacity-50">
      {pending ? "…" : "Approve"}
    </button>
  );
}
