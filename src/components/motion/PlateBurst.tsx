"use client";

import { useEffect, useRef } from "react";
import { haptic } from "@/lib/haptics";

const COLORS = ["#d8453e", "#4a86dc", "#e8b931", "#41a86d", "#eceee8"];

/**
 * Celebration: a burst of tiny bumper plates that fly up and fall.
 * Drawn on a canvas so it stays smooth even on older phones.
 */
export function PlateBurst({ fire = true }: { fire?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!fire || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
    };
    resize();
    haptic("celebrate");

    const W = window.innerWidth;
    const H = window.innerHeight;
    const plates = Array.from({ length: 70 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * 80,
      y: H * 0.35,
      vx: (Math.random() - 0.5) * 11,
      vy: -6 - Math.random() * 10,
      r: 4 + Math.random() * 7,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      squash: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.3,
    }));

    let frame = 0;
    const start = performance.now();
    const draw = (now: number) => {
      const t = now - start;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, t - 1600) / 900);
      for (const p of plates) {
        p.vy += 0.32;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.squash += p.spin;
        const sx = Math.abs(Math.cos(p.squash)) * 0.8 + 0.2; // plates tumble edge-on
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(sx, 1);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#17212b";
        ctx.beginPath();
        ctx.arc(0, 0, p.r * 0.32, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      if (t < 2500) frame = requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, W, H);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [fire]);

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-[60] h-full w-full" aria-hidden />;
}
