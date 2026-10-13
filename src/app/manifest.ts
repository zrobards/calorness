import type { MetadataRoute } from "next";

// This file becomes /manifest.webmanifest. It's what lets phones install
// Calorness to the home screen and open it full-screen like a native app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Calorness",
    short_name: "Calorness",
    description: "Log your lifts and your meals in one app.",
    start_url: "/train",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#17212b",
    theme_color: "#17212b",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
