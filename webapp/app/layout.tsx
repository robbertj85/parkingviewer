import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Parkeerdataviewer - Parkeerbezetting Nederland",
  description: "Real-time parkeerbezetting van parkeergarages in Nederland. Bekijk beschikbaarheid, bezettingsgraad en historische data van het NPR/RDW netwerk.",
  keywords: ["parkeren", "parkeergarage", "Nederland", "bezetting", "NPR", "RDW", "real-time"],
  authors: [{ name: "Parkeerdataviewer" }],
  openGraph: {
    title: "Parkeerdataviewer - Parkeerbezetting Nederland",
    description: "Real-time parkeerbezetting van parkeergarages in Nederland",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover" />
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </head>
      <body className="antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
