"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type RefObject,
  type ReactNode,
  type SetStateAction,
} from "react";
import { usePathname } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import {
  apiService,
  isApiNetworkError,
  type ChatStreamTiming,
  type ConversationSummary,
  type ContextCache,
  type ContextCacheBase,
  type GroundingMetadata,
  type MediaUpload,
  type Reminder,
  type ReminderCreatePayload,
  type User,
} from "@/lib/api";
import { buildLocalTimeContext } from "@/lib/timeContext";
import { formatReminderDateLabel, formatReminderSlotLabel } from "./reminderTimeUtils";
import { type QuestionnaireSession } from "@/lib/questionnaire";

import { compressImage } from "@/lib/imageCompression";
import {
  ChatRole,
  ChatMessage,
  ChatSession,
  ChatSessionScope,
  ChatTitleMode,
  ChatContextValue,
  GrayReminderCreatedPayload,
  ConversationHistoryEntryPayload,
} from "./chat/types";
import {
  buildGeneralConversationId,
  isGeneralConversationId,
  buildPersonalizedSystemPrompt,
  computeProfileHash,
  buildAssistantReply,
  buildAssistantErrorReply,
  normalizeAssistantContent,
  normalizeAssistantMessage,
  shouldIncludeWorkspaceContext,
  resolveClientTimezone,
  buildSessionStorageKeyCandidates,
  deriveTitleFromMessage,
  shouldRequestAutoTitleForSession,
  normalizeConversationIdValue,
  isGenericSessionTitle as isGenericTitle,
  stripGrayTitleMarkers,
  parseGrayTitleMarkers,
  formatConversationTitle,
  coerceConversationIdForRequest,
  buildConversationHistoryPayload,
  toTimestamp,
  isTitleDerivedFromMessage,
} from "./chat/utils";
import { extractGrayRemindersFromText, buildReminderConfirmationText, buildReminderKey, coerceReminderPayload } from "./chat/reminderUtils";
import { ALL_PIONEER_MODEL_IDS, PIONEER_ONLY_MODEL_IDS } from "./modelCatalog";
import {
  GENERAL_CHAT_SESSION_ID,
  GENERAL_CONVERSATION_PREFIX,
  SHARED_CHAT_PLACEHOLDER_TITLE,
  GREETING_PATTERN,
  SELF_CONTEXT_PATTERNS,
  WORKSPACE_CONTEXT_KEYWORDS,
  LOW_SIGNAL_TITLE_WORDS,
  DUPLICATE_THREAD_WINDOW_MS,
  REMOTE_SESSION_MERGE_WINDOW_MS,
  REMINDER_POLL_MIN_INTERVAL,
  REMINDER_POLL_SHORT_INTERVAL,
} from "./chat/constants";
import { REMINDERS_REFRESH_EVENT } from "./hooks/useWorkspaceData";

const WORKSPACE_CONTEXT_COOLDOWN_MS = 600000; // 10 minutes
const CONVERSATION_MEMORY_STORAGE_PREFIX = "gray_conversation_memory";
const VISIBLE_MODEL_IDS_STORAGE_PREFIX = "gray_visible_model_ids";

declare global {
  interface Window {
    endSearchTracking?: () => void;
  }
}

const endSearchTracking = () => {
  if (typeof window === "undefined") {
    return;
  }
  window.endSearchTracking?.();
};



type SaveContextCacheOptions = {
  skipMessage?: boolean;
  skipReset?: boolean;
};

const ChatContext = createContext<ChatContextValue | null>(null);


const INITIAL_SESSIONS: ChatSession[] = [];
const PLACEHOLDER_SESSION_IDS = new Set([
  "session-subjective-attractiveness",
  "session-mobile-fade-effect",
  "session-chat-log-analysis",
]);
const PLACEHOLDER_TITLES = new Set([
  "Subjective Attractiveness",
  "Mobile-Friendly Fade Effect",
  "Chat Log Analysis Techniques",
]);
const FALLBACK_ASSISTANT_DELAY_MS = 150;
const GENERAL_SESSION_ID = "general-session";
const GENERAL_SESSION_TITLE = "General Chat";


const normalizeReminderLabel = (label?: string | null) => {
  if (!label) {
    return "that thing we planned";
  }
  const trimmed = label.trim();
  return trimmed.length > 0 ? trimmed : "that thing we planned";
};

const formatReminderScheduleLabel = (iso?: string | null) => {
  return formatReminderDateLabel(iso) ?? iso ?? "sometime soon";
};

const buildReminderPingMessage = (reminder: Reminder): string => {
  const label = normalizeReminderLabel(reminder.label);
  const note = reminder.summary ?? reminder.description ?? null;

  // Use a cleaner, less "bot-like" format for delivered reminders
  const parts = [`🔔 ${label}`];
  if (note) {
    parts.push(note);
  }
  return parts.join("\n\n");
};
const REMINDER_NOTIFICATION_ICON = "/grayaiwhite.svg";

const buildReminderNotificationTitle = (reminder: Reminder) =>
  `Reminder: ${normalizeReminderLabel(reminder.label)}`;

const buildReminderNotificationBody = (reminder: Reminder) => {
  const scheduleLabel = formatReminderScheduleLabel(reminder.remind_at);
  const note = reminder.summary ?? reminder.description ?? null;
  const segments: string[] = [];
  if (scheduleLabel) {
    segments.push(`Scheduled for ${scheduleLabel}`);
  }
  if (note) {
    segments.push(note);
  }
  return segments.length > 0 ? segments.join(" • ") : "Tap to view details.";
};

const sendReminderNotification = (reminder: Reminder) => {
  if (
    typeof window === "undefined" ||
    typeof Notification === "undefined" ||
    (typeof window !== "undefined" && !window.isSecureContext)
  ) {
    return;
  }
  if (!reminder.id) {
    return;
  }
  if (Notification.permission !== "granted") {
    return;
  }
  try {
    const notification = new Notification(buildReminderNotificationTitle(reminder), {
      body: buildReminderNotificationBody(reminder),
      icon: REMINDER_NOTIFICATION_ICON,
      badge: REMINDER_NOTIFICATION_ICON,
      tag: `gray-reminder-${reminder.id}`,
      requireInteraction: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    notification.addEventListener("click", () => {
      if (typeof window !== "undefined" && window.focus) {
        window.focus();
      }
      notification.close();
    });
  } catch (error) {
    console.error("Failed to show reminder notification:", error);
  }
};

/**
 * Create a new ChatMessage object with proper id and timestamp.
 */
const makeMessage = (
  role: ChatRole,
  content: string,
  tempId?: string,
  metadata?: GroundingMetadata,
  attachments?: MediaUpload[]
): ChatMessage => {
  const now = Date.now();
  return {
    id:
      tempId ??
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `msg-${role}-${now}-${Math.random().toString(36).slice(2, 10)}`),
    role,
    content,
    createdAt: now,

    groundingMetadata: metadata ?? undefined,
    attachments: attachments ?? undefined,
  };
};


const createEmptyGeneralSession = (timestamp?: number, conversationId?: string | null): ChatSession => {
  const now = timestamp ?? Date.now();
  return {
    id: GENERAL_SESSION_ID,
    title: GENERAL_SESSION_TITLE,
    titleMode: "manual",
    createdAt: now,
    updatedAt: now,
    messages: [],
    isResponding: false,
    scope: "general",
    conversationId: conversationId ?? undefined,
    pendingAutoStream: false,
  };
};

const cloneSession = (session: ChatSession): ChatSession => ({
  ...session,
  titleMode: session.titleMode ?? (session.scope === "general" ? "manual" : "auto"),
  messages: session.messages.map((message) => ({
    ...message,
  })),
});

const defaultSessions = () => {
  if (!INITIAL_SESSIONS.length) {
    return [createEmptyGeneralSession()];
  }
  const cloned = INITIAL_SESSIONS.map(cloneSession);
  const hasGeneral = cloned.some((session) => session.scope === "general");
  return hasGeneral ? cloned : [createEmptyGeneralSession(), ...cloned];
};

const withGeneralFirst = (sessions: ChatSession[]): ChatSession[] => {
  const generalIndex = sessions.findIndex((session) => session.scope === "general");
  if (generalIndex <= 0) {
    return sessions;
  }
  const copy = [...sessions];
  const [general] = copy.splice(generalIndex, 1);
  copy.unshift(general);
  return copy;
};

const getSessionSeedFingerprint = (session: ChatSession): { fingerprint: string; createdAt: number } | null => {
  if (session.scope !== "thread" || session.messages.length === 0) {
    return null;
  }
  const firstUserMessage = session.messages.find(
    (message) => message.role === "user" && message.content.trim().length > 0
  );
  if (!firstUserMessage) {
    return null;
  }
  const normalized = firstUserMessage.content.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  const createdAt =
    typeof firstUserMessage.createdAt === "number" ? firstUserMessage.createdAt : session.createdAt;
  return {
    fingerprint: normalized,
    createdAt,
  };
};

const dedupeSessionsByConversation = (sessions: ChatSession[]): ChatSession[] => {
  const map = new Map<string, ChatSession>();
  sessions.forEach((session) => {
    const normalizedConversationId = normalizeConversationIdValue(session.conversationId);
    const key =
      session.scope === "general"
        ? GENERAL_SESSION_ID
        : normalizedConversationId ?? `session:${session.id}`;

    const existing = map.get(key);
    if (!existing) {
      map.set(key, session);
      return;
    }
    const existingScore = existing.messages.length;
    const currentScore = session.messages.length;
    const shouldReplace =
      currentScore > existingScore ||
      (currentScore === existingScore && session.updatedAt > existing.updatedAt);
    if (shouldReplace) {
      map.set(key, session);
    }
  });
  return Array.from(map.values());
};

const dedupeSessionsByTitleWindow = (sessions: ChatSession[]): ChatSession[] => {
  const titleMap = new Map<string, { index: number; session: ChatSession }>();
  const result: ChatSession[] = [];

  sessions.forEach((session) => {
    const normalizedTitle = session.title?.trim().toLowerCase() ?? "";
    if (!normalizedTitle) {
      result.push(session);
      return;
    }
    const existingEntry = titleMap.get(normalizedTitle);
    if (!existingEntry) {
      titleMap.set(normalizedTitle, { index: result.length, session });
      result.push(session);
      return;
    }
    const existing = existingEntry.session;
    const withinWindow =
      Math.abs(session.updatedAt - existing.updatedAt) <= REMOTE_SESSION_MERGE_WINDOW_MS;
    const isRemoteShell =
      withinWindow &&
      ((session.messages.length === 0 && existing.messages.length > 0) ||
        (existing.messages.length === 0 && session.messages.length > 0));
    if (isRemoteShell) {
      if (existing.messages.length === 0 && session.messages.length > 0) {
        result[existingEntry.index] = session;
        titleMap.set(normalizedTitle, { index: existingEntry.index, session });
      }
      return;
    }
    result.push(session);
  });

  return result;
};

const normalizeSessionsList = (sessions: ChatSession[]): ChatSession[] =>
  withGeneralFirst(dedupeSessionsByTitleWindow(dedupeSessionsByConversation(sessions)));

const loadStoredSessions = (
  _storageKeys: readonly string[]
): { key: string | null; sessions: ChatSession[] } => {
  if (typeof window === "undefined") {
    return { key: null, sessions: defaultSessions() };
  }

  for (const key of _storageKeys) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        continue;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Basic schema validation / migration could go here
        const sessions = parsed.slice(0, 50) as ChatSession[]; // Limit to 50 recent
        // Ensure data shapes are correct (e.g. dates are timestamps)
        const validSessions = sessions.filter(
          (s) =>
            s &&
            typeof s.id === "string" &&
            Array.isArray(s.messages)
        );
        if (validSessions.length > 0) {
          return { key, sessions: validSessions };
        }
      }
    } catch (error) {
      console.warn(`Failed to parse stored sessions for key "${key}":`, error);
    }
  }

  return { key: null, sessions: defaultSessions() };
};

