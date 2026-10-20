"use client";

import { useEffect } from "react";

export type ToastData = { message: string; action?: { label: string; onClick: () => void } };

/** A short confirmation at the bottom of the screen, with an optional Undo. */
export function Toast({ toast, onDone }: { toast: ToastData | null; onDone: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, [toast, onDone]);
  if (!toast) return null;
  return (
    <div
      role="status"
      className="fixed left-1/2 z-[70] flex w-[calc(100%-2rem)] max-w-sm items-center gap-3 rounded-2xl bg-chalk px-4 py-3 text-rack shadow-2xl"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 5.5rem + var(--music-dock-h, 0px))", transform: "translateX(-50%)", animation: "toast-in 260ms cubic-bezier(0.2,0.9,0.3,1.2)" }}
    >
      <span className="flex-1 text-sm font-medium">{toast.message}</span>
      {toast.action && (
        <button onClick={() => { toast.action!.onClick(); onDone(); }} className="font-display text-lg font-bold text-plate-red">
          {toast.action.label}
        </button>
      )}
    </div>
  );
}
