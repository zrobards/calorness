"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { EditSessionTime } from "@/components/train/EditSessionTime";

/** "Wrong length?" on a finished workout: fix the minutes and effort so calories burned are right. */
export function WorkoutTimeEditor({ id, minutes, effort }: { id: string; minutes: number; effort: string | null }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <div className="mt-2">
      {!open ? (
        <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-sm font-medium text-plate-blue">
          <Pencil size={14} aria-hidden /> Change length or effort (for calories burned)
        </button>
      ) : (
        <EditSessionTime kind="workout" id={id} minutes={minutes} effort={effort ?? undefined}
          onSaved={() => { router.refresh(); setTimeout(() => setOpen(false), 700); }} onCancel={() => setOpen(false)} />
      )}
    </div>
  );
}
