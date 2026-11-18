"use client";

import Link from "next/link";
import { useState } from "react";
import { ClipboardPaste, LayoutGrid, PencilLine, Plus, Sparkles } from "lucide-react";
import { Sheet } from "@/components/diary/Sheet";
import { haptic } from "@/lib/haptics";

const OPTIONS = [
  { href: "/train/programs/build", icon: Sparkles, color: "text-plate-yellow", title: "Build it with AI", detail: "Tell it your goal, days, and equipment" },
  { href: "/train/programs/build?mode=paste", icon: ClipboardPaste, color: "text-plate-blue", title: "Paste my program", detail: "Set up a plan you already have, exactly as written" },
  { href: "/train/templates", icon: LayoutGrid, color: "text-plate-blue", title: "Start from a template", detail: "Push/Pull/Legs, Upper/Lower, 5×5, and more" },
  { href: "/train/routines/new", icon: PencilLine, color: "text-chalk-muted", title: "Make a single routine", detail: "Pick the exercises yourself" },
];

/** One button for every way to make a plan. */
export function NewPlanButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => { haptic(); setOpen(true); }} className="flex items-center gap-1 rounded-full bg-plate-blue px-3.5 py-1.5 text-sm font-semibold text-rack">
        <Plus size={16} aria-hidden /> New plan
      </button>
      {open && (
        <Sheet title="New plan" onClose={() => setOpen(false)}>
          <ul className="mt-2 space-y-2">
            {OPTIONS.map((o) => (
              <li key={o.href}>
                <Link href={o.href} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-2xl bg-rack px-4 py-3.5 active:bg-rack-line/40">
                  <o.icon size={22} className={`shrink-0 ${o.color}`} aria-hidden />
                  <span>
                    <span className="block font-semibold">{o.title}</span>
                    <span className="text-sm text-chalk-muted">{o.detail}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Sheet>
      )}
    </>
  );
}
