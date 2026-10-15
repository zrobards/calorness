"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { haptic } from "@/lib/haptics";

const message = (url: string) =>
  `I've been tracking workouts and food with Calorness. Snap a photo of a meal and it counts the calories. ` +
  `Try it: ${url}\n\nTap "Create account", then add it to your home screen ` +
  `(iPhone: open in Safari → Share → Add to Home Screen. Android: Chrome menu → Install app).`;

/** Opens the phone's share sheet (Messages, Snapchat…) with the link and install steps. */
export function InviteCard({ url, qrSvg }: { url: string; qrSvg: string }) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const share = async () => {
    haptic();
    const text = message(url);
    if (navigator.share) {
      try {
        await navigator.share({ title: "Calorness", text });
        return;
      } catch {
        // cancelled, or sharing isn't available: fall through to copying
      }
    }
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <p className="mt-1 text-sm text-chalk-muted">Free accounts, private data. Friends get their own diary, workouts, and goals.</p>
      <button onClick={share} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-plate-red py-3.5 font-display text-xl font-semibold text-white">
        {copied ? <Check size={20} aria-hidden /> : <Share2 size={20} aria-hidden />}
        {copied ? "Invite copied, paste it in a text" : "Invite a friend"}
      </button>
      <button onClick={() => setShowQr((s) => !s)} className="mt-3 w-full text-sm font-medium text-plate-blue" aria-expanded={showQr}>
        {showQr ? "Hide QR code" : "Show a QR code (for the gym)"}
      </button>
      {showQr && (
        <div className="animate-rise mt-3 flex flex-col items-center gap-2">
          {/* white background so any phone camera can read it */}
          <div className="w-56 rounded-2xl bg-white p-3" role="img" aria-label={`QR code for ${url}`} dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <p className="text-sm text-chalk-muted">Point a phone camera here to open {url.replace(/^https?:\/\//, "")}</p>
        </div>
      )}
    </div>
  );
}