const mapApiMessagesToChatMessages = (
  history: { role: string; text: string; timestamp?: number; grounding_metadata?: GroundingMetadata | null; groundingMetadata?: GroundingMetadata | null; reminders?: unknown[] | null }[],
  conversationId: string,
  fallbackTimestamp: number = Date.now()
): ChatMessage[] => {
  // Deduplicate consecutive identical backend messages to keep the
  // rendered history tidy.
  const dedupedHistory = history.filter((message, index, arr) => {
    if (index === 0) {
      return true;
    }
    const prev = arr[index - 1];
    return !(prev.role === message.role && (prev.text ?? "") === (message.text ?? ""));
  });

  return dedupedHistory.map((message, index) => {
    const role: ChatRole = message.role === "model" ? "assistant" : "user";
    const rawText = message.text ?? "";
    const normalizedText = role === "assistant" ? stripGrayTitleMarkers(rawText) : rawText;

    // Prefer reminders from API (database-persisted) over text extraction
    const apiReminders = Array.isArray(message.reminders) && message.reminders.length > 0
      ? message.reminders.map((r) => coerceReminderPayload(r)).filter((r): r is GrayReminderCreatedPayload => Boolean(r))
      : null;

    const reminderExtraction =
      role === "assistant" && !apiReminders
        ? extractGrayRemindersFromText(normalizedText)
        : { cleanText: normalizedText, reminders: [] };

    const normalizedMetadata =
      message.grounding_metadata ??
      message.groundingMetadata ??
      null;

    // Use the message's own timestamp if available and valid (> 0), otherwise fall back to the provided timestamp.
    // The backend returns 0 for messages with missing or unparseable timestamps, so we treat 0 as invalid.
    const messageTimestamp = typeof message.timestamp === 'number' && Number.isFinite(message.timestamp) && message.timestamp > 0
      ? message.timestamp
      : fallbackTimestamp;

    return {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${conversationId}-${index}-${messageTimestamp}`,
      role,
      content: reminderExtraction.cleanText,
      createdAt: messageTimestamp,
      reminders:
        apiReminders ??
        (role === "assistant" && reminderExtraction.reminders.length
          ? reminderExtraction.reminders
          : undefined),
      groundingMetadata: normalizedMetadata ?? undefined,
    };
  });
};

type ChatProviderProps = {
  children: ReactNode;
  workspaceContext?: string;
};

export function ChatProvider({ children, workspaceContext }: ChatProviderProps) {
  const { user, waitForUser, updateUser, refreshUser } = useUser();
  const [defaultSystemPrompt, setDefaultSystemPrompt] = useState<string | null>(null);
  const [, setShowIntro] = useState(false);
  const onboardingSeenRef = useRef(false);
  const onboardingKickoffRef = useRef(false);
  const hasLoadedFromStorageRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    let controller = new AbortController();

    const loadSystemPrompt = async () => {
      try {
        controller.abort();
        controller = new AbortController();
        const response = await fetch("/system-prompts.json", {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as { chat?: string | null } | null;
        if (!isMounted) {
          return;
        }
        const raw = typeof data?.chat === "string" ? data.chat : "";
        const trimmed = raw.trim();
        setDefaultSystemPrompt(trimmed.length > 0 ? trimmed : null);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        console.error("Failed to load system prompt:", error);
      }
    };

    void loadSystemPrompt();

    if (typeof window !== "undefined" && typeof document !== "undefined") {
      const handleVisibilityChange = () => {
        if (document.visibilityState === "visible") {
          void loadSystemPrompt();
        }
      };
      window.addEventListener("visibilitychange", handleVisibilityChange);

      return () => {
        isMounted = false;
        controller.abort();
        window.removeEventListener("visibilitychange", handleVisibilityChange);
      };
    }

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  // Sync selected model from user profile on load
  useEffect(() => {
    if (user?.preferred_model) {
      setSelectedModelId(user.preferred_model);
    }
  }, [user]);

  const handleSetSelectedModelId = useCallback(
    (id: string | null) => {
      setSelectedModelId(id);
      if (user && id) {
        // Persist preference to backend
        void apiService.updateUser(user.id, { preferred_model: id }).catch((err) => {
          console.error("Failed to persist model preference:", err);
        });
      }
    },
    [user]
  );

  const personalizedSystemPrompt = useMemo(
    () => buildPersonalizedSystemPrompt(user, defaultSystemPrompt),
    [user, defaultSystemPrompt]
  );

  // Persist "has seen" state from user profile to local ref to prevent re-showing
  useEffect(() => {
    if (user?.has_seen_general_chat) {
      onboardingSeenRef.current = true;
      onboardingKickoffRef.current = true;
      // Also ensure state is synced if it was somehow set to true
      setShowIntro(false);
    } else {
      // Only allow reset if user is loaded and explicitly has it false
      // This prevents flashing if user is momentarily null/loading
      if (user && !user.has_seen_general_chat) {
        onboardingKickoffRef.current = false;
      }
    }
  }, [user?.has_seen_general_chat, user?.id, user]);

  const markHasSeenGeneralChat = useCallback(async () => {
    if (!user || onboardingSeenRef.current || user.has_seen_general_chat) {
      onboardingSeenRef.current = onboardingSeenRef.current || Boolean(user?.has_seen_general_chat);
      return;
    }

    onboardingSeenRef.current = true;
    try {
      await updateUser({ has_seen_general_chat: true });
    } catch (error) {
      console.error("Failed to mark general chat as seen:", error);
    }
  }, [updateUser, user]);

  const [sessionsState, setSessionsState] = useState<ChatSession[]>(defaultSessions);
  const sessionsRef = useRef<ChatSession[]>(sessionsState);
  const setSessions = useCallback(
    (updater: SetStateAction<ChatSession[]>) => {
      setSessionsState((prev) => {
        const next =
          typeof updater === "function"
            ? (updater as (value: ChatSession[]) => ChatSession[])(prev)
            : updater;
        sessionsRef.current = next;
        return next;
      });
    },
    []
  );
  const generalConversationId = useMemo(
    () => buildGeneralConversationId(user?.id),
    [user?.id]
  );
  const generalConversationIdRef = useRef<string | undefined>(generalConversationId);
  useEffect(() => {
    generalConversationIdRef.current = generalConversationId;
  }, [generalConversationId]);

  const sessions = sessionsState;
  const [remoteConversationsLoaded, setRemoteConversationsLoaded] = useState(false);
  const pendingTitleSyncRef = useRef<Map<string, string>>(new Map());
  const pendingThreadSeedsRef = useRef<Map<string, { sessionId: string; createdAt: number }>>(
    new Map()
  );
  const debouncedUpdateTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const [workspaceContextValue, setWorkspaceContextValue] = useState<string | null>(
    workspaceContext ?? null
  );
  const workspaceContextUsageRef = useRef<Map<string, number>>(new Map());
  const [selectedAttachments, setSelectedAttachments] = useState<MediaUpload[]>([]);
  const attachmentsRef = useRef<MediaUpload[]>(selectedAttachments);
  useEffect(() => {
    attachmentsRef.current = selectedAttachments;
  }, [selectedAttachments]);
  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach((attachment) => {
        if (attachment?.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl);
        }
      });
    };
  }, []);
  const releaseAttachmentPreview = useCallback((attachment: MediaUpload) => {
    if (attachment?.previewUrl) {
      URL.revokeObjectURL(attachment.previewUrl);
    }
  }, []);
  const [isAttachmentUploading, setIsAttachmentUploading] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [mapsEnabled, setMapsEnabled] = useState(false);

  useEffect(() => {
    if (user) {
      setMapsEnabled(Boolean(user.maps_enabled));
    }
  }, [user]);

  const [mapsWidgetEnabled, setMapsWidgetEnabled] = useState(false);
  const [mapsLatitude, setMapsLatitude] = useState("");
  const [mapsLongitude, setMapsLongitude] = useState("");

  // Removed: pendingLocationRequestMessage, isHandlingLocationRequest, pendingLocationRequestActionRef
  // as we no longer block sending for location consent.
  const pendingLocationRequestMessage = null;
  const isHandlingLocationRequest = false;

  const mapPayload = useMemo(() => {
    const normalizedLatitude = mapsLatitude.trim();
    const normalizedLongitude = mapsLongitude.trim();
    const parsedLatitude = normalizedLatitude ? Number(normalizedLatitude) : undefined;
    const parsedLongitude = normalizedLongitude ? Number(normalizedLongitude) : undefined;
    const payload: {
      maps_enabled: boolean;
      maps_widget: boolean;
      maps_latitude?: number;
      maps_longitude?: number;
    } = {
      maps_enabled: mapsEnabled,
      maps_widget: mapsWidgetEnabled,
    };
    if (normalizedLatitude && !Number.isNaN(parsedLatitude ?? NaN)) {
      payload.maps_latitude = parsedLatitude;
    }
    if (normalizedLongitude && !Number.isNaN(parsedLongitude ?? NaN)) {
      payload.maps_longitude = parsedLongitude;
    }
    return payload;
  }, [mapsEnabled, mapsLatitude, mapsLongitude, mapsWidgetEnabled]);

  const hasLocationCoordinates = Boolean(
    mapPayload.maps_latitude != null && mapPayload.maps_longitude != null
  );

  const getGeolocation = (): Promise<{ latitude: number; longitude: number } | null> => {
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !window.navigator?.geolocation) {
        resolve(null);
        return;
      }
      window.navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        () => resolve(null)
      );
    });
  };

  // Helper to manually request location (e.g. from the Tools menu)
  const requestLocationCoordinates = async () => {
    const coords = await getGeolocation();
    if (coords) {
      setMapsLatitude(coords.latitude.toString());
      setMapsLongitude(coords.longitude.toString());
      setMapsWidgetEnabled(true);
      return true;
    }
    return false;
  };

  const toggleMapsEnabled = useCallback(async () => {
    const nextState = !mapsEnabled;
    setMapsEnabled(nextState);

    // If enabling, also try to get coordinates if not already present
    if (nextState && !hasLocationCoordinates) {
      await requestLocationCoordinates();
    }
  }, [mapsEnabled, hasLocationCoordinates]);

  const toggleWebSearchEnabled = useCallback(() => {
    setWebSearchEnabled((prev) => !prev);
  }, []);

  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const toggleRemindersEnabled = useCallback(() => {
    setRemindersEnabled((prev) => !prev);
  }, []);

  // Deprecated: No longer blocks execution.
  const promptForLocationConsent = (message: string, sendAction: () => void) => {
    // Always proceed immediately. 
    // We strictly rely on the manual "Maps" toggle or backend inference (without blocking).
    void sendAction();
    return true;
  };

  const requestLocationShare = () => {
    // No-op or manual trigger if needed
    void requestLocationCoordinates();
  };

  const skipLocationShare = () => {
    // No-op
  };

  const [contextCaches, setContextCaches] = useState<ContextCache[]>([]);
  const [contextCacheLabel, setContextCacheLabel] = useState("");
  const [contextCacheContent, setContextCacheContent] = useState("");
  const [selectedContextCacheId, setSelectedContextCacheId] = useState<number | null>(null);
  const [contextCacheMessage, setContextCacheMessage] = useState<string | null>(null);
  const [isContextCacheSaving, setIsContextCacheSaving] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [fileSearchStores, setFileSearchStores] = useState<{ name: string; display_name?: string }[]>([]);
  const [fileSearchDisplayName, setFileSearchDisplayName] = useState("");
  const [fileSearchStatus, setFileSearchStatus] = useState<string | null>(null);
  const [isCreatingFileSearchStore, setIsCreatingFileSearchStore] = useState(false);
  const [selectedFileSearchStore, setSelectedFileSearchStore] = useState("");
  const [fileSearchUploadFile, setFileSearchUploadFile] = useState<File | null>(null);
  const [fileSearchUploadStatus, setFileSearchUploadStatus] = useState<string | null>(null);
  const [fileSearchChunking, setFileSearchChunking] = useState({
    maxTokensPerChunk: "",
    maxOverlapTokens: "",
  });
  const [fileSearchImportName, setFileSearchImportName] = useState("");
  const [fileSearchImportStatus, setFileSearchImportStatus] = useState<string | null>(null);
  const [fileSearchUploadInputRef] = useState<RefObject<HTMLInputElement | null>>({ current: null });
  const [reasoningMode, setReasoningMode] = useState(false);
  const [modelTier, setModelTier] = useState<"lite" | "pro" | "pioneer">("lite");
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [visibleModelIds, setVisibleModelIds] = useState<string[] | null>(null);
  const visibleModelIdsHydratedRef = useRef(false);
  const lastPersistedVisibleModelIdsRef = useRef<string | null>(null);
  const lastAutoCachedWorkspaceRef = useRef<string | null>(null);
  const autoCacheInFlightRef = useRef(false);
  // Track profile hash to only send full profile when it changes
  const lastSentProfileHashRef = useRef<string>("");
  // Track when reasoning mode starts to calculate reasoning duration
  const reasoningStartTimeRef = useRef<number | null>(null);

  const normalizeVisibleModelIds = useCallback((value: unknown): string[] | null => {
    if (value === null || value === undefined) {
      return null;
    }
    if (!Array.isArray(value)) {
      return null;
    }
    const allowed = new Set(ALL_PIONEER_MODEL_IDS);
    const sanitized = value
      .filter((candidate): candidate is string => typeof candidate === "string" && allowed.has(candidate))
      .filter((candidate, index, self) => self.indexOf(candidate) === index);
    return sanitized.length === 0
      ? []
      : sanitized.length === ALL_PIONEER_MODEL_IDS.length
        ? null
        : sanitized;
  }, []);

  const areVisibleModelIdsEqual = useCallback((left: string[] | null, right: string[] | null): boolean => {
    if (left === null && right === null) {
      return true;
    }
    if (left === null || right === null) {
      return false;
    }
    if (left.length !== right.length) {
      return false;
    }
    for (let index = 0; index < left.length; index += 1) {
      if (left[index] !== right[index]) {
        return false;
      }
    }
    return true;
  }, []);

  // Restore model selection from local storage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedTier = localStorage.getItem("gray_model_tier");
      if (storedTier && ["lite", "pioneer"].includes(storedTier)) {
        setModelTier(storedTier as "lite" | "pioneer");
      } else if (storedTier === "pro") {
        // Migration: "Pro" is removed, force to "Lite"
        setModelTier("lite");
        localStorage.setItem("gray_model_tier", "lite");
      }
      const storedModelId = localStorage.getItem("gray_selected_model_id");
      if (storedModelId) {
        setSelectedModelId(storedModelId);
      }
    }
  }, []);

  // Enforce plan-tier model access on the client to avoid stale localStorage
  // keeping a user on a higher-tier model after downgrade.
  useEffect(() => {
    const normalizedTier = (user?.plan_tier ?? "scout").toLowerCase();

    if (normalizedTier === "scout") {
      if (modelTier !== "lite") {
        setModelTier("lite");
      }
      if (selectedModelId) {
        setSelectedModelId(null);
      }
      if (reasoningMode) {
        setReasoningMode(false);
      }
      return;
    }

    if (normalizedTier === "voyager") {
      if (selectedModelId && PIONEER_ONLY_MODEL_IDS.includes(selectedModelId)) {
        setSelectedModelId(null);
        setModelTier("lite");
      }
    }
  }, [modelTier, reasoningMode, selectedModelId, user?.plan_tier]);

  // Restore visible models per user (or anon)
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (user && "visible_model_ids" in user) {
      setVisibleModelIds(normalizeVisibleModelIds((user as { visible_model_ids?: unknown }).visible_model_ids));
      visibleModelIdsHydratedRef.current = true;
      return;
    }
    const key = `${VISIBLE_MODEL_IDS_STORAGE_PREFIX}:${user?.id ?? "anon"}`;
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      setVisibleModelIds(null);
      visibleModelIdsHydratedRef.current = true;
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      setVisibleModelIds(normalizeVisibleModelIds(parsed));
      visibleModelIdsHydratedRef.current = true;
    } catch {
      setVisibleModelIds(null);
      visibleModelIdsHydratedRef.current = true;
    }
  }, [normalizeVisibleModelIds, user]);

  // Persist visible models preference
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const key = `${VISIBLE_MODEL_IDS_STORAGE_PREFIX}:${user?.id ?? "anon"}`;
    if (visibleModelIds === null) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, JSON.stringify(visibleModelIds));
  }, [user?.id, visibleModelIds]);

  // Persist visible models preference to the backend (so it survives browser resets / multi-device).
  useEffect(() => {
    if (!user || typeof updateUser !== "function") {
      lastPersistedVisibleModelIdsRef.current = null;
      return;
    }
    if (!("visible_model_ids" in user)) {
      return;
    }
    if (!visibleModelIdsHydratedRef.current) {
      return;
    }

    const normalizedFromUser = normalizeVisibleModelIds((user as { visible_model_ids?: unknown }).visible_model_ids);
    if (areVisibleModelIdsEqual(normalizedFromUser, visibleModelIds)) {
      return;
    }

    const serialized =
      visibleModelIds === null ? "all" : JSON.stringify(visibleModelIds);
    if (lastPersistedVisibleModelIdsRef.current === serialized) {
      return;
    }
    lastPersistedVisibleModelIdsRef.current = serialized;

    void updateUser({ visible_model_ids: visibleModelIds }).catch((error) => {
      console.error("Failed to persist visible models preference:", error);
    });
  }, [areVisibleModelIdsEqual, normalizeVisibleModelIds, updateUser, user, visibleModelIds]);

  // Persist model selection changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("gray_model_tier", modelTier);
    }
  }, [modelTier]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (selectedModelId) {
        localStorage.setItem("gray_selected_model_id", selectedModelId);
      } else {
        localStorage.removeItem("gray_selected_model_id");
      }
    }
  }, [selectedModelId]);

  const [questionnaireSession, setQuestionnaireSession] = useState<QuestionnaireSession | null>(null);

  // Web search preference is now kept in memory for the current session only.

  useEffect(() => {
    workspaceContextUsageRef.current.clear();
  }, [workspaceContextValue]);

  const shouldAttachWorkspaceContextForSession = useCallback(
    (sessionId: string, message: string) => {
      if (!workspaceContextValue) {
        return false;
      }
      const wantsContext = shouldIncludeWorkspaceContext(message, workspaceContextValue);
      if (!wantsContext) {
        return false;
      }
      const normalized = message.trim().toLowerCase();
      const forceContext = SELF_CONTEXT_PATTERNS.some((pattern) => pattern.test(normalized));
      const lastUsed = workspaceContextUsageRef.current.get(sessionId);
      const now = Date.now();
      if (!forceContext && typeof lastUsed === "number" && now - lastUsed < WORKSPACE_CONTEXT_COOLDOWN_MS) {
        return false;
      }
      workspaceContextUsageRef.current.set(sessionId, now);
      return true;
    },
    [workspaceContextValue]
  );

  const saveContextCache = useCallback(
    async (
      payload: ContextCacheBase,
      options: SaveContextCacheOptions = {}
    ): Promise<ContextCache | null> => {
      if (!user?.id) {
        if (!options.skipMessage) {
          setContextCacheMessage("Sign in to cache context.");
        }
        return null;
      }
      const trimmedContent = payload.content.trim();
      if (!trimmedContent) {
        if (!options.skipMessage) {
          setContextCacheMessage("Add context content before saving.");
        }
        return null;
      }

      const normalizedPayload: ContextCacheBase = {
        content: trimmedContent,
      };
      const label = payload.label?.trim();
      if (label) {
        normalizedPayload.label = label;
      }
      if (payload.conversation_id) {
        normalizedPayload.conversation_id = payload.conversation_id;
      }

      setIsContextCacheSaving(true);
      if (!options.skipMessage) {
        setContextCacheMessage(null);
      }
      try {
        const created = await apiService.createContextCache(user.id, normalizedPayload);
        setContextCaches((prev) => [created, ...prev]);
        setSelectedContextCacheId(created.id);
        if (!options.skipMessage) {
          setContextCacheMessage("Context cached for reuse.");
        }
        if (!options.skipReset) {
          setContextCacheLabel("");
          setContextCacheContent("");
        }
        return created;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to cache context.";
        if (!options.skipMessage) {
          setContextCacheMessage(message);
        }
        console.error("Failed to cache context:", error);
        return null;
      } finally {
        setIsContextCacheSaving(false);
      }
    },
    [user?.id]
  );

  const createContextCache = useCallback(
    async (conversationId?: string) => {
      const normalizedConversationId = normalizeConversationIdValue(conversationId ?? undefined);
      const payload: ContextCacheBase = {
        content: contextCacheContent,
      };
      if (contextCacheLabel.trim()) {
        payload.label = contextCacheLabel.trim();
      }
      if (normalizedConversationId) {
        payload.conversation_id = normalizedConversationId;
      }
      await saveContextCache(payload);
    },
    [contextCacheContent, contextCacheLabel, saveContextCache]
  );

  useEffect(() => {
    if (!user?.id) {
      lastAutoCachedWorkspaceRef.current = null;
      return;
    }
    const trimmedWorkspace = workspaceContextValue?.trim();
    if (!trimmedWorkspace) {
      lastAutoCachedWorkspaceRef.current = null;
      return;
    }
    if (lastAutoCachedWorkspaceRef.current === trimmedWorkspace) {
      return;
    }
    if (autoCacheInFlightRef.current) {
      return;
    }
    autoCacheInFlightRef.current = true;
    (async () => {
      try {
        const cached = await saveContextCache(
          { content: trimmedWorkspace, label: "Workspace context" },
          { skipMessage: true, skipReset: true }
        );
        if (cached) {
          lastAutoCachedWorkspaceRef.current = trimmedWorkspace;
        }
      } catch (error) {
        console.error("Failed to auto-cache workspace context:", error);
      } finally {
        autoCacheInFlightRef.current = false;
      }
    })();
  }, [saveContextCache, user?.id, workspaceContextValue]);

  const selectContextCacheId = useCallback((cacheId: number | null) => {
    setSelectedContextCacheId(cacheId);
  }, []);
  const fileSearchChunkingConfig = useMemo(() => {
    const maxTokens = Number(fileSearchChunking.maxTokensPerChunk);
    const maxOverlap = Number(fileSearchChunking.maxOverlapTokens);
    const whiteSpaceConfig: Record<string, number> = {};
    if (!Number.isNaN(maxTokens) && maxTokens > 0) {
      whiteSpaceConfig.max_tokens_per_chunk = maxTokens;
    }
    if (!Number.isNaN(maxOverlap) && maxOverlap >= 0) {
      whiteSpaceConfig.max_overlap_tokens = maxOverlap;
    }
    if (!Object.keys(whiteSpaceConfig).length) {
      return undefined;
    }
    return { white_space_config: whiteSpaceConfig };
  }, [fileSearchChunking.maxTokensPerChunk, fileSearchChunking.maxOverlapTokens]);

  const handleCreateFileSearchStore = useCallback(async () => {
    setIsCreatingFileSearchStore(true);
    setFileSearchStatus(null);
    try {
      const store = await apiService.createFileSearchStore(
        fileSearchDisplayName.trim() || undefined
      );
      setFileSearchStores((prev) => [store, ...prev]);
      setSelectedFileSearchStore(store.name);
      setFileSearchDisplayName("");
      setFileSearchStatus(
        `Created ${store.display_name ?? store.name}.`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create file store.";
      setFileSearchStatus(message);
    } finally {
      setIsCreatingFileSearchStore(false);
    }
  }, [fileSearchDisplayName]);

  const handleFileSearchUpload = useCallback(async () => {
    if (!selectedFileSearchStore || !fileSearchUploadFile) {
      setFileSearchUploadStatus("Select a store and file first.");
      return;
    }
    setFileSearchUploadStatus("Uploading...");
    try {
      await apiService.uploadToFileSearchStore({
        storeName: selectedFileSearchStore,
        file: fileSearchUploadFile,
        displayName: fileSearchUploadFile.name,
        chunkingConfig: fileSearchChunkingConfig,
      });
      setFileSearchUploadStatus("Upload queued.");
      setFileSearchUploadFile(null);
      if (fileSearchUploadInputRef.current) {
        fileSearchUploadInputRef.current.value = "";
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "File Search upload failed.";
      setFileSearchUploadStatus(message);
    }
  }, [fileSearchChunkingConfig, fileSearchUploadFile, selectedFileSearchStore]);

  const handleFileSearchImport = useCallback(async () => {
    if (!selectedFileSearchStore || !fileSearchImportName.trim()) {
      setFileSearchImportStatus("Select store and specify file name.");
      return;
    }
    setFileSearchImportStatus("Importing...");
    try {
      await apiService.importFileSearch({
        storeName: selectedFileSearchStore,
        fileName: fileSearchImportName.trim(),
        chunkingConfig: fileSearchChunkingConfig,
      });
      setFileSearchImportStatus("Import started.");
      setFileSearchImportName("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "File Search import failed.";
      setFileSearchImportStatus(message);
    }
  }, [fileSearchChunkingConfig, fileSearchImportName, selectedFileSearchStore]);

  const autoStreamTriggeredRef = useRef<Set<string>>(new Set());
  const pendingHistorySyncRef = useRef<Set<string>>(new Set());
  const sessionStorageKeyCandidates = useMemo(
    () => buildSessionStorageKeyCandidates(user?.id ?? null, user?.email ?? null),
    [user?.id, user?.email]
  );
  const sessionStorageKey = sessionStorageKeyCandidates[0] ?? null;
  const previousSessionStorageKeyRef = useRef<string | null>(null);
  const reminderDeliveryCacheRef = useRef<Set<number>>(new Set());
  const markAutoStreamTriggered = useCallback((sessionId: string, messageId?: string | null) => {
    if (!sessionId || !messageId) {
      return;
    }
    autoStreamTriggeredRef.current.add(`${sessionId}:${messageId}`);
  }, []);
  const hasAutoStreamTriggered = useCallback((sessionId: string, messageId?: string | null) => {
    if (!sessionId || !messageId) {
      return false;
    }
    return autoStreamTriggeredRef.current.has(`${sessionId}:${messageId}`);
  }, []);
  const resetAutoStreamState = useCallback((sessionId?: string | null) => {
    if (!sessionId) {
      autoStreamTriggeredRef.current.clear();
      return;
    }
    const prefix = `${sessionId}:`;
    const keysToDelete: string[] = [];
    autoStreamTriggeredRef.current.forEach((value) => {
      if (value.startsWith(prefix)) {
        keysToDelete.push(value);
      }
    });
    keysToDelete.forEach((key) => autoStreamTriggeredRef.current.delete(key));
  }, []);
  const scheduleHistorySync = useCallback(
    (conversationId: string, payload: ConversationHistoryEntryPayload[]) => {
      void (async () => {
        try {
          await apiService.overwriteConversationHistory(conversationId, payload);
        } catch (error) {
          console.warn("Failed to sync conversation history after deletion:", error);
        }
      })();
    },
    []
  );
  const historySyncTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const enqueueHistorySync = useCallback(
    (conversationId: string, payload: ConversationHistoryEntryPayload[]) => {
      const existing = historySyncTimersRef.current.get(conversationId);
      if (existing) {
        clearTimeout(existing);
      }
      const timer = setTimeout(() => {
        historySyncTimersRef.current.delete(conversationId);
        scheduleHistorySync(conversationId, payload);
      }, 250);
      historySyncTimersRef.current.set(conversationId, timer);
    },
    [scheduleHistorySync]
  );

  useEffect(() => {
    return () => {
      historySyncTimersRef.current.forEach((timer) => clearTimeout(timer));
      historySyncTimersRef.current.clear();
    };
  }, []);

  // DISABLED: This sync effect was causing data loss by overwriting backend
  // history with stale/incomplete local state on page reload. The backend
  // should be the authoritative source of truth. Message deletions should be
  // synced via explicit API calls from the delete handler, not via full
  // history overwrites on every session change.
  //
  // Original purpose: Sync local edits (including deletions) to backend.
  // Problem: Local state could be stale/incomplete, overwriting valid backend data.
  // Fix: Only sync on explicit user actions (delete, edit), not on session changes.
  const syncedHistoryRef = useRef<Set<string>>(new Set());
  const resolveChatUser = useCallback(async () => {
    if (user) {
      return user;
    }
    return waitForUser();
  }, [user, waitForUser]);

  const schedulePendingSeedCleanup = useCallback((seed: string, sessionId: string) => {
    if (!seed) {
      return;
    }
    const existing = pendingThreadSeedsRef.current.get(seed);
    if (!existing || existing.sessionId !== sessionId) {
      pendingThreadSeedsRef.current.set(seed, { sessionId, createdAt: Date.now() });
    }
    if (typeof window === "undefined") {
      return;
    }
    window.setTimeout(() => {
      const pending = pendingThreadSeedsRef.current.get(seed);
      if (pending?.sessionId === sessionId) {
        pendingThreadSeedsRef.current.delete(seed);
      }
    }, DUPLICATE_THREAD_WINDOW_MS);
  }, []);

  const uploadAttachments = useCallback(
    async (files: FileList | File[]) => {
      const selectedFiles = Array.from(files ?? []);
      if (selectedFiles.length === 0) {
        return;
      }

      setAttachmentError(null);
      setIsAttachmentUploading(true);

      try {
        const resolvedUser = await resolveChatUser();
        if (!resolvedUser) {
          throw new Error("Unable to upload without an authenticated user.");
        }
        const uploads: MediaUpload[] = [];
        for (const file of selectedFiles) {
          if (!file) {
            continue;
          }
          // Compress image before uploading
          const processedFile = await compressImage(file);
          const upload = await apiService.uploadMediaFile(processedFile);
          const previewUrl = file.type?.toLowerCase().startsWith("image/")
            ? URL.createObjectURL(file)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            : (upload as any)?.publicUrl || (upload as any)?.url || null;
          uploads.push({ ...upload, previewUrl });
        }
        if (uploads.length > 0) {
          setSelectedAttachments((prev) => [...prev, ...uploads]);
        }
      } catch (error) {
        console.error("Failed to upload attachments:", error);
        if (error instanceof Error) {
          setAttachmentError(error.message);
        } else {
          setAttachmentError("Failed to upload attachment.");
        }
      } finally {
        setIsAttachmentUploading(false);
      }
    },
    [resolveChatUser]
  );

  const removeAttachment = useCallback(
    (id: number) => {
      setSelectedAttachments((prev) => {
        const next: MediaUpload[] = [];
        prev.forEach((attachment) => {
          if (attachment.id === id) {
            releaseAttachmentPreview(attachment);
            return;
          }
          next.push(attachment);
        });
        return next;
      });
    },
    [releaseAttachmentPreview]
  );

  const clearAttachments = useCallback(() => {
    setSelectedAttachments((prev) => {
      prev.forEach(releaseAttachmentPreview);
      return [];
    });
  }, [releaseAttachmentPreview]);

  useEffect(() => {
    if (workspaceContext !== undefined) {
      setWorkspaceContextValue(workspaceContext ?? null);
    }
  }, [workspaceContext]);

  // Hydrate from local storage on mount
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    // Only load if we haven't already (though this component should only mount once per app life ideally)
    if (hasLoadedFromStorageRef.current && sessions.length > 0) {
      return;
    }

    const { sessions: loadedSessions } = loadStoredSessions(
      buildSessionStorageKeyCandidates(user?.id, user?.email)
    );

    if (loadedSessions.length > 0) {
      setSessions((prev) => {
        // Merge loaded sessions with any that might have been initialized (e.g. general)
        // For simplicity, just use loaded ones but ensure General exists if needed.
        const merged = dedupeSessionsByConversation([...prev, ...loadedSessions]);
        const ordered = normalizeSessionsList(merged);
        return ordered;
      });
    }
    hasLoadedFromStorageRef.current = true;
  }, [user?.id, user?.email]);

  const persistSessions = useCallback((_next: ChatSession[]) => {
    if (typeof window === "undefined") {
      return;
    }
    const keys = buildSessionStorageKeyCandidates(user?.id, user?.email);
    const key = keys[0]; // Use the most specific key (ID + Email, or ID)
    if (!key) {
      return;
    }

    try {
      const serializable = _next.map((session) => ({
        ...session,
        // Don't persist large properties if not needed, but for now we accept full state.
        // We might want to trim messages in the future if quota is an issue.
      }));
      window.localStorage.setItem(key, JSON.stringify(serializable));
    } catch (error) {
      console.warn("Failed to persist sessions to localStorage:", error);
    }
  }, [user?.id, user?.email]);

  useEffect(() => {
    setSessions((prev) => {
      let changed = false;
      const next = prev.map((session) => {
        if (session.scope !== "general") {
          return session;
        }
        const nextConversationId = generalConversationId ?? undefined;
        if (session.conversationId === nextConversationId) {
          return session;
        }
        changed = true;
        return { ...session, conversationId: nextConversationId };
      });
      if (!changed) {
        return prev;
      }
      const ordered = normalizeSessionsList(next);
      persistSessions(ordered);
      return ordered;
    });
  }, [generalConversationId, persistSessions, setSessions]);

  useEffect(() => {
    if (!pendingHistorySyncRef.current.size) {
      return;
    }
    const pending = Array.from(pendingHistorySyncRef.current);
    pending.forEach((sessionId) => {
      const session = sessionsRef.current.find((candidate) => candidate.id === sessionId);
      if (!session) {
        pendingHistorySyncRef.current.delete(sessionId);
        return;
      }
      const normalizedConversationId = normalizeConversationIdValue(session.conversationId ?? undefined);
      if (!normalizedConversationId) {
        return;
      }
      pendingHistorySyncRef.current.delete(sessionId);
      const payload = buildConversationHistoryPayload(session.messages);
      scheduleHistorySync(normalizedConversationId, payload);
    });
  }, [sessions, scheduleHistorySync]);

  const syncConversationTitle = useCallback(
    async (sessionId: string, conversationId: string, title: string) => {
      const trimmed = title.trim();
      const normalizedConversationId = normalizeConversationIdValue(conversationId);
      if (!trimmed || !normalizedConversationId) {
        return;
      }
      if (!user?.id) {
        // Wait until we know the numeric user so the backend can create or update the row.
        return;
      }
      try {
        await apiService.updateConversation(normalizedConversationId, {
          title: trimmed,
          user_id: user.id,
        });
        pendingTitleSyncRef.current.delete(sessionId);
      } catch (error) {
        pendingTitleSyncRef.current.delete(sessionId);
        console.warn(
          "Skipping remote conversation title update (falling back to local title only):",
          error
        );
      }
    },
    [user?.id]
  );

  const queueConversationTitleSync = useCallback(
    (sessionId: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) {
        pendingTitleSyncRef.current.delete(sessionId);
        return;
      }
      pendingTitleSyncRef.current.set(sessionId, trimmed);
      const session = sessionsRef.current.find((candidate) => candidate.id === sessionId);
      const normalizedConversationId = normalizeConversationIdValue(session?.conversationId);
      if (normalizedConversationId) {
        void syncConversationTitle(sessionId, normalizedConversationId, trimmed);
      }
    },
    [syncConversationTitle]
  );

  useEffect(() => {
    pendingTitleSyncRef.current.forEach((title, sessionId) => {
      const session = sessionsRef.current.find((candidate) => candidate.id === sessionId);
      const normalizedConversationId = normalizeConversationIdValue(session?.conversationId);
      if (normalizedConversationId) {
        void syncConversationTitle(sessionId, normalizedConversationId, title);
      }
    });
  }, [sessions, syncConversationTitle]);

  const updateSession = useCallback(
    (sessionId: string, partial: Partial<ChatSession>) => {
      setSessions((prev) => {
        const next = prev.map((session) => {
          if (session.id !== sessionId) {
            return session;
          }
          const normalizedPartial: Partial<ChatSession> = { ...partial };
          if ("conversationId" in partial) {
            // Preserve special General conversation identifiers (`general:{userId}`)
            // while still normalizing regular thread UUIDs.
            normalizedPartial.conversationId =
              coerceConversationIdForRequest(partial.conversationId) ?? undefined;
          }
          return { ...session, ...normalizedPartial };
        });
        const ordered = normalizeSessionsList(next);
        persistSessions(ordered);
        return ordered;
      });
    },
    [persistSessions]
  );

  const applyAutoTitle = useCallback(
    (sessionId: string, candidate?: string | null) => {
      const session = sessionsRef.current.find((entry) => entry.id === sessionId);
      if (!session || session.scope === "general" || session.titleMode === "manual") {
        return;
      }
      const rawTitle = (candidate ?? "").trim();
      if (!rawTitle) {
        return;
      }
      // Only replace placeholder / generic titles so we don't fight manual titles
      // or backend-generated titles that are already set.
      // Use isGenericTitle (same check as shouldRequestAutoTitleForSession) to allow
      // replacing fallback titles derived from user messages.
      if (!isGenericTitle(session.title) && !isTitleDerivedFromMessage(session.title, session.messages)) {
        return;
      }
      if (session.title?.trim() === rawTitle) {
        return;
      }
      updateSession(sessionId, { title: rawTitle, titleMode: "auto", isGeneratingTitle: false });
      queueConversationTitleSync(sessionId, rawTitle);
    },
    [queueConversationTitleSync, updateSession]
  );

  const updateMessage = useCallback(
    (sessionId: string, messageId: string, partial: Partial<ChatMessage>) => {
      let assistantAutoTitle: string | null = null;
      setSessions((prev) => {
        let didUpdate = false;
        const next = prev.map((session) => {
          if (session.id !== sessionId) {
            return session;
          }
          const messages = session.messages.map((message) => {
            if (message.id !== messageId) {
              return message;
            }
            didUpdate = true;
            let nextPartial = partial;
            if (typeof partial.content === "string" && message.role === "assistant") {
              const parsedContent = parseGrayTitleMarkers(partial.content);
              const normalized = normalizeAssistantMessage(message.role, parsedContent.cleanText);
              nextPartial = {
                ...partial,
                content: normalized.content,
              };
              // Prefer explicit reminder payloads passed in the update, then any parsed from the content,
              // then fall back to previously stored reminders to avoid losing the card mid-stream.
              const incomingReminders =
                Array.isArray(partial.reminders) && partial.reminders.length > 0
                  ? partial.reminders
                  : undefined;
              const parsedReminders =
                normalized.reminders && normalized.reminders.length > 0 ? normalized.reminders : undefined;
              const existingReminders =
                message.reminders && message.reminders.length > 0 ? message.reminders : undefined;
              if (incomingReminders || parsedReminders || existingReminders) {
                nextPartial.reminders = incomingReminders ?? parsedReminders ?? existingReminders;
              }

              if (parsedContent.title) {
                assistantAutoTitle = parsedContent.title;
              }
            }
            return { ...message, ...nextPartial };
          });
          if (!didUpdate) {
            return session;
          }
          return {
            ...session,
            messages,
          };
        });
        if (!didUpdate) {
          return prev;
        }
        const ordered = normalizeSessionsList(next);
        persistSessions(ordered);
        return ordered;
      });

      if (assistantAutoTitle) {
        applyAutoTitle(sessionId, assistantAutoTitle);
      }
    },
    [applyAutoTitle, persistSessions]
  );

  // Throttled version of updateMessage for streaming (ensures updates every ~30ms)
  const pendingUpdatesRef = useRef<Map<string, Partial<ChatMessage>>>(new Map());
  const throttledUpdateTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const updateMessageThrottled = useCallback(
    (sessionId: string, messageId: string, partial: Partial<ChatMessage>, throttleMs = 30) => {
      const key = `${sessionId}:${messageId}`;
      pendingUpdatesRef.current.set(key, partial);

      if (throttledUpdateTimeoutsRef.current.has(key)) {
        return;
      }

      const timeout = setTimeout(() => {
        throttledUpdateTimeoutsRef.current.delete(key);
        const latestPartial = pendingUpdatesRef.current.get(key);
        if (latestPartial) {
          updateMessage(sessionId, messageId, latestPartial);
          pendingUpdatesRef.current.delete(key);
        }
      }, throttleMs);

      throttledUpdateTimeoutsRef.current.set(key, timeout);
    },
    [updateMessage]
  );

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      throttledUpdateTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      throttledUpdateTimeoutsRef.current.clear();
    };
  }, []);

  const deleteMessage = useCallback(
    (sessionId: string, messageId: string) => {
      let historyPayload: ConversationHistoryEntryPayload[] | null = null;
      let conversationIdForSync: string | undefined;
      // Prevent auto-stream from firing while we're deleting to avoid extra AI responses.

      setSessions((prev) => {
        let didUpdate = false;
        const next = prev.map((session) => {
          if (session.id !== sessionId) {
            return session;
          }
          const filtered = session.messages.filter((message) => message.id !== messageId);
          if (filtered.length === session.messages.length) {
            return session;
          }
          didUpdate = true;

          // For general sessions, try session.conversationId first, then fall back to generalConversationIdRef
          let normalizedConversationId = coerceConversationIdForRequest(session.conversationId);
          if (!normalizedConversationId && session.scope === "general") {
            normalizedConversationId = coerceConversationIdForRequest(generalConversationIdRef.current);
          }
          const payload = buildConversationHistoryPayload(filtered);

          if (normalizedConversationId) {
            conversationIdForSync = normalizedConversationId;
            historyPayload = payload;
            pendingHistorySyncRef.current.delete(session.id);
          } else if (session.scope === "thread") {
            pendingHistorySyncRef.current.add(session.id);
          }

          return {
            ...session,
            messages: filtered,
            updatedAt: Date.now(),
          };
        });
        if (!didUpdate) {
          return prev;
        }
        const ordered = normalizeSessionsList(next);
        persistSessions(ordered);
        return ordered;
      });

      if (conversationIdForSync && historyPayload) {
        enqueueHistorySync(conversationIdForSync, historyPayload);
      }
    },
    [enqueueHistorySync, persistSessions, user?.id]
  );

  const renameSession = useCallback(
    (sessionId: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) {
        return;
      }
      const target = sessionsRef.current.find((session) => session.id === sessionId);
      if (target?.scope === "general") {
        return;
      }
      const normalized = trimmed.length > 100 ? trimmed.slice(0, 100).trim() : trimmed;
      updateSession(sessionId, {
        title: normalized,
        titleMode: "manual",
        updatedAt: Date.now(),
      });
      queueConversationTitleSync(sessionId, normalized);
    },
    [queueConversationTitleSync, updateSession]
  );

  const pinSession = useCallback(
    async (sessionId: string, pinned: boolean) => {
      const session = sessionsRef.current.find((s) => s.id === sessionId);
      if (!session) return;

      // 1. Update local state
      const currentMeta = session.metadata || {};
      updateSession(sessionId, {
        metadata: { ...currentMeta, is_pinned: pinned },
        updatedAt: Date.now(),
      });

      // 2. Persist to backend if associated with a conversation ID
      const conversationId = normalizeConversationIdValue(session.conversationId);
      if (conversationId) {
        try {
          await apiService.updateConversation(conversationId, {
            metadata: { is_pinned: pinned },
          });
        } catch (err) {
          console.error("Failed to pin session:", err);
        }
      }
    },
    [updateSession]
  );

  const appendMessage = useCallback(
    (
      sessionId: string,
      role: ChatRole,
      content: string,
      tempId?: string,
      metadata?: GroundingMetadata,
      attachments?: MediaUpload[]
    ) => {
      let assistantAutoTitle: string | null = null;
      let normalizedContent = content;
      if (role === "assistant") {
        const parsedContent = parseGrayTitleMarkers(content);
        normalizedContent = parsedContent.cleanText;
        assistantAutoTitle = parsedContent.title;
      }

      // Create the message immediately instead of inside setState
      const createdMessage = makeMessage(role, normalizedContent, tempId, metadata, attachments);

      setSessions((prev) => {
        let didUpdate = false;

        const next = prev.map((session) => {
          if (session.id !== sessionId) {
            return session;
          }

          didUpdate = true;

          return {
            ...session,
            messages: [...session.messages, createdMessage],
            updatedAt: createdMessage.createdAt,
            isResponding: role === "user",
            title: session.title,
          };
        });

        if (didUpdate) {
          const ordered = normalizeSessionsList(next);
          persistSessions(ordered);
          return ordered;
        }

        const fallbackScope = sessionId === GENERAL_SESSION_ID ? "general" : "thread";
        const fallbackSession: ChatSession =
          fallbackScope === "general"
            ? {
              ...createEmptyGeneralSession(createdMessage.createdAt, generalConversationIdRef.current),
              messages: [createdMessage],
              updatedAt: createdMessage.createdAt,
              isResponding: role === "user",
              pendingAutoStream: false,
            }
            : {
              id: sessionId,
              title: "New Chat",
              titleMode: "auto",
              createdAt: createdMessage.createdAt,
              updatedAt: createdMessage.createdAt,
              messages: [createdMessage],
              isResponding: role === "user",
              scope: "thread",
              conversationId: undefined,
              pendingAutoStream: false,
            };

        const ordered = normalizeSessionsList([fallbackSession, ...prev]);
        persistSessions(ordered);
        return ordered;
      });

      if (role === "assistant" && assistantAutoTitle) {
        applyAutoTitle(sessionId, assistantAutoTitle);
      }

      return createdMessage;
    },
    [applyAutoTitle, persistSessions]
  );

  const deleteSession = useCallback(
    (sessionId: string) => {
      const target = sessionsRef.current.find((session) => session.id === sessionId);
      // Skip general sessions
      if (target?.scope === "general") {
        return;
      }

      // For local sessions, do optimistic UI removal
      if (target) {
        // Clear any pending auto-stream for this session so deletion never triggers regeneration.
        resetAutoStreamState(sessionId);

        // Optimistically remove locally so it disappears from history & context immediately.
        setSessions((prev) => {
          const next = prev.filter((session) => session.id !== sessionId);
          const ordered = normalizeSessionsList(next);
          persistSessions(ordered);
          return ordered;
        });
      }

      // Best-effort server-side delete so the conversation is removed from backend context too.
      // Use target.conversationId if available, otherwise fallback to sessionId for old chats.
      const normalizedConversationId = normalizeConversationIdValue(target?.conversationId ?? sessionId);
      if (normalizedConversationId) {
        void (async () => {
          try {
            await apiService.deleteConversation(normalizedConversationId);
          } catch (error) {
            console.error("Failed to delete remote conversation:", error);
          }
        })();
      }
    },
    [persistSessions, resetAutoStreamState]
  );

  const clearAllConversations = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        const keys = buildSessionStorageKeyCandidates(user?.id, user?.email);
        keys.forEach((key) => window.localStorage.removeItem(key));
      } catch {
        // ignore storage failures
      }
    }

    resetAutoStreamState();
    pendingTitleSyncRef.current = new Map();
    pendingThreadSeedsRef.current = new Map();
    setRemoteConversationsLoaded(false);

    setSessions(() => {
      const emptyGeneral = createEmptyGeneralSession(undefined, generalConversationIdRef.current);
      const ordered = normalizeSessionsList([emptyGeneral]);
      persistSessions(ordered);
      return ordered;
    });
  }, [persistSessions, resetAutoStreamState, user?.email, user?.id]);

  const ensureGeneralSession = useCallback((): ChatSession => {
    const existing = sessionsRef.current.find((session) => session.scope === "general");
    if (existing) {
      return existing;
    }
    const created = createEmptyGeneralSession(undefined, generalConversationIdRef.current);
    setSessions((prev) => {
      const next = normalizeSessionsList([created, ...prev]);
      persistSessions(next);
      return next;
    });
    return created;
  }, [persistSessions]);

  const mergeRemoteConversations = useCallback(
    (conversations: ConversationSummary[]) => {
      if (!Array.isArray(conversations) || conversations.length === 0) {
        return;
      }

      const shouldAdoptRemoteTitle = (currentTitle: string | null | undefined, remoteTitle: string) => {
        if (!remoteTitle || !remoteTitle.trim()) {
          return false;
        }
        const normalizedRemote = remoteTitle.trim();
        const normalizedCurrent = (currentTitle ?? "").trim();
        if (!normalizedCurrent) {
          return true;
        }
        if (normalizedCurrent.toLowerCase() === normalizedRemote.toLowerCase()) {
          return false;
        }
        if (normalizedCurrent.toLowerCase() === SHARED_CHAT_PLACEHOLDER_TITLE.toLowerCase()) {
          return true;
        }
        return isGenericTitle(normalizedCurrent);
      };
      setSessions((prev) => {
        let changed = false;
        const next = [...prev];
        const indexById = new Map(next.map((session, index) => [session.id, index]));
        const indexByConversationId = new Map(
          next
            .map((session, index) => [normalizeConversationIdValue(session.conversationId), index] as const)
            .filter(([conversationId]) => typeof conversationId === "string")
        );

        const findExistingIndex = (conversationId: string): number | undefined => {
          if (indexById.has(conversationId)) {
            return indexById.get(conversationId);
          }
          if (indexByConversationId.has(conversationId)) {
            return indexByConversationId.get(conversationId);
          }
          return undefined;
        };

        const findPendingSessionMatch = (targetTimestamp: number): number | undefined => {
          let bestIndex: number | undefined;
          let smallestDiff = REMOTE_SESSION_MERGE_WINDOW_MS + 1;
          next.forEach((session, index) => {
            if (session.scope !== "thread" || session.conversationId) {
              return;
            }
            if (!session.messages.length) {
              return;
            }
            const first = session.messages[0];
            if (!first || first.role !== "user" || !first.content.trim()) {
              return;
            }
            const diff = Math.abs(session.createdAt - targetTimestamp);
            if (diff > REMOTE_SESSION_MERGE_WINDOW_MS || diff >= smallestDiff) {
              return;
            }
            smallestDiff = diff;
            bestIndex = index;
          });
          return bestIndex;
        };

        conversations.forEach((record) => {
          const conversationId = normalizeConversationIdValue(record.id);
          if (!conversationId) {
            return;
          }
          // Skip general conversations - they should not appear as separate threads in the sidebar
          if (isGeneralConversationId(conversationId)) {
            return;
          }
          const normalizedTitle =
            record.title?.trim() && record.title.trim().length > 0 ? record.title.trim() : "New Chat";
          const createdAt = toTimestamp(record.created_at);
          const updatedAt = toTimestamp(record.updated_at ?? record.created_at);
          const existingIndex = findExistingIndex(conversationId);

          if (typeof existingIndex === "number") {
            const current = next[existingIndex];
            const adoptRemoteTitle = shouldAdoptRemoteTitle(current.title, normalizedTitle);
            const merged: ChatSession = {
              ...current,
              createdAt: Math.min(current.createdAt, createdAt),
              updatedAt: Math.max(current.updatedAt, updatedAt),
              conversationId,
              ...(adoptRemoteTitle
                ? {
                  title: normalizedTitle,
                  titleMode: isGenericTitle(normalizedTitle) ? "auto" : "manual",
                }
                : {}),
            };
            if (
              merged.title !== current.title ||
              merged.updatedAt !== current.updatedAt ||
              merged.conversationId !== current.conversationId ||
              merged.createdAt !== current.createdAt
            ) {
              next[existingIndex] = merged;
              changed = true;
            }
            return;
          }

          const pendingIndex = findPendingSessionMatch(createdAt);
          if (typeof pendingIndex === "number") {
            const pending = next[pendingIndex];
            const adoptRemoteTitle = shouldAdoptRemoteTitle(pending.title, normalizedTitle);
            const merged: ChatSession = {
              ...pending,
              createdAt: Math.min(pending.createdAt, createdAt),
              updatedAt: Math.max(pending.updatedAt, updatedAt),
              conversationId,
              pendingAutoStream: false,
              ...(adoptRemoteTitle
                ? {
                  title: normalizedTitle,
                  titleMode: isGenericTitle(normalizedTitle) ? "auto" : "manual",
                }
                : {}),
            };
            next[pendingIndex] = merged;
            indexByConversationId.set(conversationId, pendingIndex);
            changed = true;
            return;
          }

          const newSession: ChatSession = {
            id: conversationId,
            title: normalizedTitle,
            titleMode: isGenericTitle(normalizedTitle) ? "auto" : "manual",
            createdAt,
            updatedAt,
            messages: [],
            isResponding: false,
            scope: "thread",
            conversationId,
            pendingAutoStream: false,
          };
          next.push(newSession);
          indexById.set(conversationId, next.length - 1);
          indexByConversationId.set(conversationId, next.length - 1);
          changed = true;
        });

        if (!changed) {
          return prev;
        }

        const deduped: ChatSession[] = [];
        const seenConversationIds = new Map<string, number>();

        next.forEach((session) => {
          const conversationId = normalizeConversationIdValue(session.conversationId);
          if (!conversationId) {
            deduped.push(session);
            return;
          }
          const existingIndex = seenConversationIds.get(conversationId);
          if (typeof existingIndex === "number") {
            const existing = deduped[existingIndex];
            const currentScore = session.messages.length;
            const existingScore = existing.messages.length;
            const shouldReplace =
              currentScore > existingScore ||
              (currentScore === existingScore && session.updatedAt > existing.updatedAt);
            if (shouldReplace) {
              deduped[existingIndex] = session;
            }
            changed = true;
            return;
          }
          seenConversationIds.set(conversationId, deduped.length);
          deduped.push(session);
        });

        const ordered = normalizeSessionsList(deduped);
        persistSessions(ordered);
        return ordered;
      });
    },
    [persistSessions]
  );

  useEffect(() => {
    setRemoteConversationsLoaded(false);
    if (!user?.id) {
      return;
    }
    let cancelled = false;
    const loadRemoteConversations = async () => {
      try {
        const records = await apiService.listUserConversations(user.id, 200);
        if (cancelled || !records) {
          return;
        }
        mergeRemoteConversations(records);
      } catch (error) {
        console.error("Failed to load remote conversations:", error);
      } finally {
        if (!cancelled) {
          setRemoteConversationsLoaded(true);
        }
      }
    };
    void loadRemoteConversations();
    return () => {
      cancelled = true;
      setRemoteConversationsLoaded(false);
    };
  }, [user?.id, mergeRemoteConversations]);

  // Ref to break forward reference to sendGeneralMessage (defined later)
  // This avoids a Temporal Dead Zone error in the bundled output.
  const sendGeneralMessageRef = useRef<(content: string) => Promise<string>>(() => Promise.resolve(""));

  const createThreadSession = useCallback(
    async (
      initialMessage?: string,
      options?: {
        autoStream?: boolean;
        fromGeneral?: boolean;
      }
    ): Promise<ChatSession> => {
      // If this invocation is coming from the General entrypoint, do not create
      // a new thread session. Reuse the General session instead so that messages
      // sent from "General" always belong to the General conversation.
      if (options?.fromGeneral) {
        // console.log("[ChatProvider] createThreadSession: fromGeneral=true, returning general session");
        const general = ensureGeneralSession();
        // If there's an initial message, send it via the general path so it
        // streams correctly and binds to the existing conversation_id.
        if ((initialMessage ?? "").trim().length > 0) {
          void sendGeneralMessageRef.current(initialMessage ?? "");
        }
        return general;
      }

      const now = Date.now();
      const trimmedInitial = (initialMessage ?? "").trim();
      const normalizedInitial = trimmedInitial.toLowerCase();
      const shouldAutoStream = options?.autoStream !== false;
      // Duplicate detection removed to ensure fresh sessions


      const sessionId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2);
      const fallbackTitle = "New Chat";
      const willAutoStream = shouldAutoStream && trimmedInitial.length > 0;

      const baseSession: ChatSession = {
        id: sessionId,
        title: fallbackTitle,
        titleMode: "auto",
        createdAt: now,
        updatedAt: now,
        messages: [],
        // Let ChatView handle turning on isResponding when it actually
        // starts the stream, so we don't double-stream the first reply.
        isResponding: false,
        scope: "thread",
        conversationId: sessionId,
        pendingAutoStream: willAutoStream,
        // Show skeleton while title generates in background
        isGeneratingTitle: willAutoStream,
      };

      // console.log("[ChatProvider] createThreadSession: Created new session", { sessionId, willAutoStream });

      if (normalizedInitial) {
        pendingThreadSeedsRef.current.set(normalizedInitial, { sessionId, createdAt: now });
        schedulePendingSeedCleanup(normalizedInitial, sessionId);
      }

      if (trimmedInitial) {
        const userMessage = makeMessage("user", trimmedInitial);
        baseSession.messages = [userMessage];
        baseSession.updatedAt = userMessage.createdAt;
      }

      setSessions((prev) => {
        const general = prev.find((session) => session.scope === "general");
        const others = prev.filter((session) => !(general && session.id === general.id));
        const next = general ? [general, baseSession, ...others] : [baseSession, ...others];
        const ordered = normalizeSessionsList(next);
        persistSessions(ordered);
        return ordered;
      });

      queueConversationTitleSync(sessionId, fallbackTitle);

      return baseSession;
    },
    [
      appendMessage,
      persistSessions,
      updateMessage,
      updateMessageThrottled,
      updateSession,
      resolveChatUser,
      workspaceContextValue,
      queueConversationTitleSync,
      applyAutoTitle,
      schedulePendingSeedCleanup,
      personalizedSystemPrompt,
      markAutoStreamTriggered,

      promptForLocationConsent,
      shouldAttachWorkspaceContextForSession,
      webSearchEnabled,
      ensureGeneralSession
    ]
  );

  const startQuestionnaire = useCallback((_mode: "quick" | "deep") => {
    // Premade questionnaire messaging has been retired; keep state reset.
    setQuestionnaireSession(null);
  }, []);

  const cancelQuestionnaire = useCallback(() => {
    setQuestionnaireSession(null);
  }, []);

  const handleQuestionnaireResponse = useCallback(
    async (content: string, session: QuestionnaireSession) => {
      const generalSession = ensureGeneralSession();
      const trimmed = content.trim();

      // 1. Append user message
      appendMessage(generalSession.id, "user", trimmed);
      updateSession(generalSession.id, { isResponding: true });

      // 2. Process response
      // For now, we just move to the next question in the quick list
      // In a real implementation, we would use the Python logic (evaluateSmartGoal, etc.)
      // and potentially call the LLM for "deep" mode.

      const nextSession = { ...session };
      let responseText = "";

      if (session.phase === "foundation") {
        const currentQ = session.quickQuestions[session.step];
        if (currentQ) {
          nextSession.foundationAnswers[currentQ.key] = trimmed;
          nextSession.step += 1;
        }

        const nextQ = session.quickQuestions[nextSession.step];
        if (nextQ) {
          responseText = nextQ.prompt;
          if (nextQ.clarification) {
            responseText += `\n\n_${nextQ.clarification}_`;
          }
        } else {
          // End of foundation
          nextSession.phase = "personalized"; // or 'complete'
          responseText = "Thanks! I've got the basics. I've updated your profile with this information.";

          // Synthesize and save profile
          const answers = nextSession.foundationAnswers;
          const aboutParts: string[] = [];
          if (answers.goals) aboutParts.push(`Goals: ${answers.goals}`);
          if (answers.wins) aboutParts.push(`Wins: ${answers.wins}`);
          if (answers.obstacles) aboutParts.push(`Obstacles: ${answers.obstacles}`);

          const updatePayload = {
            personalization_nickname: answers.name || null,
            personalization_occupation: answers.focus || null,
            personalization_about: aboutParts.length > 0 ? aboutParts.join('\n\n') : null,
            // NOTE: Do NOT save custom_instructions from onboarding - this should only be set
            // manually by the user in Settings. The AI should not auto-generate response guidelines.
            has_seen_general_chat: true, // Mark as seen so we don't trigger again
          };

          // Fire and forget update, or await if we want to be sure
          void updateUser(updatePayload).catch(err => console.error("Failed to save questionnaire profile:", err));

          setQuestionnaireSession(null); // End it for now
        }
      }

      if (responseText) {
        setTimeout(() => {
          appendMessage(generalSession.id, "assistant", responseText);
          updateSession(generalSession.id, { isResponding: false });
        }, 500);
      } else {
        updateSession(generalSession.id, { isResponding: false });
      }

      if (nextSession.phase !== "personalized") { // If not finished
        setQuestionnaireSession(nextSession);
      }
    },
    [appendMessage, ensureGeneralSession, updateSession]
  );

  const sendGeneralMessage = useCallback(
    async (content: string): Promise<string> => {
      // Check if questionnaire is active
      if (questionnaireSession) {
        await handleQuestionnaireResponse(content, questionnaireSession);
        return ensureGeneralSession().id;
      }


      const trimmed = content.trim();
      const generalSession = ensureGeneralSession();

      // Prevent overlapping general streams (e.g., onboarding auto-trigger + manual submit).
      if (!trimmed && generalSession.isResponding) {
        return generalSession.id;
      }
      if (!trimmed) {
        // Avoid triggering the onboarding kick-off twice while the intro overlay is finishing
        if (onboardingKickoffRef.current) {
          return generalSession.id;
        }
        onboardingKickoffRef.current = true;
      }
      const isGeneralScope = generalSession.scope === "general";
      const resolvedGeneralConversationId =
        coerceConversationIdForRequest(generalSession.conversationId) ??
        coerceConversationIdForRequest(generalConversationIdRef.current);
      let requestConversationId = resolvedGeneralConversationId;

      // Allow empty message only if it's the start of a session (e.g. onboarding trigger)
      if (!trimmed && generalSession.messages.length > 0) {
        void markHasSeenGeneralChat();
        return generalSession.id;
      }

      const attachmentPayloads = attachmentsRef.current.map((attachment) => ({
        id: attachment.id,
      }));

      // Create a temp message ID to prevent duplicate auto-streaming
      const tempUserMessageId = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);

      // Mark this message as already triggered for auto-streaming BEFORE appending
      // This prevents the auto-stream effect from racing with our own streaming
      markAutoStreamTriggered(generalSession.id, tempUserMessageId);

      // 1) Optimistically append user message immediately with the temp ID
      const userMessage = appendMessage(
        generalSession.id,
        "user",
        trimmed,
        tempUserMessageId,
        undefined,
        attachmentsRef.current.length > 0 ? [...attachmentsRef.current] : undefined
      );
      clearAttachments();
      // 2) Immediately insert an empty assistant message so UI shows instant response start.
      let assistantMessageId: string | null = null;
      const initialAssistant = appendMessage(generalSession.id, "assistant", "");
      assistantMessageId = (initialAssistant as ChatMessage | null)?.id ?? null;

      updateSession(generalSession.id, {
        isResponding: true,
        updatedAt: Date.now(),
      });

      // 3) Wait for the authenticated user so the first streamed reply connects properly.
      const resolvedUser = await resolveChatUser();
      if (resolvedUser && !requestConversationId) {
        requestConversationId = buildGeneralConversationId(resolvedUser.id);
      }

      if (!resolvedUser) {
        const fallback = buildAssistantReply(trimmed);
        if (assistantMessageId) {
          updateMessage(generalSession.id, assistantMessageId, { content: fallback });
        } else {
          appendMessage(generalSession.id, "assistant", fallback);
        }
        updateSession(generalSession.id, { isResponding: false, pendingAutoStream: false });
        return generalSession.id;
      }

      let streamedConversationId: string | null = requestConversationId ?? null;

      const includeWorkspaceContext = shouldAttachWorkspaceContextForSession(
        generalSession.id,
        trimmed
      );
      const contextPayload = includeWorkspaceContext ? workspaceContextValue ?? undefined : undefined;
      const shouldUseWebSearch = webSearchEnabled;

      const streamGeneralResponse = () => {
        (async () => {
          let accumulated = "";
          let capturedReminders: unknown[] = [];
          let didReceiveToken = false;
          const streamingUserId = resolvedUser.id;
          try {
            const timeContext = buildLocalTimeContext();
            // const autoMapPayload = buildAutoMapPayload(trimmed); // Removed

            // Only include full profile when it changes or on first message
            const currentProfileHash = computeProfileHash(resolvedUser);
            const isFirstMessage = generalSession.messages.length <= 1;
            const profileChanged = currentProfileHash !== lastSentProfileHashRef.current;
            const shouldIncludeFullProfile = isFirstMessage || profileChanged;

            const systemPromptForRequest = buildPersonalizedSystemPrompt(
              resolvedUser,
              defaultSystemPrompt,
              shouldIncludeFullProfile
            );

            // Update the ref so subsequent messages know the profile was sent
            if (shouldIncludeFullProfile) {
              lastSentProfileHashRef.current = currentProfileHash;
            }

            // Start tracking reasoning time if reasoning mode is enabled
            if (reasoningMode) {
              reasoningStartTimeRef.current = Date.now();
            }

            const shouldGenerateTitle = shouldRequestAutoTitleForSession(generalSession);
            if (shouldGenerateTitle) {
              updateSession(generalSession.id, { isGeneratingTitle: true });
            }

            const conversationMemoryEnabled = (() => {
              if (typeof window === "undefined") {
                return true;
              }
              const storageKey = `${CONVERSATION_MEMORY_STORAGE_PREFIX}:${streamingUserId ?? "anon"}`;
              try {
                return window.localStorage.getItem(storageKey) !== "0";
              } catch {
                return true;
              }
            })();

            for await (const event of apiService.sendMessageStream({
              message: trimmed,
              system_prompt: systemPromptForRequest,
              user_id: streamingUserId,
              context: contextPayload,
              conversation_id: requestConversationId ?? undefined,
              time_context: timeContext,
              timezone: resolveClientTimezone(),
              conversation_memory_enabled: conversationMemoryEnabled,
              attachments: attachmentPayloads,
              context_cache_id: selectedContextCacheId ?? undefined,
              should_generate_title: shouldGenerateTitle,
              web_search_enabled: shouldUseWebSearch,
              ...mapPayload,
              reasoning_mode: reasoningMode,
              reminders_enabled: remindersEnabled,
              model: selectedModelId ?? modelTier,
            })) {
              if (event.type === "token") {
                const delta = event.delta;
                accumulated = accumulated && delta.startsWith(accumulated)
                  ? delta
                  : accumulated + delta;
                const extraction = extractGrayRemindersFromText(accumulated);
                const content = extraction.cleanText;
                if (assistantMessageId) {
                  const updates: Partial<ChatMessage> = { content: accumulated };
                  // Persist reasoning duration on first token update
                  if (!didReceiveToken && reasoningStartTimeRef.current) {
                    const elapsed = (Date.now() - reasoningStartTimeRef.current) / 1000;
                    // setReasoningSeconds(elapsed); // This line is likely for a local state, not directly in message update
                    reasoningStartTimeRef.current = null; // Clear it after first token
                    updates.reasoningSeconds = elapsed;
                    didReceiveToken = true;
                  }
                  updateMessage(generalSession.id, assistantMessageId, updates);
                }
                continue;
              }

              if (event.type === "reminders") {
                // Capture structured reminders sent via SSE
                if (Array.isArray(event.reminders) && event.reminders.length > 0) {
                  capturedReminders = event.reminders;
                }
                continue;
              }

              if (event.type === "end") {
                streamedConversationId =
                  coerceConversationIdForRequest(event.conversationId) ?? streamedConversationId;
                const finalResponse = normalizeAssistantContent(event.response ?? accumulated, trimmed);
                const content = finalResponse;
                const metadata = event.groundingMetadata ?? undefined;
                const timingUpdate = event.timing ? { backendTimings: event.timing } : undefined;

                // Process reminders: prefer SSE-sent reminders, fallback to text extraction
                let finalReminders: GrayReminderCreatedPayload[] | undefined;
                if (capturedReminders.length > 0) {
                  // Use structured reminders sent via SSE; coerce legacy shapes too.
                  finalReminders = capturedReminders
                    .map((r) => coerceReminderPayload(r))
                    .filter((r): r is GrayReminderCreatedPayload => Boolean(r));
                } else {
                  // Fallback: extract reminders from text (backward compatibility)
                  const extracted = extractGrayRemindersFromText(content);
                  if (extracted.reminders.length > 0) {
                    finalReminders = extracted.reminders;
                  }
                }

                // If we have reminders but no text, generate a friendly confirmation message
                let finalContent = content;
                if (finalReminders && finalReminders.length > 0 && !content.trim()) {
                  const confirmationText = buildReminderConfirmationText(finalReminders);
                  if (confirmationText) {
                    finalContent = confirmationText;
                  }
                }

                const finalMessageUpdates: Partial<ChatMessage> = {
                  content: finalContent,
                  groundingMetadata: metadata,
                  reminders: finalReminders,
                  ...(timingUpdate ?? {}),
                };

                // If reasoningSeconds was not set on first token (e.g., very fast response), set it now
                if (!didReceiveToken && reasoningStartTimeRef.current) {
                  const elapsed = (Date.now() - reasoningStartTimeRef.current) / 1000;
                  finalMessageUpdates.reasoningSeconds = elapsed;
                }

                if (assistantMessageId) {
                  updateMessage(generalSession.id, assistantMessageId, finalMessageUpdates);
                } else {
                  const assistantMessage = appendMessage(
                    generalSession.id,
                    "assistant",
                    content,
                    undefined,
                    metadata
                  );
                  assistantMessageId = (assistantMessage as ChatMessage | null)?.id ?? null;
                  if (assistantMessageId && timingUpdate) {
                    updateMessage(generalSession.id, assistantMessageId, timingUpdate);
                  }
                }

                updateSession(generalSession.id, {
                  conversationId: streamedConversationId ?? resolvedGeneralConversationId ?? undefined,
                  isResponding: false,
                  pendingAutoStream: false,
                  isGeneratingTitle: false,
                });
                void markHasSeenGeneralChat();
                clearAttachments();
                if (!isGeneralScope && event.title) {
                  applyAutoTitle(generalSession.id, event.title);
                }
                return generalSession.id;
              }

              if (event.type === "error") {
                throw new Error(event.message);
              }
            }

            const finalFallback = normalizeAssistantContent(accumulated, trimmed);
            if (assistantMessageId) {
              updateMessage(generalSession.id, assistantMessageId, { content: finalFallback });
            } else {
              const assistantMessage = appendMessage(generalSession.id, "assistant", finalFallback);
              assistantMessageId = (assistantMessage as ChatMessage | null)?.id ?? null;
            }
            updateSession(generalSession.id, {
              conversationId: streamedConversationId ?? resolvedGeneralConversationId ?? undefined,
              isResponding: false,
              pendingAutoStream: false,
              isGeneratingTitle: false,
            });
          } catch (error) {
            console.error("Failed to send general message:", error);
            const fallback = buildAssistantErrorReply(error);
            if (assistantMessageId) {
              updateMessage(generalSession.id, assistantMessageId, { content: fallback });
            } else {
              appendMessage(generalSession.id, "assistant", fallback);
            }
            updateSession(generalSession.id, {
              conversationId: streamedConversationId ?? resolvedGeneralConversationId ?? undefined,
              isResponding: false,
              pendingAutoStream: false,
              isGeneratingTitle: false,
            });
            clearAttachments();
          } finally {
            endSearchTracking();
            void markHasSeenGeneralChat();
            // Keep the local user profile in sync with any onboarding/profile tools
            // that may have run during this message (e.g., complete_onboarding).
            void refreshUser();
            // Safety net: ensure isResponding is always reset
            updateSession(generalSession.id, { isResponding: false, pendingAutoStream: false });
          }
          clearAttachments();
        })();
      };

      if (!promptForLocationConsent(trimmed, streamGeneralResponse)) {
        return generalSession.id;
      }

      return generalSession.id;
    },
    [
      appendMessage,
      ensureGeneralSession,
      updateMessage,
      updateSession,
      resolveChatUser,
      workspaceContextValue,
      personalizedSystemPrompt,
      applyAutoTitle,
      clearAttachments,
      mapPayload, // Replaced buildAutoMapPayload
      promptForLocationConsent,
      selectedContextCacheId,
      shouldAttachWorkspaceContextForSession,
      webSearchEnabled,
      reasoningMode, // Added
      remindersEnabled, // Added
      markHasSeenGeneralChat,
      refreshUser,
      modelTier,
      defaultSystemPrompt,
      questionnaireSession,
      handleQuestionnaireResponse,
      endSearchTracking,
    ]
  );

  // Keep the ref in sync with the actual sendGeneralMessage function
  useEffect(() => {
    sendGeneralMessageRef.current = sendGeneralMessage;
  }, [sendGeneralMessage]);

  const getSession = useCallback((sessionId: string) => {
    return sessionsRef.current.find((session) => session.id === sessionId);
  }, []);

  const ensureSession = useCallback(
    (sessionId: string, initializer: () => ChatSession): ChatSession => {
      const existing = sessionsRef.current.find((session) => session.id === sessionId);
      if (existing) {
        return existing;
      }

      const now = Date.now();
      const raw = initializer() ?? ({} as ChatSession);
      const normalizedScope: ChatSessionScope =
        raw.scope === "general" ? "general" : "thread";
      const normalized: ChatSession = {
        id: sessionId,
        title:
          normalizedScope === "general"
            ? GENERAL_SESSION_TITLE
            : typeof raw.title === "string" && raw.title.trim().length > 0
              ? raw.title.trim()
              : "New Chat",
        titleMode:
          normalizedScope === "general"
            ? "manual"
            : (raw.titleMode as ChatTitleMode) === "manual"
              ? "manual"
              : "auto",
        createdAt: typeof raw.createdAt === "number" ? raw.createdAt : now,
        updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : now,
        messages: Array.isArray(raw.messages)
          ? raw.messages.map((message) => ({
            ...message,
          }))
          : [],
        isResponding: Boolean(raw.isResponding),
        scope: normalizedScope,
        conversationId: normalizeConversationIdValue(raw.conversationId),
        pendingAutoStream: Boolean(raw.pendingAutoStream),
      };

      setSessions((prev) => {
        const alreadyExists = prev.some((session) => session.id === sessionId);
        if (alreadyExists) {
          return prev;
        }
        const general = prev.find((session) => session.scope === "general");
        const others = prev.filter((session) => !(general && session.id === general.id));
        const next = general ? [general, normalized, ...others] : [normalized, ...others];
        const ordered = normalizeSessionsList(next);
        persistSessions(ordered);
        return ordered;
      });

      return normalized;
    },
    [persistSessions]
  );

  const generalSessionId = useMemo(() => {
    const general = sessions.find((session) => session.scope === "general");
    return general?.id ?? null;
  }, [sessions]);

  const generalGreetingRef = useRef(false);
  const generalHistoryHydratedRef = useRef(false);
  const pathname = usePathname();

  const loadConversationMessages = useCallback(
    async (sessionId: string) => {
      const session = sessionsRef.current.find((s) => s.id === sessionId);
      if (!session || !session.conversationId) {
        return;
      }
      if (session.messages.length > 0) {
        return;
      }

      try {
        const history = await apiService.getConversation(session.conversationId);
        if (!Array.isArray(history) || history.length === 0) {
          return;
        }

        const now = Date.now();
        const mapped = mapApiMessagesToChatMessages(history, session.conversationId, now);

        if (!mapped.length) {
          return;
        }

        setSessions((prev) => {
          const index = prev.findIndex((s) => s.id === sessionId);
          if (index === -1) {
            return prev;
          }
          const current = prev[index];
          // Double check to avoid race conditions
          if (current.messages && current.messages.length > 0) {
            return prev;
          }
          const updated: ChatSession = {
            ...current,
            messages: mapped,
            // We don't update updatedAt here to avoid jumping it to the top of the list
            isResponding: false,
          };
          const next = [...prev];
          next[index] = updated;
          const ordered = normalizeSessionsList(next);
          persistSessions(ordered);
          return ordered;
        });
      } catch (error) {
        console.error("Failed to load conversation messages:", error);
      }
    },
    [persistSessions, setSessions]
  );

  // Hydrate the General workspace (`/g`) from Supabase-backed history so that
  // existing `general_chat_messages` rows render as the canonical General chat.
  useEffect(() => {
    const general = sessionsRef.current.find((session) => session.scope === "general");
    const generalHasMessages = Boolean(general?.messages && general.messages.length > 0);

    // Reset hydration flag if we're on /g but the session has no messages
    // This handles page refreshes where the session state is lost
    if (pathname === "/g" && !generalHasMessages) {
      generalHistoryHydratedRef.current = false;
    }

    if (!general || !user?.id || pathname !== "/g" || generalHistoryHydratedRef.current || generalHasMessages) {
      return;
    }

    let cancelled = false;

    const hydrateGeneralHistory = async () => {
      const generalConversationId = buildGeneralConversationId(user.id);
      if (!generalConversationId) {
        return;
      }
      try {
        const history = await apiService.getConversation(generalConversationId);
        if (cancelled || !Array.isArray(history) || history.length === 0) {
          return;
        }

        const now = Date.now();
        const mapped = mapApiMessagesToChatMessages(history, generalConversationId, now);

        if (!mapped.length) {
          return;
        }

        // Mark as synced immediately to prevent the sync effect from pushing
        // this authoritative history back to the server, which can cause
        // message duplication if the backend's replace logic is non-atomic.
        syncedHistoryRef.current.add(generalConversationId);

        setSessions((prev) => {
          const index = prev.findIndex((session) => session.scope === "general");
          if (index === -1) {
            return prev;
          }
          const current = prev[index];
          if (current.messages && current.messages.length > 0) {
            return prev;
          }
          const updated: ChatSession = {
            ...current,
            conversationId: generalConversationId,
            messages: mapped,
            updatedAt: now,
            isResponding: false,
          };
          const next = [...prev];
          next[index] = updated;
          const ordered = normalizeSessionsList(next);
          persistSessions(ordered);
          return ordered;
        });
        generalHistoryHydratedRef.current = true;
      } catch (error) {
        console.error("Failed to load general conversation history:", error);
      }
    };

    void hydrateGeneralHistory();
    return () => {
      cancelled = true;
    };
  }, [pathname, persistSessions, setSessions, user?.id]);

  useEffect(() => {
    const general = sessionsRef.current.find((session) => session.scope === "general");
    const generalHasMessages = Boolean(general?.messages && general.messages.length > 0);
    if (!general || !user?.id || pathname !== "/g") {
      return;
    }

    // Only show the intro overlay when the user clearly needs onboarding:
    // missing any personalization fields and has not completed general chat.
    const needsOnboarding =
      !user.personalization_nickname ||
      !user.personalization_occupation ||
      !user.personalization_about;

    if (
      generalGreetingRef.current ||
      generalHasMessages ||
      !needsOnboarding ||
      user.has_seen_general_chat
    ) {
      return;
    }

    generalGreetingRef.current = true;
    setShowIntro(true);
  }, [
    pathname,
    user?.id,
    user?.has_seen_general_chat,
    user?.personalization_nickname,
    user?.personalization_occupation,
    user?.personalization_about,
  ]);



  useEffect(() => {
    if (!user?.id || !generalSessionId) {
      reminderDeliveryCacheRef.current.clear();
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const computeNextReminderPollDelay = (candidates: Reminder[]): number => {
      if (!candidates.length) {
        return REMINDER_POLL_MIN_INTERVAL;
      }
      const now = Date.now();
      const delays = candidates
        .map((reminder) => {
          const remindAt = new Date(reminder.remind_at).getTime();
          if (!Number.isFinite(remindAt)) {
            return null;
          }
          return remindAt - now;
        })
        .filter((candidate): candidate is number => candidate !== null);
      if (!delays.length) {
        return REMINDER_POLL_MIN_INTERVAL;
      }
      const soonest = Math.min(...delays);
      if (soonest <= 0) {
        return REMINDER_POLL_SHORT_INTERVAL;
      }
      return Math.min(soonest, REMINDER_POLL_MIN_INTERVAL);
    };

    const pollDueReminders = async () => {
      if (cancelled || !user?.id || !generalSessionId) {
        return;
      }
      let fetchedReminders: Reminder[] = [];
      try {
        const reminders = await apiService.getUserReminders(user.id, { status: "pending", limit: 50 });
        fetchedReminders = reminders;
        const now = Date.now();
        for (const reminder of reminders) {
          if (!reminder.id) {
            continue;
          }
          const remindAt = new Date(reminder.remind_at).getTime();
          if (!Number.isFinite(remindAt) || remindAt > now) {
            continue;
          }
          if (reminderDeliveryCacheRef.current.has(reminder.id)) {
            continue;
          }
          reminderDeliveryCacheRef.current.add(reminder.id);

          // Client-side stale check: If > 15 mins late, mark delivered but don't nag.
          // This protects against backend returning old pending items.
          const isStale = (now - remindAt) > (15 * 60 * 1000);

          if (!isStale) {
            appendMessage(generalSessionId, "assistant", buildReminderPingMessage(reminder));
            sendReminderNotification(reminder);
          }

          try {
            await apiService.updateReminder(user.id, reminder.id, { status: "delivered" });
          } catch (updateError) {
            console.error("Failed to update reminder status:", updateError);
          }
        }
      } catch (error) {
        // Soft-handle network/unavailable backend errors to avoid noisy logs
        const isNetworkish =
          isApiNetworkError(error) ||
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (error instanceof Error && "status" in error && typeof (error as any).status === "number" && (error as any).status >= 500);
        if (isNetworkish) {
          if (process.env.NODE_ENV !== "production") {
            console.debug("Skipping reminder poll; backend unavailable.", error);
          }
        } else {
          console.error("Failed to poll reminders:", error);
        }
      } finally {
        if (!cancelled) {
          const nextDelay = computeNextReminderPollDelay(fetchedReminders);
          timeoutId = setTimeout(pollDueReminders, nextDelay);
        }
      }
    };

    pollDueReminders();
    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [appendMessage, generalSessionId, user?.id]);

  const value = useMemo(
    () => ({
      sessions,
      createThreadSession,
      sendGeneralMessage,
      appendMessage,
      updateMessage,
      deleteMessage,
      updateSession,
      renameSession,
      pinSession,
      applyAutoTitle,
      deleteSession,
      clearAllConversations,
      getSession,
      ensureSession,
      generalSessionId,
      workspaceContext: workspaceContextValue,
      setWorkspaceContext: setWorkspaceContextValue,
      hasAutoStreamTriggered,
      markAutoStreamTriggered,
      resetAutoStreamState,
      markHasSeenGeneralChat,
      personalizedSystemPrompt,
      attachments: selectedAttachments,
      isAttachmentUploading,
      attachmentError,
      uploadAttachments,
      removeAttachment,
      clearAttachments,
      mapsEnabled,
      mapsWidgetEnabled,
      mapsLatitude,
      mapsLongitude,
      setMapsEnabled,
      setMapsWidgetEnabled,
      setMapsLatitude,
      setMapsLongitude,
      toggleMapsEnabled,
      toggleWebSearchEnabled,
      remindersEnabled,
      toggleRemindersEnabled,
      mapPayload,
      pendingLocationRequestMessage: null,
      isHandlingLocationRequest: false,
      requestLocationShare,
      skipLocationShare,
      // Context Cache
      contextCaches,
      contextCacheLabel,
      contextCacheContent,
      selectedContextCacheId,
      contextCacheMessage,
      isContextCacheSaving,
      createContextCache,
      selectContextCacheId: setSelectedContextCacheId,
      setContextCacheLabel,
      setContextCacheContent,
      // Web Search (with toggles above)
      webSearchEnabled,
      setWebSearchEnabled,
      // File Search / Stores
      fileSearchStores,
      fileSearchDisplayName,
      setFileSearchDisplayName,
      fileSearchStatus,
      isCreatingFileSearchStore,
      handleCreateFileSearchStore,
      selectedFileSearchStore,
      setSelectedFileSearchStore,
      fileSearchUploadFile,
      setFileSearchUploadFile,
      fileSearchUploadStatus,
      handleFileSearchUpload,
      fileSearchChunking,
      setFileSearchChunking,
      fileSearchImportName,
      setFileSearchImportName,
      fileSearchImportStatus,
      handleFileSearchImport,
      fileSearchUploadInputRef,
      loadConversationMessages,
      reasoningMode,
      setReasoningMode,
      modelTier,
      setModelTier,
      selectedModelId,
      setSelectedModelId: handleSetSelectedModelId,
      visibleModelIds,
      setVisibleModelIds,
      questionnaireSession,
      startQuestionnaire,
      cancelQuestionnaire,
      remoteConversationsLoaded,
    }),
    [
      appendMessage,
      createThreadSession,
      clearAllConversations,
      deleteSession,
      generalSessionId,
      getSession,
      deleteMessage,
      sendGeneralMessage,
      updateMessage,
      renameSession,
      applyAutoTitle,
      ensureSession,
      sessions,
      updateSession,
      workspaceContextValue,
      hasAutoStreamTriggered,
      markAutoStreamTriggered,
      resetAutoStreamState,
      markHasSeenGeneralChat,
      personalizedSystemPrompt,
      selectedAttachments,
      isAttachmentUploading,
      attachmentError,
      uploadAttachments,
      removeAttachment,
      clearAttachments,
      mapsEnabled,
      mapsWidgetEnabled,
      mapsLatitude,
      mapsLongitude,
      setMapsEnabled,
      setMapsWidgetEnabled,
      setMapsLatitude,
      setMapsLongitude,
      mapPayload,
      pendingLocationRequestMessage,
      isHandlingLocationRequest,
      requestLocationShare,
      skipLocationShare,
      contextCaches,
      contextCacheLabel,
      contextCacheContent,
      selectedContextCacheId,
      contextCacheMessage,
      isContextCacheSaving,
      createContextCache,
      selectContextCacheId,
      setContextCacheLabel,
      setContextCacheContent,
      webSearchEnabled,
      setWebSearchEnabled,
      fileSearchStores,
      fileSearchDisplayName,
      setFileSearchDisplayName,
      fileSearchStatus,
      isCreatingFileSearchStore,
      handleCreateFileSearchStore,
      selectedFileSearchStore,
      setSelectedFileSearchStore,
      fileSearchUploadFile,
      setFileSearchUploadFile,
      fileSearchUploadStatus,
      handleFileSearchUpload,
      fileSearchChunking,
      setFileSearchChunking,
      fileSearchImportName,
      setFileSearchImportName,
      fileSearchImportStatus,
      handleFileSearchImport,
      fileSearchUploadInputRef,
      fileSearchUploadInputRef,
      loadConversationMessages,
      reasoningMode,
      setReasoningMode,
      modelTier,
      setModelTier,
      selectedModelId,
      handleSetSelectedModelId,
      visibleModelIds,
      setVisibleModelIds,
      pinSession,
    ]
  );

  useEffect(() => {
    if (!hasLoadedFromStorageRef.current) {
      return;
    }
    persistSessions(sessions);
  }, [persistSessions, sessions]);

  // Persist AI-created reminders to Supabase
  const persistedReminderKeysRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const allMessages = sessions.flatMap((session) => session.messages);
    const messagesWithReminders = allMessages.filter(
      (message) => message.role === "assistant" && message.reminders && message.reminders.length > 0
    );

    for (const message of messagesWithReminders) {
      if (!message.reminders) continue;

      for (const reminder of message.reminders) {
        const reminderKey = buildReminderKey(reminder);

        // Skip if already persisted
        if (persistedReminderKeysRef.current.has(reminderKey)) {
          continue;
        }

        // Extract reminder data
        const data = reminder.data;
        const reminderRecord = (data.reminder as Record<string, unknown> | null) ?? null;
        const remindAtIso =
          (reminderRecord && typeof reminderRecord.remind_at === "string" && reminderRecord.remind_at) ||
          (typeof data.time_iso === "string" ? data.time_iso : null);

        if (!remindAtIso) {
          console.warn("Skipping reminder without valid remind_at time:", reminder);
          continue;
        }

        // Check for color in metadata
        let color: string | undefined = undefined;
        if (reminderRecord && typeof reminderRecord["metadata"] === "object" && reminderRecord["metadata"]) {
          const metadata = reminderRecord["metadata"] as Record<string, unknown>;
          if (typeof metadata["color"] === "string" && metadata["color"]) {
            color = metadata["color"];
          }
        }

        const payload: ReminderCreatePayload = {
          label: data.label || "Reminder",
          remind_at: remindAtIso,
          description: data.summary ?? reminder.data.raw?.description as string | undefined ?? null,
          entity_type: reminder.entity,
          delivery_mode: reminder.delivery_mode ?? reminder.entity,
          summary: data.summary ?? null,
          metadata: reminderRecord?.metadata as Record<string, unknown> | undefined ?? null,
          color,
        };

        // Persist to Supabase
        persistedReminderKeysRef.current.add(reminderKey);
        apiService
          .createReminder(user.id, payload)
          .then((created) => {
            // Dispatch custom event so useWorkspaceData can refresh reminder list
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent(REMINDERS_REFRESH_EVENT));
            }
          })
          .catch((error) => {
            console.error("Failed to persist AI-created reminder:", error);
            // Remove from persisted set so it can be retried
            persistedReminderKeysRef.current.delete(reminderKey);
          });
      }
    }
  }, [sessions, user?.id]);

  return (
    <ChatContext.Provider value={value}>
      {children}

    </ChatContext.Provider>
  );
}

export const useChatStore = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error("useChatStore must be used within a ChatProvider");
  }
  return ctx;
};

export { GENERAL_CHAT_SESSION_ID };
