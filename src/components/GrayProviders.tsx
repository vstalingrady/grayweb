"use client";

import { type ReactNode, useEffect } from "react";
import { usePathname } from "next/navigation";
import { isGrayWorkspaceHost } from "@/lib/grayRouting";
import { UserProvider } from "@/contexts/UserContext";
import { ChatProvider } from "@/components/gray/ChatProvider";
import { ProactivityNotificationProvider } from "@/components/gray/ProactivityNotificationProvider";
import { I18nProvider } from "@/contexts/I18nContext";
import { NotificationPreferencesProvider } from "@/contexts/NotificationPreferencesContext";
import { UserSettingsSync } from "@/components/UserSettingsSync";

type GrayProvidersProps = {
  viewerEmail?: string | null;
  children: ReactNode;
};

export function GrayProviders({ viewerEmail, children }: GrayProvidersProps) {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storageKey = "gray_theme";
    const media = window.matchMedia("(prefers-color-scheme: light)");

    const applyPreferredTheme = () => {
      let stored: string | null = null;
      try {
        stored = window.localStorage.getItem(storageKey);
      } catch {
        stored = null;
      }

      const mode =
        stored === "light" || stored === "dark" || stored === "system"
          ? stored
          : "system";
      const shouldBeLight = mode === "light" || (mode === "system" && media.matches);
      document.documentElement.classList.toggle("light", shouldBeLight);
    };

    applyPreferredTheme();

    const handleMediaChange = () => {
      let stored: string | null = null;
      try {
        stored = window.localStorage.getItem(storageKey);
      } catch {
        stored = null;
      }

      if (!stored || stored === "system") {
        applyPreferredTheme();
      }
    };

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", handleMediaChange);
    } else if (typeof media.addListener === "function") {
      media.addListener(handleMediaChange);
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key === storageKey) {
        applyPreferredTheme();
      }
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      if (typeof media.removeEventListener === "function") {
        media.removeEventListener("change", handleMediaChange);
      } else if (typeof media.removeListener === "function") {
        media.removeListener(handleMediaChange);
      }

      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    // Top half - intentional error (red)
    console.error(
      `%c
                                              .
                                              ▒█▓                                                   
▒▒                                          ░▓████▓▒                                                
▒█████░                                  ▒▓███████▓░                                                
  ░▓███▓▒                   ░          ░████████▓                   ░                               
 ░  ░▓████▓            ░           ░▓▓███████████░                      ░                           
      ░▓█████▓▒░              ░▓▒░▒███████████████░             ░░    ░▒▒                           
    ░▒  ▓███████▓▒░░░         ███████████████████▓▒░  ▒▒█▓▓▒▒▒▒▓▒     ▓█▓                           
         ░████████▒ ░░        ▓██████████████████    ░▒     ░░░       ▒▒     ▒░  ░                  
       ░░  ▓██████▓▒           ▓███████████████▓░   ░██░░▓▓▓▒▒        ░░     ░▒▓████▓   ░░          
        ░   ▓███████▓░▓█░       ▒█████████████▓     ▓█████░    ░░░░   ░     ░   ▓████░   ▒▒▓██▓▒░░  `,
      "font-family: monospace; font-weight: bold; line-height: 1.2;"
    );

    // Bottom half - standard log
    console.log(
      `%c
          ░░ ▒█████████▓▒░░▓░    ▓▓▒███▓██████░    ▒███░███        ░▒░ ░▒▒▒▒▒░  ░▒████▒ ▒███████████
               ▒███████▒                  ▓▓▒▒      ░██ ░██▓░      ░▒░ ░░   ░░    ▓▒▒▓██████████████
                 ░▓████▒                             ██  ░▓▓█                           ░░▒▓████████
                   ░▒▒▒▒░░░                          ▒░    ░░                        ▓░      ▒██████
                      ░▓█████▒▒▒░▒▓▒▒░░░░                                           ░▒        ▒█████
                         ░░▒▓▓▓▓███████▓▓▒                         ░░         ▒░             ▓██████
                                  ░░░░░░▒▓░▒░░▓▒▓▓▒▒  ▒▒▒▒░░░░░░▒▓▓▓▒░                       ░░░  ▒█
                                                    ▒▒▓░      ▓█▓▒░                                 
                                                      ░░    ░░▒░                                    

                                          Made in Indonesia
`,
      "font-family: monospace; font-weight: bold; line-height: 1.2;"
    );
  }, []);
  const pathname = usePathname();
  const hostname =
    typeof window !== "undefined" ? window.location.hostname : "";
  const isGrayHost = isGrayWorkspaceHost(hostname);
  const appRoutePrefixes = [
    "/g",
    "/gray",
    "/c",
    "/threads",
    "/pulse",
    "/cal",
    "/reference",
    "/payment",
    "/admin",
    "/login",
    "/signup",
    "/reset-password",
    "/callback",
    "/confirm-delete",
    "/delete-account",
  ];
  const isAppRoute = appRoutePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  // Skip user loading on marketing pages to prevent auth redirects.
  const shouldLoadUser = isGrayHost || isAppRoute;
  const effectiveEmail = shouldLoadUser ? viewerEmail : null;

  return (
    <I18nProvider>
      <UserProvider userEmail={effectiveEmail ?? undefined}>
        <UserSettingsSync />
        <NotificationPreferencesProvider>
          <ChatProvider>
            <ProactivityNotificationProvider>{children}</ProactivityNotificationProvider>
          </ChatProvider>
        </NotificationPreferencesProvider>
      </UserProvider>
    </I18nProvider>
  );
}
