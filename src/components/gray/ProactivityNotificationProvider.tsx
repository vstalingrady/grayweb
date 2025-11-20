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
    // eslint-disable-next-line no-new
    new Notification(title, {
      body,
      icon: PROACTIVITY_NOTIFICATION_ICON,
      badge: PROACTIVITY_NOTIFICATION_ICON,
      tag: `gray-reminder-${notification.id}`,
      requireInteraction: true,
    });
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
  const deliveredRef = useRef<Set<string>>(new Set());

  const getOrEnsureGeneralSessionId = useCallback(() => {
    if (generalSessionId) {
      return generalSessionId;
    }
    const session = ensureSession(
      GENERAL_CHAT_SESSION_ID,
      () =>
        ({
          scope: "general",
          messages: [],
        } as any)
    );
    return session.id;
  }, [generalSessionId, ensureSession]);

  const markDelivered = useCallback((key: string) => {
    deliveredRef.current.add(key);
    setDeliveredKeys((previous) => {
      if (previous.has(key)) {
        return previous;
      }
      const next = new Set(previous);
      next.add(key);
      return next;
    });
  }, []);

  // Hydrate deliveries from the backend so that proactivity slots can render as
  // "checked" even after refresh.
  useEffect(() => {
    if (!userId) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }

    const hydrate = async () => {
      try {
        const base = resolveApiBaseUrl();
        const url = `${base.replace(/\/+$/, "")}/users/${userId}/proactivity/deliveries`;
        const response = await fetch(url, {
          method: "GET",
          credentials: "include",
        });
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as { sent_at?: string[] };
        const values = Array.isArray(payload.sent_at) ? payload.sent_at : [];
        const nextKeys = new Set<string>();
        values.forEach((iso) => {
          const date = new Date(iso);
          if (Number.isNaN(date.getTime())) {
            return;
          }
          const key = `${toDateKey(date)}T${String(date.getHours()).padStart(2, "0")}:${String(
            date.getMinutes()
          ).padStart(2, "0")}`;
          nextKeys.add(key);
        });
        if (nextKeys.size === 0) {
          return;
        }
        setDeliveredKeys((previous) => {
          const merged = new Set(previous);
          nextKeys.forEach((key) => merged.add(key));
          deliveredRef.current = merged;
          return merged;
        });
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error("[Proactivity] Failed to hydrate deliveries from backend", error);
        }
      }
    };

    hydrate().catch(() => undefined);
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      typeof Notification === "undefined"
    ) {
      return;
    }

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[Proactivity] VAPID public key is not configured");
      }
      return;
    }

    let cancelled = false;

    const subscribe = async () => {
      try {
        if (!window.isSecureContext) {
          if (process.env.NODE_ENV !== "production") {
            console.warn("[Proactivity] Push subscription requires a secure context (HTTPS or localhost)");
          }
          return;
        }

        let permission: NotificationPermission | null = Notification.permission;

        if (permission === "default") {
          permission = await requestNotificationPermission();
        }

        if (permission !== "granted") {
          if (process.env.NODE_ENV !== "production") {
            console.warn("[Proactivity] Push subscription skipped because notification permission is not granted");
          }
          return;
        }

        const registration = await navigator.serviceWorker.register("/sw-proactivity.js");
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as any,
          });
        }

        if (cancelled || !subscription) {
          return;
        }

        const base = resolveApiBaseUrl();
        const url = `${base.replace(/\/+$/, "")}/users/${userId}/proactivity/subscription`;
        try {
          await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(subscription),
          });
        } catch (error) {
          if (process.env.NODE_ENV !== "production") {
            console.error("[Proactivity] Failed to register subscription with backend", error);
          }
        }
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error("[Proactivity] Failed to register push subscription", error);
        }
      }
    };

    subscribe().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }
    if (typeof window === "undefined" || typeof window.EventSource === "undefined") {
      return;
    }

    let cancelled = false;
    let eventSource: EventSource | null = null;
    let reconnectTimer: number | null = null;
    const streamPath = `/users/${userId}/proactivity/stream`;

    const buildStreamUrl = () => {
      const base = resolveApiBaseUrl();
      const normalizedBase = base.replace(/\/+$/, "");
      if (!normalizedBase) {
        return streamPath;
      }
      return `${normalizedBase}${streamPath}`;
    };

    const closeStream = () => {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };

    const handleProactivityMessage = async (event: MessageEvent) => {
      let payload: Record<string, unknown> | null = null;
      try {
        payload = event.data ? JSON.parse(event.data as string) : null;
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[Proactivity] Failed to parse payload", error);
        }
        return;
      }
      if (!payload) {
        return;
      }

      const payloadRecord = payload as Record<string, unknown>;
      const rawMessage = payloadRecord["message"];
      const message = typeof rawMessage === "string" ? rawMessage.trim() : "";
      if (!message) {
        return;
      }

      const sessionId = getOrEnsureGeneralSessionId();
      appendMessage(sessionId, "assistant", message);

      const sentAtRaw = payloadRecord["sent_at"];
      const sentAtIso =
        typeof sentAtRaw === "string" && sentAtRaw ? sentAtRaw : new Date().toISOString();
      const sentAtDate = new Date(sentAtIso);
      if (!Number.isNaN(sentAtDate.getTime())) {
        const dedupeKey = `${toDateKey(sentAtDate)}T${String(sentAtDate.getHours()).padStart(2, "0")}:${String(
          sentAtDate.getMinutes()
        ).padStart(2, "0")}`;
        markDelivered(dedupeKey);
      }

      try {
        const permission = await requestNotificationPermission();
        const cadenceRaw = payloadRecord["cadence"];
        const cadenceLabel =
          typeof cadenceRaw === "string" && cadenceRaw.trim().length > 0
            ? cadenceRaw.trim()
            : "Check-in";
        const sourceRaw = payloadRecord["source"];
        const timezoneRaw = payloadRecord["timezone"];
        const eventNameRaw = payloadRecord["event"];
        const notification: ProactivityNotification = {
          id: sentAtDate.getTime() || Date.now(),
          user_id: userId,
          type: "proactivity_message",
          title: `🔔 ${cadenceLabel} Check-in`,
          message,
          metadata: {
            source: typeof sourceRaw === "string" && sourceRaw ? sourceRaw : "proactivity_engine",
            timezone: typeof timezoneRaw === "string" && timezoneRaw ? timezoneRaw : null,
            event: typeof eventNameRaw === "string" && eventNameRaw ? eventNameRaw : "proactivity_message",
          },
          due_at: sentAtIso,
          sent_at: sentAtIso,
          read_at: null,
          completed_at: null,
          created_at: sentAtIso,
        };
        if (permission) {
          showBrowserNotification(notification, permission);
        }
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[Proactivity] Failed to show browser notification", error);
        }
      }
    };

    function scheduleReconnect() {
      if (cancelled) {
        return;
      }
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
      }
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, 3000);
    }

    function handleError(event?: Event) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[Proactivity] Stream error", event);
      }
      closeStream();
      scheduleReconnect();
    }

    function connect() {
      if (cancelled) {
        return;
      }
      const url = buildStreamUrl();
      try {
        eventSource = new EventSource(url, { withCredentials: true });
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error("[Proactivity] Failed to initialize stream", error);
        }
        scheduleReconnect();
        return;
      }
      eventSource.addEventListener("error", handleError as EventListener);
      eventSource.addEventListener("ready", () => undefined);
      eventSource.addEventListener("proactivity_message", (event) => {
        void handleProactivityMessage(event as MessageEvent);
      });
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
      }
      closeStream();
    };
  }, [userId, appendMessage, getOrEnsureGeneralSessionId, markDelivered]);

  const contextValue = useMemo(
    () => ({
      deliveredKeys,
    }),
    [deliveredKeys]
  );

  return (
    <ProactivityNotificationContext.Provider value={contextValue}>
      {children}
    </ProactivityNotificationContext.Provider>
  );
}

export const useProactivityNotifications = () => useContext(ProactivityNotificationContext);
