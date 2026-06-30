import "./globals.css";
import { Analytics } from "@vercel/analytics/react";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Oyi Facility",
  description: "Facility OS command center for estates, infrastructure, visitors and operational intelligence.",
  applicationName: "Oyi Facility",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Oyi Facility",
  },
  icons: {
    icon: "/oyi-logo-transparent.png",
    apple: "/oyi-logo-transparent.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-white">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
