"use client";

import { useEffect, useRef, useState } from "react";
import { Sheet } from "./Sheet";

/**
 * Reads a barcode with the phone camera. Uses the browser's built-in
 * BarcodeDetector where it exists (Android Chrome) and a WebAssembly
 * version everywhere else (iPhone Safari). Typing the number also works.
 */
export function BarcodeScanner({ onDetected, onClose }: { onDetected: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState("Starting camera…");
  const [manual, setManual] = useState("");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (stopped || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const { BarcodeDetector } = await import("barcode-detector/ponyfill");
        const detector = new BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
        setStatus("Point at a barcode");

        const scan = async () => {
          if (stopped || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes[0]?.rawValue) {
              navigator.vibrate?.(80);
              onDetected(codes[0].rawValue);
              return;
            }
          } catch {}
          timer = setTimeout(scan, 250);
        };
        scan();
      } catch {
        setStatus("Camera unavailable. Type the barcode number instead.");
      }
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onDetected]);

  return (
    <Sheet title="Scan a barcode" onClose={onClose}>
      <div className="relative mt-4 aspect-[4/3] overflow-hidden rounded-2xl bg-black">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        {/* aiming frame */}
        <div className="pointer-events-none absolute inset-x-8 top-1/2 h-28 -translate-y-1/2 rounded-xl border-4 border-plate-yellow/90" aria-hidden />
        <div className="pointer-events-none absolute inset-x-10 top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-plate-red motion-reduce:animate-none" aria-hidden />
      </div>
      <p className="mt-3 text-center text-sm text-chalk-muted" aria-live="polite">{status}</p>
      <form
        onSubmit={(e) => { e.preventDefault(); if (manual.trim()) onDetected(manual.trim()); }}
        className="mt-4 flex gap-2"
      >
        <input value={manual} onChange={(e) => setManual(e.target.value)} inputMode="numeric" placeholder="Or type the barcode number" aria-label="Barcode number"
          className="flex-1 rounded-xl border border-rack-line bg-rack px-3 py-3 tabular-nums focus:border-plate-yellow focus:outline-none" />
        <button className="rounded-xl bg-chalk px-4 font-medium text-rack">Look up</button>
      </form>
    </Sheet>
  );
}
