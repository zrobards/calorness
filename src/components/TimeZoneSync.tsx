"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { setTimeZone } from "@/app/(app)/profile/actions";

/** Tells the server which time zone the phone is in, so "today" is always your today. */
export function TimeZoneSync({ current }: { current: string }) {
  const router = useRouter();
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && tz !== current) setTimeZone(tz).then(() => router.refresh());
  }, [current, router]);
  return null;
}
