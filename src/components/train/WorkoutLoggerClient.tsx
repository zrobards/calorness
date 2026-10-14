"use client";

import dynamic from "next/dynamic";

// The logger restores unsaved sets from the phone's storage, which only
// exists in the browser, so we skip server rendering for it entirely.
export const WorkoutLoggerClient = dynamic(
  () => import("./WorkoutLogger").then((m) => m.WorkoutLogger),
  {
    ssr: false,
    loading: () => (
      <div className="px-5 pt-16" aria-busy="true" aria-label="Loading workout">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-rack-raised" />
        <div className="mt-6 h-56 animate-pulse rounded-2xl bg-rack-raised" />
      </div>
    ),
  },
);
