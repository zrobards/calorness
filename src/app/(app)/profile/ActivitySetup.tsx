"use client";

import { useState, useTransition } from "react";
import { Check, Copy } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { createApiKey, healthStatus, setActivityGoals } from "./actions";

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

function CopyBox({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-chalk-muted">{label}</span>
        <button type="button" onClick={async () => { await navigator.clipboard.writeText(text); haptic("success"); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="flex items-center gap-1 text-xs font-semibold text-plate-blue">{copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}</button>
      </div>
      <pre className="mt-1 max-h-48 overflow-auto rounded-xl bg-rack p-3 text-[11px] leading-relaxed break-all whitespace-pre-wrap text-chalk-muted">{text}</pre>
    </div>
  );
}

/**
 * Connecting Apple Health, as a short guided flow: your key and web address
 * with copy buttons, two ways to send data (an app that does it for you, or
 * a free Shortcut), and a live "is it working?" check.
 */
export function HealthSetup({ origin, shortcutUrl, initialStatus }: {
  origin: string;
  shortcutUrl: string | null;
  initialStatus: { lastSync: string; steps: number | null; day: string } | null;
}) {
  const [key, setKey] = useState<string | null>(null);
  const [status, setStatus] = useState(initialStatus);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [method, setMethod] = useState<"app" | "shortcut">(shortcutUrl ? "shortcut" : "app");
  const url = `${origin}/api/health`;

  const makeKey = () => start(async () => {
    setError(null);
    const r = await createApiKey("Apple Health");
    if ("error" in r && r.error) return setError(r.error);
    if ("key" in r && r.key) { setKey(r.key); haptic("success"); }
  });
  const check = async () => {
    setChecking(true);
    setStatus(await healthStatus());
    setChecking(false);
  };

  return (
    <div className="mt-2 text-sm">
      {/* Status first: is it working? */}
      <div className={`flex items-center gap-3 rounded-xl p-3 ${status ? "bg-plate-green/15" : "bg-rack"}`}>
        <span className={`size-2.5 shrink-0 rounded-full ${status ? "bg-plate-green" : "bg-chalk-muted"}`} aria-hidden />
        <span className="flex-1">
          {status ? (
            <>Connected. Last sync {new Date(status.lastSync).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}{status.steps !== null ? `, ${status.steps.toLocaleString("en-US")} steps` : ""}.</>
          ) : (
            "Not connected yet."
          )}
        </span>
        <button onClick={check} disabled={checking} className="text-xs font-semibold text-plate-blue">{checking ? "Checking…" : "Check"}</button>
      </div>

      <ol className="mt-4 space-y-4">
        <Step n={1} title="Get your personal key">
          {key ? (
            <>
              <CopyBox label="Your key (shown once; copy it now)" text={key} />
              <p className="mt-1 text-xs text-chalk-muted">Anyone with this key can send data to your account. You can delete it in Phone shortcut keys.</p>
            </>
          ) : (
            <button onClick={makeKey} disabled={pending} className="mt-1 rounded-xl bg-plate-red px-4 py-2.5 font-semibold text-white disabled:opacity-60">
              {pending ? "Creating…" : "Create my key"}
            </button>
          )}
          {error && <p role="alert" className="mt-1 text-plate-red">{error}</p>}
        </Step>

        <Step n={2} title="Pick how your iPhone sends it">
          <div className="mt-1 grid grid-cols-2 gap-2">
            <button onClick={() => setMethod("app")} aria-pressed={method === "app"} className={`rounded-xl px-3 py-2.5 text-left ${method === "app" ? "bg-chalk text-rack" : "bg-rack"}`}>
              <span className="block font-semibold">Easiest</span><span className="text-xs opacity-75">Health Auto Export app</span>
            </button>
            <button onClick={() => setMethod("shortcut")} aria-pressed={method === "shortcut"} className={`rounded-xl px-3 py-2.5 text-left ${method === "shortcut" ? "bg-chalk text-rack" : "bg-rack"}`}>
              <span className="block font-semibold">Free</span><span className="text-xs opacity-75">Apple Shortcuts</span>
            </button>
          </div>

          {method === "app" ? (
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-chalk-muted">
              <li>Install <b>Health Auto Export</b> from the App Store and allow it to read Health. (Sending to a web address is part of its paid upgrade.)</li>
              <li>In the app, open <b>Automations</b>, add a new one, and choose <b>REST API</b>.</li>
              <li>Paste the address below as the URL.</li>
              <li>Add a header named <b>Authorization</b> with the value below.</li>
              <li>For data, choose <b>Health Metrics</b>: Step Count, Active Energy, Apple Exercise Time, Walking + Running Distance, Walking Speed, Resting Heart Rate. Format <b>JSON</b>, aggregated by <b>day</b>.</li>
              <li>Turn the automation on, then tap <b>Check</b> above.</li>
            </ol>
          ) : shortcutUrl ? (
            <div className="mt-3 space-y-2 text-chalk-muted">
              <a href={shortcutUrl} className="block rounded-xl bg-plate-red py-3 text-center font-semibold text-white">Get the ready-made Shortcut</a>
              <p>Add it, paste your key when it asks, then in Shortcuts → <b>Automation</b> → <b>+</b> → <b>Time of Day</b>, run it daily (choose <b>Run Immediately</b>). Tap <b>Check</b> above after it runs.</p>
            </div>
          ) : (
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-chalk-muted">
              <li>Open <b>Shortcuts</b> → <b>Automation</b> → <b>+</b> → <b>Time of Day</b>. Pick 9 PM, <b>Daily</b>, and <b>Run Immediately</b>.</li>
              <li>Add <b>Find Health Samples</b>: Type <b>Steps</b>, Start Date <b>is today</b>. Then add <b>Calculate Statistics</b> → <b>Sum</b>.</li>
              <li>Do the same for <b>Active Energy</b> and <b>Exercise Minutes</b> (Sum). Optional: <b>Walking Speed</b> (Average), <b>Walking + Running Distance</b> (Sum).</li>
              <li>Add <b>Get Contents of URL</b> with the address below. Tap <b>Show More</b>: Method <b>POST</b>, header <b>Authorization</b> with the value below, Request Body <b>JSON</b>.</li>
              <li>In the JSON body, add the fields below, each set to the matching <b>Statistics</b> result.</li>
              <li>Tap ▶ to run it once, then tap <b>Check</b> above.</li>
            </ol>
          )}
        </Step>

        <Step n={3} title="Paste these where it asks">
          <CopyBox label="Address (URL)" text={url} />
          <CopyBox label="Authorization header" text={`Bearer ${key ?? "your-key-from-step-1"}`} />
          {method === "shortcut" && !shortcutUrl && <CopyBox label="JSON field names" text={"steps\nactiveCalories\nexerciseMinutes\nwalkingSpeed\ndistance"} />}
        </Step>
      </ol>
      <p className="mt-4 text-xs text-chalk-muted">Android: Health Connect can&apos;t be read by websites yet, so this is iPhone-only for now.</p>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-rack font-display text-sm font-bold" aria-hidden>{n}</span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        {children}
      </div>
    </li>
  );
}

/** A home-screen widget using the free Scriptable app. */
export function WidgetSetup({ origin }: { origin: string }) {
  const script = `// Calorness home-screen widget for the free Scriptable app
const KEY = "PASTE_YOUR_CALORNESS_KEY"; // from Profile → Phone shortcut
const BASE = "${origin}";

const red = new Color("#e05252"), green = new Color("#5dbb63"), blue = new Color("#4a8fe0"), muted = new Color("#9aa7b4");
let d = null;
try {
  const r = new Request(BASE + "/api/widget");
  r.headers = { Authorization: "Bearer " + KEY };
  d = await r.loadJSON();
} catch (e) {}

const w = new ListWidget();
w.backgroundColor = new Color("#17212b");
w.url = BASE + "/log"; // tap the widget to open Quick log
w.setPadding(14, 14, 14, 14);
const line = (text, size, color, bold) => { const t = w.addText(text); t.font = bold ? Font.boldSystemFont(size) : Font.systemFont(size); t.textColor = color || Color.white(); t.minimumScaleFactor = 0.6; return t; };
const fmt = (n) => (n === null || n === undefined ? "—" : Math.round(n).toLocaleString());

if (!d || d.error) {
  line("Calorness", 14, red, true);
  line(d && d.error ? d.error : "Can't reach Calorness", 12, muted);
} else {
  line("🔥 " + d.logStreak + "-day streak", 12, new Color("#f2c14e"), true);
  w.addSpacer(4);
  line(d.calories.left === null ? fmt(d.calories.eaten) + " cal" : fmt(Math.abs(d.calories.left)) + (d.calories.left >= 0 ? " left" : " over"), 24, Color.white(), true);
  line(fmt(d.protein.eaten) + (d.protein.goal ? " / " + fmt(d.protein.goal) : "") + " g protein", 12, blue);
  w.addSpacer(6);
  if (d.healthConnected) {
    line("Move " + fmt(d.activeCalories.value) + " / " + fmt(d.activeCalories.goal), 12, red);
    line("Steps " + fmt(d.steps.value) + " / " + fmt(d.steps.goal), 12, green);
  }
  if (config.widgetFamily !== "small") { w.addSpacer(6); line(d.message, 11, muted); }
}
w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
Script.setWidget(w);
w.presentSmall();
Script.complete();`;
  return (
    <div className="mt-2 text-sm">
      <p className="text-chalk-muted">See calories left, protein, steps, and your streak on your home screen, and tap it to log. Web apps can&apos;t make widgets on their own, so this uses the free <b>Scriptable</b> app.</p>
      <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-chalk-muted">
        <li>Install <b>Scriptable</b> from the App Store.</li>
        <li>Make a key in <b>Phone shortcut</b> above (or reuse one).</li>
        <li>In Scriptable, tap <b>+</b>, paste the script below, and replace <code>PASTE_YOUR_CALORNESS_KEY</code> with your key.</li>
        <li>Long-press your home screen → <b>+</b> → <b>Scriptable</b> → small or medium → <b>Edit Widget</b> → pick this script.</li>
      </ol>
      <CopyBox label="Widget script" text={script} />
    </div>
  );
}
