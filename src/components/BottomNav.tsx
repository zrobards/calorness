"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell, House, NotebookPen, UserRound } from "lucide-react";

// Home is Quick log: logging food is one tap from anywhere. "You" holds your
// progress and profile; settings open from there.
const TABS = [
  { href: "/log", match: ["/log"], label: "Home", Icon: House },
  { href: "/diary", match: ["/diary"], label: "Diary", Icon: NotebookPen },
  { href: "/train", match: ["/train"], label: "Train", Icon: Dumbbell },
  { href: "/progress", match: ["/progress", "/profile", "/coach"], label: "You", Icon: UserRound },
] as const;

export function BottomNav() {
  return <NavBar pathname={usePathname()} />;
}

// Rendered without a pathname while the URL isn't known yet (during
// prerendering of dynamic routes like /train/history/[id]).
export function NavBar({ pathname }: { pathname: string | null }) {
  return (
    <nav
      aria-label="Main"
      className="vv-pin fixed inset-x-0 bottom-0 z-10 border-t border-rack-line bg-rack/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {TABS.map(({ href, match, label, Icon }) => {
          const active = match.some((m) => pathname?.startsWith(m)) ?? false;
          return (
            <li key={href}>
              <Link
                href={href}
                prefetch // load each tab ahead of time so tapping it is instant
                aria-current={active ? "page" : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${active ? "text-plate-yellow" : "text-chalk-muted"}`}
              >
                <Icon size={23} strokeWidth={active ? 2.4 : 1.9} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
