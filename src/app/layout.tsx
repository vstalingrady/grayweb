import type { Metadata } from "next";
import { IBM_Plex_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "gray_hackathon",
  description: "Minimalist Supabase-powered auth experience.",
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
    <html lang="en">
      <body className={`${plusJakarta.variable} ${plexMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
