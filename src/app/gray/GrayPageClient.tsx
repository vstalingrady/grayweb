"use client";

import { usePathname, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
// Icons used directly in this component's JSX
import { Menu, Zap, MessageCircle } from "lucide-react";
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
  type SidebarHistorySection,
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
import {
  type ChatSession,
} from "@/components/gray/chat/types";
import {
  normalizeConversationIdValue,
} from "@/components/gray/chat/utils";
import { DEFAULT_HISTORY_SECTIONS } from "@/components/gray/historySeed";
import { useProactivityNotifications } from "@/components/gray/ProactivityNotificationProvider";

// New Imports for Refactoring
import { useWorkspaceData } from "@/components/gray/hooks/useWorkspaceData";
import { useProactivity } from "@/components/gray/hooks/useProactivity";
import { usePulse } from "@/components/gray/hooks/usePulse";
import { DEFAULT_EVENT_COLOR } from "./constants";
import { toDateKey, normalizeProactivityTimes, primaryProactivityTime, normalizeProactivityChannels } from "./utils";
import { UsageLimitBanner } from "@/components/gray/UsageLimitBanner";
// Type-only import
import type { ChatDraftControls } from "@/components/gray/ChatDraftInput";
import {
  buildGeneralChatSession,
  buildReminderEventKey,
  buildCalendarEventFromReminder,
  derivePlanTierLabel,
  getSessionSeedFingerprint,
  getReadableSessionTitle,
  parseReminderPlanId,
  extractReminderId,
  deriveInitials,
  greetingForDate,
  type PlanCarrierUser,
} from "@/components/gray/utils/helperFunctions";
import { HISTORY_DUPLICATE_WINDOW_MS } from "@/components/gray/utils/constants";
import { SIDEBAR_ITEMS, SIDEBAR_RAIL_ITEMS, NAVIGATION_ROUTES } from "@/components/gray/utils/sidebarConfig";
import {
  isAnonLimitReached,
  incrementAnonMessageCount,
  getAnonMessageCount,
  ANON_MESSAGE_LIMIT_VALUE,
} from "@/lib/anonymousSession";
import { SignUpPromptModal } from "@/components/gray/SignUpPromptModal";

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



const ChatDraftInput = dynamic(
  () => import("@/components/gray/ChatDraftInput").then((mod) => mod.ChatDraftInput),
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

// DashboardOverlay removed
const GrayReferenceView = dynamic(
  () => import("@/components/gray/ReferenceView").then((mod) => mod.ReferenceView),
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
};

function GrayPageClientInner({
  initialTimestamp,
  activeNav = "general",
  variant = "general",
  activeChatId = null,
}: GrayPageClientProps) {

  const { user, loading: userLoading } = useUser();
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
    reminderPlans,
    setReminderPlans,
    calendarCalendars,
    setCalendarCalendars,
    calendarEvents,
    setCalendarEvents,
    streakCount,
    refreshPlansAndHabits
  } = useWorkspaceData(userId, variant);

  const {
    proactivity,
    setProactivity,
    persistProactivitySettings
  } = useProactivity(userId, resolvedTimezone);

  void pathname;

  // Include reminderPlans in derivedPlans so they appear in the pulse
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
  } = useChatStore();
  const reminderEventKeysRef = useRef<Set<string>>(new Set());
  const supportsInlineChat = variant !== "chat";
  const [currentChatId, setCurrentChatId] = useState<string | null>(() => activeChatId ?? null);
  const [isCompactLayout, setIsCompactLayout] = useState(false);
  const ensureSessionRef = useRef(ensureSession);
  const { deliveredKeys: deliveredProactivityKeys } = useProactivityNotifications();
  const lastDeletedChatIdStorageKey = "gray:lastDeletedChatId";

  const derivedPlans = user ? [...plans, ...reminderPlans] : [];
  const derivedHabits = user ? habits : [];

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

  const [isSidebarExpanded, setIsSidebarExpanded] = useState<boolean>(false);
  const [hasLoadedSidebarPref, setHasLoadedSidebarPref] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isMounted, setIsMounted] = useState(false);


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
      const lastDeletedId = sessionStorage.getItem(lastDeletedChatIdStorageKey);
      if (lastDeletedId && lastDeletedId === chatId) {
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
          return false;
        }
        if (!hasLoadedSidebarPref) {
          return true;
        }
        return previous;
      });

      if (!hasLoadedSidebarPref) {
        setHasLoadedSidebarPref(true);
      }
    };

    // Initial check
    handleResize();

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, [hasLoadedSidebarPref]);

  const [dashboardTab, setDashboardTab] = useState<"pulse" | "calendar">("pulse");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialSection, setSettingsInitialSection] = useState<
    "account" | "preferences" | "personalization" | "data_controls"
  >("account");
  const [contextUsageSummary, setContextUsageSummary] = useState<ContextUsageSummary | null>(null);
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<Date>(() => new Date(initialTimestamp));

  const [isHistoryOverlayOpen, setIsHistoryOverlayOpen] = useState(false);

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
    async (proactivityId: string) => {
      void proactivityId;
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
  const shouldShowUpgradeButton = useMemo(() => {
    if (!pathname) return false;
    // Show on / route (dashboard view)
    if (pathname === "/") return true;
    return false;
  }, [pathname]);

  const [manualViewMode, setManualViewMode] = useState<ViewMode | null>(() => {
    if (supportsInlineChat && (activeChatId ?? null)) {
      return "chat";
    }
    return activeNav === "history" && baseViewMode !== "chat" ? "history" : null;
  });

  const effectiveManualViewMode = manualViewMode;

  const viewMode: ViewMode =
    baseViewMode === "chat"
      ? "chat"
      : effectiveManualViewMode ?? (activeNav === "history" ? "history" : baseViewMode);

  const shouldHideDesktopWorkspaceChrome = !isMobileViewport
    && (viewMode === "chat"
      || (pathname?.startsWith("/c/") ?? false)
      || pathname === "/g"
      || (pathname?.startsWith("/g/") ?? false));
  const renderPrimaryView = () => {
    if (activeNav === "reference") {
      return <GrayReferenceView />;
    }
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
          chatBar={null}
          isCompactLayout={isCompactLayout}
          userId={userId}
          reminderPlans={reminderPlans}
          proactivityDeliveryKeys={deliveredProactivityKeys}
          onReminderMove={handleReminderMove}
          streakCount={streakCount}
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
          onEditHabit={editHabit}
          onDeleteHabit={deleteHabit}
          onRefreshData={refreshPlansAndHabits}
          showGreeting={false}
          hidePlans={effectiveIsMobileViewport}
        />
      </div>
    );
  };

  // Close mobile sidebar on navigation
  const handleMobileNavigate = (nav: SidebarNavKey) => {
    handleNavigate(nav);
    if (isMobileViewport) {
      setIsSidebarExpanded(false);
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
              streakCount={streakCount}
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
    if (viewMode === "general" && activeNav !== "reference") {
      return (
        <div
          className={styles.mainContent}
          data-view={viewMode}
          data-compact={isCompactLayout ? "true" : "false"}
        >
          {!shouldHideDesktopWorkspaceChrome ? (
            <GrayWorkspaceHeader
              streakCount={streakCount}
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
    return formatDisplayName(user?.full_name, user?.email);
  }, [userLoading, user?.email, user?.full_name, user?.personalization_nickname]);

  const viewerAvatarUrl =
    user?.profile_picture_url && user.profile_picture_url.trim().length > 0
      ? user.profile_picture_url
      : null;

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
    const isPioneerOrHigher = ["Pioneer", "Depth"].includes(viewerPlanLabel);
    if (isPioneerOrHigher) {
      return SIDEBAR_ITEMS;
    }
    return SIDEBAR_ITEMS.filter((item) => item.id !== "reference");
  }, [viewerPlanLabel]);

  const filteredRailItems = useMemo(() => {
    const isPioneerOrHigher = ["Pioneer", "Depth"].includes(viewerPlanLabel);
    if (isPioneerOrHigher) {
      return SIDEBAR_RAIL_ITEMS;
    }
    return SIDEBAR_RAIL_ITEMS.filter((item) => item.id !== "reference");
  }, [viewerPlanLabel]);
  const historySections = useMemo<SidebarHistorySection[]>(() => {
    // Only show conversations that are bound to a *normalized*
    // conversationId so we don't duplicate entries with both
    // the raw user prompt and the refined AI title or temporary
    // local-only thread shells.
    const threadSessions = sessions.filter((session) => {
      if (session.scope !== "thread") {
        return false;
      }
      const normalizedConversationId = normalizeConversationIdValue(session.conversationId);
      return typeof normalizedConversationId === "string" && normalizedConversationId.length > 0;
    });
    const dedupeMap = new Map<string, ChatSession>();

    const registerSession = (key: string, session: ChatSession) => {
      const existing = dedupeMap.get(key);
      if (!existing || session.updatedAt > existing.updatedAt) {
        dedupeMap.set(key, session);
      }
    };

    threadSessions.forEach((session) => {
      const normalizedConversationId = session.conversationId?.trim() ?? "";
      const fingerprint = getSessionSeedFingerprint(session);
      const baseKey =
        normalizedConversationId.length > 0
          ? normalizedConversationId
          : fingerprint
            ? `seed:${fingerprint}`
            : session.id;
      const existing = dedupeMap.get(baseKey);
      if (!existing) {
        registerSession(baseKey, session);
        return;
      }
      const isConversationMatch = normalizedConversationId.length > 0;
      const isBurstDuplicate =
        !isConversationMatch &&
        Math.abs(session.updatedAt - existing.updatedAt) <= HISTORY_DUPLICATE_WINDOW_MS;
      if (isConversationMatch || isBurstDuplicate) {
        registerSession(baseKey, session);
        return;
      }
      registerSession(`${baseKey}:${session.id}`, session);
    });

    const dedupedThreadSessions = Array.from(dedupeMap.values());
    if (!dedupedThreadSessions.length) {
      return DEFAULT_HISTORY_SECTIONS.map((section) => ({
        ...section,
        entries: section.entries.map((entry) => ({ ...entry })),
      }));
    }


    const pinnedSessions: ChatSession[] = [];
    const unpinnedSessions: ChatSession[] = [];

    dedupedThreadSessions.forEach((session) => {
      // Check for pinned in metadata
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const isPinned = !!(session.metadata as any)?.is_pinned;
      if (isPinned) {
        pinnedSessions.push(session);
      } else {
        unpinnedSessions.push(session);
      }
    });

    const currentYear = new Date().getFullYear();
    const groups = new Map<
      string,
      {
        id: string;
        label: string;
        entries: SidebarHistorySection["entries"];
        sortKey: number;
      }
    >();

    // 1. Pinned Group
    if (pinnedSessions.length > 0) {
      // Sort pinned by most recently updated
      pinnedSessions.sort((a, b) => b.updatedAt - a.updatedAt);
      const pinnedEntries = pinnedSessions.map((session) => ({
        id: session.id,
        title: getReadableSessionTitle(session),
        href: `/c/${session.conversationId || session.id}`,
        createdAt: session.updatedAt,
        isGeneratingTitle: session.isGeneratingTitle,
        isPinned: true,
      }));
      groups.set("pinned", {
        id: "pinned",
        label: "Pinned",
        entries: pinnedEntries,
        sortKey: 9999, // Ensure it stays on top
      });
    }

    // 2. Regular Groups
    unpinnedSessions.forEach((session) => {
      const date = new Date(session.updatedAt);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const oneWeekAgo = new Date(today);
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      let groupId: string;
      let label: string;
      let sortKey: number;

      if (date >= today) {
        groupId = "recent";
        label = "Recent";
        sortKey = Number.MAX_SAFE_INTEGER;
      } else if (date >= yesterday) {
        groupId = "yesterday";
        label = "Yesterday";
        sortKey = Number.MAX_SAFE_INTEGER - 1;
      } else if (date >= oneWeekAgo) {
        groupId = "this-week";
        label = "This Week";
        sortKey = Number.MAX_SAFE_INTEGER - 2;
      } else {
        groupId = `${date.getFullYear()}-${date.getMonth()}`;
        label =
          date.getFullYear() === currentYear
            ? date.toLocaleDateString([], { month: "long" })
            : date.toLocaleDateString([], { month: "long", year: "numeric" });
        sortKey = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
      }

      const href =
        session.scope === "general" || session.id === GENERAL_CHAT_SESSION_ID
          ? "/g"
          : `/c/${session.id}`;

      if (!groups.has(groupId)) {
        groups.set(groupId, {
          id: groupId,
          label,
          entries: [],
          sortKey,
        });
      }

      groups.get(groupId)?.entries.push({
        id: session.id,
        title: getReadableSessionTitle(session),
        href,
        createdAt: session.updatedAt,
        isGeneratingTitle: session.isGeneratingTitle,
      });
    });

    return Array.from(groups.values())
      .sort((a, b) => b.sortKey - a.sortKey)
      .map((group) => {
        const sorted = group.entries.sort((a, b) => b.createdAt - a.createdAt);
        const seen = new Set<string>();
        const deduped: typeof sorted = [];
        sorted.forEach((entry) => {
          const day = new Date(entry.createdAt).toDateString();
          const key = `${entry.title.toLowerCase()}::${day}`;
          if (seen.has(key)) {
            return;
          }
          seen.add(key);
          deduped.push(entry);
        });
        return {
          id: group.id,
          label: group.label,
          entries: deduped,
        };
      });
  }, [sessions]);
  const workspaceDateLabel = useMemo(
    () =>
      now.toLocaleDateString([], {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    [now]
  );
  const isDashboardView = viewMode === "dashboard";
  const isChatView = viewMode === "chat";

  const handleNavigate = (navId: SidebarNavKey) => {
    if (navId === "search") {
      setIsSidebarExpanded(true);
      return;
    }

    if (navId === "history") {
      setIsHistoryOverlayOpen(true);
      return;
    }

    if (navId === "dashboard") {
      setManualViewMode(null);
      router.push("/");
      return;
    }

    if (navId === "reference") {
      setManualViewMode(null);
      const target = NAVIGATION_ROUTES[navId];
      if (target) {
        router.push(target);
      }
      return;
    }

    if (navId === "general") {
      setManualViewMode(null);
      const target = NAVIGATION_ROUTES[navId];
      if (target) {
        router.push(target);
      }
      return;
    }

    if (navId === "threads") {
      setIsSidebarExpanded(true);
      setManualViewMode(null);
      const target = NAVIGATION_ROUTES[navId];
      if (target) {
        router.push(target);
      }
      return;
    }

    setIsSidebarExpanded(true);
  };

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

  const reminderPlanMap = useMemo(
    () => new Map(reminderPlans.map((plan) => [plan.id, plan])),
    [reminderPlans]
  );
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
    if (!sessions.length) {
      reminderEventKeysRef.current.clear();
      return;
    }
    const calendarId = calendarCalendars[0]?.id ?? "default";
    const calendarColor = calendarCalendars[0]?.color ?? DEFAULT_EVENT_COLOR;
    const eventsToAdd: CalendarEvent[] = [];
    const keysToRemove: string[] = [];

    sessions.forEach((session) => {
      session.messages.forEach((message) => {
        if (message.role !== "assistant" || !Array.isArray(message.reminders)) {
          return;
        }
        message.reminders.forEach((reminder) => {
          const key = buildReminderEventKey(reminder);
          const normalizedStatus = (
            (reminder.data.reminder_status ?? reminder.status ?? "created") as string
          ).toString().trim().toLowerCase();
          if (normalizedStatus === "deleted") {
            if (reminderEventKeysRef.current.has(key)) {
              keysToRemove.push(key);
              reminderEventKeysRef.current.delete(key);
            }
            return;
          }
          if (reminderEventKeysRef.current.has(key)) {
            return;
          }
          const event = buildCalendarEventFromReminder(reminder, key, calendarId, calendarColor);
          if (!event) {
            return;
          }
          reminderEventKeysRef.current.add(key);
          eventsToAdd.push(event);
        });
      });
    });

    if (!eventsToAdd.length && !keysToRemove.length) {
      return;
    }

    setCalendarEvents((previous) => {
      const filtered = keysToRemove.length
        ? previous.filter(
          (event) =>
            !(event.id.startsWith("reminder-") &&
              keysToRemove.includes(event.id.replace(/^reminder-/, "")))
        )
        : previous;
      if (!eventsToAdd.length) {
        return filtered;
      }
      const existingIds = new Set(filtered.map((event) => event.id));
      const toAppend = eventsToAdd.filter((event) => !existingIds.has(event.id));
      if (!toAppend.length) {
        return filtered;
      }
      return [...filtered, ...toAppend];
    });
  }, [sessions, calendarCalendars, setCalendarEvents]);

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
    // console.log('[GrayPageClient] Looking for session:', activeChatId, 'found:', directSession?.id, 'messages:', directSession?.messages?.length);
    // console.log('[GrayPageClient] All sessions:', sessions.map(s => ({ id: s.id, msgCount: s.messages?.length })));

    // Already selected the right session and it exists.
    if (currentChatId === activeChatId && directSession) {
      return;
    }

    // 1) Exact local session id match (/c/{session.id}).
    if (directSession) {
      // console.log('[GrayPageClient] Found direct session, setting as current');
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

    const reminderId = parseReminderPlanId(id);
    if (reminderId !== null) {
      const previousReminderPlans = reminderPlans;
      const previousCalendarEvents = calendarEvents;
      const targetPlan = reminderPlanMap.get(id);
      if (!targetPlan) {
        return;
      }
      const nextCompleted = !targetPlan.completed;
      const newStatus: "delivered" | "pending" = nextCompleted ? "delivered" : "pending";
      const updated = previousReminderPlans.map((plan) => {
        if (plan.id === id) {
          return {
            ...plan,
            completed: nextCompleted,
            reminderStatus: newStatus,
          };
        }
        return plan;
      });

      // Also update the corresponding calendar event
      const updatedCalendarEvents = previousCalendarEvents.map((event) => {
        if (event.id === id) {
          return {
            ...event,
            reminderStatus: newStatus,
          };
        }
        return event;
      });

      setReminderPlans(updated);
      setCalendarEvents(updatedCalendarEvents);

      apiService
        .updateReminder(user.id, reminderId, {
          status: nextCompleted ? "delivered" : "pending",
        })
        .catch((error) => {
          console.error("Failed to update reminder:", error);
          setReminderPlans(previousReminderPlans);
          setCalendarEvents(previousCalendarEvents);
        });
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

    const reminderId = parseReminderPlanId(planId);
    if (reminderId !== null) {
      const previousReminderPlans = reminderPlans;
      const targetPlan = reminderPlanMap.get(planId);
      if (!targetPlan) {
        return;
      }
      const nextPlans = previousReminderPlans.map((plan) =>
        plan.id === planId
          ? {
            ...plan,
            label: updates.label,
            details: updates.details ?? null,
            deadline: updates.deadline ?? null,
          }
          : plan
      );
      setReminderPlans(nextPlans);
      const title = updates.label || targetPlan.label || "Reminder plan";
      void sendDashboardNotification("Plan saved", `${title} updated in today's pulse.`);
      try {
        await apiService.updateReminder(user.id, reminderId, {
          label: updates.label,
          description: updates.details ?? null,
          remind_at: updates.deadline ?? targetPlan.deadline ?? undefined,
        });
      } catch (error) {
        console.error("Failed to update reminder:", error);
        setReminderPlans(previousReminderPlans);
        throw error;
      }
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
    const targetPlan = previousPlans.find((plan) => plan.id === planId);
    const planLabel = updates.label || targetPlan?.label || "Plan";
    void sendDashboardNotification("Plan saved", `${planLabel} updated in today's pulse.`);

    try {
      await apiService.updatePlan(user.id, numericPlanId, {
        label: updates.label,
        description: updates.details ?? null,
        deadline: updates.deadline ?? null,
        scheduleSlot: updates.scheduleSlot ?? null,
      });
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

    const reminderId = parseReminderPlanId(planToDelete.id);
    if (reminderId !== null) {
      console.log(`[DELETE] Attempting to delete reminder ${reminderId} (plan ID: ${planToDelete.id})`);
      const previousReminderPlans = reminderPlans;
      const previousCalendarEvents = calendarEvents;
      const updatedReminderPlans = previousReminderPlans.filter((plan) => plan.id !== planToDelete.id);

      // Also remove the corresponding calendar event
      // We must handle both simple IDs (reminder-{id}) and complex IDs (reminder-{source}-{id}-{iso})
      const updatedCalendarEvents = previousCalendarEvents.filter((event) => {
        if (event.id === planToDelete.id) {
          return false;
        }
        // Check for complex ID match
        const match = event.id.match(/^reminder-[^-]+-(\d+)-/);
        if (match && Number(match[1]) === reminderId) {
          return false;
        }
        return true;
      });

      setReminderPlans(updatedReminderPlans);
      setCalendarEvents(updatedCalendarEvents);

      apiService.deleteReminder(user.id, reminderId)
        .then(() => {
          console.log(`[DELETE] Successfully deleted reminder ${reminderId}`);
        })
        .catch((error) => {
          console.error(`[DELETE] Failed to delete reminder ${reminderId}:`, error);
          setReminderPlans(previousReminderPlans);
          setCalendarEvents(previousCalendarEvents);
        });
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

    const parseStreakCount = (label: string | null | undefined) => {
      if (!label) {
        return 0;
      }
      const match = label.match(/(\d+)/);
      if (!match) {
        return 0;
      }
      const parsed = Number.parseInt(match[1], 10);
      return Number.isNaN(parsed) ? 0 : parsed;
    };

    const formatStreakLabel = (count: number) => {
      const safeCount = Math.max(0, Math.trunc(count));
      return `${safeCount} day${safeCount === 1 ? "" : "s"}`;
    };

    const updatedHabits = previousHabits.map((habit) =>
      habit.id === id
        ? {
          ...habit,
          completed: !habit.completed,
          streakLabel: formatStreakLabel(
            habit.completed
              ? Math.max(0, parseStreakCount(habit.streakLabel) - 1)
              : parseStreakCount(habit.streakLabel) + 1
          ),
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
              streakLabel: updatedH.streakLabel,
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
            streak_label: h.streakLabel,
            previous_label: h.previousLabel,
            completed: h.completed,
          })),
          proactivity: newActivePulse.proactivity,
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
      if (!user) {
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
        await apiService.updateHabit(user.id, numericId, {
          label: updates.label,
          description: updates.details ?? null,
        });
      } catch (error) {
        console.error("Failed to update habit:", error);
        setHabits(previousHabits);
        throw (error instanceof Error ? error : new Error("Failed to update habit."));
      }
    },
    [habits, user?.id]
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
      .catch((error) => {
        console.error("Failed to delete habit:", error);
        // If habit is already deleted on backend, keep it removed from UI
        if (error.message.includes("Habit not found")) {
          console.log("Habit was already deleted on backend, keeping UI updated");
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
    // Define prefix locally to match planCalendarUtils
    const PLAN_EVENT_ID_PREFIX = "plan-event-";

    // 1. Separate events by type
    const planEvents = allEvents.filter((e) => e.id.startsWith(PLAN_EVENT_ID_PREFIX));
    const reminderEvents = allEvents.filter((e) => e.id.startsWith("reminder-"));
    const standardEvents = allEvents.filter(
      (e) => !e.id.startsWith(PLAN_EVENT_ID_PREFIX) && !e.id.startsWith("reminder-")
    );

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

    // 3. Capture previousEvents BEFORE any state changes for accurate comparison
    const previousEvents = calendarEvents;

    // 4. Handle Reminders (Update remind_at)
    reminderEvents.forEach((event) => {
      const originalEvent = previousEvents.find((e) => e.id === event.id);
      // If start/end didn't change, skip
      if (
        originalEvent &&
        originalEvent.start.getTime() === event.start.getTime() &&
        originalEvent.end.getTime() === event.end.getTime()
      ) {
        return;
      }

      const reminderId = extractReminderId(event.id);
      if (reminderId !== null && user) {
        // Update API
        const previousReminderPlans = reminderPlans;

        // Optimistically update local state
        const updatedReminderPlans = previousReminderPlans.map((plan) =>
          plan.reminderId === reminderId
            ? { ...plan, deadline: event.start.toISOString() }
            : plan
        );
        setReminderPlans(updatedReminderPlans);

        apiService.updateReminder(user.id, reminderId, {
          remind_at: event.start.toISOString(),
          metadata: { color: event.color },
        }).catch(err => {
          console.error("Failed to update reminder time", err);
          // Revert on error
          setReminderPlans(previousReminderPlans);
        });
      }
    });

    // 5. Update Calendar State (Standard + Reminders + Plans)
    // We need to preserve plan events in the calendar state to prevent them from disappearing
    // when events are clicked or moved. Plan data lives in `plans` state, but the calendar
    // events derived from plans need to remain in calendarEvents for rendering.
    const nextStateEvents = [...standardEvents, ...reminderEvents, ...planEvents];
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
    // Only consider standard/reminder events for deletion detection against previous state
    const deletedEventIds = previousEvents
      .filter(prev => !nextStateEvents.find(next => next.id === prev.id))
      .map(event => event.id);

    // Find new events (in next but not in previous)
    const newEvents = nextStateEvents.filter(
      next => !previousEvents.find(prev => prev.id === next.id)
    );

    // Find updated events (in both, but with different data)
    const updatedEvents = nextStateEvents.filter(next => {
      const prev = previousEvents.find(p => p.id === next.id);
      if (!prev) return false;
      return (
        prev.title !== next.title ||
        prev.start.getTime() !== next.start.getTime() ||
        prev.end.getTime() !== next.end.getTime() ||
        prev.description !== next.description ||
        prev.calendarId !== next.calendarId ||
        prev.color !== next.color
      );
    });

    // Delete removed events
    for (const eventId of deletedEventIds) {
      if (eventId.startsWith("reminder-")) {
        const reminderId = extractReminderId(eventId);
        if (reminderId !== null) {
          console.log(`[CALENDAR DELETE] Attempting to delete reminder ${reminderId} from calendar`);
          try {
            await apiService.deleteReminder(user.id, reminderId);
            console.log(`[CALENDAR DELETE] Successfully deleted reminder ${reminderId}`);
          } catch (error) {
            console.error(`[CALENDAR DELETE] Failed to delete reminder ${reminderId}:`, error);
            logCalendarSyncError("delete reminder", error);
            revertDelete(eventId);
            return;
          }
        }
        continue;
      }

      const numericId = Number(eventId);
      if (!Number.isNaN(numericId)) {
        // Real event - delete from backend
        try {
          await apiService.deleteCalendarEvent(user.id, numericId);
        } catch (error) {
          logCalendarSyncError("delete calendar event", error);
          revertDelete(eventId);
          return;
        }
      } else if (eventId.startsWith('evt-')) {
        // Temporary event - just remove from local state
        console.log("Removing temporary event:", eventId);
      }
    }

    // Create new events
    console.log("[CALENDAR] Creating new events:", newEvents.map(e => ({ id: e.id, title: e.title, calendarId: e.calendarId, entryType: e.entryType })));
    for (const event of newEvents) {
      if (event.entryType === "reminder") {
        try {
          const createdReminder = await apiService.createReminder(user.id, {
            label: event.title,
            remind_at: event.start.toISOString(),
            description: event.description,
            summary: event.description,
          });
          const newId = `reminder-${createdReminder.id}`;
          setCalendarEvents((prev) =>
            prev.map((e) =>
              e.id === event.id
                ? {
                  ...e,
                  id: newId,
                  reminderId: createdReminder.id,
                  reminderStatus: createdReminder.status,
                }
                : e
            )
          );
          // Also update reminderPlans to reflect the new reminder immediately
          setReminderPlans((prev) => [
            ...prev,
            {
              id: newId,
              label: createdReminder.label,
              completed: createdReminder.status === "completed",
              deadline: createdReminder.remind_at,
              scheduleSlot: null,
              details: createdReminder.description ?? createdReminder.summary ?? null,
              reminderId: createdReminder.id,
              reminderStatus: createdReminder.status,
            },
          ]);
        } catch (error) {
          logCalendarSyncError("create reminder", error);
          revertCreate(event.id);
          return;
        }
        continue;
      }

      if (event.id.startsWith("reminder-")) continue; // Should not happen for new events, but safety check

      const numericCalendarId = event.calendarId ? Number(event.calendarId) : null;
      if (!Number.isNaN(numericCalendarId) || event.calendarId === "default") {
        try {
          const createdEvent = await apiService.createCalendarEvent(user.id, {
            calendar_id: event.calendarId === "default" ? null : numericCalendarId,
            title: event.title,
            description: event.description,
            start_time: event.start.toISOString(),
            end_time: event.end.toISOString(),
          });
          // Update the local state with the real ID from the backend
          setCalendarEvents(prev => prev.map(e => e.id === event.id ? {
            ...e,
            id: createdEvent.id.toString()
          } : e));
        } catch (error) {
          logCalendarSyncError("create calendar event", error);
          revertCreate(event.id);
          return;
        }
      }
    }

    // Update existing events
    console.log("[CALENDAR] Updating events:", updatedEvents.map(e => ({ id: e.id, title: e.title })));
    for (const event of updatedEvents) {
      if (event.entryType === "reminder" || event.id.startsWith("reminder-")) {
        const reminderId = event.reminderId ?? Number(event.id.replace("reminder-", ""));
        if (!Number.isNaN(reminderId)) {
          try {
            await apiService.updateReminder(user.id, reminderId, {
              label: event.title,
              description: event.description,
              remind_at: event.start.toISOString(),
              metadata: { color: event.color },
            });
            // Update reminderPlans as well
            setReminderPlans((prev) =>
              prev.map((plan) =>
                plan.reminderId === reminderId
                  ? {
                    ...plan,
                    label: event.title,
                    details: event.description ?? null,
                    deadline: event.start.toISOString(),
                  }
                  : plan
              )
            );
          } catch (error) {
            logCalendarSyncError("update reminder", error);
            revertUpdate(event.id);
            return;
          }
        }
        continue;
      }

      // Handle temporary events (evt-*) that were created locally but not yet persisted
      if (event.id.startsWith('evt-')) {
        // Treat as a new event that needs to be created
        const numericCalendarId = event.calendarId ? Number(event.calendarId) : null;
        if (!Number.isNaN(numericCalendarId) || event.calendarId === "default") {
          try {
            const createdEvent = await apiService.createCalendarEvent(user.id, {
              calendar_id: event.calendarId === "default" ? null : numericCalendarId,
              title: event.title,
              description: event.description,
              start_time: event.start.toISOString(),
              end_time: event.end.toISOString(),
              color: event.color,
            });
            // Update local state with the real ID
            setCalendarEvents(prev => prev.map(e => e.id === event.id ? {
              ...e,
              id: createdEvent.id.toString()
            } : e));
          } catch (error) {
            logCalendarSyncError("create calendar event from temporary", error);
            // Keep the temporary event in local state even if creation fails
            continue;
          }
        }
        continue;
      }

      const numericEventId = Number(event.id);
      const numericCalendarId = event.calendarId ? Number(event.calendarId) : null;
      if (!Number.isNaN(numericEventId) && (!Number.isNaN(numericCalendarId) || event.calendarId === "default")) {
        try {
          await apiService.updateCalendarEvent(user.id, numericEventId, {
            calendar_id: event.calendarId === "default" ? null : numericCalendarId,
            title: event.title,
            description: event.description,
            start_time: event.start.toISOString(),
            end_time: event.end.toISOString(),
            color: event.color,
          });
        } catch (error) {
          // If event doesn't exist in database (404), skip the API call and keep optimistic update
          if (error instanceof Error && error.message.includes("Not Found")) {
            console.log(`Event ${event.id} not found in database, keeping as client-side only`);
            continue;
          }
          logCalendarSyncError("update calendar event", error);
          revertUpdate(event.id);
          return;
        }
      }
    }

    // Suppress desktop notifications for routine calendar event edits/moves.
  };

  const handleReminderMove = useCallback(
    async (reminderId: number, range: { start: Date; end: Date }) => {
      if (!user) {
        return;
      }

      const previousReminderPlans = reminderPlans;
      const previousCalendarEvents = calendarEvents;
      const isoTime = range.start.toISOString();

      const updatedReminderPlans = previousReminderPlans.map((plan) =>
        plan.reminderId === reminderId ? { ...plan, deadline: isoTime } : plan
      );
      const updatedCalendarEvents = previousCalendarEvents.map((event) =>
        event.reminderId === reminderId
          ? { ...event, start: new Date(range.start), end: new Date(range.end) }
          : event
      );

      setReminderPlans(updatedReminderPlans);
      setCalendarEvents(updatedCalendarEvents);

      try {
        await apiService.updateReminder(user.id, reminderId, {
          remind_at: isoTime,
          metadata: { color: updatedCalendarEvents.find(e => e.reminderId === reminderId)?.color },
        });
      } catch (error) {
        console.error("Failed to move reminder:", error);
        setReminderPlans(previousReminderPlans);
        setCalendarEvents(previousCalendarEvents);
      }
    },
    [user, reminderPlans, calendarEvents]
  );

  const handleCalendarIntegration = useCallback(async () => {
    if (!user) {
      console.warn("Unable to start Google Calendar integration without a user.");
      return;
    }

    const callbackUrl = typeof window !== "undefined"
      ? `${window.location.origin}/api/auth/google-calendar/callback`
      : undefined;

    try {
      const response = await apiService.requestGoogleCalendarAuth(user.id, {
        redirectUri: callbackUrl,
      });
      const authUrl = response?.authorization_url;

      if (authUrl) {
        window.open(authUrl, "_blank", "noopener,noreferrer");
      } else {
        console.error("Google Calendar integration response did not include an authorization URL.");
      }
    } catch (error) {
      console.error("Failed to initiate Google Calendar integration:", error);
    }
  }, [user]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }
      const payload = event.data as { type?: string } | null;
      if (payload?.type === "google-calendar-connected") {
        window.location.reload();
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  const handleChatSubmit = async (draft: string, controls: ChatDraftControls) => {
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

      // console.log("[GrayPageClient] handleChatSubmit", {
      //   isGeneralSurface,
      //   currentChatId,
      //   isGeneralChatActive,
      //   shouldStartStandaloneThread,
      //   draft: normalizedDraft.slice(0, 20)
      // });

      if (shouldStartStandaloneThread) {
        // console.log("[GrayPageClient] Creating standalone thread...");
        const session = await createThreadSession(normalizedDraft);
        // console.log("[GrayPageClient] Thread created, sessionId:", session.id);

        void markHasSeenGeneralChat();
        setCurrentChatId(session.id);

        if (supportsInlineChat) {
          setManualViewMode("chat");
          if (typeof window !== "undefined") {
            // console.log("[GrayPageClient] Pushing state to history:", `/c/${session.id}`);
            router.push(`/c/${session.id}`);
          }
        } else {
          // console.log("[GrayPageClient] Routing to new thread:", session.id);
          router.push(`/c/${session.id}`);
        }
        return;
      }

      // If not starting a standalone thread, we are sending to the general chat
      // (or the current chat if it happens to be general? logic implies general here)
      // console.log("[GrayPageClient] Sending general message...");
      const sessionId = await sendGeneralMessage(normalizedDraft);
      void markHasSeenGeneralChat();
      setCurrentChatId(sessionId);

      const generalId = generalSessionId ?? GENERAL_CHAT_SESSION_ID;
      const isGeneralSession = sessionId === generalId;

      if (supportsInlineChat) {
        setManualViewMode("chat");
        if (!isGeneralSession && typeof window !== "undefined") {
          // console.log("[GrayPageClient] Pushing state to history:", `/c/${sessionId}`);
          router.push(`/c/${sessionId}`);
        }
      } else if (isGeneralSession) {
        // console.log("[GrayPageClient] Routing to general chat");
        router.push("/g");
      } else if (activeChatId !== sessionId) {
        // console.log("[GrayPageClient] Routing to existing chat:", sessionId);
        router.push(`/c/${sessionId}`);
      }
    } catch (error) {
      console.error("Failed to send general message:", error);
      controls.restore(draft);
    }
  };




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
      router.replace(targetPath);
    }
  }, [currentChatId, generalSessionId, manualViewMode, sessions, supportsInlineChat]);

  const [isStreakValueVisible, setIsStreakValueVisible] = useState(false);

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

  const handleDeleteHistoryEntry = useCallback((id: string) => {
    const confirmed = window.confirm("Delete this conversation? This cannot be undone.");
    if (!confirmed) {
      return;
    }
    try {
      sessionStorage.setItem(lastDeletedChatIdStorageKey, id);
    } catch {
      // Ignore
    }
    deleteSession(id);
    if (activeChatId === id) {
      if (generalSessionId) {
        router.push("/" + generalSessionId);
      } else {
        router.push("/");
      }
    }
  }, [deleteSession, activeChatId, generalSessionId, router, sessions]);

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
  const generalAttachmentsFlag = generalAttachmentsActive;
  const generalAttachmentTray = viewMode === "general"
    ? (
      <AttachmentTray
        attachments={attachments}
        isUploading={isAttachmentUploading}
        error={attachmentError}
        onAddAttachment={openAttachmentPicker}
        onRemoveAttachment={removeAttachment}
      />
    )
    : null;
  const effectiveIsMobileViewport = isMounted ? isMobileViewport : false;
  const effectiveIsSidebarExpanded = isMounted ? isSidebarExpanded : true;

  return (
    <>
      <div
        className={styles.page}
        data-dashboard-tab={activeNav === "dashboard" ? dashboardTab : undefined}
        data-mobile-sidebar={effectiveIsMobileViewport ? "true" : "false"}
        data-sidebar-expanded={effectiveIsSidebarExpanded ? "true" : "false"}
        {...(isMounted && { "data-general-attachments": generalAttachmentsFlag ? "true" : "false" })}
      >
        {/* Mobile Header - only rendered after hydration to avoid SSR/CSR mismatch */}
        {isMounted && (
          <div className={styles.mobileHeader}>
            {!effectiveIsSidebarExpanded && (
              <>
                <button
                  className={styles.mobileMenuButton}
                  onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
                >
                  <Menu size={24} />
                </button>

                <div className={styles.mobileHeaderRight}>
                  {streakCount > 0 && activeNav !== "dashboard" && (
                    <button
                      className={styles.mobileMenuButton}
                      onClick={() => setIsStreakValueVisible((prev) => !prev)}
                      aria-label="Toggle streak count"
                    >
                      {isStreakValueVisible ? (
                        <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>{streakCount}</span>
                      ) : (
                        <Zap size={24} />
                      )}
                    </button>
                  )}
                  {isScout && (
                    <button className={styles.upgradePill} onClick={handleUpgradePlan}>
                      <Zap size={14} />
                      <span>Upgrade</span>
                    </button>
                  )}
                </div>
              </>
            )}

            {/* Mobile View Toggle - Always Visible */}
            <div className={styles.mobileToggle}>
              <button
                className={styles.mobileToggleOption}
                data-active={activeNav === "threads" || activeNav === "general" ? "true" : "false"}
                onClick={() => handleMobileNavigate("threads")}
              >
                <span className={styles.mobileToggleIcon}>
                  <MessageCircle size={16} />
                </span>
                <span>Chat</span>
              </button>
            </div>
          </div>
        )}

        <div className={styles.shell}>
          <div
            className={styles.layout}
            data-view={viewMode}
            data-mobile-sidebar={effectiveIsMobileViewport ? "true" : "false"}
            {...(isMounted && { "data-sidebar-expanded": effectiveIsSidebarExpanded ? "true" : "false" })}
          >


            <GrayEnhancedSidebar
              activeNav={activeNav ?? "general"}
              isExpanded={effectiveIsSidebarExpanded}
              onToggle={() => setIsSidebarExpanded((prev) => !prev)}
              onExpand={() => setIsSidebarExpanded(true)}
              onCollapse={() => setIsSidebarExpanded(false)}
              viewerName={viewerName}
              viewerInitials={viewerInitials}
              viewerAvatarUrl={viewerAvatarUrl}
              viewerPlanLabel={viewerPlanLabel}
              navItems={filteredSidebarItems}
              railItems={filteredRailItems}
              historySections={historySections}
              onNavigate={handleMobileNavigate}
              activeChatId={activeChatId ?? generalSessionId}
              onOpenSettings={handleOpenSettings}
              onOpenHelp={handleOpenHelp}
              onUpgradePlan={handleUpgradePlan}
              onLogOut={handleLogOut}
              onRenameHistoryEntry={handleRenameHistoryEntry}
              onDeleteHistoryEntry={handleDeleteHistoryEntry}
              onPinHistoryEntry={handlePinHistoryEntry}
            />

            {/* Mobile Sidebar Overlay */}
            <div
              className={styles.main}
              data-dashboard={isDashboardView ? "true" : "false"}
              data-view={viewMode}
              data-dashboard-tab={dashboardTabAttr}
              data-compact={isCompactLayout ? "true" : "false"}
              {...(isMounted && { "data-general-attachments": generalAttachmentsFlag ? "true" : "false" })}
              data-dashboard-free="true"
            >
              {/* Mobile Sidebar Overlay */}
              {isMounted && (
                <div
                  className={styles.overlay}
                  data-visible={effectiveIsMobileViewport && effectiveIsSidebarExpanded ? "true" : "false"}
                  onClick={() => {
                    if (effectiveIsMobileViewport) {
                      setIsSidebarExpanded(false);
                    }
                  }}
                  aria-hidden="true"
                />
              )}

              {/* Centered Transparent Logo (mobile only; hidden on desktop via CSS) */}


              {isDashboardView ? renderPrimaryView() : renderMainSurface()}
              {isMounted && viewMode === "general" && activeNav !== "reference" ? (
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
                  <ChatDraftInput
                    variant="composer"
                    onSubmitMessage={handleChatSubmit}
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
          onRenameEntry={handleRenameHistoryEntry}
          onDeleteEntry={handleDeleteHistoryEntry}
          onCreateNewChat={() => {
            getOrCreateGeneralSessionId();
            handleNavigate("general");
            setManualViewMode(null);
            router.push("/");
          }}
        />
      </div>
    </>
  );
}

export const GrayPageClient = dynamic(() => Promise.resolve(GrayPageClientInner), {
  ssr: false,
});

export default GrayPageClient;
