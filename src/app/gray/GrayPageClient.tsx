"use client";

import { usePathname, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@/contexts/UserContext";
import { workspaceService } from "@/lib/api";
import { requestNotificationPermission } from "@/lib/notificationUtils";
import { formatDisplayName } from "@/lib/names";
import { clearAuthCookies } from "@/lib/auth/cookies";
import { clearSupabaseAuthStorage } from "@/lib/supabaseStorage";
import { getSupabaseClient } from "@/lib/supabaseClient";
import pageStyles from "./GrayPageLayout.module.css";
import greetingStyles from "@/components/gray/Greeting.module.css";
import composerStyles from "@/components/gray/chat/ChatComposerStyles.module.css";
import {
  type ProactivityItem,
  type SidebarNavKey,
  type SidebarHistoryEntry,
  type ContextUsageSummary,
} from "@/components/gray/types";
import {
  useChatStore,
} from "@/components/gray/ChatProvider";
import {
  GENERAL_CHAT_SESSION_ID,
  SHARED_CHAT_PLACEHOLDER_TITLE,
} from "@/components/gray/chat/constants";
import { EventComposerPayload } from "@/components/calendar/EventComposer";
import { useNotificationPreferences } from "@/contexts/NotificationPreferencesContext";
import {
  normalizeConversationIdValue,
} from "@/components/gray/chat/utils";
import { useProactivityNotifications } from "@/components/gray/ProactivityNotificationProvider";

// New Imports for Refactoring
import { useWorkspaceData } from "@/components/gray/hooks/useWorkspaceData";
import { useProactivity } from "@/components/gray/hooks/useProactivity";
import { usePulse } from "@/components/gray/hooks/usePulse";
import { toDateKey, normalizeProactivityTimes, primaryProactivityTime, normalizeProactivityChannels } from "./utils";
import { UsageLimitBanner } from "@/components/gray/UsageLimitBanner";
import { buildHistorySections } from "./buildHistorySections";
// Type-only import
import { GrayChatComposer } from "@/components/gray/ChatComposer";
import {
  buildGeneralChatSession,
  normalizePlanTier,
  derivePlanTierLabel,
  deriveInitials,
  greetingForDate,
  type PlanCarrierUser,
} from "@/components/gray/utils/helperFunctions";
import { SIDEBAR_ITEMS, SIDEBAR_RAIL_ITEMS, NAVIGATION_ROUTES } from "@/components/gray/utils/sidebarConfig";
import {
  isAnonLimitReached,
  incrementAnonMessageCount,
  getAnonMessageCount,
  ANON_MESSAGE_LIMIT_VALUE,
} from "@/lib/anonymousSession";
import { SignUpPromptModal } from "@/components/gray/SignUpPromptModal";
import { GrayMobileHeader } from "./components/GrayMobileHeader";
import { useCalendarSyncHandlers } from "./hooks/useCalendarSyncHandlers";
import { usePlanHabitActions } from "./hooks/usePlanHabitActions";
import { useGrayLayoutState } from "./hooks/useGrayLayoutState";
import { MobileWelcomeScreen } from "@/components/gray/chat/view/MobileWelcomeScreen";
import { PLAN_EVENT_ID_PREFIX } from "@/components/gray/planCalendarUtils";

// Lazy load all heavy components for better code splitting
const GrayEnhancedSidebar = dynamic(
  () => import("@/components/gray/EnhancedSidebar").then((mod) => mod.GrayEnhancedSidebar),
  { loading: () => null }
);

const GrayWorkspaceHeader = dynamic(
  () => import("@/components/gray/WorkspaceHeader").then((mod) => mod.GrayWorkspaceHeader),
  { loading: () => null }
);

const GrayChatView = dynamic(
  () => import("@/components/gray/ChatView").then((mod) => mod.GrayChatView),
  { loading: () => null }
);

const SettingsModal = dynamic(
  () => import("@/components/gray/SettingsModal").then((mod) => mod.SettingsModal),
  { loading: () => null }
);
const AttachmentTray = dynamic(
  () => import("@/components/gray/AttachmentTray"),
  { loading: () => null }
);

const GrayDashboardView = dynamic(
  () => import("@/components/gray/DashboardView").then((mod) => mod.GrayDashboardView),
  { loading: () => null }
);

const GrayGeneralView = dynamic(
  () => import("@/components/gray/GeneralView").then((mod) => mod.GrayGeneralView),
  { loading: () => null }
);

const HistoryOverlay = dynamic(
  () => import("@/components/gray/HistoryOverlay").then((mod) => mod.HistoryOverlay),
  { loading: () => null }
);

type SpeechRecognitionAlternativeLike = {
  transcript?: string;
};

type SpeechRecognitionResultLike = {
  isFinal?: boolean;
  0?: SpeechRecognitionAlternativeLike;
  item?: (index: number) => SpeechRecognitionAlternativeLike | null;
};

type SpeechRecognitionResultListLike = ArrayLike<SpeechRecognitionResultLike>;

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
};

const parsePlanIdFromComposerEventId = (eventId?: string): number | null => {
  if (typeof eventId !== "string" || eventId.trim() === "") {
    return null;
  }
  const normalizedId = eventId.startsWith(PLAN_EVENT_ID_PREFIX)
    ? eventId.slice(PLAN_EVENT_ID_PREFIX.length)
    : eventId;
  const numericId = Number(normalizedId);
  if (!Number.isFinite(numericId)) {
    return null;
  }
  return numericId;
};

