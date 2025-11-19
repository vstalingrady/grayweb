import type { Metadata } from "next";
import "./globals.css";
import "katex/dist/katex.min.css";
import ApiNetworkErrorHandler from "@/components/ApiNetworkErrorHandler";
import { readServerSession } from "@/lib/auth/server";
import { GrayProviders } from "@/components/GrayProviders";

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
    template: "%s",
  },
  description: "alignment.id — exploring tools for intentionality and focus in a world engineered for distraction.",
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
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: reactDevtoolsHotfix }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&family=IBM+Plex+Mono:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,100;1,200;1,300;1,400;1,500;1,600;1,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <GrayProviders viewerEmail={session?.email ?? null}>
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
