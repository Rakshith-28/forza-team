import type { Metadata } from "next";
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
      <body className="flex min-h-full flex-col overflow-x-clip">
        {children}
        <Footer />
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
