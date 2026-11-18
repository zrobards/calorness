"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/costs", label: "AI costs" },
  { href: "/admin/foods", label: "Foods" },
  { href: "/admin/exercises", label: "Exercises" },
];

export function AdminTabs() {
  const path = usePathname();
  return (
    <nav aria-label="Admin sections" className="mx-5 mb-4 grid grid-cols-4 gap-1.5">
      {TABS.map((t) => {
        const on = t.href === "/admin" ? path === "/admin" : path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} aria-current={on ? "page" : undefined}
            className={`rounded-full px-1 py-1.5 text-center text-sm font-semibold whitespace-nowrap ${on ? "bg-plate-yellow text-rack" : "bg-rack-raised text-chalk-muted"}`}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
