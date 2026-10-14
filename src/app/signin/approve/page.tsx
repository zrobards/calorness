import type { Metadata } from "next";
import { Suspense } from "react";
import { getOptionalUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { handoffStatus } from "@/lib/handoff";
import { ApproveButton, ProviderButton } from "./ApproveButtons";

export const metadata: Metadata = { title: "Sign in the app" };

// Opened by the home-screen app in a browser window. Sign in here, confirm
// the code matches, and the app signs itself in.
export default function ApprovePage({ searchParams }: { searchParams: Promise<{ req?: string; provider?: string }> }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6" style={{ paddingTop: "calc(env(safe-area-inset-top) + 3rem)" }}>
      <p className="font-display text-xl font-semibold text-chalk-muted">Calorness</p>
      <Suspense fallback={<div className="skeleton mt-10 h-40 rounded-2xl" />}>
        <Approve searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Approve({ searchParams }: { searchParams: Promise<{ req?: string; provider?: string }> }) {
  const { req: id = "", provider = "github" } = await searchParams;
  const user = await getOptionalUser();
  const request = id.length >= 30 ? await db.loginRequest.findUnique({ where: { id } }) : null;
  const status = handoffStatus(request, new Date());

  if (status !== "pending" && status !== "approved") {
    return <Message title="This link expired" body="Go back to the Calorness app and tap Continue again." />;
  }
  if (status === "approved") {
    return <Message title="You're all set" body="Go back to the Calorness app. It's signing you in now. You can close this window." />;
  }
  if (!user) {
    return (
      <>
        <h1 className="mt-10 font-display text-5xl font-bold tracking-tight">Sign in</h1>
        <p className="mt-3 text-chalk-muted">Then you&apos;ll confirm the code shown in the app.</p>
        <div className="mt-8">
          <ProviderButton provider={provider} callbackUrl={`/signin/approve?req=${encodeURIComponent(id)}&provider=${provider}`} />
        </div>
      </>
    );
  }
  return (
    <>
      <h1 className="mt-10 font-display text-4xl font-bold tracking-tight">Sign in the Calorness app?</h1>
      <p className="mt-3 text-chalk-muted">
        Signed in here as <span className="text-chalk">{user.name ?? user.email}</span>. Only confirm if the app on your screen shows this code:
      </p>
      <p className="mt-6 text-center font-display text-6xl font-bold tracking-[0.3em] tabular-nums">{request!.code}</p>
      <div className="mt-8">
        <ApproveButton id={id} />
      </div>
    </>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <>
      <h1 className="mt-10 font-display text-4xl font-bold tracking-tight">{title}</h1>
      <p className="mt-3 text-chalk-muted">{body}</p>
    </>
  );
}
