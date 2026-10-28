"use client";

import { useState, useTransition } from "react";
import { signOut } from "next-auth/react";
import { deleteAccount } from "@/lib/clientActions";

/** Permanently delete the account and everything in it. */
export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-sm font-medium text-chalk-muted hover:text-plate-red">
        Delete my account
      </button>
    );
  }
  return (
    <div className="rounded-2xl border border-plate-red/50 p-4">
      <p className="font-semibold">Delete your account and all your data?</p>
      <p className="mt-1 text-sm text-chalk-muted">Workouts, diary, foods, goals, and shortcut keys are removed for good. This can&apos;t be undone.</p>
      <label className="mt-3 block text-sm text-chalk-muted">
        Type DELETE to confirm
        <input value={text} onChange={(e) => setText(e.target.value)} autoCapitalize="characters"
          className="mt-1 w-full rounded-xl border border-rack-line bg-rack px-3 py-2.5 text-base text-chalk focus:border-plate-red focus:outline-none" />
      </label>
      {error && <p role="alert" className="mt-2 text-sm text-plate-red">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button onClick={() => { setOpen(false); setText(""); }} className="flex-1 rounded-xl bg-rack py-2.5 font-medium">Cancel</button>
        <button
          disabled={pending || text !== "DELETE"}
          onClick={() => start(async () => {
            const r = await deleteAccount(text);
            if (r?.error) return setError(r.error);
            await signOut({ callbackUrl: "/" });
          })}
          className="flex-1 rounded-xl bg-plate-red py-2.5 font-semibold text-white disabled:opacity-40"
        >
          {pending ? "Deleting…" : "Delete forever"}
        </button>
      </div>
    </div>
  );
}
