"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@/contexts/UserContext";
import {
  apiService,
  isApiNetworkError,
} from "@/lib/api";
import { requestNotificationPermission } from "@/lib/notificationUtils";
import { formatDisplayName } from "@/lib/names";
import { clearAuthCookies } from "@/lib/auth/cookies";
import { getSupabaseClient } from "@/lib/supabaseClient";
import styles from "./GrayPageClient.module.css";
import {
  type PlanItem,
  type PlanUpdates,
  type HabitItem,
  type HabitUpdates,
  type ProactivityItem,
  type SidebarNavKey,
  type SidebarHistoryEntry,
  type ContextUsageSummary,
} from "@/components/gray/types";
import type { CalendarEvent, CalendarInfo } from "@/components/calendar/types";
import {
  useChatStore,
} from "@/components/gray/ChatProvider";
import {
  GENERAL_CHAT_SESSION_ID,
  SHARED_CHAT_PLACEHOLDER_TITLE,
} from "@/components/gray/chat/constants";
import { EventComposerPayload } from "@/components/calendar/EventComposer";
import { useI18n } from "@/contexts/I18nContext";
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
import { PLAN_EVENT_ID_PREFIX } from "@/components/gray/planCalendarUtils";
import { GrayMobileHeader } from "./components/GrayMobileHeader";

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

