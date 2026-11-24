"use client";

import { useState } from "react";
import { X } from "lucide-react";

const fmt = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** Someone's shared progress photos, with a tap-to-enlarge view. */
export function PhotoStrip({ photos }: { photos: { id: string; day: string }[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const current = photos.find((p) => p.id === open);
  return (
    <>
      <ul className="grid grid-cols-3 gap-2">
        {photos.map((p) => (
          <li key={p.id}>
            <button onClick={() => setOpen(p.id)} className="relative block aspect-[3/4] w-full overflow-hidden rounded-xl bg-rack-raised" aria-label={`Progress photo from ${fmt(p.day)}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/photos/${p.id}?size=thumb`} alt="" loading="lazy" className="size-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 px-1.5 pt-4 pb-1 text-left text-[11px] font-semibold text-white">{fmt(p.day)}</span>
            </button>
          </li>
        ))}
      </ul>
      {current && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4" role="dialog" aria-modal="true" aria-label={`Progress photo from ${fmt(current.day)}`} onClick={() => setOpen(null)}>
          <button className="absolute top-[calc(env(safe-area-inset-top)+1rem)] right-4 rounded-full bg-white/10 p-2 text-white" aria-label="Close"><X size={22} /></button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/photos/${current.id}`} alt="" className="max-h-[80dvh] max-w-full rounded-xl object-contain" />
          <p className="mt-3 text-sm text-white/80">{fmt(current.day)}</p>
        </div>
      )}
    </>
  );
}
