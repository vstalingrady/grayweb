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
import {
  buildGeneralConversationId,
  normalizeAssistantMessage,
  parseGrayTitleMarkers,
  resolveClientTimezone,
} from "./chat/utils";
import { getSupabaseAccessToken } from "@/lib/auth/supabaseAccessToken";

type ProactivityNotificationContextValue = {
  deliveredKeys: ReadonlySet<string>;
};

const ProactivityNotificationContext = createContext<ProactivityNotificationContextValue>({
  deliveredKeys: new Set<string>(),
});

const MAX_RECENT_PROACTIVITY_EVENTS = 50;
type ProactivityPayload = {
  session_id?: string;
  message?: string;
  delivery_key?: string;
  sent_at?: string;
  timezone?: string;
};

const buildProactivityEventKey = (payload: ProactivityPayload): string | null => {
  if (payload.delivery_key) {
    return `delivery:${payload.delivery_key}`;
  }
  if (payload.sent_at) {
    return `sent:${payload.sent_at}`;
  }
  if (payload.message) {
    return `message:${payload.message}`;
  }
  return null;
};

const CHECK_IN_DELIVERY_REGEX = /^check_in:\d+:(\d{8})T(\d{4})$/;

const formatDateTimeKey = (date: Date, timeZone: string): string | null => {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value ?? "";
    const year = get("year");
    const month = get("month");
    const day = get("day");
    const hour = get("hour");
    const minute = get("minute");
    if (!year || !month || !day || !hour || !minute) {
      return null;
    }
    return `${year}-${month}-${day}T${hour}:${minute}`;
  } catch {
    return null;
  }
};

const buildScheduleKeyFromDeliveryKey = (deliveryKey: string, timezone: string): string | null => {
  const match = CHECK_IN_DELIVERY_REGEX.exec(deliveryKey);
  if (!match) {
    return null;
  }
  const datePart = match[1];
  const timePart = match[2];
  const year = Number.parseInt(datePart.slice(0, 4), 10);
  const month = Number.parseInt(datePart.slice(4, 6), 10);
  const day = Number.parseInt(datePart.slice(6, 8), 10);
  const hour = Number.parseInt(timePart.slice(0, 2), 10);
  const minute = Number.parseInt(timePart.slice(2, 4), 10);
  if ([year, month, day, hour, minute].some((value) => Number.isNaN(value))) {
    return null;
  }
  const utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute));
  return formatDateTimeKey(utcDate, timezone);
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

const normalizeProactivityApiBase = (value: string) => {
  const trimmed = value.replace(/\/+$/, "");
  if (trimmed.endsWith("/api/p")) {
    return trimmed;
  }
  if (trimmed.endsWith("/api")) {
    return `${trimmed}/p`;
  }
  return trimmed;
};

const resolveProactivityApiBase = () => {
  const explicit = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
  if (explicit) {
    return normalizeProactivityApiBase(explicit);
  }
  return resolveApiBaseUrl();
};

