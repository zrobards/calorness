"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ClipboardCopy, Copy, Dumbbell, Flame, MoreHorizontal, Search, Trophy, X } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { Sheet } from "@/components/diary/Sheet";
import type { FeedPost, ProgramPostData, WorkoutPostData } from "@/lib/community";
import {
  answerRequest,
  blockPerson,
  copySharedProgram,
  deletePost,
  follow,
  report,
  saveCommunityProfile,
  searchPeople,
  toggleProps,
  unfollow,
} from "@/app/(app)/feed/actions";

const field = "w-full rounded-xl border border-rack-line bg-rack px-3.5 py-3 text-base text-chalk focus:border-plate-yellow focus:outline-none";
const ago = (iso: string) => {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 60) return `${Math.max(1, m)}m`;
  if (m < 1440) return `${Math.round(m / 60)}h`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
export const Avatar = ({ handle, size = 40 }: { handle: string; size?: number }) => (
  <span className="flex shrink-0 items-center justify-center rounded-full bg-plate-yellow font-extrabold text-rack" style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden>
    {handle.charAt(0).toUpperCase()}
  </span>
);

/** Create or edit your community profile. */
export function ProfileSetup({ initial, onSaved }: { initial?: { handle: string; bio: string; shareWorkouts: boolean; shareRecaps: boolean }; onSaved?: () => void }) {
  const router = useRouter();
  const [v, setV] = useState(initial ?? { handle: "", bio: "", shareWorkouts: true, shareRecaps: true });
  const [msg, setMsg] = useState<{ ok?: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form className="space-y-3" onSubmit={(e) => {
      e.preventDefault();
      start(async () => {
        const r = await saveCommunityProfile(v).catch(() => ({ error: "Couldn't save: no connection." }));
        if ("error" in r && r.error) return setMsg({ text: r.error });
        haptic("success");
        setMsg({ ok: true, text: "Saved." });
        onSaved?.();
        router.refresh();
      });
    }}>
      <label className="block text-sm font-medium text-chalk-muted">Username
        <span className="mt-1 flex items-center rounded-xl border border-rack-line bg-rack focus-within:border-plate-yellow">
          <span className="pl-3.5 text-chalk-muted">@</span>
          <input value={v.handle} onChange={(e) => setV({ ...v, handle: e.target.value.toLowerCase() })} required minLength={3} maxLength={20} autoCapitalize="none" autoCorrect="off" spellCheck={false}
            placeholder="yourname" className="w-full bg-transparent py-3 pr-3.5 pl-1 text-base text-chalk focus:outline-none" />
        </span>
      </label>
      <label className="block text-sm font-medium text-chalk-muted">Bio (optional)
        <input value={v.bio} onChange={(e) => setV({ ...v, bio: e.target.value })} maxLength={160} placeholder="Climbing + Upper/Lower, gaining" className={`mt-1 ${field}`} />
      </label>
      <fieldset className="space-y-2 text-sm">
        <legend className="mb-1 font-medium text-chalk-muted">Share with people you approve</legend>
        <label className="flex items-start gap-2.5"><input type="checkbox" checked={v.shareWorkouts} onChange={(e) => setV({ ...v, shareWorkouts: e.target.checked })} className="mt-0.5 size-4 accent-plate-yellow" />Finished workouts and new records</label>
        <label className="flex items-start gap-2.5"><input type="checkbox" checked={v.shareRecaps} onChange={(e) => setV({ ...v, shareRecaps: e.target.checked })} className="mt-0.5 size-4 accent-plate-yellow" />Weekly recaps and streak milestones</label>
        <p className="text-xs text-chalk-muted">Programs are only shared when you tap Share. Your food, weight, and body stats are never shared.</p>
      </fieldset>
      {msg && <p role="status" className={`text-sm ${msg.ok ? "text-plate-green" : "text-plate-red"}`}>{msg.text}</p>}
      <button disabled={pending} className="w-full rounded-xl bg-plate-blue py-3 font-semibold text-rack disabled:opacity-60">{pending ? "Saving…" : initial ? "Save profile" : "Join the feed"}</button>
    </form>
  );
}

