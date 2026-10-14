import type { MetadataRoute } from "next";

// This file becomes /manifest.webmanifest. It's what lets phones install
// Calorness to the home screen and open it full-screen like a native app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Calorness",
    short_name: "Calorness",
    description: "Log your lifts and your meals in one app.",
    start_url: "/log",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#17212b",
    theme_color: "#17212b",
    // Long-press the app icon (Android) to jump straight to these
    shortcuts: [
      { name: "Snap a meal", short_name: "Snap", url: "/log?mode=snap", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Scan a barcode", short_name: "Scan", url: "/log?mode=scan", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Describe a meal", short_name: "Describe", url: "/log?mode=describe", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Workouts", short_name: "Train", url: "/train", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
