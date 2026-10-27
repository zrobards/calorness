"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell, NotebookPen, Plus, TrendingUp, UserRound } from "lucide-react";

const LEFT = [
  { href: "/train", label: "Train", Icon: Dumbbell },
  { href: "/diary", label: "Diary", Icon: NotebookPen },
] as const;
const RIGHT = [
  { href: "/progress", label: "Progress", Icon: TrendingUp },
  { href: "/profile", label: "Profile", Icon: UserRound },
] as const;

export function BottomNav() {
  return <NavBar pathname={usePathname()} />;
}

// Rendered without a pathname while the URL isn't known yet (during
// prerendering of dynamic routes like /train/history/[id]).
export function NavBar({ pathname }: { pathname: string | null }) {
  const tab = ({ href, label, Icon }: (typeof LEFT)[number] | (typeof RIGHT)[number]) => {
    const active = pathname?.startsWith(href) ?? false;
    return (
      <li key={href}>
        <Link
          href={href}
          prefetch // load each tab ahead of time so tapping it is instant
          aria-current={active ? "page" : undefined}
          className={`flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium ${active ? "text-chalk" : "text-chalk-muted"}`}
        >
          <Icon size={22} strokeWidth={active ? 2.4 : 1.8} aria-hidden />
          {label}
          <span aria-hidden className={`h-0.5 rounded-full transition-all duration-300 ${active ? "w-5 bg-plate-red" : "w-0 bg-transparent"}`} />
        </Link>
      </li>
    );
  };
  const logActive = pathname?.startsWith("/log") ?? false;

  return (
    <nav
      aria-label="Main"
      className="vv-pin fixed inset-x-0 bottom-0 z-10 border-t border-rack-line bg-rack/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid max-w-md grid-cols-5 items-end">
        {LEFT.map(tab)}
        <li className="flex justify-center">
          {/* The center button: a bumper plate. Everything you log starts here. */}
          <Link
            href="/log"
            prefetch
            aria-label="Quick log"
            aria-current={logActive ? "page" : undefined}
            className={`relative -mt-7 mb-2 flex size-16 items-center justify-center rounded-full border-[5px] border-[#a8302c] bg-plate-red text-white shadow-[0_8px_24px_-6px_rgba(216,69,62,0.7)] ${logActive ? "ring-4 ring-plate-red/30" : ""}`}
          >
            <span className="absolute inset-[9px] rounded-full border-2 border-white/15" aria-hidden />
            <Plus size={30} strokeWidth={3} aria-hidden />
          </Link>
        </li>
        {RIGHT.map(tab)}
      </ul>
    </nav>
  );
}
