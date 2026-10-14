"use client";

import { useState, useTransition } from "react";
import { Check, Copy, KeyRound, Trash2 } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { createApiKey, deleteApiKey } from "./actions";

type Key = { id: string; name: string; prefix: string; createdAt: string; lastUsedAt: string | null };

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-2">
      <p className="text-xs text-chalk-muted">{label}</p>
      <button
        type="button"
        onClick={async () => { await navigator.clipboard.writeText(value); haptic("success"); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="mt-1 flex w-full items-center gap-2 rounded-xl bg-rack px-3 py-2.5 text-left"
      >
        <code className="min-w-0 flex-1 truncate text-sm">{value}</code>
        {copied ? <Check size={17} className="text-plate-green" aria-label="Copied" /> : <Copy size={17} className="text-chalk-muted" aria-label="Copy" />}
      </button>
    </div>
  );
}

/** Profile section: make a key and follow the steps to build the iPhone Shortcut. */
export function ShortcutKeys({ keys }: { keys: Key[] }) {
  const [fresh, setFresh] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [origin] = useState(() => (typeof window === "undefined" ? "" : window.location.origin));
  const endpoint = `${origin}/api/quick-log`;

  return (
    <div>
      <p className="mt-1 text-sm text-chalk-muted">
        Log a meal from your home screen without opening the app: tap, snap, and a notification tells you what was logged.
      </p>

      {fresh ? (
        <div className="animate-rise mt-4 rounded-2xl border border-plate-yellow/50 bg-plate-yellow/10 p-4">
          <p className="font-semibold">Your key, shown only this once</p>
          <p className="text-sm text-chalk-muted">Copy it into the shortcut now. Treat it like a password.</p>
          <CopyField label="Key" value={fresh} />
          <CopyField label="Authorization header value" value={`Bearer ${fresh}`} />
          <CopyField label="URL" value={endpoint} />
          <button onClick={() => setFresh(null)} className="mt-3 text-sm font-medium text-plate-blue">I&apos;ve copied it</button>
        </div>
      ) : (
        <button
          disabled={pending}
          onClick={() => start(async () => {
            const r = await createApiKey("iPhone shortcut");
            if ("error" in r && r.error) setError(r.error);
            else if ("key" in r && r.key) { haptic("success"); setFresh(r.key); }
          })}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-plate-blue py-3 font-display text-lg font-semibold text-white disabled:opacity-60"
        >
          <KeyRound size={18} aria-hidden /> {pending ? "Making a key…" : "Make a shortcut key"}
        </button>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-plate-red">{error}</p>}

      {keys.length > 0 && (
        <ul className="mt-4 divide-y divide-rack-line rounded-xl bg-rack">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{k.name} <code className="text-chalk-muted">{k.prefix}…</code></span>
                <span className="text-xs text-chalk-muted">
                  {k.lastUsedAt ? `Last used ${new Date(k.lastUsedAt).toLocaleDateString("en-US", { timeZone: "America/New_York" })}` : "Never used"}
                </span>
              </span>
              <button
                onClick={() => confirm("Delete this key? Shortcuts using it will stop working.") && start(() => deleteApiKey(k.id))}
                className="p-1.5 text-chalk-muted hover:text-plate-red"
                aria-label={`Delete key ${k.prefix}`}
              >
                <Trash2 size={17} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <details className="mt-4">
        <summary className="cursor-pointer font-medium text-plate-blue">How to build the iPhone shortcut</summary>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed">
          <li>Open the <b>Shortcuts</b> app, tap <b>+</b>, and name it <b>Log meal</b>.</li>
          <li>Add <b>Take Photo</b>. (For a photo you already took, use <b>Select Photos</b> instead.)</li>
          <li>Add <b>Convert Image</b> and set it to <b>JPEG</b>.</li>
          <li>Add <b>Resize Image</b> and set the width to <b>1024</b>.</li>
          <li>
            Add <b>Get Contents of URL</b>. Paste the URL above, tap <b>Show More</b>, set Method to <b>POST</b>, add a header named{" "}
            <b>Authorization</b> with the header value above, set Request Body to <b>Form</b>, and add a <b>File</b> field named{" "}
            <b>photo</b> set to the <b>Resized Image</b>.
          </li>
          <li>Add <b>Show Notification</b> and set it to the <b>Contents of URL</b>.</li>
          <li>Tap the share icon → <b>Add to Home Screen</b>, or long-press your home screen → <b>+</b> → <b>Shortcuts</b> to add it as a widget.</li>
        </ol>
        <p className="mt-3 text-sm text-chalk-muted">
          Voice version: make a second shortcut with <b>Dictate Text</b>, then the same Get Contents of URL step with a <b>Text</b> field
          named <b>text</b> set to the Dictated Text. Logs go to the meal for the time of day; fix anything later in the Diary.
        </p>
      </details>
    </div>
  );
}
