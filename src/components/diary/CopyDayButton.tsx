"use client";

import { useState, useTransition } from "react";
import { CopyPlus } from "lucide-react";
import { copyWholeDay } from "@/app/(app)/diary/actions";
import { haptic } from "@/lib/haptics";

/** On an empty day: repeat everything from the day before in one tap. */
export function CopyDayButton({ fromDay, toDay }: { fromDay: string; toDay: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="mx-5 mt-4">
      <button
        disabled={pending}
        onClick={() => start(async () => { const r = await copyWholeDay(fromDay, toDay); if (r.error) setMsg(r.error); else haptic("success"); })}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-rack-line py-3 font-medium text-chalk-muted hover:border-plate-blue hover:text-chalk"
      >
        <CopyPlus size={18} aria-hidden /> {pending ? "Copying…" : "Repeat yesterday's whole day"}
      </button>
      {msg && <p className="mt-2 text-center text-sm text-chalk-muted">{msg}</p>}
    </div>
  );
}
