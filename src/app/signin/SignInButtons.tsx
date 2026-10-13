"use client";

import { signIn } from "next-auth/react";

export function SignInButtons({ providers }: { providers: { id: string; name: string }[] }) {
  return (
    <div className="space-y-3">
      {providers.map((p) => (
        <button
          key={p.id}
          onClick={() => signIn(p.id, { callbackUrl: "/train" })}
          className={`w-full rounded-xl py-3.5 font-display text-xl font-semibold ${
            p.id === "demo"
              ? "border border-rack-line text-chalk"
              : "bg-chalk text-rack"
          }`}
        >
          {p.id === "demo" ? "Try the demo account" : `Continue with ${p.name}`}
        </button>
      ))}
    </div>
  );
}
