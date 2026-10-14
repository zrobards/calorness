"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { getPushPublicKey, removePushSubscription, savePushSubscription, sendTestNotification } from "./actions";

function urlBase64ToBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

type Status = "checking" | "unsupported" | "install-first" | "off" | "on" | "blocked";

/** Turn on rest-timer and reminder notifications for this phone. */
export function NotificationsCard() {
  const [status, setStatus] = useState<Status>("checking");
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    (async () => {
      const ios = /iPhone|iPad/.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
      if (ios && !standalone) return setStatus("install-first");
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setStatus("unsupported");
      if (Notification.permission === "denied") return setStatus("blocked");
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub ? "on" : "off");
    })().catch(() => setStatus("unsupported"));
  }, []);

  const enable = () =>
    start(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return setStatus(permission === "denied" ? "blocked" : "off");
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToBytes(await getPushPublicKey()) });
        await savePushSubscription(sub.toJSON());
        await sendTestNotification();
        haptic("success");
        setStatus("on");
        setNote("Sent a test notification.");
      } catch {
        setNote("Couldn't turn on notifications on this device.");
      }
    });

  const disable = () =>
    start(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus("off");
      setNote(null);
    });

  return (
    <div>
      <p className="mt-1 text-sm text-chalk-muted">
        Get &ldquo;Rest&apos;s over&rdquo; on your lock screen when you leave the app mid-rest, and one lunchtime nudge if nothing&apos;s logged.
      </p>
      {status === "install-first" && (
        <p className="mt-3 rounded-xl bg-rack p-3 text-sm">
          On iPhone, notifications only work in the home-screen app. In Safari tap Share → <b>Add to Home Screen</b>, open Calorness from there, and turn them on here.
        </p>
      )}
      {status === "unsupported" && <p className="mt-3 text-sm text-chalk-muted">This browser doesn&apos;t support notifications.</p>}
      {status === "blocked" && <p className="mt-3 text-sm text-plate-yellow">Notifications are blocked. Allow them for Calorness in your phone&apos;s Settings, then come back.</p>}
      {(status === "off" || status === "on") && (
        <button
          onClick={status === "on" ? disable : enable}
          disabled={pending}
          className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-display text-lg font-semibold disabled:opacity-60 ${status === "on" ? "bg-rack text-chalk" : "bg-plate-blue text-white"}`}
        >
          {status === "on" ? <BellOff size={18} aria-hidden /> : <Bell size={18} aria-hidden />}
          {pending ? "One moment…" : status === "on" ? "Turn off notifications" : "Turn on notifications"}
        </button>
      )}
      {note && <p role="status" className="mt-2 text-sm text-chalk-muted">{note}</p>}
    </div>
  );
}
