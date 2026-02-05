// app/layout.tsx
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";

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
