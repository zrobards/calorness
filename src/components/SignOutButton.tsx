"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="rounded-lg px-3 py-1.5 text-sm font-medium text-chalk-muted hover:text-chalk"
    >
      Sign out
    </button>
  );
}
