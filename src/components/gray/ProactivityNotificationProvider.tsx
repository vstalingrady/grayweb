"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useUser } from "@/contexts/UserContext";
import { useChatStore } from "./ChatProvider";
import { GENERAL_CHAT_SESSION_ID } from "./chat/constants";
import { resolveApiBaseUrl } from "@/lib/api";
import { useI18n } from "@/contexts/I18nContext";
import { useNotificationPreferences } from "@/contexts/NotificationPreferencesContext";

type ProactivityNotificationContextValue = {
  deliveredKeys: ReadonlySet<string>;
};

const ProactivityNotificationContext = createContext<ProactivityNotificationContextValue>({
  deliveredKeys: new Set<string>(),
});

const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = typeof window === "undefined" ? "" : window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

type ProactivityNotificationProviderProps = {
  children: ReactNode;
};

export function ProactivityNotificationProvider({ children }: ProactivityNotificationProviderProps) {
  const { t } = useI18n();
  const { user } = useUser();
  const userId = typeof user?.id === "number" ? user.id : null;
  const { appendMessage } = useChatStore();
  const { notificationPreferences } = useNotificationPreferences();
  const [deliveredKeys, setDeliveredKeys] = useState<Set<string>>(new Set());
  const pushSetupRef = useRef<Promise<void> | null>(null);
  const getAuthToken = useCallback(async (): Promise<string | null> => {
    const { getSupabaseClient } = await import("@/lib/supabaseClient");
    const supabase = getSupabaseClient();
    if (!supabase) {
      return null;
    }
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.warn("[Proactivity] Failed to get auth session:", error);
      return null;
    }
    return data.session?.access_token ?? null;
  }, []);

  const handleProactivityMessage = useCallback(
    (payload: { session_id?: string; message?: string; delivery_key?: string }) => {
      // 1. Append to chat if we have a session ID
      const targetSessionId = payload.session_id || GENERAL_CHAT_SESSION_ID;
      if (targetSessionId && payload.message) {
        appendMessage(targetSessionId, "assistant", payload.message);
      }

      // 2. Show browser notification if enabled and proactivity notifications are on
      if (notificationPreferences.device && notificationPreferences.proactivity && Notification.permission === "granted") {
        new Notification("Gray", {
          body: payload.message || t("New message from Gray"),
          icon: "/grayai.png",
          requireInteraction: true,
          tag: payload.delivery_key ? `gray-proactivity-${payload.delivery_key}` : undefined,
        });
      }

      // 3. In-app toast could be surfaced here if needed.
    },
    [appendMessage, t, notificationPreferences.device, notificationPreferences.proactivity]
  );

  useEffect(() => {
    if (!userId || typeof window === "undefined" || typeof EventSource === "undefined") return;

    const setupProactivity = async () => {
      const token = await getAuthToken();
      if (!token) {
        console.warn('[Proactivity] No auth token available');
        return;
      }

      const url = resolveApiBaseUrl();
      // EventSource doesn't support custom headers, so we pass the token as a query parameter
      let eventSource: EventSource | null = null;
      try {
        eventSource = new EventSource(`${url}/users/${userId}/proactivity/stream?token=${encodeURIComponent(token)}`);
      } catch (err) {
        console.warn("[Proactivity] SSE init failed:", err);
        return;
      }

      eventSource.onopen = () => {
        // console.log("[Proactivity] SSE Connected");
      };

      eventSource.addEventListener("ping", () => {
        // Keep-alive, ignore
      });

      const handleEvent = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          // console.log("[Proactivity] Message received:", data);
          handleProactivityMessage(data);

          // Track delivery to avoid re-showing
          const key = data.delivery_key;
          if (key) {
            setDeliveredKeys(prev => {
              const next = new Set(prev);
              next.add(key);
              return next;
            });
          }
        } catch (err) {
          console.error("[Proactivity] Failed to parse message:", err);
        }
      };

      eventSource.addEventListener("message", handleEvent);
      eventSource.addEventListener("proactivity_message", handleEvent);

      eventSource.onerror = (err) => {
        // Avoid noisy empty error objects; log once and close.
        console.warn("[Proactivity] SSE disconnected; will close the stream.", err);
        eventSource?.close();
      };

      return () => {
        eventSource?.close();
      };
    };

    const cleanup = setupProactivity();
    return () => {
      cleanup.then(fn => fn?.());
    };
  }, [getAuthToken, userId, handleProactivityMessage]);

  useEffect(() => {
    if (!userId || typeof window === "undefined") return;
    if (!notificationPreferences.device || !notificationPreferences.proactivity) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    if (window.isSecureContext === false) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    if (pushSetupRef.current) return;

    const setup = async () => {
      const token = await getAuthToken();
      if (!token) return;

      const registration = await navigator.serviceWorker.register("/sw-proactivity.js");
      const subscribeOptions = {
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "BNoW7-tQZ8XwYt7-tQZ8XwY"
        ) as BufferSource,
      };

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe(subscribeOptions);
      }

      const p256dh = subscription.getKey("p256dh");
      const auth = subscription.getKey("auth");
      if (!p256dh || !auth) return;

      const apiBase = resolveApiBaseUrl();
      await fetch(`${apiBase}/users/${userId}/push/subscribe?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          p256dh: btoa(String.fromCharCode(...new Uint8Array(p256dh))),
          auth: btoa(String.fromCharCode(...new Uint8Array(auth))),
        }),
      });
    };

    pushSetupRef.current = setup()
      .catch((error) => {
        console.error("[Proactivity] Failed to register push subscription:", error);
      })
      .finally(() => {
        pushSetupRef.current = null;
      });
  }, [getAuthToken, notificationPreferences.device, notificationPreferences.proactivity, userId]);

  return (
    <ProactivityNotificationContext.Provider value={{ deliveredKeys }}>
      {children}
    </ProactivityNotificationContext.Provider>
  );
}

export const useProactivityNotifications = () => useContext(ProactivityNotificationContext);
