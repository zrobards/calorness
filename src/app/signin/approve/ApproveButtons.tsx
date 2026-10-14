"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { approveHandoff } from "../actions";

export function ProviderButton({ provider, callbackUrl }: { provider: string; callbackUrl: string }) {
  const name = provider === "google" ? "Google" : "GitHub";
  return (
    <button onClick={() => signIn(provider, { callbackUrl })} className="w-full rounded-xl bg-chalk py-3.5 font-display text-xl font-semibold text-rack">
      Continue with {name}
    </button>
  );
}

export function ApproveButton({ id }: { id: string }) {
  const [result, setResult] = useState<{ ok?: boolean; error?: string } | null>(null);
  const [pending, start] = useTransition();
  if (result?.ok) {
    return <p className="rounded-2xl bg-plate-green/15 p-5 text-center font-display text-2xl font-semibold">Done. Go back to the app.</p>;
  }
  return (
    <>
      <button
        disabled={pending}
        onClick={() => start(async () => setResult(await approveHandoff(id)))}
        className="w-full rounded-xl bg-plate-red py-3.5 font-display text-xl font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Confirming…" : "Yes, sign in the app"}
      </button>
      {result?.error && <p role="alert" className="mt-3 text-sm text-plate-red">{result.error}</p>}
    </>
  );
}