type SpeechRecognitionErrorEventLike = {
  error?: string;
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

const extractRecognitionTranscript = (result: SpeechRecognitionResultLike): string => {
  if (typeof result?.[0]?.transcript === "string") {
    return result[0].transcript;
  }
  const fallback = result.item?.(0);
  if (fallback && typeof fallback.transcript === "string") {
    return fallback.transcript;
  }
  return "";
};

const MOBILE_LAST_CHAT_ROUTE_STORAGE_KEY = "gray:mobileLastChatRoute";

// Helper functions and constants imported from extracted modules

type GrayPageClientProps = {
  initialTimestamp: number;
  activeNav?: SidebarNavKey;
  variant?: "general" | "dashboard" | "chat";
  activeChatId?: string | null;
  initialDashboardTab?: "pulse" | "calendar";
  sidebarPreferenceKey?: string;
  defaultSidebarExpandedDesktop?: boolean;
};

type ViewMode = "chat" | "dashboard" | "general" | "history";

function GrayPageClientInner({
  initialTimestamp,
  activeNav = "general",
  variant = "general",
  activeChatId = null,
  initialDashboardTab = "pulse",
  sidebarPreferenceKey = "gray:sidebarExpanded",
  defaultSidebarExpandedDesktop = false,
}: GrayPageClientProps) {
  const { user, loading: userLoading } = useUser();
  const { notificationPreferences, setNotificationPreference } = useNotificationPreferences();
  const usageStatus = user?.usage_status;
  const isUsageLimitReached = usageStatus?.is_monthly_limit_reached || usageStatus?.is_six_hour_limit_reached;
  const streakCount = typeof user?.streak_count === "number" ? user.streak_count : null;
  const router = useRouter();
  const pathname = usePathname();
  const [now, setNow] = useState(() => new Date(initialTimestamp));

  // Derived state for hooks
  const userId = typeof user?.id === "number" ? user.id : null;
  const normalizedTier = useMemo(() => normalizePlanTier(user), [user]);
  const hasCalendarAccess = normalizedTier === "voyager" || normalizedTier === "pioneer";
  const resolvedTimezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
    } catch {
      return "UTC";
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const root = document.documentElement;
    let rafId: number | null = null;

    const updateViewportHeight = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      rafId = window.requestAnimationFrame(() => {
        const visualHeight = window.visualViewport?.height ?? window.innerHeight;
        const safeHeight = Math.min(window.innerHeight, visualHeight);
        root.style.setProperty("--gray-viewport-height", `${safeHeight}px`);
        rafId = null;
      });
    };

    updateViewportHeight();
    window.addEventListener("resize", updateViewportHeight);
    window.addEventListener("orientationchange", updateViewportHeight);
    window.addEventListener("load", updateViewportHeight);
    window.addEventListener("pageshow", updateViewportHeight);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", updateViewportHeight);
      window.visualViewport.addEventListener("scroll", updateViewportHeight);
    }
    const postLoadTimer = window.setTimeout(updateViewportHeight, 250);
    const settleTimer = window.setTimeout(updateViewportHeight, 900);

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      window.clearTimeout(postLoadTimer);
      window.clearTimeout(settleTimer);
      window.removeEventListener("resize", updateViewportHeight);
      window.removeEventListener("orientationchange", updateViewportHeight);
      window.removeEventListener("load", updateViewportHeight);
      window.removeEventListener("pageshow", updateViewportHeight);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", updateViewportHeight);
        window.visualViewport.removeEventListener("scroll", updateViewportHeight);
      }
    };
  }, []);

  const nowDateKey = useMemo(() => toDateKey(now), [now]);
  const todayAnchor = useMemo(() => {
    const [yearString, monthString, dayString] = nowDateKey.split("-");
    const year = Number.parseInt(yearString ?? "", 10);
    const monthIndex = Number.parseInt(monthString ?? "", 10) - 1;
    const day = Number.parseInt(dayString ?? "", 10);

    if (Number.isNaN(year) || Number.isNaN(monthIndex) || Number.isNaN(day)) {
      const fallback = new Date();
      fallback.setHours(0, 0, 0, 0);
      return fallback;
    }

    return new Date(year, monthIndex, day, 0, 0, 0, 0);
  }, [nowDateKey]);
  const [mobilePulseActive, setMobilePulseActive] = useState(() => {
    return (
      variant === "dashboard" ||
      pathname === "/pulse" ||
      pathname?.startsWith("/cal") ||
      pathname?.startsWith("/gray/dashboard")
    );
  });
  const shouldLoadCalendarData =
    hasCalendarAccess &&
    (variant === "dashboard" ||
      mobilePulseActive ||
      activeNav === "calendar" ||
      initialDashboardTab === "calendar" ||
      pathname === "/cal" ||
      pathname?.startsWith("/cal") ||
      pathname?.startsWith("/gray/dashboard"));

  // Custom Hooks
  const {
    plans,
    setPlans,
    calendarCalendars,
    setCalendarCalendars,
    calendarEvents,
    setCalendarEvents,
    refreshPlansAndHabits
  } = useWorkspaceData(userId, variant, hasCalendarAccess, shouldLoadCalendarData);

  useEffect(() => {
    const shouldAutoActivate =
      variant === "dashboard" ||
      pathname === "/pulse" ||
      pathname?.startsWith("/cal") ||
      pathname?.startsWith("/gray/dashboard");

    if (shouldAutoActivate && !mobilePulseActive) {
      setMobilePulseActive(true);
    }
  }, [mobilePulseActive, pathname, variant]);

  const {
    proactivity,
    setProactivity,
    persistProactivitySettings,
    isLoaded: isProactivityLoaded,
  } = useProactivity(userId, resolvedTimezone);

  const {
    sessions,
    renameSession,
    deleteSession,
    setWorkspaceContext,
    sendGeneralMessage,
    createThreadSession,
    generalSessionId,
    updateSession,
    getSession,
    ensureSession,
    markHasSeenGeneralChat,
    uploadAttachments,
    attachments,
    isAttachmentUploading,
    attachmentError,
    removeAttachment,
    pinSession,
    remoteConversationsLoaded,
  } = useChatStore();
  const [currentChatId, setCurrentChatId] = useState<string | null>(() => activeChatId ?? null);
  const ensureSessionRef = useRef(ensureSession);
  const generalOnboardingKickoffRef = useRef(false);
  const { deliveredKeys: deliveredProactivityKeys } = useProactivityNotifications();
  const lastDeletedChatIdStorageKey = "gray:lastDeletedChatId";

  const derivedPlans = user ? plans : [];

  const [threadComposerDraft, setThreadComposerDraft] = useState("");
  const [isVoiceInputSupported, setIsVoiceInputSupported] = useState(false);
  const [isVoiceInputActive, setIsVoiceInputActive] = useState(false);
  const speechRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const voiceDraftPrefixRef = useRef("");
  const voiceFinalTranscriptRef = useRef("");
  const threadComposerControls = useMemo(
    () => ({
      clear: () => setThreadComposerDraft(""),
      restore: (value: string) => setThreadComposerDraft(value),
    }),
    []
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const speechWindow = window as typeof window & {
      SpeechRecognition?: BrowserSpeechRecognitionConstructor;
      webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
    };
    const SpeechRecognitionCtor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setIsVoiceInputSupported(false);
      speechRecognitionRef.current = null;
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = window.navigator.language || "en-US";
    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let interimText = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = extractRecognitionTranscript(result);
        if (!transcript) {
          continue;
        }
        if (result.isFinal) {
          voiceFinalTranscriptRef.current += transcript;
        } else {
          interimText += transcript;
        }
      }

      const nextDraft =
        `${voiceDraftPrefixRef.current}${voiceFinalTranscriptRef.current}${interimText}`.trim();
      setThreadComposerDraft(nextDraft);
    };
    recognition.onerror = () => {
      setIsVoiceInputActive(false);
    };
    recognition.onend = () => {
      setIsVoiceInputActive(false);
    };

    speechRecognitionRef.current = recognition;
    setIsVoiceInputSupported(true);

    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.stop();
      } catch {
        // Ignore stop failures during teardown.
      }
      if (speechRecognitionRef.current === recognition) {
        speechRecognitionRef.current = null;
      }
    };
  }, []);

  const handleToggleVoiceInput = useCallback(() => {
    const recognition = speechRecognitionRef.current;
    if (!recognition) {
      return;
    }

    if (isVoiceInputActive) {
      try {
        recognition.stop();
      } catch {
        // Ignore stop errors from browsers that auto-stop.
      }
      setIsVoiceInputActive(false);
      return;
    }

    const trimmed = threadComposerDraft.trim();
    voiceDraftPrefixRef.current = trimmed.length > 0 ? `${trimmed} ` : "";
    voiceFinalTranscriptRef.current = "";
    try {
      recognition.start();
      setIsVoiceInputActive(true);
    } catch {
      setIsVoiceInputActive(false);
    }
  }, [isVoiceInputActive, threadComposerDraft]);

  const handleCreatePlan = useCallback(async (payload: EventComposerPayload) => {
    if (!user?.id) return;

    const formatTime = (date: Date) => {
      // Format as HH:MM in 24h format
      return date.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' });
    };

    const startStr = formatTime(payload.start);
    const endStr = formatTime(payload.end);
    const scheduleSlot = `${startStr}-${endStr}`;
    const planPayload = {
      label: payload.title,
      deadline: toDateKey(payload.start),
      scheduleSlot: scheduleSlot,
      description: payload.description || null,
      color: payload.color || null,
    };
    const existingPlanId = parsePlanIdFromComposerEventId(payload.id);

    if (existingPlanId !== null) {
      await workspaceService.updatePlan(user.id, existingPlanId, planPayload);
    } else {
      await workspaceService.createPlan(user.id, {
        ...planPayload,
        completed: false,
      });
    }

    await refreshPlansAndHabits();
  }, [user?.id, refreshPlansAndHabits]);

  const sendDashboardNotification = useCallback(async (title: string, body: string) => {
    if (typeof window === "undefined" || typeof Notification === "undefined") {
      return;
    }
    let permission: NotificationPermission | null = Notification.permission;
    if (permission === "default") {
      permission = await requestNotificationPermission();
    }
    if (permission !== "granted") {
      return;
    }
    try {
      const notification = new Notification(title, { body, requireInteraction: true });
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("Failed to dispatch dashboard notification", error);
      }
    }
  }, []);

  const {
    pulseEntries,
    setActivePulseId,
    activePulse,
    isActivePulseEditable
  } = usePulse(userId, todayAnchor, nowDateKey, derivedPlans, [], proactivity, sendDashboardNotification);
  const {
    togglePlan,
    savePlan,
    deletePlan,
  } = usePlanHabitActions({
    userId,
    isActivePulseEditable,
    pulseEntries,
    plans,
    setPlans,
    sendDashboardNotification,
  });

  const {
    isMobileViewport,
    isCompactLayout,
    sidebarExpandedForLayout,
    toggleSidebarExpandedForLayout,
    expandSidebarForLayout,
    collapseSidebarForLayout,
    collapseAllSidebars,
  } = useGrayLayoutState({
    pathname,
    sidebarPreferenceKey,
    defaultSidebarExpandedDesktop,
  });

  const supportsInlineChat = variant !== "chat";
  const shouldUseInlineChat = supportsInlineChat && isMobileViewport;

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (shouldUseInlineChat) {
      return;
    }
    const chatId = activeChatId ?? null;
    if (!chatId) {
      return;
    }
    try {
      const lastDeletedRaw = sessionStorage.getItem(lastDeletedChatIdStorageKey);
      if (!lastDeletedRaw) {
        return;
      }
      const parsedIds: Array<string | null> = [];
      try {
        const parsed = JSON.parse(lastDeletedRaw) as unknown;
        if (typeof parsed === "string") {
          parsedIds.push(parsed);
        } else if (parsed && typeof parsed === "object") {
          const sessionId = (parsed as { sessionId?: unknown }).sessionId;
          const conversationId = (parsed as { conversationId?: unknown }).conversationId;
          parsedIds.push(
            typeof sessionId === "string" ? sessionId : null,
            typeof conversationId === "string" ? conversationId : null
          );
        }
      } catch {
        parsedIds.push(lastDeletedRaw);
      }

      if (parsedIds.some((candidate) => candidate === chatId)) {
        sessionStorage.removeItem(lastDeletedChatIdStorageKey);
        router.replace("/");
      }
    } catch {
      // Ignore storage errors (e.g. disabled cookies).
    }
  }, [activeChatId, lastDeletedChatIdStorageKey, router, shouldUseInlineChat]);

  const [dashboardTab, setDashboardTab] = useState<"pulse" | "calendar">(() => initialDashboardTab);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialSection, setSettingsInitialSection] = useState<
    "account" | "preferences" | "personalization" | "data_controls"
  >("account");
  const [contextUsageSummary, setContextUsageSummary] = useState<ContextUsageSummary | null>(null);
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<Date>(() => {
    const initial = new Date(initialTimestamp);
    initial.setHours(0, 0, 0, 0);
    return initial;
  });

  const [isHistoryOverlayOpen, setIsHistoryOverlayOpen] = useState(false);

  useEffect(() => {
    setDashboardTab(initialDashboardTab);
  }, [initialDashboardTab]);

  // Anonymous user state for limiting messages before sign-up
  const isAnonymousUser = !user?.id && !userLoading;
  const [showSignUpPrompt, setShowSignUpPrompt] = useState(false);
  const [anonMessageCount, setAnonMessageCount] = useState(() => getAnonMessageCount());


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsHistoryOverlayOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);


  useEffect(() => {
    ensureSessionRef.current = ensureSession;
  }, [ensureSession]);

  const getOrCreateGeneralSessionId = useCallback(() => {
    if (generalSessionId) {
      return generalSessionId;
    }
    const ensureSessionFn = ensureSessionRef.current ?? ensureSession;
    const ensured = ensureSessionFn(GENERAL_CHAT_SESSION_ID, buildGeneralChatSession);
    return ensured.id;
  }, [generalSessionId, ensureSession]);

  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const handleAttachmentInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) {
        return;
      }
      uploadAttachments(files);
      if (attachmentInputRef.current) {
        attachmentInputRef.current.value = "";
      }
    },
    [uploadAttachments]
  );
  const openAttachmentPicker = useCallback(() => {
    attachmentInputRef.current?.click();
  }, []);
  const handleAttachmentPaste = useCallback(
    (files: File[]) => {
      if (!files || files.length === 0) {
        return;
      }
      uploadAttachments(files);
    },
    [uploadAttachments]
  );

  // Dashboard appearance preferences (sidebar + background) are now per-session
  // only, so we no longer read from or write to localStorage here.

  const handleTestProactivity = useCallback(
    async (_proactivityId: string) => {
      if (!userId) {
        return;
      }
      try {
        await workspaceService.triggerProactivityForUser(userId);
        // We don't need to do anything else, the SSE stream will handle the notification
      } catch (err) {
        console.error("Failed to trigger proactivity test:", err);
      }
    },
    [userId]
  );

  const baseViewMode: ViewMode =
    variant === "chat"
      ? "chat"
      : variant === "dashboard"
        ? "dashboard"
        : "general";

  // Determine if upgrade button should be shown based on route
  // Show on / (dashboard) route only
  const shouldShowUpgradeButton = pathname === "/";

  const [manualViewMode, setManualViewMode] = useState<ViewMode | null>(() => {
    if (shouldUseInlineChat && (activeChatId ?? null)) {
      return "chat";
    }
    return activeNav === "history" && baseViewMode !== "chat" ? "history" : null;
  });
  const viewMode: ViewMode =
    baseViewMode === "chat"
      ? "chat"
      : manualViewMode ??
        (activeNav === "history" ? "history" : baseViewMode);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const currentPath = window.location.pathname;
    if (currentPath === "/" || currentPath === "/g" || currentPath.startsWith("/c/")) {
      try {
        window.sessionStorage.setItem(MOBILE_LAST_CHAT_ROUTE_STORAGE_KEY, currentPath);
      } catch {
        // Ignore storage failures.
      }
    }
  }, [pathname]);

  const handleMobileHeaderSelectChat = useCallback(() => {
    setMobilePulseActive(false);
    let targetRoute = activeNav === "general" ? NAVIGATION_ROUTES.general ?? "/g" : NAVIGATION_ROUTES.threads ?? "/";
    if (typeof window !== "undefined") {
      try {
        const storedRoute = window.sessionStorage.getItem(MOBILE_LAST_CHAT_ROUTE_STORAGE_KEY);
        if (
          storedRoute &&
          (storedRoute === "/" || storedRoute === "/g" || storedRoute.startsWith("/c/"))
        ) {
          targetRoute = storedRoute;
        }
      } catch {
        // Ignore storage failures.
      }
    }

    if (pathname !== targetRoute) {
      router.push(targetRoute);
    }
    if (isMobileViewport) {
      collapseAllSidebars();
    }
  }, [activeNav, collapseAllSidebars, isMobileViewport, pathname, router]);

  const handleMobileHeaderSelectPulse = useCallback(() => {
    setMobilePulseActive(true);
    setDashboardTab("pulse");
    if (typeof window !== "undefined") {
      try {
        const currentPath = window.location.pathname;
        if (currentPath === "/" || currentPath === "/g" || currentPath.startsWith("/c/")) {
          window.sessionStorage.setItem(MOBILE_LAST_CHAT_ROUTE_STORAGE_KEY, currentPath);
        }
      } catch {
        // Ignore storage failures.
      }
    }
    if (pathname !== "/pulse") {
      router.push("/pulse");
    }
    if (isMobileViewport) {
      collapseAllSidebars();
    }
  }, [collapseAllSidebars, isMobileViewport, pathname, router]);

  const handleMobileHeaderCreateNewChat = useCallback(async () => {
    try {
      setMobilePulseActive(false);
      const session = await createThreadSession();
      setCurrentChatId(session.id);
      setThreadComposerDraft("");

      if (shouldUseInlineChat) {
        setManualViewMode("chat");
      } else {
        router.push(`/c/${session.id}`);
      }

      if (isMobileViewport) {
        collapseAllSidebars();
      }
    } catch (error) {
      console.error("Failed to create new chat:", error);
    }
  }, [
    collapseAllSidebars,
    createThreadSession,
    isMobileViewport,
    router,
    shouldUseInlineChat,
  ]);

  const shouldHideDesktopWorkspaceChrome =
    !isMobileViewport &&
    (viewMode === "chat" ||
      (pathname?.startsWith("/c/") ?? false) ||
      pathname === "/g" ||
      (pathname?.startsWith("/g/") ?? false));

  const renderDashboardSurface = () => (
    <GrayDashboardView
      pulseEntries={pulseEntries}
      currentPulse={activePulse}
      isCurrentPulseEditable={isActivePulseEditable}
      livePlans={derivedPlans}
      onSelectPulse={setActivePulseId}
      proactivityFallback={proactivity}
      isProactivityLoaded={isProactivityLoaded}
      onProactivitySelect={selectProactivityPreset}
          onProactivityRemove={removeProactivity}
          onTestProactivity={handleTestProactivity}
          onSavePlan={savePlan}
          onDeletePlan={deletePlan}
          onTogglePlan={togglePlan}
          activeTab={dashboardTab}
          onSelectTab={setDashboardTab}
      currentDate={now}
      calendars={derivedCalendars}
          onCalendarsChange={handleCalendarsChange}
          calendarEvents={derivedEvents}
          onCalendarEventsChange={handleEventsChange}
          calendarSelectedDate={calendarSelectedDate}
          onCalendarSelectedDateChange={setCalendarSelectedDate}
          onCreatePlan={handleCreatePlan}
      chatBar={null}
      isCompactLayout={isCompactLayout}
      userId={userId}
      proactivityDeliveryKeys={deliveredProactivityKeys}
      onUpgradeClick={handleUpgradePlan}
      showUpgradeButton={shouldShowUpgradeButton}
      hideHeader={isMobileCalendarView}
    />
  );

  const renderPrimaryView = () => {
    if (isDashboardView) {
      return renderDashboardSurface();
    }
    if (isChatView) {
      return (
        <GrayChatView
          sessionId={currentChatId ?? null}
          onContextUsageChange={setContextUsageSummary}
          hideThinkingIndicator={hideChatThinkingIndicator}
          introContent={null}
          isInputDisabled={isUsageLimitReached}
        />
      );
    }

    return (
      <div className={pageStyles.generalViewSection}>
        <GrayGeneralView
          greeting={greeting}
          currentDate={now}
          plans={derivedPlans}
          proactivity={proactivity}
          onSelectProactivity={selectProactivityPreset}
          onRemoveProactivity={removeProactivity}
          onTogglePlan={togglePlan}
          onSavePlan={savePlan}
          onDeletePlan={deletePlan}
          onRefreshData={refreshPlansAndHabits}
          showGreeting={false}
          hidePlans={isMobileViewport}
        />
      </div>
    );
  };

  // Close mobile sidebar on navigation
  const handleMobileNavigate = (nav: SidebarNavKey) => {
    if (nav === "calendar") {
      setMobilePulseActive(true);
      setDashboardTab("calendar");
    } else {
      setMobilePulseActive(false);
    }
    handleNavigate(nav);
    if (isMobileViewport) {
      collapseSidebarForLayout();
    }
  };

  const renderMainSurface = () => {
    if (viewMode === "chat") {
      return (
        <div
          className={pageStyles.mainContent}
          data-view={viewMode}
          data-compact={isCompactLayout ? "true" : "false"}
        >
          {!shouldHideDesktopWorkspaceChrome ? (
            <GrayWorkspaceHeader
              planLabel={viewerPlanLabel}
              onUpgradeClick={handleUpgradePlan}
              showUpgradeButton={shouldShowUpgradeButton}
              hideDesktopMeta={shouldHideDesktopWorkspaceChrome}
              streakCount={streakCount}
            >
              {renderWorkspaceGreeting()}
            </GrayWorkspaceHeader>
          ) : null}
          {renderPrimaryView()}
        </div>
      );
    }
    if (viewMode === "general") {
      return (
        <div
          className={pageStyles.mainContent}
          data-view={viewMode}
          data-compact={isCompactLayout ? "true" : "false"}
        >
          {/* Welcome overlay for the main "/" (threads) surface */}
          {pathname === "/" && activeNav === "threads" ? <MobileWelcomeScreen /> : null}
          {!shouldHideDesktopWorkspaceChrome ? (
            <GrayWorkspaceHeader
              planLabel={viewerPlanLabel}
              onUpgradeClick={handleUpgradePlan}
              showUpgradeButton={shouldShowUpgradeButton}
              hideDesktopMeta={shouldHideDesktopWorkspaceChrome}
              streakCount={streakCount}
            >
              {renderWorkspaceGreeting()}
            </GrayWorkspaceHeader>
          ) : null}
          {renderPrimaryView()}
        </div>
      );
    }
    return renderPrimaryView();
  };

  const renderMobileChatSurface = () => {
    if (viewMode === "chat") {
      return (
        <div
          className={pageStyles.mainContent}
          data-view="chat"
          data-compact={isCompactLayout ? "true" : "false"}
        >
          {renderPrimaryView()}
        </div>
      );
    }
    return (
      <div
        className={pageStyles.mainContent}
        data-view="general"
        data-compact={isCompactLayout ? "true" : "false"}
      >
        <MobileWelcomeScreen />
      </div>
    );
  };

  useEffect(() => {
    if (!isMobileViewport && manualViewMode && manualViewMode !== "history") {
      setManualViewMode(null);
    }
    if (baseViewMode === "chat") {
      return;
    }
    if (activeNav === "dashboard" && manualViewMode !== null) {
      setManualViewMode(null);
      return;
    }
    if (activeNav === "general" && manualViewMode === "history") {
      setManualViewMode(null);
    }
  }, [activeNav, baseViewMode, isMobileViewport, manualViewMode]);

  const viewerName = useMemo(() => {
    if (userLoading) {
      return "Loading...";
    }
    const nickname = user?.personalization_nickname?.trim();
    if (nickname && nickname.length > 0) {
      return nickname;
    }
    return formatDisplayName(user?.full_name);
  }, [userLoading, user?.full_name, user?.personalization_nickname]);

  const viewerAvatarUrl =
    user?.profile_picture_url && user.profile_picture_url.trim().length > 0
      ? user.profile_picture_url
      : null;

  const viewerAvatarColor = useMemo(() => {
    const palette = [
      "#2563eb",
      "#7c3aed",
      "#db2777",
      "#dc2626",
      "#ea580c",
      "#d97706",
      "#16a34a",
      "#059669",
      "#0891b2",
      "#4f46e5",
    ] as const;

    const seed = String(user?.id ?? user?.email ?? user?.full_name ?? viewerName ?? "gray");
    let hash = 0;
    for (let index = 0; index < seed.length; index += 1) {
      hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
    }
    return palette[hash % palette.length];
  }, [user?.email, user?.full_name, user?.id, viewerName]);

  const viewerPlanLabel = useMemo(() => {
    const planCarrier = (user ?? null) as PlanCarrierUser | null;
    return derivePlanTierLabel(planCarrier);
  }, [user]);


  useEffect(() => {
    if (!hasCalendarAccess && dashboardTab === "calendar") {
      setDashboardTab("pulse");
    }
  }, [hasCalendarAccess, dashboardTab]);

  useEffect(() => {
    if (hasCalendarAccess) {
      return;
    }

    if (activeNav === "calendar" || pathname === "/cal") {
      router.replace(NAVIGATION_ROUTES.general ?? "/g");
    }
  }, [activeNav, hasCalendarAccess, pathname, router]);

  const viewerInitials = useMemo(() => {
    if (userLoading) {
      return "--";
    }
    if (user?.initials) {
      return user.initials;
    }
    return deriveInitials(user?.full_name ?? viewerName) || "OP";
  }, [user, userLoading, viewerName]);

  const filteredSidebarItems = useMemo(() => {
    return SIDEBAR_ITEMS.filter((item) => {
      if (!hasCalendarAccess && item.id === "calendar") {
        return false;
      }
      return true;
    });
  }, [hasCalendarAccess]);

  const filteredRailItems = useMemo(() => {
    return SIDEBAR_RAIL_ITEMS.filter((item) => {
      if (!hasCalendarAccess && item.id === "calendar") {
        return false;
      }
      return true;
    });
  }, [hasCalendarAccess]);

  const historySections = useMemo(() => buildHistorySections(sessions), [sessions]);
  const isDashboardView = viewMode === "dashboard";
  const isChatView = viewMode === "chat";
  const isPulseRoute =
    pathname === "/pulse" || pathname.startsWith("/cal") || pathname.startsWith("/gray/dashboard");

  const handleNavigate = useCallback(
    (navId: SidebarNavKey) => {
      switch (navId) {
        case "search":
          return;
        case "history":
          setIsHistoryOverlayOpen(true);
          return;
        case "dashboard":
          setManualViewMode(null);
          router.push("/");
          return;
        default: {
          setManualViewMode(null);
          const target = NAVIGATION_ROUTES[navId];
          if (target) {
            router.push(target);
          }
        }
      }
    },
    [router]
  );

  useEffect(() => {
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      setNow(new Date(initialTimestamp + elapsed));
    };

    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [initialTimestamp]);

  const handleOpenSettings = () => {
    setSettingsInitialSection("account");
    setIsSettingsOpen(true);
  };

  const handleOpenHelp = () => {
    if (typeof window !== "undefined") {
      window.open("https://forms.gle/BMXcgqCjyMUooYmB6", "_blank", "noopener,noreferrer");
    }
  };

  const handleUpgradePlan = useCallback(() => {
    router.push("/pricing");
  }, [router]);

  const handleLogOut = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase.auth.signOut({ scope: "local" });
      }
    } catch (error) {
      console.error("Failed to log out:", error);
    } finally {
      clearSupabaseAuthStorage();
      await clearAuthCookies();
      router.push("/login");
    }
  }, [router]);

  const currentChatSession = useMemo(() => {
    if (!currentChatId) {
      return null;
    }
    return sessions.find((session) => session.id === currentChatId) ?? null;
  }, [currentChatId, sessions]);

  const documentTitle = useMemo(() => {
    if (viewMode === "chat") {
      if (currentChatId && generalSessionId && currentChatId === generalSessionId) {
        return "General";
      }
      if (currentChatSession?.title?.trim()) {
        return currentChatSession.title.trim();
      }
      return "Chat";
    }

    if (viewMode === "dashboard" || activeNav === "dashboard") {
      return "Dashboard";
    }
    if (viewMode === "history" || activeNav === "history") {
      return "History";
    }
    if (activeNav === "threads") {
      return "New Chat";
    }
    if (activeNav === "general") {
      return "General";
    }
    if (viewMode === "general") {
      return "General";
    }

    return "Gray";
  }, [activeNav, currentChatId, currentChatSession, generalSessionId, viewMode]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      const label = documentTitle?.trim() || "Gray";
      document.title = label;
    }
  }, [documentTitle]);

  const derivedCalendars = user ? calendarCalendars : [];
  const derivedEvents = user ? calendarEvents : [];
  const workspaceContextSummary = useMemo<string | null>(() => {
    // Pulse snapshots removed from context injection to reduce noise.
    // The AI can fetch this state via get_workspace_state tool if needed.
    return null;
  }, []);

  useEffect(() => {
    setWorkspaceContext(workspaceContextSummary);
  }, [setWorkspaceContext, workspaceContextSummary]);

  useEffect(() => {
    if (activeNav === "threads") {
      return;
    }
    if (activeNav === "general" && generalSessionId) {
      if (currentChatId !== generalSessionId) {
        setCurrentChatId(generalSessionId);
      }
      return;
    }
    if (!currentChatId && generalSessionId) {
      setCurrentChatId(generalSessionId);
    }
  }, [activeNav, currentChatId, generalSessionId]);

  useEffect(() => {
    if (generalOnboardingKickoffRef.current) {
      return;
    }
    if (!remoteConversationsLoaded || userLoading || isAnonymousUser || !user) {
      return;
    }
    if (user.has_seen_general_chat || isUsageLimitReached) {
      return;
    }
    if (viewMode !== "chat") {
      return;
    }
    const generalSession = sessions.find((session) => session.scope === "general");
    if (!generalSession) {
      return;
    }
    if (currentChatId && generalSession.id !== currentChatId) {
      return;
    }
    if (generalSession.isResponding || generalSession.messages.length > 0) {
      return;
    }
    generalOnboardingKickoffRef.current = true;
    void sendGeneralMessage("Let's get started.");
  }, [
    currentChatId,
    isAnonymousUser,
    isUsageLimitReached,
    remoteConversationsLoaded,
    sendGeneralMessage,
    sessions,
    user,
    userLoading,
    viewMode,
  ]);

  /**
   * Synchronize currentChatId with /c/[chatId] when in full-page chat mode.
   *
   * Behavior:
   * - /c/{thread_session_id}:
   *     use that local session (messages stream & persist correctly).
   * - /c/{conversation_id}:
   *     if any session has conversationId === id, use that session.
   * - unknown /c/{id}:
   *     create a real thread ChatSession with id === {id}, so sending messages works.
   * - missing id:
   *     fall back to generalSessionId.
   */
  useEffect(() => {
    if (variant !== "chat") {
      return;
    }

    // No explicit chat id -> keep using general session.
    if (!activeChatId) {
      if (!currentChatId && generalSessionId) {
        setCurrentChatId(generalSessionId);
      }
      return;
    }

    const directSession = sessions.find((session) => session.id === activeChatId);

    // Already selected the right session and it exists.
    if (currentChatId === activeChatId && directSession) {
      return;
    }

    // 1) Exact local session id match (/c/{session.id}).
    if (directSession) {
      if (currentChatId !== directSession.id) {
        setCurrentChatId(directSession.id);
      }
      return;
    }

    // 2) Match by conversationId so /c/{conversationId} works.
    const byConversation = sessions.find(
      (session) => session.conversationId && session.conversationId === activeChatId
    );
    if (byConversation) {
      if (currentChatId !== byConversation.id) {
        setCurrentChatId(byConversation.id);
      }
      return;
    }

    // 3) Unknown id: seed a real session so /c/{id} can hydrate & stream normally.
    let resolved = getSession(activeChatId);
    if (!resolved) {
      const ensureSessionFn = ensureSessionRef.current;
      if (!ensureSessionFn) {
        return;
      }
      const nowTs = Date.now();
      resolved = ensureSessionFn(activeChatId, () => ({
        id: activeChatId,
        title: SHARED_CHAT_PLACEHOLDER_TITLE,
        titleMode: "auto",
        createdAt: nowTs,
        updatedAt: nowTs,
        messages: [],
        isResponding: false,
        scope: "thread",
        // Set conversationId to the activeChatId - it might be a conversation ID
        // The history loading effect will try to load it, and if it exists, great!
        // If not, it will remain undefined until the first message creates a conversation
        conversationId: activeChatId,
        pendingAutoStream: false,
      }));
    }

    setCurrentChatId(resolved?.id ?? activeChatId);
  }, [
    activeChatId,
    currentChatId,
    generalSessionId,
    getSession,
    sessions,
    updateSession,
    variant,
  ]);

  const selectProactivityPreset = (next: ProactivityItem) => {
    const normalized: ProactivityItem = {
      ...next,
      times: normalizeProactivityTimes(next.times ?? null, next.time),
      time: primaryProactivityTime(next.times ?? null, next.time),
      channels: normalizeProactivityChannels(next.channels ?? null),
      timezone: next.timezone ?? proactivity?.timezone ?? resolvedTimezone,
    };
    setProactivity(normalized);
    void persistProactivitySettings(normalized);

    const shouldPromptForNotifications =
      normalized.id === "proactivity-daily" || normalized.id === "proactivity-frequent";

    if (
      shouldPromptForNotifications &&
      typeof window !== "undefined" &&
      typeof Notification !== "undefined" &&
      window.isSecureContext !== false &&
      Notification.permission === "default" &&
      notificationPreferences.device
    ) {
      void requestNotificationPermission().then((permission) => {
        if (permission === "granted") {
          setNotificationPreference("device", true);
        }
      });
    }
  };

  const removeProactivity = () => {
    setProactivity(null);
    void persistProactivitySettings(null);
  };

  const { handleCalendarsChange, handleEventsChange } = useCalendarSyncHandlers({
    userId,
    plans,
    setPlans,
    calendars: calendarCalendars,
    setCalendars: setCalendarCalendars,
    events: calendarEvents,
    setEvents: setCalendarEvents,
  });

  const handleChatSubmit = useCallback(
    async (
      draft: string,
      controls: { clear: () => void; restore: (value: string) => void }
    ) => {
      const normalizedDraft = draft.trim();
      if (!normalizedDraft) {
        return;
      }

      // Check anonymous message limit before proceeding
      if (isAnonymousUser && isAnonLimitReached()) {
        setShowSignUpPrompt(true);
        return;
      }

      // Increment anonymous message counter (will be ignored for authenticated users)
      if (isAnonymousUser) {
        const newCount = incrementAnonMessageCount();
        setAnonMessageCount(newCount);
      }

      controls.clear();

      try {
        const isGeneralChatActive =
          Boolean(currentChatId) &&
          Boolean(generalSessionId) &&
          currentChatId === generalSessionId;

        const isGeneralSurface = activeNav === "general";
        const isThreadSurface = activeNav === "threads";
        const shouldStartStandaloneThread =
          isThreadSurface || (!isGeneralSurface && (!currentChatId || isGeneralChatActive));

        if (shouldStartStandaloneThread) {
          const session = await createThreadSession(normalizedDraft);

          void markHasSeenGeneralChat();
          setCurrentChatId(session.id);

          if (shouldUseInlineChat) {
            setManualViewMode("chat");
          } else {
            router.push(`/c/${session.id}`);
          }
          return;
        }

        const sessionId = await sendGeneralMessage(normalizedDraft);
        void markHasSeenGeneralChat();
        setCurrentChatId(sessionId);

        const generalId = generalSessionId ?? GENERAL_CHAT_SESSION_ID;
        const isGeneralSession = sessionId === generalId;

        if (shouldUseInlineChat) {
          setManualViewMode("chat");
        } else if (isGeneralSession) {
          router.push("/g");
        } else if (activeChatId !== sessionId) {
          router.push(`/c/${sessionId}`);
        }
      } catch (error) {
        console.error("Failed to send general message:", error);
        controls.restore(draft);
      }
    },
    [
      activeChatId,
      activeNav,
      createThreadSession,
      currentChatId,
      generalSessionId,
      isAnonymousUser,
      markHasSeenGeneralChat,
      router,
      sendGeneralMessage,
      shouldUseInlineChat,
    ]
  );

  const handleThreadComposerSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (isUsageLimitReached) {
        return;
      }
      const trimmed = threadComposerDraft.trim();
      if (!trimmed) {
        return;
      }
      void handleChatSubmit(trimmed, threadComposerControls);
    },
    [handleChatSubmit, isUsageLimitReached, threadComposerControls, threadComposerDraft]
  );

  useEffect(() => {
    if (!shouldUseInlineChat || typeof window === "undefined") {
      return;
    }
    if (manualViewMode !== "chat" || !currentChatId) {
      return;
    }

    // The General workspace should never be addressed via /c/general-session.
    const canonicalGeneralId = generalSessionId ?? GENERAL_CHAT_SESSION_ID;
    if (currentChatId === canonicalGeneralId) {
      return;
    }

    // Find the current session and use its conversationId (backend UUID) for the URL
    // This ensures the URL uses the ID that the backend can find on reload
    const currentSession = sessions.find(
      (session) => session.id === currentChatId || session.conversationId === currentChatId
    );
    const urlId = currentSession?.conversationId ?? currentChatId;

    const currentPathname = window.location.pathname;
    const targetPath = `/c/${urlId}`;
    if (currentPathname !== targetPath) {
      window.history.replaceState(null, "", targetPath);
    }
  }, [currentChatId, generalSessionId, manualViewMode, sessions, shouldUseInlineChat]);

  useEffect(() => {
    if (variant !== "chat") {
      return;
    }
    if (!activeChatId || !currentChatId) {
      return;
    }

    const canonicalGeneralId = generalSessionId ?? GENERAL_CHAT_SESSION_ID;
    if (currentChatId === canonicalGeneralId) {
      return;
    }

    const currentSession = sessions.find((session) => session.id === currentChatId);
    const conversationId = normalizeConversationIdValue(currentSession?.conversationId);
    if (!conversationId || conversationId === activeChatId) {
      return;
    }

    router.replace(`/c/${conversationId}`);
  }, [activeChatId, currentChatId, generalSessionId, router, sessions, variant]);

  const handleOpenHistoryEntry = (entry: SidebarHistoryEntry) => {
    if (!entry.href || entry.href === "#") {
      return;
    }
    if (shouldUseInlineChat) {
      setCurrentChatId(entry.id);
      setManualViewMode("chat");
      // Keep the URL in sync so the current conversation can be refreshed or shared.
      if (typeof window !== "undefined") {
        const nextHref = entry.href && entry.href !== "#" ? entry.href : `/c/${entry.id}`;
        window.history.pushState(null, "", nextHref);
      }
      return;
    }
    setManualViewMode(null);
    router.push(entry.href);
  };

  const handleOpenHistoryEntryExternal = (entry: SidebarHistoryEntry) => {
    if (!entry.href || entry.href === "#") {
      return;
    }
    window.open(entry.href, "_blank", "noopener,noreferrer");
  };

  const handleRenameHistoryEntry = useCallback((id: string) => {
    const session = sessions.find((s) => s.id === id);
    if (!session) return;
    const nextTitle = window.prompt("Rename conversation", session.title || "New Conversation");
    if (!nextTitle) {
      return;
    }
    renameSession(id, nextTitle);
  }, [sessions, renameSession]);

  const handleDeleteHistoryEntry = useCallback(
    (id: string) => {
      const confirmed = window.confirm("Delete this conversation? This cannot be undone.");
      if (!confirmed) {
        return;
      }

      const targetSession = sessions.find((session) => session.id === id) ?? null;
      const normalizedConversationId =
        normalizeConversationIdValue(targetSession?.conversationId) ?? null;

      try {
        sessionStorage.setItem(
          lastDeletedChatIdStorageKey,
          JSON.stringify({ sessionId: id, conversationId: normalizedConversationId })
        );
      } catch {
        // Ignore
      }

      deleteSession(id);

      const matchesActiveRoute =
        activeChatId === id ||
        (normalizedConversationId !== null && activeChatId === normalizedConversationId);
      const matchesCurrentChat =
        currentChatId === id ||
        (normalizedConversationId !== null && currentChatId === normalizedConversationId);

      if (matchesCurrentChat) {
        setCurrentChatId(generalSessionId);
      }

      if (!matchesActiveRoute && !matchesCurrentChat) {
        return;
      }

      if (shouldUseInlineChat) {
        setManualViewMode(null);
        return;
      }

      router.replace("/");
    },
    [
      activeChatId,
      currentChatId,
      deleteSession,
      generalSessionId,
      lastDeletedChatIdStorageKey,
      router,
      sessions,
      shouldUseInlineChat,
    ]
  );

  const handleRenameHistoryOverlayEntry = useCallback(
    (entry: SidebarHistoryEntry) => handleRenameHistoryEntry(entry.id),
    [handleRenameHistoryEntry]
  );

  const handleDeleteHistoryOverlayEntry = useCallback(
    (entry: SidebarHistoryEntry) => handleDeleteHistoryEntry(entry.id),
    [handleDeleteHistoryEntry]
  );

  const handlePinHistoryEntry = useCallback((id: string, pinned: boolean) => {
    void pinSession(id, pinned);
  }, [pinSession]);

  const greeting = `Good ${greetingForDate(now)}, ${viewerName}`;
  const hideChatThinkingIndicator = false;
  const shouldShowWorkspaceGreeting = variant !== "chat" && !shouldHideDesktopWorkspaceChrome;

  const renderWorkspaceGreeting = useCallback(
    () => {
      if (!shouldShowWorkspaceGreeting) {
        return null;
      }
      const shouldCenterGreeting =
        normalizedTier === "pioneer" &&
        typeof streakCount === "number" &&
        streakCount > 0;
      return (
        <div
          className={`${greetingStyles.greetingStack} hidden md:block`}
          {...(shouldCenterGreeting ? { "data-centered": "true" } : {})}
        >
          <h1 className={greetingStyles.greeting}>{greeting}</h1>
        </div>
      );
    },
    [greeting, shouldShowWorkspaceGreeting, normalizedTier, streakCount]
  );
  const dashboardTabAttr = isDashboardView ? dashboardTab : undefined;
  const isMobileCalendarView =
    isMobileViewport &&
    (dashboardTab === "calendar" || activeNav === "calendar" || pathname?.startsWith("/cal"));

  const generalAttachmentsActive =
    viewMode === "general" && (attachments.length > 0 || isAttachmentUploading);
  const generalAttachmentTray =
    viewMode === "general" ? (
      <AttachmentTray
        attachments={attachments}
        isUploading={isAttachmentUploading}
        error={attachmentError}
        onRemoveAttachment={removeAttachment}
      />
    ) : null;

  return (
    <>
      <div
        className={pageStyles.page}
        data-dashboard-tab={dashboardTabAttr}
        data-mobile-sidebar={isMobileViewport ? "true" : "false"}
        data-sidebar-expanded={sidebarExpandedForLayout ? "true" : "false"}
        {...(isMounted && { "data-general-attachments": generalAttachmentsActive ? "true" : "false" })}
      >
        {/* Mobile Header - only rendered after hydration to avoid SSR/CSR mismatch */}
        {isMounted ? (
          <GrayMobileHeader
            isSidebarExpanded={sidebarExpandedForLayout}
            isPulseActive={isMobileViewport ? mobilePulseActive : isPulseRoute}
            hideControls={isMobileCalendarView}
            streakCount={streakCount}
            onToggleSidebar={toggleSidebarExpandedForLayout}
            onSelectChat={handleMobileHeaderSelectChat}
            onSelectPulse={handleMobileHeaderSelectPulse}
            onCreateNewChat={handleMobileHeaderCreateNewChat}
          />
        ) : null}

        <div className={pageStyles.shell}>
          <div
            className={pageStyles.layout}
            data-view={viewMode}
            data-mobile-sidebar={isMobileViewport ? "true" : "false"}
            {...(isMounted && { "data-sidebar-expanded": sidebarExpandedForLayout ? "true" : "false" })}
          >


            <GrayEnhancedSidebar
              activeNav={activeNav ?? "general"}
              isExpanded={sidebarExpandedForLayout}
              onToggle={toggleSidebarExpandedForLayout}
              onExpand={expandSidebarForLayout}
              onCollapse={collapseSidebarForLayout}
              viewerName={viewerName}
              viewerInitials={viewerInitials}
              viewerAvatarUrl={viewerAvatarUrl}
              viewerAvatarColor={viewerAvatarColor}
              viewerPlanLabel={viewerPlanLabel}
              navItems={filteredSidebarItems}
              railItems={filteredRailItems}
              historySections={historySections}
              onNavigate={handleMobileNavigate}
              activeChatId={currentChatId ?? activeChatId ?? generalSessionId}
              onOpenSettings={handleOpenSettings}
              onOpenHelp={handleOpenHelp}
              onUpgradePlan={handleUpgradePlan}
              onLogOut={handleLogOut}
              onRenameHistoryEntry={handleRenameHistoryEntry}
              onDeleteHistoryEntry={handleDeleteHistoryEntry}
              onPinHistoryEntry={handlePinHistoryEntry}
              isLoadingHistory={!remoteConversationsLoaded}
            />

            {/* Mobile Sidebar Overlay */}
            <div
              className={pageStyles.main}
              data-dashboard={isDashboardView ? "true" : "false"}
              data-view={viewMode}
              data-dashboard-tab={dashboardTabAttr}
              data-compact={isCompactLayout ? "true" : "false"}
              {...(isMounted && { "data-general-attachments": generalAttachmentsActive ? "true" : "false" })}
              data-dashboard-free="true"
            >
              {/* Mobile Sidebar Overlay */}
              {isMounted && (
                <div
                  className={pageStyles.overlay}
                  data-visible={isMobileViewport && sidebarExpandedForLayout ? "true" : "false"}
                  onClick={() => {
                    if (isMobileViewport) {
                      collapseSidebarForLayout();
                    }
                  }}
                  aria-hidden="true"
                />
              )}

              {/* Centered Transparent Logo (mobile only; hidden on desktop via CSS) */}


              {isMobileViewport ? (
                mobilePulseActive ? (
                  renderDashboardSurface()
                ) : (
                  renderMobileChatSurface()
                )
              ) : isDashboardView ? (
                renderPrimaryView()
              ) : (
                renderMainSurface()
              )}
              {isMounted && viewMode === "general" && !(isMobileViewport && mobilePulseActive) ? (
                <div className={composerStyles.chatComposerDock} data-surface="threads">
                  <div className={composerStyles.chatAttachmentTopTray}>{generalAttachmentTray}</div>
                  <input
                    ref={attachmentInputRef}
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    className={composerStyles.chatAttachmentInput}
                    onChange={handleAttachmentInputChange}
                  />
                  {isUsageLimitReached && usageStatus && (
                    <UsageLimitBanner usageStatus={usageStatus} />
                  )}
                  <GrayChatComposer
                    value={threadComposerDraft}
                    onChange={setThreadComposerDraft}
                    onSubmit={handleThreadComposerSubmit}
                    showUnderline={false}
                    onAddAttachment={openAttachmentPicker}
                    onPasteFiles={handleAttachmentPaste}
                    onToggleVoiceInput={handleToggleVoiceInput}
                    isVoiceInputSupported={isVoiceInputSupported}
                    isVoiceInputActive={isVoiceInputActive}
                    isInputDisabled={isUsageLimitReached}
                    {...(isUsageLimitReached ? { isSubmitDisabled: true } : {})}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
        {isSettingsOpen && (
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            initialSection={settingsInitialSection}
            contextUsage={contextUsageSummary}
          />
        )}

        {showSignUpPrompt && (
          <SignUpPromptModal
            isOpen={showSignUpPrompt}
            onClose={() => setShowSignUpPrompt(false)}
            messagesUsed={anonMessageCount}
            messageLimit={ANON_MESSAGE_LIMIT_VALUE}
          />
        )}
        <HistoryOverlay
          isOpen={isHistoryOverlayOpen}
          onClose={() => setIsHistoryOverlayOpen(false)}
          sections={historySections}
          onOpenEntry={handleOpenHistoryEntry}
          onOpenEntryExternal={handleOpenHistoryEntryExternal}
          onRenameEntry={handleRenameHistoryOverlayEntry}
          onDeleteEntry={handleDeleteHistoryOverlayEntry}
          onCreateNewChat={() => {
            getOrCreateGeneralSessionId();
            handleNavigate("threads");
          }}
        />
      </div>
    </>
  );
}

export const GrayPageClient = dynamic(() => Promise.resolve(GrayPageClientInner), {
  ssr: false,
}) as typeof GrayPageClientInner;

export default GrayPageClient;
