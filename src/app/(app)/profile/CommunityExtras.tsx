"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeCommunityProfile, unblockPerson } from "@/app/(app)/feed/actions";

/** Blocked people, and leaving the feed entirely. */
export function CommunityExtras({ blocked }: { blocked: string[] }) {
  const router = useRouter();
  const [list, setList] = useState(blocked);
  const [pending, start] = useTransition();
  return (
    <div className="mt-5 space-y-4 border-t border-rack-line pt-4 text-sm">
      {list.length > 0 && (
        <div>
          <p className="font-medium text-chalk-muted">Blocked</p>
          <ul className="mt-1 space-y-1">
            {list.map((h) => (
              <li key={h} className="flex items-center justify-between">
                @{h}
                <button disabled={pending} onClick={() => start(async () => { await unblockPerson(h).catch(() => null); setList((l) => l.filter((x) => x !== h)); })} className="font-semibold text-plate-blue">Unblock</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button disabled={pending}
        onClick={() => { if (confirm("Leave the feed? Your username, posts, followers, and who you follow are removed. Your own workouts and food stay.")) start(async () => { await removeCommunityProfile().catch(() => null); router.refresh(); }); }}
        className="font-semibold text-plate-red">Leave the feed</button>
    </div>
  );
}
