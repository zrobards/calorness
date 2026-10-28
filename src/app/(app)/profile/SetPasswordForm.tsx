"use client";

import { useState, useTransition } from "react";
import { setPassword } from "@/lib/clientActions";
import { haptic } from "@/lib/haptics";

/** Add a password to a GitHub account so the phone app can sign in directly. */
export function SetPasswordForm({ hasPassword, email }: { hasPassword: boolean; email: string | null }) {
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  if (!email) return null;
  return (
    <form
      className="mt-4 border-t border-rack-line pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const data = new FormData(form);
        const password = String(data.get("password") ?? "");
        const current = String(data.get("current") ?? "");
        start(async () => {
          const r = await setPassword(password, current || undefined);
          if (r.error) return setMsg({ text: r.error });
          haptic("success");
          form.reset();
          setMsg({ ok: true, text: `Saved. Sign in on any device with ${"email" in r ? r.email : "your email"} and this password.` });
        });
      }}
    >
      {hasPassword && (
        <label className="mb-3 block text-sm font-medium text-chalk-muted">
          Current password
          <input name="current" type="password" required autoComplete="current-password"
            className="mt-1 w-full rounded-xl border border-rack-line bg-rack px-3 py-2.5 text-base text-chalk focus:border-plate-yellow focus:outline-none" />
        </label>
      )}
      <label className="block text-sm font-medium text-chalk-muted">
        {hasPassword ? "New password" : "Add a password (for signing in on the phone app)"}
        <input name="password" type="password" minLength={8} required autoComplete="new-password"
          className="mt-1 w-full rounded-xl border border-rack-line bg-rack px-3 py-2.5 text-base text-chalk focus:border-plate-yellow focus:outline-none" />
      </label>
      {msg && <p role="status" className={`mt-2 text-sm ${msg.ok ? "text-plate-green" : "text-plate-red"}`}>{msg.text}</p>}
      <button disabled={pending} className="mt-2 rounded-xl bg-rack px-4 py-2.5 text-sm font-semibold disabled:opacity-60">
        {pending ? "Saving…" : hasPassword ? "Change password" : "Add password"}
      </button>
    </form>
  );
}
