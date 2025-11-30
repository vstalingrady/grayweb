"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useUser } from "@/contexts/UserContext";
import { GENERAL_CHAT_SESSION_ID, useChatStore } from "./ChatProvider";
import { resolveApiBaseUrl, type ProactivityNotification } from "@/lib/api";
import { requestNotificationPermission } from "@/lib/notificationUtils";

type ProactivityNotificationContextValue = {
  deliveredKeys: ReadonlySet<string>;
};

const ProactivityNotificationContext = createContext<ProactivityNotificationContextValue>({
  deliveredKeys: new Set<string>(),
});

const PROACTIVITY_NOTIFICATION_ICON = "/grayaiwhite.svg";

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const showBrowserNotification = (
  notification: ProactivityNotification,
  permission: NotificationPermission
) => {
  if (
    permission !== "granted" ||
    typeof window === "undefined" ||
    !notification ||
    (typeof window !== "undefined" && !window.isSecureContext)
  ) {
    return;
  }
  const title = "Gray";
  const parts: string[] = [];
  if (notification.message?.trim()) {
    parts.push(notification.message.trim());
  }
  if (notification.due_at) {
    const dueDate = new Date(notification.due_at);
    if (!Number.isNaN(dueDate.getTime())) {
      parts.push(
        `Due ${dueDate.toLocaleString([], {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}`
      );
    }
  }
  const body = parts.join("\n") || "You have a reminder waiting. Just say the word.";
  try {
    const browserNotification = new Notification(title, {
      body,
      icon: PROACTIVITY_NOTIFICATION_ICON,
      badge: PROACTIVITY_NOTIFICATION_ICON,
      tag: `gray-reminder-${notification.id}`,
      requireInteraction: true,
    });
    browserNotification.onclick = () => {
      window.focus();
      browserNotification.close();
    };
  } catch (error) {
    console.error("Failed to show reminder browser notification:", error);
  }
};

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
  const { user } = useUser();
  const userId = typeof user?.id === "number" ? user.id : null;
  const { appendMessage, generalSessionId, ensureSession } = useChatStore();
  const [deliveredKeys, setDeliveredKeys] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleProactivityMessage = useCallback(
    (payload: any) => {
      // 1. Append to chat if we have a session ID
      const targetSessionId = payload.session_id || GENERAL_CHAT_SESSION_ID;
      if (targetSessionId && payload.message) {
        appendMessage(targetSessionId, "assistant", payload.message);
      }

      // 2. Show browser notification if enabled
      if (Notification.permission === "granted") {
        new Notification("Gray", {
          body: payload.message || "New message from Gray",
          icon: "/grayai.png",
          requireInteraction: true,
          tag: payload.delivery_key ? `gray-proactivity-${payload.delivery_key}` : undefined,
        });
      }

      // 3. Show in-app toast
      setToastMessage(payload.message || "New message");
    },
    []
  );

  useEffect(() => {
    if (!userId) return;

    // Get authentication token
    const getAuthToken = async (): Promise<string | null> => {
      const supabase = (await import('@/lib/supabaseClient')).getSupabaseClient();
      if (!supabase) return null;
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? null;
    };

    const setupProactivity = async () => {
      const token = await getAuthToken();
      if (!token) {
        console.warn('[Proactivity] No auth token available');
        return;
      }

      // Register service worker for push notifications
      if ("serviceWorker" in navigator && "PushManager" in window) {
        navigator.serviceWorker
          .register("/sw-proactivity.js")
          .then(async (registration) => {
            try {
              const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(
                  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "BNoW7-tQZ8XwYt7-tQZ8XwY"
                ) as any,
              });

              // Send subscription to backend
              const endpoint = subscription.endpoint;
              const p256dh = subscription.getKey("p256dh");
              const auth = subscription.getKey("auth");

              if (p256dh && auth) {
                const apiBase = resolveApiBaseUrl();
                await fetch(`${apiBase}/users/${userId}/push/subscribe?token=${encodeURIComponent(token)}`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                  },
                  body: JSON.stringify({
                    endpoint,
                    p256dh: btoa(String.fromCharCode(...new Uint8Array(p256dh))),
                    auth: btoa(String.fromCharCode(...new Uint8Array(auth))),
                  }),
                });
              }
            } catch (err) {
              console.error("Failed to subscribe to push:", err);
            }
          })
          .catch((err) => console.error("Service Worker registration failed:", err));
      }

      const url = resolveApiBaseUrl();
      // EventSource doesn't support custom headers, so we pass the token as a query parameter
      const eventSource = new EventSource(`${url}/users/${userId}/proactivity/stream?token=${encodeURIComponent(token)}`);

      eventSource.onopen = () => {
        console.log("[Proactivity] SSE Connected");
      };

      eventSource.addEventListener("ping", (event) => {
        // Keep-alive, ignore
      });

      const handleEvent = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          console.log("[Proactivity] Message received:", data);
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
        console.error("[Proactivity] SSE Error:", err);
        eventSource.close();
      };

      return () => {
        eventSource.close();
      };
    };

    const cleanup = setupProactivity();
    return () => {
      cleanup.then(fn => fn?.());
    };
  }, [userId, handleProactivityMessage]);

  return (
    <ProactivityNotificationContext.Provider value={{ deliveredKeys }}>
      {children}
    </ProactivityNotificationContext.Provider>
  );
}

export const useProactivityNotifications = () => useContext(ProactivityNotificationContext);
