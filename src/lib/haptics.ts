// Vibration feedback on phones that support it (Android). iPhones ignore
// navigator.vibrate, so these are safe no-ops there.
const PATTERNS = { tap: 10, success: [12, 40, 22], warning: [30, 50, 30], celebrate: [20, 40, 20, 40, 60] } as const;

export function haptic(kind: keyof typeof PATTERNS = "tap") {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(PATTERNS[kind] as number | number[]);
    } catch {}
  }
}
