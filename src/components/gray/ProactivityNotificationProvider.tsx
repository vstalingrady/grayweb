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
import { buildGeneralConversationId, normalizeAssistantMessage, parseGrayTitleMarkers } from "./chat/utils";
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
  const sessionsRef = useRef(sessions);
  const isHydratingHistoryRef = useRef(false);
  const recentEventKeysRef = useRef<string[]>([]);
  const recentEventSetRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);
  const getAuthToken = useCallback(async (): Promise<string | null> => {
    return getSupabaseAccessToken();
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

    const setupProactivity = async () => {
      const token = await getAuthToken();
      if (!token) {
        console.warn('[Proactivity] No auth token available');
        return;
      }

      const url = resolveProactivityApiBase();
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
          const data = JSON.parse(event.data) as ProactivityPayload;
          // console.log("[Proactivity] Message received:", data);
          const eventKey = buildProactivityEventKey(data);
          if (eventKey && !rememberEventKey(eventKey)) {
            return;
          }
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
  }, [getAuthToken, userId, handleProactivityMessage, rememberEventKey]);

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

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        console.warn("[Proactivity] Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY; push disabled.");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw-proactivity.js");
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
