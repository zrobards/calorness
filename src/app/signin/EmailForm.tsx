"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { haptic } from "@/lib/haptics";
import { signUp } from "./actions";

const field =
  "mt-1 w-full rounded-xl border border-rack-line bg-rack-raised px-3 py-3 text-base text-chalk focus:border-plate-yellow focus:outline-none";

/** Email + password: the sign-in that works inside the home-screen app. */
export function EmailForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (form: HTMLFormElement) => {
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;
    setError(null);
    start(async () => {
      if (mode === "signup") {
        const created = await signUp({ name: data.name ?? "", email: data.email ?? "", password: data.password ?? "" });
        if (created.error) return setError(created.error);
      }
      const result = await signIn("password", { email: data.email, password: data.password, redirect: false });
      if (!result || result.error) {
        haptic("warning");
        return setError(
          result?.error === "LOCKED"
            ? "Too many wrong passwords. For your security, try again in 15 minutes."
            : "That email and password don't match.",
        );
      }
      haptic("success");
      router.replace("/log");
      router.refresh();
    });
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(e.currentTarget); }} className="space-y-3">
      <div className="grid grid-cols-2 rounded-xl border border-rack-line p-1" role="tablist">
        {(["signin", "signup"] as const).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setError(null); }}
            className={`rounded-lg py-2 text-sm font-semibold ${mode === m ? "bg-chalk text-rack" : "text-chalk-muted"}`}>
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>
      {mode === "signup" && (
        <label className="block text-sm font-medium text-chalk-muted">Name<input name="name" autoComplete="name" required className={field} /></label>
      )}
      <label className="block text-sm font-medium text-chalk-muted">
        Email<input name="email" type="email" autoComplete="email" inputMode="email" required className={field} />
      </label>
      <label className="block text-sm font-medium text-chalk-muted">
        Password
        <input name="password" type="password" required minLength={8}
          autoComplete={mode === "signup" ? "new-password" : "current-password"} className={field} />
      </label>
      {mode === "signup" && <p className="text-xs text-chalk-muted">At least 8 characters.</p>}
      {error && <p role="alert" className="rounded-xl border border-plate-red/50 bg-plate-red/10 p-3 text-sm">{error}</p>}
      <button disabled={pending} className="w-full rounded-xl bg-plate-red py-3.5 font-display text-xl font-semibold text-white disabled:opacity-60">
        {pending ? "One moment…" : mode === "signin" ? "Sign in" : "Create account"}
      </button>
    </form>
  );
}
