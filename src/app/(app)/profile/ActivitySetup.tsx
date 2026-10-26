"use client";

import { useState, useTransition } from "react";
import { Check, Copy } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { setActivityGoals } from "./actions";

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
      <pre className="mt-1 max-h-48 overflow-auto rounded-xl bg-rack p-3 text-[11px] leading-relaxed whitespace-pre-wrap text-chalk-muted">{text}</pre>
    </div>
  );
}

/** Step-by-step: an iPhone Shortcut that sends Apple Health activity to Calorness. */
export function HealthSetup({ origin, shortcutUrl }: { origin: string; shortcutUrl: string | null }) {
  return (
    <div className="mt-2 text-sm">
      <p className="text-chalk-muted">Apple doesn&apos;t let websites read Apple Health directly, so an iPhone Shortcut sends your numbers here on a schedule. You set it up once.</p>
      {shortcutUrl && (
        <a href={shortcutUrl} className="mt-3 block rounded-xl bg-plate-red py-3 text-center font-semibold text-white">Get the ready-made Shortcut</a>
      )}
      <details className="mt-3" open={!shortcutUrl}>
        <summary className="cursor-pointer font-medium">Build it yourself (about 3 minutes)</summary>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-chalk-muted">
          <li>Make a key in <b>Phone shortcut</b> above and copy it.</li>
          <li>Open <b>Shortcuts</b> → <b>Automation</b> → <b>+</b> → <b>Time of Day</b>. Pick a time like 9 PM, repeat <b>Daily</b>, and choose <b>Run Immediately</b>. (Add more automations at other times if you want updates during the day.)</li>
          <li>Add <b>Find Health Samples</b>: Type <b>Steps</b>, Start Date <b>is today</b>. Then <b>Calculate Statistics</b>: <b>Sum</b>.</li>
          <li>Repeat for <b>Active Energy</b> (Sum), <b>Exercise Minutes</b> (Sum), <b>Walking + Running Distance</b> (Sum), <b>Walking Speed</b> (Average), and optionally <b>Resting Heart Rate</b> (Average).</li>
          <li>Add <b>Get Contents of URL</b> with the address below. Method <b>POST</b>, add a header <b>Authorization</b> = <code>Bearer</code> + your key, Request Body <b>JSON</b> with the fields below, each set to its Statistics result.</li>
          <li>Run it once by hand. It answers with what it synced, like &ldquo;Synced: 8,345 steps, 512 active cal…&rdquo;</li>
        </ol>
        <CopyBox label="Address" text={`${origin}/api/health`} />
        <CopyBox label="JSON fields" text={"steps\nactiveCalories\nexerciseMinutes\ndistance\nwalkingSpeed\nrestingHeartRate"} />
      </details>
      <p className="mt-3 text-xs text-chalk-muted">On Android: Health Connect can&apos;t be read by websites yet, so activity sync is iPhone-only for now.</p>
    </div>
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
