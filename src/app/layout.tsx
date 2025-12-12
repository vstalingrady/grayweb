import type { Metadata } from "next";
import "./globals.css";
import "katex/dist/katex.min.css";
import ApiNetworkErrorHandler from "@/components/ApiNetworkErrorHandler";
import { readServerSession } from "@/lib/auth/server";
import { GrayProviders } from "@/components/GrayProviders";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { Plus_Jakarta_Sans, IBM_Plex_Mono } from "next/font/google";

const resolveMetadataBase = (): URL | undefined => {
  const candidate =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ??
    (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "https://alignment.id");

  try {
    return candidate ? new URL(candidate) : undefined;
  } catch {
    return undefined;
  }
};

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  title: {
    default: "Gray",
    template: "%s | Gray",
  },
  description:
    "Your personal accelerator. An AI mentor that checks in throughout the day, remembers your goals, and helps you maximize your potential.",
  openGraph: {
    title: "Gray",
    description:
      "Your personal accelerator. An AI mentor that checks in throughout the day, remembers your goals, and helps you maximize your potential.",
    siteName: "Gray",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Gray",
    description:
      "Your personal accelerator. An AI mentor that checks in throughout the day, remembers your goals, and helps you maximize your potential.",
  },
  icons: {
    icon: [
      {
        url: "/faviconlighttheme.ico",
        type: "image/x-icon",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/favicondarktheme.ico",
        type: "image/x-icon",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/favicondarktheme.ico",
        type: "image/x-icon",
      },
    ],
    shortcut: ["/favicondarktheme.ico"],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
};

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700"],
  variable: "--font-mono",
  display: "swap",
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await readServerSession();
  const reactDevtoolsHotfix = `
    (function() {
      if (typeof window === "undefined") {
        return;
      }

      var fallbackVersion = "19.2.0";
      var ensureMetadata = function(target) {
        if (!target || typeof target !== "object") {
          return;
        }

        var normalize = function(value) {
          return typeof value === "string" ? value.trim() : "";
        };

        if (!normalize(target.version)) {
          target.version = fallbackVersion;
        }

        if (!normalize(target.rendererPackageVersion)) {
          target.rendererPackageVersion =
            target.version && target.version.trim() ? target.version : fallbackVersion;
        }
      };

      var applyPatch = function() {
        var hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
        if (!hook || hook.__versionPatched) {
          return !!hook && hook.__versionPatched;
        }
        hook.__versionPatched = true;

        if (hook.renderers && typeof hook.renderers.forEach === "function") {
          hook.renderers.forEach(function(renderer) {
            ensureMetadata(renderer);
          });
        }

        if (typeof hook.inject === "function") {
          var originalInject = hook.inject;
          hook.inject = function(renderer) {
            ensureMetadata(renderer);
            return originalInject.apply(this, arguments);
          };
        }

        if (hook.rendererInterfaces && typeof hook.rendererInterfaces.forEach === "function") {
          hook.rendererInterfaces.forEach(ensureMetadata);
        }

        var originalRegister = hook.registerRendererInterface;
        if (typeof originalRegister === "function") {
          hook.registerRendererInterface = function(rendererInterface) {
            ensureMetadata(rendererInterface);
            return originalRegister.apply(this, arguments);
          };
        }
        return true;
      };

      if (applyPatch()) {
        return;
      }

      var attempts = 30;
      var interval = setInterval(function() {
        if (applyPatch() || attempts-- <= 0) {
          clearInterval(interval);
        }
      }, 100);
    })();
  `;
  const themeInitScript = `
    (function() {
      try {
        var stored = localStorage.getItem("gray_theme");
        var mode =
          stored === "light" || stored === "dark" || stored === "system"
            ? stored
            : "system";
        var prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
        var shouldBeLight = mode === "light" || (mode === "system" && prefersLight);
        document.documentElement.classList.toggle("light", shouldBeLight);
      } catch (e) {}
    })();
  `;
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${plusJakartaSans.variable} ${ibmPlexMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: reactDevtoolsHotfix }} suppressHydrationWarning />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} suppressHydrationWarning />

        {/* PWA Manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* Mobile Web App Meta Tags */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Gray" />

        {/* Theme Color for Address Bar */}
        <meta name="theme-color" content="#0a0a0a" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />

        {/* Apple Touch Icons */}
        <link rel="apple-touch-icon" href="/grayai.png" />
      </head>
      <body>
        <GrayProviders viewerEmail={session?.email ?? null}>
          <ServiceWorkerRegister />
          <ApiNetworkErrorHandler />
          <svg style={{ display: "none" }} aria-hidden focusable="false">
            <filter id="grainy-noise">
              <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
            </filter>
          </svg>
          {children}
        </GrayProviders>
      </body>
    </html>
  );
}