const AddPlanHabitModal = dynamic(
  () => import("@/components/gray/AddPlanHabitModal").then((mod) => mod.AddPlanHabitModal),
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
  const { t } = useI18n();
  const { user, loading: userLoading } = useUser();
  const { notificationPreferences, setNotificationPreference } = useNotificationPreferences();
  const usageStatus = user?.usage_status;
  const isUsageLimitReached = usageStatus?.is_monthly_limit_reached || usageStatus?.is_six_hour_limit_reached;
  const router = useRouter();
  const pathname = usePathname();
  const [now, setNow] = useState(() => new Date(initialTimestamp));

  // Derived state for hooks
  const userId = typeof user?.id === "number" ? user.id : null;
  const resolvedTimezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
    } catch {
      return "UTC";
    }
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

  // Custom Hooks
  const {
    plans,
    setPlans,
    habits,
    setHabits,
    calendarCalendars,
    setCalendarCalendars,
    calendarEvents,
    setCalendarEvents,
    refreshPlansAndHabits
  } = useWorkspaceData(userId, variant);

  const {
    proactivity,
    setProactivity,
    persistProactivitySettings
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
  const supportsInlineChat = variant !== "chat";
  const [currentChatId, setCurrentChatId] = useState<string | null>(() => activeChatId ?? null);
  const [isCompactLayout, setIsCompactLayout] = useState(false);
  const ensureSessionRef = useRef(ensureSession);
  const { deliveredKeys: deliveredProactivityKeys } = useProactivityNotifications();
  const lastDeletedChatIdStorageKey = "gray:lastDeletedChatId";

  const derivedPlans = user ? plans : [];
  const derivedHabits = user ? habits : [];

  const [threadComposerDraft, setThreadComposerDraft] = useState("");
  const threadComposerControls = useMemo(
    () => ({
      clear: () => setThreadComposerDraft(""),
      restore: (value: string) => setThreadComposerDraft(value),
    }),
    []
  );

  const handleCreatePlan = useCallback(async (payload: EventComposerPayload) => {
    if (!user?.id) return;

    const formatTime = (date: Date) => {
      // Format as HH:MM in 24h format
      return date.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' });
    };

    const startStr = formatTime(payload.start);
    const endStr = formatTime(payload.end);
    const scheduleSlot = `${startStr}-${endStr}`;

    await apiService.createPlan(user.id, {
      label: payload.title,
      completed: false,
      deadline: null,
      scheduleSlot: scheduleSlot,
      description: payload.description || null,
    });

    await refreshPlansAndHabits();
  }, [user?.id, refreshPlansAndHabits]);

  const handleCreateHabit = useCallback(async (payload: EventComposerPayload) => {
    if (!user?.id) return;

    await apiService.createHabit(user.id, {
      label: payload.title,
      previous_label: t("No history yet"),
      description: payload.description || null,
    });

    await refreshPlansAndHabits();
  }, [user?.id, refreshPlansAndHabits, t]);

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
    setPulseEntries,
    setActivePulseId,
    activePulse,
    isActivePulseEditable
  } = usePulse(userId, todayAnchor, nowDateKey, derivedPlans, derivedHabits, proactivity, sendDashboardNotification);

  const [habitEditorTarget, setHabitEditorTarget] = useState<HabitItem | null>(null);

  const readSidebarExpandedPreference = useCallback(() => {
    if (typeof window === "undefined") {
      return defaultSidebarExpandedDesktop;
    }
    try {
      const stored = localStorage.getItem(sidebarPreferenceKey);
      if (stored === "true") return true;
      if (stored === "false") return false;
    } catch {
      // localStorage may be unavailable
    }
    return defaultSidebarExpandedDesktop;
  }, [defaultSidebarExpandedDesktop, sidebarPreferenceKey]);

  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === "undefined") return false;
    return (window.innerWidth || 0) <= 768;
  });

  const [isSidebarExpanded, setIsSidebarExpanded] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return defaultSidebarExpandedDesktop;
    }
    const shouldCollapseSidebar = (window.innerWidth || 0) <= 768;
    if (shouldCollapseSidebar) return false;
    try {
      const stored = localStorage.getItem(sidebarPreferenceKey);
      if (stored === "true") return true;
      if (stored === "false") return false;
    } catch {
      // localStorage may be unavailable
    }
    return defaultSidebarExpandedDesktop;
  });

  const [isCalendarSidebarExpanded, setIsCalendarSidebarExpanded] = useState(false);

  const [isMounted, setIsMounted] = useState(false);
  const wasMobileViewportRef = useRef(isMobileViewport);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (supportsInlineChat) {
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
  }, [activeChatId, lastDeletedChatIdStorageKey, router, supportsInlineChat]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleResize = () => {
      const width = window.innerWidth || 0;
      const shouldCollapseSidebar = width <= 768;

      setIsMobileViewport(shouldCollapseSidebar);

      setIsSidebarExpanded((previous) => {
        if (shouldCollapseSidebar) {
          wasMobileViewportRef.current = true;
          return false;
        }
        if (wasMobileViewportRef.current) {
          wasMobileViewportRef.current = false;
          return readSidebarExpandedPreference();
        }
        return previous;
      });
    };

    // Initial check
    handleResize();

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, [readSidebarExpandedPreference]);

  // Persist sidebar preference to localStorage when it changes (desktop only)
  useEffect(() => {
    if (typeof window === "undefined" || isMobileViewport) {
      return;
    }
    try {
      localStorage.setItem(sidebarPreferenceKey, isSidebarExpanded ? "true" : "false");
    } catch {
      // localStorage may be unavailable
    }
  }, [isSidebarExpanded, isMobileViewport, sidebarPreferenceKey]);

  const isCalendarPage = pathname === "/pulse" || pathname.startsWith("/cal");
  const toggleSidebarExpandedForLayout = useCallback(() => {
    if (isCalendarPage) {
      setIsCalendarSidebarExpanded((previous) => !previous);
      return;
    }
    setIsSidebarExpanded((previous) => !previous);
  }, [isCalendarPage]);
  const expandSidebarForLayout = useCallback(() => {
    if (isCalendarPage) {
      setIsCalendarSidebarExpanded(true);
      return;
    }
    setIsSidebarExpanded(true);
  }, [isCalendarPage]);
  const collapseSidebarForLayout = useCallback(() => {
    if (isCalendarPage) {
      setIsCalendarSidebarExpanded(false);
      return;
    }
    setIsSidebarExpanded(false);
  }, [isCalendarPage]);

  useEffect(() => {
    if (isCalendarPage) {
      setIsCalendarSidebarExpanded(false);
    }
  }, [isCalendarPage]);

  const [dashboardTab, setDashboardTab] = useState<"pulse" | "calendar">(() => initialDashboardTab);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialSection, setSettingsInitialSection] = useState<
    "account" | "preferences" | "personalization" | "data_controls"
  >("account");
  const [contextUsageSummary, setContextUsageSummary] = useState<ContextUsageSummary | null>(null);
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<Date>(() => new Date(initialTimestamp));

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
        await apiService.triggerProactivityForUser(userId);
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
    if (supportsInlineChat && (activeChatId ?? null)) {
      return "chat";
    }
    return activeNav === "history" && baseViewMode !== "chat" ? "history" : null;
  });

  const viewMode: ViewMode =
    baseViewMode === "chat"
      ? "chat"
      : manualViewMode ?? (activeNav === "history" ? "history" : baseViewMode);

  const handleMobileHeaderSelectChat = useCallback(() => {
    setManualViewMode(null);
    if (pathname !== "/") {
      router.push("/");
    }
    if (isMobileViewport) {
      setIsSidebarExpanded(false);
      setIsCalendarSidebarExpanded(false);
    }
  }, [isMobileViewport, pathname, router]);

  const handleMobileHeaderSelectPulse = useCallback(() => {
    setManualViewMode(null);
    if (pathname !== "/pulse") {
      router.push("/pulse");
    }
    if (isMobileViewport) {
      setIsSidebarExpanded(false);
      setIsCalendarSidebarExpanded(false);
    }
  }, [isMobileViewport, pathname, router]);

  const shouldHideDesktopWorkspaceChrome =
    !isMobileViewport &&
    (viewMode === "chat" ||
      (pathname?.startsWith("/c/") ?? false) ||
      pathname === "/g" ||
      (pathname?.startsWith("/g/") ?? false));
  const renderPrimaryView = () => {
    if (isDashboardView) {
      return (
        <GrayDashboardView
          pulseEntries={pulseEntries}
          currentPulse={activePulse}
          isCurrentPulseEditable={isActivePulseEditable}
          onSelectPulse={setActivePulseId}
          proactivityFallback={proactivity}
          onProactivitySelect={selectProactivityPreset}
          onProactivityRemove={removeProactivity}
          onTestProactivity={handleTestProactivity}
          onTogglePlan={togglePlan}
          onToggleHabit={toggleHabit}
          onSavePlan={savePlan}
          onDeletePlan={deletePlan}
          activeTab={dashboardTab}
          onSelectTab={setDashboardTab}
          currentDate={now}
          calendars={derivedCalendars}
          onCalendarsChange={handleCalendarsChange}
          calendarEvents={derivedEvents}
          onCalendarEventsChange={handleEventsChange}
          calendarSelectedDate={calendarSelectedDate}
          onCalendarSelectedDateChange={setCalendarSelectedDate}
          onEditHabit={editHabit}
          onDeleteHabit={deleteHabit}
          onIntegrationAction={handleCalendarIntegration}
          onRefreshData={refreshPlansAndHabits}
          onCreatePlan={handleCreatePlan}
          onCreateHabit={handleCreateHabit}
          chatBar={null}
          isCompactLayout={isCompactLayout}
          userId={userId}
          proactivityDeliveryKeys={deliveredProactivityKeys}
          onUpgradeClick={handleUpgradePlan}
          showUpgradeButton={shouldShowUpgradeButton}
        />
      );
    }
    if (isChatView) {

      return (
        <GrayChatView
          sessionId={currentChatId ?? null}
          onContextUsageChange={setContextUsageSummary}
          hideThinkingIndicator={hideChatThinkingIndicator}
          introContent={null}
        />
      );
    }

    return (
      <div className={styles.generalViewSection}>
        <GrayGeneralView
          greeting={greeting}
          currentDate={now}
          plans={derivedPlans}
          habits={derivedHabits}
          proactivity={proactivity}
          onSelectProactivity={selectProactivityPreset}
          onRemoveProactivity={removeProactivity}
          onTogglePlan={togglePlan}
          onToggleHabit={toggleHabit}
          onSavePlan={savePlan}
          onDeletePlan={deletePlan}
	          onDeleteHabit={deleteHabit}
	          onRefreshData={refreshPlansAndHabits}
	          showGreeting={false}
	          hidePlans={isMobileViewport}
	        />
	      </div>
	    );
	  };

  // Close mobile sidebar on navigation
  const handleMobileNavigate = (nav: SidebarNavKey) => {
    handleNavigate(nav);
    if (isMobileViewport) {
      collapseSidebarForLayout();
    }
  };

  const renderMainSurface = () => {
    if (viewMode === "chat") {
      return (
        <div
          className={styles.mainContent}
          data-view={viewMode}
          data-compact={isCompactLayout ? "true" : "false"}
        >
          {!shouldHideDesktopWorkspaceChrome ? (
            <GrayWorkspaceHeader
              planLabel={viewerPlanLabel}
              onUpgradeClick={handleUpgradePlan}
              showUpgradeButton={shouldShowUpgradeButton}
              hideDesktopMeta={shouldHideDesktopWorkspaceChrome}
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
          className={styles.mainContent}
          data-view={viewMode}
          data-compact={isCompactLayout ? "true" : "false"}
        >
          {/* Welcome overlay for the main "/" (threads) surface */}
          {pathname === "/" && activeNav === "threads" ? (
            <div className={styles.mobileWelcomeScreen} aria-hidden="true">
                <div className={styles.mobileWelcomeContent}>
                  <div className={styles.mobileWelcomeLogo}>
                  <Image
                    src="/grayaiwhitenotspinning.svg"
                    alt=""
                    width={40}
                    height={40}
                    className={styles.uiIconImage}
                  />
                  </div>
                  <p className={styles.mobileWelcomeGreeting}>Ready when you are.</p>
                </div>
            </div>
          ) : null}
          {!shouldHideDesktopWorkspaceChrome ? (
            <GrayWorkspaceHeader
              planLabel={viewerPlanLabel}
              onUpgradeClick={handleUpgradePlan}
              showUpgradeButton={shouldShowUpgradeButton}
              hideDesktopMeta={shouldHideDesktopWorkspaceChrome}
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

  useEffect(() => {
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
  }, [activeNav, baseViewMode, manualViewMode]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const evaluateViewport = () => {
      const width = window.innerWidth || 0;
      const height = window.innerHeight || 0;
      const aspectRatio = height > 0 ? height / Math.max(width, 1) : 0;
      const shouldUseCompactLayout = width <= 1024 || aspectRatio >= 1.1;
      setIsCompactLayout((previous) =>
        previous === shouldUseCompactLayout ? previous : shouldUseCompactLayout
      );
    };

    evaluateViewport();
    window.addEventListener("resize", evaluateViewport);
    window.addEventListener("orientationchange", evaluateViewport);
    return () => {
      window.removeEventListener("resize", evaluateViewport);
      window.removeEventListener("orientationchange", evaluateViewport);
    };
  }, []);

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

  const isScout = viewerPlanLabel === "Scout";

  useEffect(() => {
    if (isScout && dashboardTab === "calendar") {
      setDashboardTab("pulse");
    }
  }, [isScout, dashboardTab]);

  useEffect(() => {
    if (!isScout) {
      return;
    }

    if (activeNav === "calendar" || pathname === "/cal") {
      router.replace(NAVIGATION_ROUTES.general ?? "/g");
    }
  }, [activeNav, isScout, pathname, router]);

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
    if (isScout) {
      return SIDEBAR_ITEMS.filter((item) => item.id !== "calendar");
    }
    return SIDEBAR_ITEMS;
  }, [isScout]);

  const filteredRailItems = useMemo(() => {
    if (isScout) {
      return SIDEBAR_RAIL_ITEMS.filter((item) => item.id !== "calendar");
    }
    return SIDEBAR_RAIL_ITEMS;
  }, [isScout]);

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
        await supabase.auth.signOut();
      }
    } catch (error) {
      console.error("Failed to log out:", error);
    } finally {
      clearAuthCookies();
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

  const togglePlan = (id: string) => {
    if (!user) {
      return;
    }

    if (!isActivePulseEditable && pulseEntries.length > 0) {
      return;
    }

    const planId = Number(id);
    if (Number.isNaN(planId)) {
      return;
    }

    const previousPlans = plans;
    const targetPlan = previousPlans.find((plan) => plan.id === id);
    if (!targetPlan) {
      return;
    }

    const nextCompleted = !targetPlan.completed;
    const updatedPlans = previousPlans.map((plan) =>
      plan.id === id ? { ...plan, completed: nextCompleted } : plan
    );

    setPlans(updatedPlans);

    apiService
      .updatePlan(user.id, planId, { completed: nextCompleted })
      .catch((error) => {
        console.error("Failed to update plan:", error);
        setPlans(previousPlans);
      });
  };

  const savePlan = async (planId: string, updates: PlanUpdates) => {
    if (!user) {
      return;
    }
    if (!isActivePulseEditable && pulseEntries.length > 0) {
      return;
    }

    const numericPlanId = Number(planId);
    if (Number.isNaN(numericPlanId)) {
      return;
    }

    const previousPlans = plans;
    const updatedPlans = previousPlans.map((plan) =>
      plan.id === planId
        ? {
          ...plan,
          label: updates.label,
          deadline: updates.deadline ?? null,
          scheduleSlot: updates.scheduleSlot ?? null,
          details: updates.details ?? null,
          reminderAt: "reminderAt" in updates ? (updates.reminderAt ?? null) : plan.reminderAt ?? null,
          color: "color" in updates ? (updates.color ?? null) : plan.color ?? null,
        }
        : plan
    );

    setPlans(updatedPlans);
    const targetPlan = previousPlans.find((plan) => plan.id === planId);
    const planLabel = updates.label || targetPlan?.label || "Plan";
    void sendDashboardNotification("Plan saved", `${planLabel} updated in today's pulse.`);

    try {
      const updatePayload: Parameters<typeof apiService.updatePlan>[2] = {
        label: updates.label,
        description: updates.details ?? null,
        deadline: updates.deadline ?? null,
        scheduleSlot: updates.scheduleSlot ?? null,
      };
      if ("reminderAt" in updates) {
        updatePayload.reminderAt = updates.reminderAt ?? null;
      }
      if ("color" in updates) {
        updatePayload.color = updates.color ?? null;
      }
      await apiService.updatePlan(user.id, numericPlanId, updatePayload);
    } catch (error) {
      console.error("Failed to update plan:", error);
      setPlans(previousPlans);
      throw error;
    }
  };

  const deletePlan = (planToDelete: PlanItem) => {
    if (!user) {
      return;
    }
    if (!isActivePulseEditable && pulseEntries.length > 0) {
      return;
    }

    const planId = Number(planToDelete.id);
    if (Number.isNaN(planId)) {
      return;
    }

    const previousPlans = plans;
    const updatedPlans = previousPlans.filter((plan) => plan.id !== planToDelete.id);
    setPlans(updatedPlans);

    apiService
      .deletePlan(user.id, planId)
      .catch((error) => {
        console.error("Failed to delete plan:", error);
        setPlans(previousPlans);
      });
  };

  const toggleHabit = async (id: string) => {
    if (!user) {
      return;
    }
    if (!isActivePulseEditable && pulseEntries.length > 0) {
      return;
    }
    const previousHabits = habits;
    const targetHabit = previousHabits.find((habit) => habit.id === id);
    if (!targetHabit) {
      return;
    }

    const updatedHabits = previousHabits.map((habit) =>
      habit.id === id
        ? {
          ...habit,
          completed: !habit.completed,
        }
        : habit
    );

    // 1. Update local habits state (definitions)
    setHabits(updatedHabits);

    // 2. Update Pulse Entries (Dashboard View source of truth)
    // We must manually update this so that:
    // a) The UI updates immediately
    // b) The usePulse sync logic (which preserves existing pulse status) sees the new status
    if (activePulse) {
      const updatedPulseHabits = activePulse.habits.map((h) => {
        if (h.id === id) {
          const updatedH = updatedHabits.find((uh) => uh.id === id);
          if (updatedH) {
            return {
              ...h,
              completed: updatedH.completed,
            };
          }
        }
        return h;
      });

      const newActivePulse = { ...activePulse, habits: updatedPulseHabits };

      setPulseEntries((prev) =>
        prev.map((p) => (p.id === activePulse.id ? newActivePulse : p))
      );

      // 3. Persist to API
      try {
        await apiService.createOrUpdateDashboardPulse(user.id, {
          date_key: newActivePulse.dateKey,
          timestamp: newActivePulse.timestamp,
          plans: newActivePulse.plans, // Use existing plans
          habits: newActivePulse.habits.map((h) => ({
            id: h.id,
            label: h.label,
            previous_label: h.previousLabel,
            completed: Boolean(h.completed),
          })),
          proactivity: {
            id: newActivePulse.proactivity?.id ?? "proactivity-1",
            label: newActivePulse.proactivity?.label ?? "Check-ins",
            description: newActivePulse.proactivity?.description ?? null,
            cadence: newActivePulse.proactivity?.cadence ?? "Manual",
            time: newActivePulse.proactivity?.time ?? "09:00",
          },
          carry_forward: false,
        });
      } catch (err) {
        console.error("Failed to save habit toggle to pulse:", err);
        // Optional: Revert state on error?
      }
    }
  };

  const handleHabitModalSubmit = useCallback(
    async (habitId: string | null, updates: HabitUpdates) => {
      if (typeof userId !== "number") {
        throw new Error("You need to be signed in to update habits.");
      }
      if (!habitId) {
        throw new Error("Missing habit id.");
      }
      const numericId = Number(habitId);
      if (Number.isNaN(numericId)) {
        throw new Error("Invalid habit id.");
      }
      const previousHabits = habits;
      const updatedHabits = previousHabits.map((habit) =>
        habit.id === habitId
          ? { ...habit, label: updates.label, details: updates.details ?? habit.details }
          : habit
      );
      setHabits(updatedHabits);
      try {
        await apiService.updateHabit(userId, numericId, {
          label: updates.label,
          description: updates.details ?? null,
        });
      } catch (error) {
        console.error("Failed to update habit:", error);
        setHabits(previousHabits);
        throw (error instanceof Error ? error : new Error("Failed to update habit."));
      }
    },
    [habits, setHabits, userId]
  );

  const editHabit = (habitToEdit: HabitItem) => {
    if (!user) {
      return;
    }
    if (!isActivePulseEditable && pulseEntries.length > 0) {
      return;
    }
    setHabitEditorTarget(habitToEdit);
  };

  const deleteHabit = (habitToDelete: HabitItem) => {
    if (!user) {
      return;
    }
    if (!isActivePulseEditable && pulseEntries.length > 0) {
      return;
    }

    const habitId = Number(habitToDelete.id);
    if (Number.isNaN(habitId)) {
      return;
    }

    const previousHabits = habits;
    const updatedHabits = previousHabits.filter((habit) => habit.id !== habitToDelete.id);
    setHabits(updatedHabits);

    apiService
      .deleteHabit(user.id, habitId)
      .catch((error: unknown) => {
        console.error("Failed to delete habit:", error);
        const message = error instanceof Error ? error.message : String(error);
        // If habit is already deleted on backend, keep it removed from UI
        if (message.includes("Habit not found")) {
          return;
        }
        // For other errors, restore the habit in UI
        setHabits(previousHabits);
      });
  };

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
      !notificationPreferences.device
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

  // Calendar-driven plan updates should always sync to the backend,
  // even when historical pulse snapshots are view-only.
  const persistPlanFromCalendarMove = async (planId: string, updates: PlanUpdates) => {
    if (!user) {
      return;
    }

    const numericPlanId = Number(planId);
    if (Number.isNaN(numericPlanId)) {
      return;
    }

    const previousPlans = plans;
    const updatedPlans = previousPlans.map((plan) =>
      plan.id === planId
        ? {
          ...plan,
          label: updates.label,
          deadline: updates.deadline ?? null,
          scheduleSlot: updates.scheduleSlot ?? null,
          details: updates.details ?? null,
        }
        : plan
    );

    setPlans(updatedPlans);

    try {
      await apiService.updatePlan(user.id, numericPlanId, {
        label: updates.label,
        description: updates.details ?? null,
        deadline: updates.deadline ?? null,
        scheduleSlot: updates.scheduleSlot ?? null,
      });
    } catch (error) {
      console.error("Failed to update plan from calendar move:", error);
      setPlans(previousPlans);
    }
  };

  const handleCalendarsChange = (nextCalendars: CalendarInfo[]) => {
    const previousCalendars = new Map(calendarCalendars.map((calendar) => [calendar.id, calendar]));
    setCalendarCalendars(nextCalendars);

    if (!user) {
      return;
    }

    const changedCalendars: string[] = [];
    nextCalendars.forEach((calendar) => {
      const previous = previousCalendars.get(calendar.id);
      if (
        !previous ||
        previous.label !== calendar.label ||
        previous.color !== calendar.color ||
        previous.isVisible !== calendar.isVisible
      ) {
        const calendarId = Number(calendar.id);
        if (Number.isNaN(calendarId)) {
          return;
        }

        apiService
          .updateCalendar(user.id, calendarId, {
            label: calendar.label,
            color: calendar.color,
            is_visible: calendar.isVisible,
          })
          .catch((error) => {
            console.error("Failed to update calendar:", error);
          });
        changedCalendars.push(calendar.label);
      }
    });
    // Intentionally suppress desktop notifications for calendar visibility/label tweaks.
  };

	  const handleEventsChange = async (allEvents: CalendarEvent[]) => {
	    // 1. Separate events by type
	    const planEvents = allEvents.filter((e) => e.id.startsWith(PLAN_EVENT_ID_PREFIX));
	    const standardEvents = allEvents.filter((e) => !e.id.startsWith(PLAN_EVENT_ID_PREFIX));

    // 2. Handle Plans (Update schedule + deadline day when moved between days)
    // We compare against current `plans` state to see if schedule or day changed.
    planEvents.forEach((event) => {
      const planId = event.id.slice(PLAN_EVENT_ID_PREFIX.length);
      const originalPlan = plans.find((p) => p.id === planId);
      if (!originalPlan) return;

      // Construct new schedule slot
      const formatTime = (value: Date) =>
        `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
      const newScheduleSlot = `${formatTime(event.start)}-${formatTime(event.end)}`;

      const existingDeadlineIso = originalPlan.deadline ?? null;
      let nextDeadlineIso = existingDeadlineIso;

      if (existingDeadlineIso) {
        const existingDeadline = new Date(existingDeadlineIso);
        if (!Number.isNaN(existingDeadline.getTime())) {
          const sameDateKey = (value: Date) =>
            `${value.getFullYear()}-${value.getMonth()}-${value.getDate()}`;
          const originalDateKey = sameDateKey(existingDeadline);
          const nextDateKey = sameDateKey(event.start);

          // If the event was moved to a different day (horizontal drag),
          // update the plan's deadline to match the new day while preserving
          // the original deadline's time-of-day.
          if (originalDateKey !== nextDateKey) {
            const updatedDeadline = new Date(existingDeadline);
            updatedDeadline.setFullYear(
              event.start.getFullYear(),
              event.start.getMonth(),
              event.start.getDate()
            );
            nextDeadlineIso = updatedDeadline.toISOString();
          }
        }
      }

      const scheduleChanged = originalPlan.scheduleSlot !== newScheduleSlot;
      const deadlineChanged = nextDeadlineIso !== existingDeadlineIso;

      if (!scheduleChanged && !deadlineChanged) {
        return;
      }

      void persistPlanFromCalendarMove(planId, {
        label: originalPlan.label,
        details: originalPlan.details ?? null,
        deadline: nextDeadlineIso,
        scheduleSlot: newScheduleSlot,
      });
    });

	    // 3. Capture previous events BEFORE any state changes for accurate comparison
	    const previousEvents = calendarEvents;
	    const previousStandardEvents = previousEvents.filter(
	      (event) => !event.id.startsWith(PLAN_EVENT_ID_PREFIX)
	    );
	    const nextStandardEvents = standardEvents;
	
	    // 4. Update Calendar State (Standard + Plans)
	    // We need to preserve plan events in the calendar state to prevent them from disappearing
	    // when events are clicked or moved. Plan data lives in `plans` state, but the calendar
	    // events derived from plans need to remain in calendarEvents for rendering.
	    const nextStateEvents = [...nextStandardEvents, ...planEvents];
	    setCalendarEvents(nextStateEvents);

    if (!user) {
      return;
    }

    const revertUpdate = (failedId: string) => {
      const original = previousEvents.find((e) => e.id === failedId);
      if (original) {
        setCalendarEvents((current) => current.map((e) => (e.id === failedId ? original : e)));
      }
    };

    const revertDelete = (failedId: string) => {
      const original = previousEvents.find((e) => e.id === failedId);
      if (original) {
        setCalendarEvents((current) => [...current, original]);
      }
    };

    const revertCreate = (tempId: string) => {
      setCalendarEvents((current) => current.filter((e) => e.id !== tempId));
    };

    const logCalendarSyncError = (action: string, error: unknown) => {
      if (isApiNetworkError(error)) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[Calendar sync offline] ${action}`, { message });
        return;
      }
      console.error(`Failed to ${action}:`, error);
	    };
	
	    // Find deleted events (in previous but not in next)
	    const deletedEventIds = previousStandardEvents
	      .filter(
	        (previousEvent) => !nextStandardEvents.some((nextEvent) => nextEvent.id === previousEvent.id)
	      )
	      .map((event) => event.id);
	
	    // Find new events (in next but not in previous)
	    const newEvents = nextStandardEvents.filter(
	      (nextEvent) => !previousStandardEvents.some((previousEvent) => previousEvent.id === nextEvent.id)
	    );
	
	    // Find updated events (in both, but with different data)
	    const updatedEvents = nextStandardEvents.filter((nextEvent) => {
	      const previousEvent = previousStandardEvents.find((event) => event.id === nextEvent.id);
	      if (!previousEvent) {
	        return false;
	      }
	      return (
	        previousEvent.title !== nextEvent.title ||
	        previousEvent.start.getTime() !== nextEvent.start.getTime() ||
	        previousEvent.end.getTime() !== nextEvent.end.getTime() ||
	        previousEvent.description !== nextEvent.description ||
	        previousEvent.calendarId !== nextEvent.calendarId ||
	        previousEvent.color !== nextEvent.color ||
	        previousEvent.reminderMinutesBefore !== nextEvent.reminderMinutesBefore
	      );
	    });

    // Delete removed events
    for (const eventId of deletedEventIds) {
      const numericId = Number(eventId);
      if (Number.isNaN(numericId)) {
        continue;
      }

      try {
        await apiService.deleteCalendarEvent(user.id, numericId);
      } catch (error) {
        logCalendarSyncError("delete calendar event", error);
        revertDelete(eventId);
        return;
      }
    }

    // Create new events
    for (const event of newEvents) {
      const numericCalendarId = event.calendarId ? Number(event.calendarId) : null;
      if (Number.isNaN(numericCalendarId) && event.calendarId !== "default") {
        continue;
      }

      try {
        const createdEvent = await apiService.createCalendarEvent(user.id, {
          calendar_id: event.calendarId === "default" ? null : numericCalendarId,
          title: event.title,
          description: event.description,
          start_time: event.start.toISOString(),
          end_time: event.end.toISOString(),
          color: event.color,
          reminder_minutes_before: event.reminderMinutesBefore ?? null,
        });
        // Update the local state with the real ID from the backend
        setCalendarEvents((previous) =>
          previous.map((existing) =>
            existing.id === event.id ? { ...existing, id: createdEvent.id.toString() } : existing
          )
        );
      } catch (error) {
        logCalendarSyncError("create calendar event", error);
        revertCreate(event.id);
        return;
      }
    }

    // Update existing events
    for (const event of updatedEvents) {
      // Handle temporary events (evt-*) that were created locally but not yet persisted
      if (event.id.startsWith("evt-")) {
        const numericCalendarId = event.calendarId ? Number(event.calendarId) : null;
        if (Number.isNaN(numericCalendarId) && event.calendarId !== "default") {
          continue;
        }

        try {
          const createdEvent = await apiService.createCalendarEvent(user.id, {
            calendar_id: event.calendarId === "default" ? null : numericCalendarId,
            title: event.title,
            description: event.description,
            start_time: event.start.toISOString(),
            end_time: event.end.toISOString(),
            color: event.color,
            reminder_minutes_before: event.reminderMinutesBefore ?? null,
          });
          setCalendarEvents((previous) =>
            previous.map((existing) =>
              existing.id === event.id ? { ...existing, id: createdEvent.id.toString() } : existing
            )
          );
        } catch (error) {
          logCalendarSyncError("create calendar event from temporary", error);
        }

        continue;
      }

      const numericEventId = Number(event.id);
      const numericCalendarId = event.calendarId ? Number(event.calendarId) : null;
      if (
        Number.isNaN(numericEventId) ||
        (Number.isNaN(numericCalendarId) && event.calendarId !== "default")
      ) {
        continue;
      }

      try {
        await apiService.updateCalendarEvent(user.id, numericEventId, {
          calendar_id: event.calendarId === "default" ? null : numericCalendarId,
          title: event.title,
          description: event.description,
          start_time: event.start.toISOString(),
          end_time: event.end.toISOString(),
          color: event.color,
          reminder_minutes_before: event.reminderMinutesBefore ?? null,
        });
      } catch (error) {
        // If event doesn't exist in database (404), skip the API call and keep optimistic update
        if (error instanceof Error && error.message.includes("Not Found")) {
          continue;
        }
        logCalendarSyncError("update calendar event", error);
        revertUpdate(event.id);
        return;
      }
    }

    // Suppress desktop notifications for routine calendar event edits/moves.
  };

  const handleCalendarIntegration = useCallback(() => {
    if (!user) {
      console.warn("Unable to start Google Calendar integration without a user.");
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const callbackUrl = `${window.location.origin}/api/auth/google-calendar/callback`;
    const oauthStorageKey = "gray_google_calendar_oauth";

    // Open the popup synchronously so browsers don't block it (the auth URL is fetched async).
    const popup = window.open(
      "about:blank",
      "google-calendar-oauth",
      "popup=yes,width=520,height=720"
    );

    const writePopupStatus = (title: string, message: string) => {
      if (!popup || popup.closed) {
        return;
      }
      try {
        const escapedTitle = title.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const escapedMessage = message.replace(/</g, "&lt;").replace(/>/g, "&gt;");
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

    if (popup) {
      writePopupStatus("Connecting to Google Calendar…", "Loading Google authorization…");
    }

    void (async () => {
      try {
        const response = await apiService.requestGoogleCalendarAuth(user.id, {
          redirectUri: callbackUrl,
        });
        const authUrl = response?.authorization_url;

        if (!authUrl) {
          writePopupStatus(
            "Unable to start Google Calendar setup",
            "The backend did not return an authorization URL. Please check the server logs and try again."
          );
          console.error("Google Calendar integration response did not include an authorization URL.", response);
          return;
        }

        if (popup) {
          popup.location.href = authUrl;
          popup.focus?.();
          return;
        }

        // Popup blocked: fall back to same-tab navigation.
        window.location.assign(authUrl);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error while starting Google Calendar setup.";

        const hint = isApiNetworkError(error)
          ? "\n\nIf you're running locally, make sure the backend is running (e.g. `npm run backend`) and listening on the configured port."
          : "";

        writePopupStatus("Unable to start Google Calendar setup", `${message}${hint}`);
        try {
          window.localStorage.setItem(
            oauthStorageKey,
            JSON.stringify({ type: "google-calendar-error", ts: Date.now(), message })
          );
        } catch { }
        console.error("Failed to initiate Google Calendar integration:", error);
      }
    })();
  }, [user]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const oauthStorageKey = "gray_google_calendar_oauth";

    const handleConnected = () => {
      window.location.reload();
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }
      const payload = event.data as { type?: string } | null;
      if (payload?.type === "google-calendar-connected") {
        handleConnected();
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== oauthStorageKey || !event.newValue) {
        return;
      }
      try {
        const payload = JSON.parse(event.newValue) as { type?: string } | null;
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
        channel = new BroadcastChannel("gray-oauth");
        channel.addEventListener("message", (event: MessageEvent) => {
          const payload = event.data as { type?: string } | null;
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
        const shouldStartStandaloneThread =
          !isGeneralSurface && (!currentChatId || isGeneralChatActive);

        if (shouldStartStandaloneThread) {
          const session = await createThreadSession(normalizedDraft);

          void markHasSeenGeneralChat();
          setCurrentChatId(session.id);

          if (supportsInlineChat) {
            setManualViewMode("chat");
            if (typeof window !== "undefined") {
              router.push(`/c/${session.id}`);
            }
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

        if (supportsInlineChat) {
          setManualViewMode("chat");
          if (!isGeneralSession && typeof window !== "undefined") {
            router.push(`/c/${sessionId}`);
          }
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
      supportsInlineChat,
    ]
  );

  const handleThreadComposerSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = threadComposerDraft.trim();
      if (!trimmed) {
        return;
      }
      void handleChatSubmit(trimmed, threadComposerControls);
    },
    [handleChatSubmit, threadComposerControls, threadComposerDraft]
  );




  useEffect(() => {
    if (!supportsInlineChat || typeof window === "undefined") {
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

	    const pathname = window.location.pathname;
	    const targetPath = `/c/${urlId}`;
	    if (pathname !== targetPath) {
	      window.history.replaceState(null, "", targetPath);
	    }
	  }, [currentChatId, generalSessionId, manualViewMode, sessions, supportsInlineChat]);

  const handleOpenHistoryEntry = (entry: SidebarHistoryEntry) => {
    if (!entry.href || entry.href === "#") {
      return;
    }
    if (supportsInlineChat) {
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

	      if (supportsInlineChat) {
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
	      supportsInlineChat,
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
      return (
        <div className={`${styles.greetingStack} hidden md:block`}>
          <h1 className={styles.greeting}>{greeting}</h1>
        </div>
      );
    },
    [greeting, shouldShowWorkspaceGreeting]
  );
  const dashboardTabAttr = isDashboardView ? dashboardTab : undefined;

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
  const sidebarExpandedForLayout = isCalendarPage ? isCalendarSidebarExpanded : isSidebarExpanded;

  return (
    <>
      <div
        className={styles.page}
        data-dashboard-tab={dashboardTabAttr}
        data-mobile-sidebar={isMobileViewport ? "true" : "false"}
        data-sidebar-expanded={sidebarExpandedForLayout ? "true" : "false"}
        {...(isMounted && { "data-general-attachments": generalAttachmentsActive ? "true" : "false" })}
      >
        {/* Mobile Header - only rendered after hydration to avoid SSR/CSR mismatch */}
        {isMounted ? (
          <GrayMobileHeader
            isSidebarExpanded={sidebarExpandedForLayout}
            isPulseActive={isPulseRoute}
            onToggleSidebar={toggleSidebarExpandedForLayout}
            onSelectChat={handleMobileHeaderSelectChat}
            onSelectPulse={handleMobileHeaderSelectPulse}
          />
        ) : null}

        <div className={styles.shell}>
          <div
            className={styles.layout}
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
              className={styles.main}
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
                  className={styles.overlay}
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


              {isDashboardView ? renderPrimaryView() : renderMainSurface()}
              {isMounted && viewMode === "general" ? (
                <div className={styles.chatComposerDock} data-surface="threads">
                  <div className={styles.chatAttachmentTopTray}>{generalAttachmentTray}</div>
                  <input
                    ref={attachmentInputRef}
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    className={styles.chatAttachmentInput}
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
                    {...(isUsageLimitReached ? { isSubmitDisabled: true } : {})}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
        {habitEditorTarget ? (
          <AddPlanHabitModal
            isOpen={Boolean(habitEditorTarget)}
            onClose={() => setHabitEditorTarget(null)}
            type="habit"
            habitToEdit={habitEditorTarget}
            onSubmitHabit={handleHabitModalSubmit}
            onSuccess={async () => {
              await refreshPlansAndHabits();
            }}
          />
        ) : null}
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