export function ProactivityNotificationProvider({ children }: ProactivityNotificationProviderProps) {
  const { t } = useI18n();
  const { user } = useUser();
  const userId = typeof user?.id === "number" ? user.id : null;
  const { appendMessage, sessions, loadConversationMessages } = useChatStore();
  const { notificationPreferences } = useNotificationPreferences();
  const [deliveredKeys, setDeliveredKeys] = useState<Set<string>>(new Set());
  const pushSetupRef = useRef<Promise<void> | null>(null);
  const pushRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sseRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sseConnectionRef = useRef<EventSource | null>(null);
  const sseAttemptRef = useRef(0);
  const sessionsRef = useRef(sessions);
  const isHydratingHistoryRef = useRef(false);
  const recentEventKeysRef = useRef<string[]>([]);
  const recentEventSetRef = useRef<Set<string>>(new Set());
  const clientTimezoneRef = useRef(resolveClientTimezone());

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);
  const getAuthToken = useCallback(async (): Promise<string | null> => {
    const token = await getSupabaseAccessToken();
    if (token) {
      return token;
    }
    return getSupabaseAccessToken({ forceRefresh: true });
  }, []);

  const hydrateGeneralHistory = useCallback(async () => {
    if (!userId || isHydratingHistoryRef.current) {
      return;
    }

    const generalConversationId = buildGeneralConversationId(userId);
    if (!generalConversationId) {
      return;
    }

    const generalSession = sessionsRef.current.find((session) => session.scope === "general");
    if (!generalSession || generalSession.isResponding) {
      return;
    }

    const hasUserMessage = generalSession.messages.some((message) => message.role === "user");
    if (hasUserMessage && generalSession.messages.length > 3) {
      return;
    }

    isHydratingHistoryRef.current = true;
    try {
      await loadConversationMessages(generalSession.id, {
        force: true,
        touchUpdatedAt: true,
        conversationIdOverride: generalConversationId,
      });
    } catch (error) {
      console.warn("[Proactivity] Failed to refresh general chat history:", error);
    } finally {
      isHydratingHistoryRef.current = false;
    }
  }, [loadConversationMessages, userId]);

  const rememberEventKey = useCallback((key: string): boolean => {
    const seen = recentEventSetRef.current;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    const order = recentEventKeysRef.current;
    order.push(key);
    while (order.length > MAX_RECENT_PROACTIVITY_EVENTS) {
      const removed = order.shift();
      if (removed) {
        seen.delete(removed);
      }
    }
    return true;
  }, []);

  const handleProactivityMessage = useCallback(
    (payload: ProactivityPayload) => {
      // 1. Append to chat if we have a session ID
      const targetSessionId = payload.session_id || GENERAL_CHAT_SESSION_ID;
      if (targetSessionId && payload.message) {
        const parsed = parseGrayTitleMarkers(payload.message);
        const normalized = normalizeAssistantMessage("assistant", parsed.cleanText);
        appendMessage(targetSessionId, "assistant", normalized.content);
        void hydrateGeneralHistory();
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
    [
      appendMessage,
      hydrateGeneralHistory,
      t,
      notificationPreferences.device,
      notificationPreferences.proactivity,
    ]
  );

  useEffect(() => {
    if (!userId || typeof window === "undefined" || typeof EventSource === "undefined") return;

    let cancelled = false;

    const clearRetry = () => {
      if (sseRetryTimerRef.current) {
        clearTimeout(sseRetryTimerRef.current);
        sseRetryTimerRef.current = null;
      }
    };

    const closeEventSource = () => {
      if (sseConnectionRef.current) {
        sseConnectionRef.current.close();
        sseConnectionRef.current = null;
      }
    };

    const scheduleRetry = () => {
      if (cancelled || sseRetryTimerRef.current) {
        return;
      }
      sseAttemptRef.current += 1;
      const delayMs = Math.min(30_000, 1000 * Math.pow(2, sseAttemptRef.current - 1));
      sseRetryTimerRef.current = setTimeout(() => {
        sseRetryTimerRef.current = null;
        void connect();
      }, delayMs);
    };

    const handleEvent = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as ProactivityPayload;
        const eventKey = buildProactivityEventKey(data);
        if (eventKey && !rememberEventKey(eventKey)) {
          return;
        }
        handleProactivityMessage(data);

        const key = data.delivery_key;
        if (key) {
          setDeliveredKeys((prev) => {
            const next = new Set(prev);
            next.add(key);
            const timezone = data.timezone || clientTimezoneRef.current;
            const scheduleKey = buildScheduleKeyFromDeliveryKey(key, timezone);
            if (scheduleKey) {
              next.add(scheduleKey);
            }
            return next;
          });
        }
      } catch (err) {
        console.error("[Proactivity] Failed to parse message:", err);
      }
    };

    const connect = async () => {
      clearRetry();
      closeEventSource();

      const token = await getAuthToken();
      if (!token) {
        console.warn("[Proactivity] No auth token available; retrying.");
        scheduleRetry();
        return;
      }

      const url = resolveProactivityApiBase();
      let eventSource: EventSource;
      try {
        eventSource = new EventSource(`${url}/users/${userId}/proactivity/stream?token=${encodeURIComponent(token)}`);
      } catch (err) {
        console.warn("[Proactivity] SSE init failed:", err);
        scheduleRetry();
        return;
      }

      sseConnectionRef.current = eventSource;

      eventSource.onopen = () => {
        sseAttemptRef.current = 0;
      };

      eventSource.addEventListener("ping", () => {
        // Keep-alive, ignore
      });

      eventSource.addEventListener("message", handleEvent);
      eventSource.addEventListener("proactivity_message", handleEvent);

      eventSource.onerror = (err) => {
        console.warn("[Proactivity] SSE disconnected; retrying.", err);
        closeEventSource();
        scheduleRetry();
      };
    };

    void connect();
    return () => {
      cancelled = true;
      clearRetry();
      closeEventSource();
    };
  }, [getAuthToken, userId, handleProactivityMessage, rememberEventKey]);

  useEffect(() => {
    if (!userId || typeof window === "undefined") return;
    if (!notificationPreferences.device || !notificationPreferences.proactivity) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    if (window.isSecureContext === false) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    let cancelled = false;

    const clearRetry = () => {
      if (pushRetryTimerRef.current) {
        clearTimeout(pushRetryTimerRef.current);
        pushRetryTimerRef.current = null;
      }
    };

    const scheduleRetry = () => {
      if (cancelled || pushRetryTimerRef.current) {
        return;
      }
      pushRetryTimerRef.current = setTimeout(() => {
        pushRetryTimerRef.current = null;
        void setup();
      }, 5000);
    };

    if (pushSetupRef.current) return;

    const setup = async () => {
      const token = await getAuthToken();
      if (!token) {
        scheduleRetry();
        return;
      }

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        console.warn("[Proactivity] Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY; push disabled.");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscribeOptions = {
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          vapidPublicKey
        ) as BufferSource,
      };

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe(subscribeOptions);
      }

      const p256dh = subscription.getKey("p256dh");
      const auth = subscription.getKey("auth");
      if (!p256dh || !auth) return;

      const apiBase = resolveProactivityApiBase();
      const response = await fetch(`${apiBase}/users/${userId}/push/subscribe`, {
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
      if (!response.ok) {
        console.warn("[Proactivity] Push subscription registration failed:", response.status);
        scheduleRetry();
      }
    };

    pushSetupRef.current = setup()
      .catch((error) => {
        console.error("[Proactivity] Failed to register push subscription:", error);
        scheduleRetry();
      })
      .finally(() => {
        pushSetupRef.current = null;
      });
    return () => {
      cancelled = true;
      clearRetry();
    };
  }, [getAuthToken, notificationPreferences.device, notificationPreferences.proactivity, userId]);

  return (
    <ProactivityNotificationContext.Provider value={{ deliveredKeys }}>
      {children}
    </ProactivityNotificationContext.Provider>
  );
}

export const useProactivityNotifications = () => useContext(ProactivityNotificationContext);
