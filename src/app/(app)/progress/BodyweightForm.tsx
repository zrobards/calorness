"use client";

import { useActionState } from "react";
import { logBodyweight } from "@/lib/clientActions";

export function BodyweightForm({ unit }: { unit: string }) {
  const [state, action, pending] = useActionState<{ error?: string; ok?: boolean }, FormData>(logBodyweight, {});
  // The browser knows the user's real calendar day; the server doesn't.
  const today = new Date().toLocaleDateString("en-CA");

  return (
    <form action={action} className="flex items-end gap-2">
      <input type="hidden" name="date" value={today} />
      <label className="flex-1 text-sm font-medium text-chalk-muted">
        Today&apos;s weight ({unit})
        <input name="weight" type="number" inputMode="decimal" step="0.1" required
          className="mt-1 w-full rounded-xl border border-rack-line bg-rack px-3 py-2.5 font-display text-xl text-chalk tabular-nums focus:border-plate-yellow focus:outline-none" />
      </label>
      <button disabled={pending} className="rounded-xl bg-plate-green px-5 py-3 font-display text-lg font-semibold text-white disabled:opacity-60">
        {pending ? "Saving…" : state.ok ? "Saved" : "Log"}
      </button>
      {state.error && <p role="alert" className="text-sm text-plate-red">{state.error}</p>}
    </form>
  );
}
