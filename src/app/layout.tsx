import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ViewportGuard } from "@/components/ViewportGuard";
import { OfflineBanner } from "@/components/OfflineBanner";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });


export const metadata: Metadata = {
  title: { default: "Calorness", template: "%s · Calorness" },
  description: "Log your lifts and your meals in one app.",
  applicationName: "Calorness",
  // iOS reads these when someone taps Share → Add to Home Screen
  appleWebApp: { capable: true, title: "Calorness", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0e141d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // let the app draw under the iPhone notch/home bar
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} antialiased`}>
      <body>
        <ViewportGuard />
        <OfflineBanner />
        {children}
      </body>
    </html>
  );
}
