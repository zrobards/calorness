"use client";

import { useEffect } from "react";

/**
 * Keeps bars that are fixed to the bottom of the screen (tab bar, rest timer,
 * music player) where they belong on iPhone.
 *
 * iOS Safari, especially as an installed home-screen app, sometimes leaves
 * the page's layout area shorter than the screen after the keyboard closes or
 * after zooming into a text field. "Fixed" bars then sit in the middle of the
 * screen and travel with the page as you scroll. Two fixes:
 *  1. When typing ends, nudge the page so Safari recalculates its layout,
 *     and briefly cap zoom so any automatic zoom springs back.
 *  2. Measure the visible area and shift bottom bars to its real bottom
 *     (the --vv-fix variable used by the .vv-pin class).
 */
export function ViewportGuard() {
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;
    const typing = () => {
      const el = document.activeElement;
      return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || (el as HTMLElement).isContentEditable);
    };

    const pin = () => {
      if (!vv || typing() || Math.abs(vv.scale - 1) > 0.01) {
        root.style.setProperty("--vv-fix", "0px");
        return;
      }
      const gap = vv.height + vv.offsetTop - window.innerHeight; // >0 when the layout area ends above the visible bottom
      root.style.setProperty("--vv-fix", `${Math.abs(gap) < 1 ? 0 : Math.round(gap)}px`);
    };

    const afterTyping = () => {
      setTimeout(() => {
        if (typing()) return;
        // Snap back any zoom iOS applied while typing
        const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
        if (meta && vv && vv.scale > 1.01) {
          const original = meta.content;
          meta.content = `${original}, maximum-scale=1`;
          setTimeout(() => (meta.content = original), 300);
        }
        window.scrollTo(window.scrollX, window.scrollY); // makes Safari recalculate the layout area
        pin();
      }, 120);
    };

    vv?.addEventListener("resize", pin);
    vv?.addEventListener("scroll", pin);
    window.addEventListener("orientationchange", pin);
    document.addEventListener("focusout", afterTyping);
    document.addEventListener("focusin", pin);
    document.addEventListener("visibilitychange", pin);
    pin();
    return () => {
      vv?.removeEventListener("resize", pin);
      vv?.removeEventListener("scroll", pin);
      window.removeEventListener("orientationchange", pin);
      document.removeEventListener("focusout", afterTyping);
      document.removeEventListener("focusin", pin);
      document.removeEventListener("visibilitychange", pin);
    };
  }, []);
  return null;
}