/** Find people by username and ask to follow them. */
export function PeopleSearch() {
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<Awaited<ReturnType<typeof searchPeople>>>([]);
  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      const r = await searchPeople(q).catch(() => []);
      if (alive) setPeople(r);
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);
  return (
    <div>
      <label className="relative block">
        <Search size={18} className="absolute top-1/2 left-3 -translate-y-1/2 text-chalk-muted" aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder="Find people by username" aria-label="Find people" autoCapitalize="none"
          className="w-full rounded-xl border border-rack-line bg-rack-raised py-3 pr-3 pl-10 text-base focus:border-plate-yellow focus:outline-none" />
      </label>
      {people.length > 0 && (
        <ul className="mt-2 divide-y divide-rack-line overflow-hidden rounded-2xl bg-rack-raised">
          {people.map((p) => (
            <li key={p.handle} className="flex items-center gap-3 px-4 py-3">
              <Link href={`/u/${p.handle}`} className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar handle={p.handle} size={36} />
                <span className="min-w-0"><span className="block truncate font-semibold">@{p.handle}</span>{p.bio && <span className="block truncate text-xs text-chalk-muted">{p.bio}</span>}</span>
              </Link>
              <FollowButton key={p.status ?? "none"} handle={p.handle} status={p.status} small />
            </li>
          ))}
        </ul>
      )}
      {q.trim().length >= 2 && people.length === 0 && <p className="mt-2 text-sm text-chalk-muted">No one with that username yet.</p>}
    </div>
  );
}

export function FollowButton({ handle, status, small }: { handle: string; status: "PENDING" | "ACCEPTED" | null; small?: boolean }) {
  const router = useRouter();
  const [s, setS] = useState(status);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const label = s === "ACCEPTED" ? "Following" : s === "PENDING" ? "Requested" : "Follow";
  return (
    <span className="shrink-0 text-right">
      <button disabled={pending} aria-pressed={!!s}
        onClick={() => start(async () => {
          haptic();
          setErr(null);
          if (s) {
            if (s === "ACCEPTED" && !confirm(`Unfollow @${handle}?`)) return;
            await unfollow(handle).catch(() => null);
            setS(null);
          } else {
            const r = await follow(handle).catch(() => ({ error: "No connection. Try again." }));
            if ("error" in r && r.error) return setErr(r.error);
            if ("status" in r && r.status) setS(r.status);
          }
          router.refresh();
        })}
        className={`rounded-full font-semibold disabled:opacity-60 ${small ? "px-3.5 py-1.5 text-sm" : "px-5 py-2.5"} ${s ? "bg-rack-line text-chalk" : "bg-plate-blue text-rack"}`}>
        {label}
      </button>
      {err && <span role="alert" className="mt-1 block max-w-48 text-xs text-plate-red">{err}</span>}
    </span>
  );
}

