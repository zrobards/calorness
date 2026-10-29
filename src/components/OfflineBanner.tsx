"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

const subscribe = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

/** A small bar at the top when the phone has no connection, so a failed save isn't a mystery. */
export function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  if (online) return null;
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-plate-yellow px-4 pb-1.5 text-sm font-semibold text-rack" style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.375rem)" }}>
      <WifiOff size={15} aria-hidden /> No connection. Wait for signal, then save again.
    </div>
  );
}
