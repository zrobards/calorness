"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell, NotebookPen, TrendingUp, UserRound } from "lucide-react";

const TABS = [
  { href: "/train", label: "Train", Icon: Dumbbell },
  { href: "/diary", label: "Diary", Icon: NotebookPen },
  { href: "/progress", label: "Progress", Icon: TrendingUp },
  { href: "/profile", label: "Profile", Icon: UserRound },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-rack-line bg-rack/95 backdrop-blur"
      // keep the tabs above the iPhone home indicator
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium ${
                  active ? "text-chalk" : "text-chalk-muted"
                }`}
              >
                <Icon size={22} strokeWidth={active ? 2.4 : 1.8} aria-hidden />
                {label}
                <span
                  aria-hidden
                  className={`h-0.5 w-5 rounded-full ${active ? "bg-plate-red" : "bg-transparent"}`}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
