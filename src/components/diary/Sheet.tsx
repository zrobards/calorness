"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

/** A bottom sheet, the standard mobile pattern for a focused task. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-black/60" onClick={onClose} aria-label="Close" tabIndex={-1} />
      <div
        className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-rack-raised px-5 pt-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.25rem)" }}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-rack-line" aria-hidden />
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-2xl leading-tight font-semibold">{title}</h2>
          <button onClick={onClose} className="-mr-1 p-1 text-chalk-muted" aria-label="Close">
            <X size={22} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