/** People waiting for you to approve their follow. */
export function FollowRequests({ requests }: { requests: { id: string; handle: string; bio: string | null }[] }) {
  const router = useRouter();
  const [gone, setGone] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const left = requests.filter((r) => !gone.includes(r.id));
  if (!left.length) return null;
  return (
    <section aria-label="Follow requests" className="rounded-2xl bg-rack-raised p-4">
      <h2 className="text-sm font-semibold">Follow requests</h2>
      <ul className="mt-2 space-y-2">
        {left.map((r) => (
          <li key={r.id} className="flex items-center gap-3">
            <Link href={`/u/${r.handle}`} className="flex min-w-0 flex-1 items-center gap-3"><Avatar handle={r.handle} size={36} /><span className="truncate font-semibold">@{r.handle}</span></Link>
            {[true, false].map((ok) => (
              <button key={String(ok)} disabled={pending} aria-label={`${ok ? "Approve" : "Decline"} @${r.handle}`}
                onClick={() => start(async () => { haptic(ok ? "success" : undefined); await answerRequest(r.id, ok).catch(() => null); setGone((g) => [...g, r.id]); router.refresh(); })}
                className={`flex size-10 items-center justify-center rounded-full ${ok ? "bg-plate-blue text-rack" : "bg-rack-line text-chalk"}`}>
                {ok ? <Check size={18} /> : <X size={18} />}
              </button>
            ))}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PostCard({ post, imperial }: { post: FeedPost; imperial: boolean }) {
  const router = useRouter();
  const [props, setProps] = useState({ n: post.props, mine: post.propped });
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const w = (kg: number) => Math.round(imperial ? kg * 2.20462 : kg);
  const unit = imperial ? "lb" : "kg";

  const cheer = () => start(async () => {
    haptic();
    setProps((p) => ({ n: p.n + (p.mine ? -1 : 1), mine: !p.mine }));
    const r = await toggleProps(post.id).catch(() => ({ error: "x" }));
    if ("error" in r) setProps({ n: post.props, mine: post.propped });
  });

  let body: React.ReactNode = null;
  if (post.kind === "WORKOUT") {
    const d = post.data as WorkoutPostData;
    body = (
      <>
        <p className="mt-2 text-lg font-bold">{d.name}</p>
        <p className="text-sm text-chalk-muted">{d.minutes} min · {d.sets} {d.sets === 1 ? "set" : "sets"} · {w(d.volumeKg).toLocaleString("en-US")} {unit}</p>
        {d.records.length > 0 && (
          <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-plate-yellow/12 px-3 py-2 text-sm font-medium text-plate-yellow">
            <Trophy size={16} className="mt-0.5 shrink-0" aria-hidden /> New {d.records.length === 1 ? "record" : "records"}: {d.records.join(", ")}
          </p>
        )}
        <ul className="mt-2 space-y-1 text-sm">
          {d.exercises.slice(0, 5).map((e) => (
            <li key={e.name} className="flex justify-between gap-3">
              <span className="truncate">{e.sets} × {e.name}</span>
              <span className="shrink-0 text-chalk-muted tabular-nums">{e.bestKg ? `${w(e.bestKg)} ${unit} × ${e.bestReps}` : e.bestReps ? `${e.bestReps} reps` : ""}</span>
            </li>
          ))}
        </ul>
      </>
    );
  } else if (post.kind === "PROGRAM") {
    const d = post.data as ProgramPostData;
    body = (
      <>
        <p className="mt-2 text-sm text-chalk-muted">Shared a program</p>
        <p className="text-lg font-bold">{d.name}</p>
        {d.summary && <p className="text-sm text-chalk-muted">{d.summary}</p>}
        <ul className="mt-2 space-y-1.5 text-sm">
          {d.routines.map((r) => (
            <li key={r.name}><span className="font-semibold">{r.name}</span> <span className="text-chalk-muted">{r.exercises.length ? r.exercises.map((e) => e.name).join(", ") : r.notes}</span></li>
          ))}
        </ul>
        {!post.mine && (
          <button disabled={pending} onClick={() => start(async () => {
            const r = await copySharedProgram(post.id).catch(() => ({ error: "No connection. Try again." }));
            if ("error" in r && r.error) return setNote(r.error);
            haptic("success");
            setNote(`Copied to your programs and switched on${"skipped" in r && r.skipped ? ` (${r.skipped} custom exercises left out)` : ""}.`);
          })} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-plate-blue py-2.5 font-semibold text-rack disabled:opacity-60">
            <Copy size={16} aria-hidden /> Copy this program
          </button>
        )}
      </>
    );
  } else {
    const d = post.data as { type: "week" | "streak"; days?: number; workouts?: number; activities?: number; logStreak?: number };
    body = d.type === "streak" ? (
      <p className="mt-2 flex items-center gap-2 text-lg font-bold"><Flame className="text-plate-yellow" size={22} aria-hidden /> {d.days}-day logging streak</p>
    ) : (
      <>
        <p className="mt-2 text-lg font-bold">Week recap</p>
        <p className="text-sm text-chalk-muted">{d.workouts} {d.workouts === 1 ? "workout" : "workouts"}{d.activities ? `, ${d.activities} ${d.activities === 1 ? "activity" : "activities"}` : ""}{d.logStreak ? ` · ${d.logStreak}-day logging streak` : ""}</p>
      </>
    );
  }

  return (
    <article className="rounded-2xl bg-rack-raised p-4" aria-label={`Post by @${post.handle}`}>
      <header className="flex items-center gap-3">
        <Link href={`/u/${post.handle}`} className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar handle={post.handle} size={36} />
          <span className="min-w-0"><span className="block truncate font-semibold">@{post.handle}</span><span className="text-xs text-chalk-muted">{ago(post.createdAt)}</span></span>
        </Link>
        {post.kind === "WORKOUT" && <Dumbbell size={18} className="text-chalk-muted" aria-hidden />}
        <button onClick={() => setMenu(true)} className="rounded-lg p-1.5 text-chalk-muted" aria-label="More"><MoreHorizontal size={20} /></button>
      </header>
      {body}
      {note && <p role="status" className="mt-2 text-sm text-plate-green">{note}</p>}
      <footer className="mt-3 border-t border-rack-line pt-2.5">
        <button onClick={cheer} aria-pressed={props.mine} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${props.mine ? "bg-plate-yellow/15 text-plate-yellow" : "text-chalk-muted"}`}>
          <Flame size={16} aria-hidden /> Props{props.n > 0 ? ` · ${props.n}` : ""}
        </button>
      </footer>

      {menu && (
        <Sheet title={post.mine ? "Your post" : `@${post.handle}`} onClose={() => { setMenu(false); setReporting(false); }}>
          {post.mine ? (
            <button onClick={() => start(async () => { await deletePost(post.id).catch(() => null); setMenu(false); router.refresh(); })} className="w-full rounded-xl bg-rack py-3 font-semibold text-plate-red">Delete this post</button>
          ) : reporting ? (
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await report({ postId: post.id, reason }).catch(() => ({ error: "No connection." })); if ("error" in r && r.error) return setNote(r.error); setMenu(false); setReporting(false); setNote("Thanks. The report was sent."); }); }}>
              <label className="block text-sm text-chalk-muted">What&apos;s wrong with this post?
                <input value={reason} onChange={(e) => setReason(e.target.value)} required maxLength={300} className={`mt-1 ${field}`} />
              </label>
              <button className="w-full rounded-xl bg-plate-red py-3 font-semibold text-white">Send report</button>
            </form>
          ) : (
            <div className="space-y-2">
              <button onClick={() => setReporting(true)} className="w-full rounded-xl bg-rack py-3 font-semibold">Report post</button>
              <button onClick={() => { if (confirm(`Block @${post.handle}? You'll stop following each other and won't see each other.`)) start(async () => { await blockPerson(post.handle).catch(() => null); setMenu(false); router.refresh(); }); }}
                className="w-full rounded-xl bg-rack py-3 font-semibold text-plate-red">Block @{post.handle}</button>
            </div>
          )}
        </Sheet>
      )}
    </article>
  );
}

/** Copy your profile link to invite friends to follow you. */
export function ShareProfileLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={async () => {
      haptic();
      try {
        if (navigator.share) await navigator.share({ title: "Follow me on Calorness", url });
        else { await navigator.clipboard.writeText(url); setCopied(true); }
      } catch {}
    }} className="flex items-center gap-1.5 rounded-full bg-rack-raised px-3.5 py-2 text-sm font-semibold">
      <ClipboardCopy size={15} aria-hidden /> {copied ? "Link copied" : "Share my profile"}
    </button>
  );
}
