"use client";

import dynamic from "next/dynamic";

// Rendered only in the browser: the meal guess and "today" depend on the
// phone's own clock, which the server doesn't know.
export const QuickLogClient = dynamic(() => import("./QuickLog").then((m) => m.QuickLog), {
  ssr: false,
  loading: () => (
    <div className="space-y-3 px-5" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-14 w-40 rounded-xl" />
      <div className="skeleton h-44 rounded-3xl" />
      <div className="skeleton h-24 rounded-2xl" />
    </div>
  ),
});
