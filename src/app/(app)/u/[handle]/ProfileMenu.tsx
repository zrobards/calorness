"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { Sheet } from "@/components/diary/Sheet";
import { blockPerson, removeFollower, report } from "@/app/(app)/feed/actions";

/** Remove a follower, report, or block someone from their profile. */
export function ProfileMenu({ handle }: { handle: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reporting, setReporting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-chalk-muted" aria-label={`More options for @${handle}`}><MoreHorizontal size={22} /></button>
      {open && (
        <Sheet title={`@${handle}`} onClose={() => { setOpen(false); setReporting(false); }}>
          {done ? <p role="status" className="text-chalk-muted">{done}</p> : reporting ? (
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); start(async () => { await report({ handle, reason }).catch(() => null); setDone("Thanks. The report was sent."); }); }}>
              <label className="block text-sm text-chalk-muted">What&apos;s wrong?
                <input value={reason} onChange={(e) => setReason(e.target.value)} required maxLength={300}
                  className="mt-1 w-full rounded-xl border border-rack-line bg-rack px-3.5 py-3 text-base text-chalk focus:border-plate-yellow focus:outline-none" />
              </label>
              <button disabled={pending} className="w-full rounded-xl bg-plate-red py-3 font-semibold text-white">Send report</button>
            </form>
          ) : (
            <div className="space-y-2">
              <button disabled={pending} onClick={() => start(async () => { await removeFollower(handle).catch(() => null); setDone(`@${handle} no longer follows you.`); router.refresh(); })} className="w-full rounded-xl bg-rack py-3 font-semibold">Remove as follower</button>
              <button onClick={() => setReporting(true)} className="w-full rounded-xl bg-rack py-3 font-semibold">Report</button>
              <button disabled={pending} onClick={() => { if (confirm(`Block @${handle}?`)) start(async () => { await blockPerson(handle).catch(() => null); router.push("/feed"); }); }} className="w-full rounded-xl bg-rack py-3 font-semibold text-plate-red">Block</button>
            </div>
          )}
        </Sheet>
      )}
    </>
  );
}
