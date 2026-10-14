import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { enabledProviders } from "@/lib/auth";
import { SignInButtons } from "./SignInButtons";
import { EmailForm } from "./EmailForm";

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

      <div className="mt-8">
        <EmailForm />
      </div>

      {providers.length > 0 && (
        <>
          <div className="my-6 flex items-center gap-3 text-sm text-chalk-muted" aria-hidden>
            <span className="h-px flex-1 bg-rack-line" /> or <span className="h-px flex-1 bg-rack-line" />
          </div>
          <Suspense fallback={null}>
            <SignInButtons providers={providers} />
          </Suspense>
        </>
      )}
      <div className="h-10" />
    </main>
  );
}
