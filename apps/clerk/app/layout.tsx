import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import type { ReactNode } from "react";
import { DeviceStatusProvider, StatusBadge } from "@/components/device-status";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono" });

export const metadata: Metadata = {
  title: "Splita: cloud intelligence, zero-knowledge context",
  description: "Private legal document review: identities stay on your device, the cloud reasons on stand-ins.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${plexMono.variable}`}>
      <body className="min-h-screen bg-stone-50 font-sans text-stone-900 antialiased">
        <DeviceStatusProvider>
          <SiteHeader status={<StatusBadge />} />
          {children}
        </DeviceStatusProvider>
      </body>
    </html>
  );
}
