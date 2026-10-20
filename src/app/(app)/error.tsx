"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";

// Shown in place of a screen that hit an unexpected error (the tab bar stays),
// instead of a blank page or the framework's crash screen.
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-5 mt-16 rounded-2xl bg-rack-raised p-6 text-center" role="alert">
      <h1 className="font-display text-3xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-chalk-muted">
        This screen couldn&apos;t load. Your data is safe. Check your connection and try again.
      </p>
      <button onClick={reset} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-plate-red px-5 py-3 font-display text-lg font-semibold text-white">
        <RotateCcw size={18} aria-hidden /> Try again
      </button>
      {error.digest && <p className="mt-4 text-xs text-chalk-muted">Error code: {error.digest}</p>}
    </div>
  );
}
