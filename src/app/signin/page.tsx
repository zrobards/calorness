import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { enabledProviders } from "@/lib/auth";
import { SignInButtons } from "./SignInButtons";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  const providers = enabledProviders();

  return (
    <main
      className="mx-auto flex min-h-dvh max-w-md flex-col px-6"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 3rem)" }}
    >
      <Link href="/" className="font-display text-xl font-semibold text-chalk-muted">
        Calorness
      </Link>
      <h1 className="mt-10 font-display text-5xl font-bold tracking-tight">Sign in</h1>
      <p className="mt-3 text-chalk-muted">Your workouts and diary sync to every device you sign in on.</p>

      <div className="mt-10">
        {providers.length > 0 ? (
          <Suspense fallback={null}>
            <SignInButtons providers={providers} />
          </Suspense>
        ) : (
          <p role="alert" className="rounded-xl border border-plate-yellow/50 p-4 text-sm">
            No sign-in options are configured. Add GitHub or Google keys, or set
            DEMO_LOGIN_ENABLED=true, in your environment variables.
          </p>
        )}
      </div>
    </main>
  );
}
