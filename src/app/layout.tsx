import type { Metadata } from "next";
// Switched to local/system fonts to avoid network fetches during build.
// Original (Google Fonts) imports kept below for easy re-enable.
// import { IBM_Plex_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";

// Local/offline-safe fallbacks using system fonts.
// These objects mimic next/font API's `.variable` for className usage.
const plusJakarta = { variable: "font-sans" } as const;
const plexMono = { variable: "font-mono" } as const;

// To re-enable Google Fonts, replace the above with:
// const plusJakarta = Plus_Jakarta_Sans({
//   variable: "--font-sans",
//   subsets: ["latin"],
//   weight: ["400", "500", "600", "700"],
//   display: "swap",
// });
// const plexMono = IBM_Plex_Mono({
//   variable: "--font-mono",
//   subsets: ["latin"],
//   weight: ["400", "500", "600"],
//   display: "swap",
// });

export const metadata: Metadata = {
  title: {
    default: "Gray Operator",
    template: "%s • Gray Operator",
  },
  description: "Operational cockpit for your Gray workspace.",
  icons: {
    icon: [
      {
        url: "/faviconlighttheme.ico",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/favicondarktheme.ico",
        media: "(prefers-color-scheme: dark)",
      },
      { rel: "shortcut icon", url: "/favicondarktheme.ico" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="${plusJakarta.variable} ${plexMono.variable}">
      <body>
        {children}
      </body>
    </html>
  );
}
