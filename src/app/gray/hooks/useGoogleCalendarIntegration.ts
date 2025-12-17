import { useCallback, useEffect } from "react";
import { apiService, isApiNetworkError } from "@/lib/api";

const OAUTH_STORAGE_KEY = "gray_google_calendar_oauth";
const OAUTH_BROADCAST_CHANNEL = "gray-oauth";

type OAuthSignal = { type?: string } | null;

const escapePopupText = (value: string) => value.replace(/</g, "&lt;").replace(/>/g, "&gt;");

const writePopupStatus = (popup: Window, title: string, message: string) => {
  if (popup.closed) {
    return;
  }

  try {
    const escapedTitle = escapePopupText(title);
    const escapedMessage = escapePopupText(message);
    popup.document.open();
    popup.document.write(`
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>${escapedTitle}</title>
          <style>
            body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif; background: #0f0f0f; color: #f5f5f5; }
            .wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
            .card { width: 100%; max-width: 420px; background: #181818; border-radius: 16px; padding: 28px; box-shadow: 0 25px 45px rgba(0,0,0,0.45); }
            h1 { font-size: 1.2rem; margin: 0 0 10px; }
            p { margin: 0; color: rgba(255,255,255,0.75); line-height: 1.45; white-space: pre-wrap; }
            code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 0.9em; }
          </style>
        </head>
        <body>
          <div class="wrap">
            <div class="card">
              <h1>${escapedTitle}</h1>
              <p>${escapedMessage}</p>
            </div>
          </div>
        </body>
      </html>
    `);
    popup.document.close();
  } catch (error) {
    console.warn("Unable to write status to Google Calendar OAuth popup:", error);
  }
};

export const useGoogleCalendarIntegration = (userId: number | null) => {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleConnected = () => {
      window.location.reload();
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }
      const payload = event.data as OAuthSignal;
      if (payload?.type === "google-calendar-connected") {
        handleConnected();
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== OAUTH_STORAGE_KEY || !event.newValue) {
        return;
      }
      try {
        const payload = JSON.parse(event.newValue) as OAuthSignal;
        if (payload?.type === "google-calendar-connected") {
          handleConnected();
        }
      } catch {
        // ignore
      }
    };

    window.addEventListener("message", handleMessage);
    window.addEventListener("storage", handleStorage);

    let channel: BroadcastChannel | null = null;
    try {
      if ("BroadcastChannel" in window) {
        channel = new BroadcastChannel(OAUTH_BROADCAST_CHANNEL);
        channel.addEventListener("message", (event: MessageEvent) => {
          const payload = event.data as OAuthSignal;
          if (payload?.type === "google-calendar-connected") {
            handleConnected();
          }
        });
      }
    } catch {
      channel = null;
    }

    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("storage", handleStorage);
      try {
        channel?.close();
      } catch {
        // ignore
      }
    };
  }, []);

  return useCallback(() => {
    if (typeof userId !== "number") {
      console.warn("Unable to start Google Calendar integration without a user.");
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const callbackUrl = `${window.location.origin}/api/auth/google-calendar/callback`;

    const popup = window.open(
      "about:blank",
      "google-calendar-oauth",
      "popup=yes,width=520,height=720"
    );

    if (popup) {
      writePopupStatus(popup, "Connecting to Google Calendar…", "Loading Google authorization…");
    }

    void (async () => {
      try {
        const response = await apiService.requestGoogleCalendarAuth(userId, {
          redirectUri: callbackUrl,
        });
        const authUrl = response?.authorization_url;

        if (!authUrl) {
          if (popup) {
            writePopupStatus(
              popup,
              "Unable to start Google Calendar setup",
              "The backend did not return an authorization URL. Please check the server logs and try again."
            );
          }
          console.error("Google Calendar integration response did not include an authorization URL.", response);
          return;
        }

        if (popup) {
          popup.location.href = authUrl;
          popup.focus?.();
          return;
        }

        window.location.assign(authUrl);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown error while starting Google Calendar setup.";

        const hint = isApiNetworkError(error)
          ? "\n\nIf you're running locally, make sure the backend is running (e.g. `npm run backend`) and listening on the configured port."
          : "";

        if (popup) {
          writePopupStatus(popup, "Unable to start Google Calendar setup", `${message}${hint}`);
        }

        try {
          window.localStorage.setItem(
            OAUTH_STORAGE_KEY,
            JSON.stringify({ type: "google-calendar-error", ts: Date.now(), message })
          );
        } catch {
          // ignore
        }

        console.error("Failed to initiate Google Calendar integration:", error);
      }
    })();
  }, [userId]);
};

