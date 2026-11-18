"use client";

import { useState, useTransition } from "react";
import { haptic } from "@/lib/haptics";
import { healthStatus, logTodayActivity } from "./actions";
import { createApiKey, setActivityGoals } from "@/lib/clientActions";

const field = "mt-1 w-full rounded-xl border border-rack-line bg-rack px-3 py-2.5 text-base text-chalk tabular-nums focus:border-plate-yellow focus:outline-none";

export function ActivityGoals({ initial }: { initial: { stepGoal: number; activeCalGoal: number; exerciseMinGoal: number; useHealthCalories: boolean } }) {
  const [g, setG] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form className="mt-3 space-y-3" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await setActivityGoals(g); setMsg(r.error ?? "Saved."); if (!r.error) haptic("success"); }); }}>
      <div className="grid grid-cols-3 gap-2">
        <label className="text-sm font-medium text-plate-green">Steps<input type="number" inputMode="numeric" value={g.stepGoal} onChange={(e) => setG({ ...g, stepGoal: Number(e.target.value) })} className={field} /></label>
        <label className="text-sm font-medium text-plate-red">Move (cal)<input type="number" inputMode="numeric" value={g.activeCalGoal} onChange={(e) => setG({ ...g, activeCalGoal: Number(e.target.value) })} className={field} /></label>
        <label className="text-sm font-medium text-plate-blue">Exercise (min)<input type="number" inputMode="numeric" value={g.exerciseMinGoal} onChange={(e) => setG({ ...g, exerciseMinGoal: Number(e.target.value) })} className={field} /></label>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={g.useHealthCalories} onChange={(e) => setG({ ...g, useHealthCalories: e.target.checked })} className="mt-0.5 size-4 accent-plate-yellow" />
        <span>Use Apple Health&apos;s active calories for exercise in the Diary when they&apos;re synced. <span className="text-chalk-muted">They already include your workouts, so logged sessions aren&apos;t counted twice.</span></span>
      </label>
      {msg && <p role="status" className="text-sm text-chalk-muted">{msg}</p>}
      <button disabled={pending} className="w-full rounded-xl bg-rack py-2.5 font-semibold disabled:opacity-60">{pending ? "Saving…" : "Save activity goals"}</button>
    </form>
  );
}


/**
 * Apple Health, kept to what actually works from a web app.
 * Websites can't read Apple Health. With a shared Shortcut link
 * (HEALTH_SHORTCUT_URL) it's two taps: copy your key, add the Shortcut.
 * Without one, people type today's steps and active calories here.
 */
export function HealthSetup({ shortcutUrl, initialStatus }: {
  shortcutUrl: string | null;
  initialStatus: { lastSync: string; steps: number | null; day: string } | null;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [copied, setCopied] = useState(false);
  const [steps, setSteps] = useState("");
  const [cal, setCal] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const copyKeyThenAdd = () => start(async () => {
    setMsg(null);
    const r = await createApiKey("Apple Health");
    if ("error" in r && r.error) return setMsg(r.error);
    if ("key" in r && r.key) {
      try { await navigator.clipboard.writeText(r.key); } catch {}
      haptic("success");
      setCopied(true);
      if (shortcutUrl) window.location.href = shortcutUrl;
    }
  });
  const saveManual = () => start(async () => {
    setMsg(null);
    const r = await logTodayActivity({ steps: steps ? Number(steps) : undefined, activeCalories: cal ? Number(cal) : undefined });
    if ("error" in r && r.error) return setMsg(r.error);
    haptic("success");
    setMsg("Saved.");
    setStatus(await healthStatus().catch(() => status));
  });

  return (
    <div className="mt-3 text-sm">
      {status && (
        <p className="mb-3 flex items-center gap-2 rounded-xl bg-plate-green/15 p-3">
          <span className="size-2.5 shrink-0 rounded-full bg-plate-green" aria-hidden />
          Last update {new Date(status.lastSync).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}
          {status.steps !== null ? `, ${status.steps.toLocaleString("en-US")} steps` : ""}.
        </p>
      )}

      {shortcutUrl ? (
        <>
          <p className="text-chalk-muted">Sends your steps and active calories from your iPhone every evening.</p>
          <button onClick={copyKeyThenAdd} disabled={pending} className="mt-3 w-full rounded-xl bg-plate-blue py-3 font-semibold text-rack disabled:opacity-60">
            {pending ? "One moment…" : copied ? "Key copied. Opening Shortcuts…" : "Connect Apple Health"}
          </button>
          <p className="mt-2 text-xs text-chalk-muted">Tap Add Shortcut, paste when it asks for your key (it&apos;s already copied), and you&apos;re done.</p>
        </>
      ) : (
        <p className="text-chalk-muted">
          Automatic Apple Health syncing needs a Calorness iPhone app, which isn&apos;t available yet. Until then, enter today&apos;s numbers from your Health or Fitness app:
        </p>
      )}

      <div className={`grid grid-cols-2 gap-2 ${shortcutUrl ? "mt-4" : "mt-3"}`}>
        <label className="text-xs font-medium text-chalk-muted">Steps today
          <input value={steps} onChange={(e) => setSteps(e.target.value)} type="number" inputMode="numeric" placeholder="8,000"
            className="mt-1 w-full rounded-xl border border-rack-line bg-rack px-3 py-2.5 text-base text-chalk focus:border-plate-yellow focus:outline-none" />
        </label>
        <label className="text-xs font-medium text-chalk-muted">Active calories
          <input value={cal} onChange={(e) => setCal(e.target.value)} type="number" inputMode="numeric" placeholder="450"
            className="mt-1 w-full rounded-xl border border-rack-line bg-rack px-3 py-2.5 text-base text-chalk focus:border-plate-yellow focus:outline-none" />
        </label>
      </div>
      <button onClick={saveManual} disabled={pending || (!steps && !cal)} className="mt-2 w-full rounded-xl bg-rack py-2.5 font-semibold disabled:opacity-50">Save today&apos;s activity</button>
      {msg && <p role="status" className="mt-2 text-chalk-muted">{msg}</p>}
    </div>
  );
}

/** Getting Calorness on the home screen like an app: no extra apps needed. */
export function InstallApp() {
  const [standalone] = useState(() => typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true));
  const [ios] = useState(() => typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent));
  if (standalone) return <p className="mt-3 text-sm text-plate-green">Calorness is on your home screen.</p>;
  return (
    <div className="mt-3 text-sm text-chalk-muted">
      {ios ? (
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>In Safari, tap the <b>Share</b> button (the square with an arrow).</li>
          <li>Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.</li>
        </ol>
      ) : (
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>In Chrome, tap the <b>⋮</b> menu.</li>
          <li>Tap <b>Add to Home screen</b> (or <b>Install app</b>).</li>
        </ol>
      )}
      <p className="mt-2">It opens full-screen like a normal app, straight to Quick log.</p>
    </div>
  );
}
