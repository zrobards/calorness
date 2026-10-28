"use client";

import { createContext, useContext, useEffect, useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { haptic } from "@/lib/haptics";

// Collapsible cards used across the app so screens stay tidy. Each remembers
// whether you left it open (on this phone), opens itself when a link points
// at it (#goals), and can be filtered by a search box above it.

const SearchContext = createContext<string>("");
export const CollapsibleSearch = SearchContext.Provider;

const KEY = "calorness:open-sections";
function readOpen(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, boolean>;
  } catch {
    return {};
  }
}

export function Collapsible({
  id,
  title,
  summary,
  keywords = "",
  defaultOpen = false,
  icon,
  children,
}: {
  id: string;
  title: string;
  /** One line shown while closed, e.g. current values ("2,450 cal, 180 g protein") */
  summary?: string;
  /** Extra words the search should match */
  keywords?: string;
  defaultOpen?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  const query = useContext(SearchContext).trim().toLowerCase();
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  useEffect(() => {
    const t = setTimeout(() => {
      const saved = readOpen()[id];
      if (window.location.hash === `#${id}`) {
        setOpen(true);
        document.getElementById(id)?.scrollIntoView({ block: "start" });
      } else if (saved !== undefined) setOpen(saved);
    }, 0);
    // Links to #this-section from the same page (search results, "Change
    // activity goals") change the hash without reloading: open then too.
    // Next.js updates the address with pushState, which fires no event, so
    // also check after any in-app navigation.
    const onHash = () => {
      if (window.location.hash === `#${id}`) {
        setOpen(true);
        setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "start", behavior: "smooth" }), 50);
      }
    };
    window.addEventListener("hashchange", onHash);
    window.addEventListener("calorness:navigated", onHash);
    return () => {
      clearTimeout(t);
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("calorness:navigated", onHash);
    };
  }, [id]);

  const matches = !query || `${title} ${summary ?? ""} ${keywords}`.toLowerCase().includes(query);
  if (!matches) return null;
  const isOpen = open || !!query; // searching shows matching sections open

  const toggle = () => {
    haptic();
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...readOpen(), [id]: next }));
    } catch {}
  };

  return (
    <section id={id} className="mx-5 mt-3 scroll-mt-4 overflow-hidden rounded-2xl bg-rack-raised">
      <button onClick={toggle} aria-expanded={isOpen} aria-controls={bodyId} className="flex w-full items-center gap-3 px-5 py-4 text-left">
        {icon && <span className="shrink-0 text-chalk-muted" aria-hidden>{icon}</span>}
        <span className="min-w-0 flex-1">
          <span className="block font-display text-xl font-semibold">{title}</span>
          {summary && !isOpen && <span className="block truncate text-sm text-chalk-muted">{summary}</span>}
        </span>
        <ChevronDown size={20} className={`shrink-0 text-chalk-muted transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {isOpen && (
        <div id={bodyId} className="animate-fade border-t border-rack-line px-5 pt-1 pb-5">
          {children}
        </div>
      )}
    </section>
  );
}

/** A search box that filters the Collapsible sections inside it. */
export function SearchableSections({ placeholder, children }: { placeholder: string; children: React.ReactNode }) {
  const [q, setQ] = useState("");
  return (
    <CollapsibleSearch value={q}>
      <div className="mx-5">
        <input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder={placeholder} aria-label={placeholder}
          className="w-full rounded-xl border border-rack-line bg-rack-raised px-4 py-3 text-base focus:border-plate-yellow focus:outline-none" />
      </div>
      {children}
    </CollapsibleSearch>
  );
}
