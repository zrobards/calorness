"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { createHandoff, handoffState } from "./actions";

const ERRORS: Record<string, string> = {
  OAuthCallback: "GitHub sign-in didn't finish. Try again.",
  OAuthSignin: "Couldn't start GitHub sign-in. Try again.",
  AccessDenied: "Sign-in was cancelled.",
  CredentialsSignin: "That sign-in link expired. Try again.",
  OAuthAccountNotLinked: "That email already has an account. Sign in with email and password.",
  Callback: "GitHub sign-in didn't finish. Try again.",
};

/** True when running as an app added to the home screen (not a browser tab). */
function isHomeScreenApp() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function SignInButtons({ providers }: { providers: { id: string; name: string }[] }) {
  const error = useSearchParams().get("error");
  const [handoff, setHandoff] = useState<{ id: string; code: string; providerId: string } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const finishing = useRef(false);

  // While the browser window is open, keep checking whether you've approved
  useEffect(() => {
    if (!handoff) return;
    const check = async () => {
      if (finishing.current) return;
      const state = await handoffState(handoff.id);
      if (state === "approved") {
        finishing.current = true;
        setStatus("Signed in. Opening Calorness…");
        await signIn("handoff", { requestId: handoff.id, callbackUrl: "/log" });
      } else if (state === "expired" || state === "missing" || state === "used") {
        setHandoff(null);
        setStatus("That took too long. Tap the button to try again.");
      }
    };
    const timer = setInterval(check, 1500);
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [handoff]);

  const start = async (providerId: string) => {
    // A normal browser tab handles OAuth fine. Only the home-screen app needs the handoff.
    if (providerId === "demo" || !isHomeScreenApp()) {
      return signIn(providerId, { callbackUrl: "/log" });
    }
    const { id, code } = await createHandoff();
    setHandoff({ id, code, providerId });
    setStatus(null);
    window.open(`/signin/approve?req=${encodeURIComponent(id)}&provider=${providerId}`, "_blank");
  };

  if (handoff) {
    return (
      <div className="animate-rise rounded-2xl bg-rack-raised p-5 text-center" aria-live="polite">
        <Loader2 className="mx-auto animate-spin text-plate-red" size={32} aria-hidden />
        <p className="mt-3 font-display text-2xl font-semibold">Finish in the window that opened</p>
        <p className="mt-1 text-sm text-chalk-muted">Sign in there and confirm this code, then come back here.</p>
        <p className="mt-4 font-display text-5xl font-bold tracking-[0.3em] tabular-nums">{handoff.code}</p>
        {status && <p className="mt-3 text-sm">{status}</p>}
        <button onClick={() => window.open(`/signin/approve?req=${encodeURIComponent(handoff.id)}&provider=${handoff.providerId}`, "_blank")}
          className="mt-5 text-sm font-medium text-plate-blue">
          Window didn&apos;t open? Tap here
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <p role="alert" className="rounded-xl border border-plate-red/50 bg-plate-red/10 p-3 text-sm">{ERRORS[error] ?? "Sign-in didn't work. Try again."} <span className="text-chalk-muted">(code: {error})</span></p>}
      {status && <p className="text-sm text-chalk-muted">{status}</p>}
      {providers.map((p) => (
        <button
          key={p.id}
          onClick={() => start(p.id)}
          className={`w-full rounded-xl py-3.5 font-display text-xl font-semibold ${p.id === "demo" ? "border border-rack-line text-chalk" : "bg-chalk text-rack"}`}
        >
          {p.id === "demo" ? "Try the demo account" : `Continue with ${p.name}`}
        </button>
      ))}
    </div>
  );
}
