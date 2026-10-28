"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import type { ProgramTemplate } from "@/lib/templates";
import { importTemplate } from "@/lib/clientActions";
import { haptic } from "@/lib/haptics";

const LEVEL_COLOR = { Beginner: "text-plate-green", Intermediate: "text-plate-yellow", Any: "text-plate-blue" } as const;

export function TemplateCard({ template }: { template: ProgramTemplate }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <div className="rounded-2xl bg-rack-raised p-4">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-3 text-left" aria-expanded={open}>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-2xl font-semibold">{template.name}</span>
          <span className="block text-sm text-chalk-muted">
            <span className={`font-semibold ${LEVEL_COLOR[template.level]}`}>{template.level}</span>, {template.days}
          </span>
          <span className="mt-1 block text-sm">{template.description}</span>
        </span>
        <ChevronDown size={20} className={`mt-1 shrink-0 text-chalk-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {open && (
        <div className="animate-fade mt-3 space-y-3">
          {template.routines.map((r) => (
            <div key={r.name} className="rounded-xl bg-rack p-3">
              <p className="font-semibold">{r.name}</p>
              <ul className="mt-1 space-y-0.5 text-sm text-chalk-muted">
                {r.exercises.map(([name, sets, min, max]) => (
                  <li key={name} className="flex justify-between gap-3">
                    <span className="truncate">{name}</span>
                    <span className="shrink-0 tabular-nums">{sets} × {min === max ? min : `${min}–${max}`}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <button
        disabled={pending}
        onClick={() => start(async () => {
          const r = await importTemplate(template.id);
          if ("ok" in r && r.ok) { haptic("success"); router.push("/train"); } else if ("error" in r && r.error) alert(r.error);
        })}
        className="mt-3 w-full rounded-xl bg-chalk py-3 font-display text-lg font-semibold text-rack disabled:opacity-60"
      >
        {pending ? "Adding…" : `Add ${template.routines.length === 1 ? "this routine" : `these ${template.routines.length} routines`}`}
      </button>
    </div>
  );
}
