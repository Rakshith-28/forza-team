import type { Metadata, Viewport } from "next";
import { Archivo, Bungee, Oswald } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";

import { Footer } from "@/components/app/footer";

import "./globals.css";

// Body / UI text.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Player names, section labels, stat numbers.
const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

// Page titles + jersey numbers (uppercase).
const bungee = Bungee({
  variable: "--font-bungee",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Forza Team",
  description: "Multi-tenant soccer club management platform.",
};

// Explicit mobile viewport: width=device-width + initial-scale=1 so every page
// renders at the device's real width (no zoomed-out fit-to-content). Zoom is left
// enabled for accessibility. `viewportFit: cover` lets the dark chrome extend
// under notches/safe areas on phones.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${oswald.variable} ${bungee.variable} h-full antialiased`}
    >
      <body className="flex min-h-dvh flex-col overflow-x-clip">
        {/* The page content fills at least one full viewport so the global
            footer always sits below the fold (reached after ~one page scroll),
            never butting up against short content. */}
        <div className="flex min-h-dvh w-full flex-col">{children}</div>
        <Footer />
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
