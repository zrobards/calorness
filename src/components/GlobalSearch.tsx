"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { searchEverything, type SearchHit } from "@/app/(app)/search/actions";

// One search for the whole app: places and actions, every setting, and your
// own programs, routines, exercises, foods, and Coach chats.
const PLACES: SearchHit[] = [
  { group: "Go to", title: "Quick log", detail: "Snap, describe, or scan food", href: "/log" },
  { group: "Go to", title: "Diary", detail: "Today's food and water", href: "/diary" },
  { group: "Go to", title: "Add food", detail: "Search the food database", href: "/diary/add" },
  { group: "Go to", title: "Train", detail: "Your running program", href: "/train" },
  { group: "Go to", title: "Log cardio or an activity", detail: "Running, climbing, sports…", href: "/train/cardio/new" },
  { group: "Go to", title: "Build a program with AI", href: "/train/programs/build" },
  { group: "Go to", title: "Program templates", detail: "Push/Pull/Legs, 5×5, and more", href: "/train/templates" },
  { group: "Go to", title: "Exercise library", href: "/train/exercises" },
  { group: "Go to", title: "Coach", detail: "Ask about training or food", href: "/coach" },
  { group: "Go to", title: "Progress", detail: "Muscles, volume, lifts, weight", href: "/progress" },
  { group: "Go to", title: "Activity", detail: "Steps, active calories, walking speed", href: "/progress/activity" },
  { group: "Settings", title: "Daily targets", detail: "Calories, protein, carbs, fat, water", href: "/profile#goals" },
  { group: "Settings", title: "Body stats", detail: "Sex, age, height, exercise credit", href: "/profile#body" },
  { group: "Settings", title: "Activity goals", detail: "Steps, move, exercise minutes", href: "/profile#activity-goals" },
  { group: "Settings", title: "Connect Apple Health", detail: "Steps and active calories", href: "/profile#health" },
  { group: "Settings", title: "Home-screen widget", href: "/profile#widget" },
  { group: "Settings", title: "Notifications", detail: "Rest timer and reminders", href: "/profile#notifications" },
  { group: "Settings", title: "Phone shortcut keys", detail: "Log from Siri or Back Tap", href: "/profile#shortcut" },
  { group: "Settings", title: "Units and password", detail: "Pounds or kilograms", href: "/profile#account" },
  { group: "Settings", title: "Invite friends", href: "/profile#invite" },
  { group: "Settings", title: "Privacy and delete account", href: "/profile#privacy" },
];

export function SearchButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => { haptic(); setOpen(true); }} className="rounded-lg p-2 text-chalk-muted hover:text-chalk" aria-label="Search the app">
        <Search size={21} />
      </button>
      {open && <SearchPanel onClose={() => setOpen(false)} />}
    </>
  );
}

function SearchPanel({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);

  // Your own data, looked up on the server as you type
  useEffect(() => {
    const term = q.trim();
    let alive = true;
    const t = setTimeout(async () => {
      if (term.length < 2) { setHits([]); return; }
      setLoading(true);
      const r = await searchEverything(term).catch(() => []);
      if (alive) { setHits(r); setLoading(false); }
    }, 200);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);

  const places = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return PLACES.filter((p) => p.group === "Go to");
    return PLACES.filter((p) => `${p.title} ${p.detail ?? ""}`.toLowerCase().includes(term));
  }, [q]);
  const all = [...places, ...hits];
  const groups = [...new Set(all.map((h) => h.group))];

  return (
    <div className="animate-fade fixed inset-0 z-50 overflow-y-auto bg-rack" role="dialog" aria-modal="true" aria-label="Search">
      <div className="mx-auto max-w-md px-5 pb-24" style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}>
        <div className="flex items-center gap-2">
          <label className="relative flex-1">
            <Search size={18} className="absolute top-1/2 left-3 -translate-y-1/2 text-chalk-muted" aria-hidden />
            <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder="Search foods, exercises, routines, settings…" aria-label="Search the app"
              className="w-full rounded-xl border border-rack-line bg-rack-raised py-3 pr-9 pl-10 text-base focus:border-plate-yellow focus:outline-none" />
            {loading && <Loader2 size={16} className="absolute top-1/2 right-3 -translate-y-1/2 animate-spin text-chalk-muted" aria-hidden />}
          </label>
          <button onClick={onClose} className="p-2 text-chalk-muted" aria-label="Close search"><X size={24} /></button>
        </div>

        {groups.map((g) => (
          <section key={g} className="mt-5">
            <h2 className="px-1 text-xs font-semibold tracking-wide text-chalk-muted uppercase">{g}</h2>
            <ul className="mt-1.5 divide-y divide-rack-line overflow-hidden rounded-2xl bg-rack-raised">
              {all.filter((h) => h.group === g).map((h, i) => (
                <li key={`${h.href}-${i}`}>
                  <Link href={h.href} onClick={onClose} className="block px-4 py-3 active:bg-rack-line/40">
                    <span className="block truncate font-medium">{h.title}</span>
                    {h.detail && <span className="block truncate text-sm text-chalk-muted">{h.detail}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {q.trim().length >= 2 && !loading && all.length === 0 && (
          <div className="mt-8 text-center text-chalk-muted">
            <p>Nothing matches &ldquo;{q.trim()}&rdquo;.</p>
            <Link href={`/diary/add?q=${encodeURIComponent(q.trim())}`} onClick={onClose} className="mt-3 inline-block font-medium text-plate-blue">Search the food database for it</Link>
          </div>
        )}
      </div>
    </div>
  );
}
