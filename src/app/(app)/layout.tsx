import { Suspense, ViewTransition } from "react";
import { BottomNav, NavBar } from "@/components/BottomNav";
import { requireUser } from "@/lib/auth";

// Everything inside the (app) folder is behind sign-in. The parentheses mean
// the folder name doesn't appear in the URL: (app)/train is just /train.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-md pb-[calc(5rem+env(safe-area-inset-bottom))]">
      {/* Reading the session happens per request, so it streams in behind a
          Suspense boundary while the nav renders instantly. */}
      <Suspense fallback={<PageLoading />}>
        <AuthGate>
          {/* crossfades between pages instead of a hard cut */}
          <ViewTransition>{children}</ViewTransition>
        </AuthGate>
      </Suspense>
      <Suspense fallback={<NavBar pathname={null} />}>
        <BottomNav />
      </Suspense>
    </div>
  );
}

async function AuthGate({ children }: { children: React.ReactNode }) {
  await requireUser(); // redirects to /signin when signed out
  return <>{children}</>;
}

function PageLoading() {
  return (
    <div className="px-5 pt-16" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-9 w-40 rounded-lg" />
      <div className="skeleton mt-6 h-40 rounded-2xl" />
    </div>
  );
}
