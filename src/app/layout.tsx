import type { Metadata } from "next";
import "./globals.css";
import "katex/dist/katex.min.css";

export const metadata: Metadata = {
  metadataBase: process.env.VERCEL_URL
    ? new URL(`https://${process.env.VERCEL_URL}`)
    : new URL("https://alignment.id"),
  title: {
    default: "alignment.id",
    template: "%s • alignment.id",
  },
  description: "alignment.id — exploring tools for intentionality and focus in a world engineered for distraction.",
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
      {
        url: "/favicondarktheme.ico",
      },
    ],
    shortcut: ["/favicondarktheme.ico"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <svg style={{ display: "none" }} aria-hidden focusable="false">
          <filter id="grainy-noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          </filter>
        </svg>
        {children}
      </body>
    </html>
  );
}
