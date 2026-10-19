import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    // meal photos are resized on the phone to ~200 KB, this leaves headroom
    serverActions: { bodySizeLimit: "2mb" },
    // Keep visited tabs in the phone's memory for a minute, so switching back
    // is instant. Anything that changes data clears this automatically.
    staleTimes: { dynamic: 60, static: 300 },
  },
  images: {
    // Exercise photos come from the free-exercise-db GitHub repo
    remotePatterns: [{ protocol: "https", hostname: "raw.githubusercontent.com", pathname: "/yuhonas/free-exercise-db/**" }],
  },
};

export default nextConfig;
