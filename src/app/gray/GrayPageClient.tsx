"use client";

import { usePathname, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ChangeEvent, FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Gem, MessageSquarePlus, LayoutDashboard, History, Search } from "lucide-react";
import { GrayEnhancedSidebar } from "@/components/gray/EnhancedSidebar";
import { AddPlanHabitModal } from "@/components/gray/AddPlanHabitModal";
import { GrayChatBar, type GrayChatBarProps } from "@/components/gray/ChatBar";
import { GrayChatComposer } from "@/components/gray/ChatComposer";
import { FirstChatOnboarding, type FirstChatOnboardingResult } from "@/components/gray/FirstChatOnboarding";
import AttachmentTray from "@/components/gray/AttachmentTray";
import { useUser } from "@/contexts/UserContext";
import {
  apiService,
  isApiNetworkError,
  type Reminder,
  type User,
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
  type SidebarNavItem,
  type SidebarHistorySection,
  type SidebarHistoryEntry,
  type PulseEntry,
  type ContextUsageSummary,
} from "@/components/gray/types";
import type { CalendarEvent, CalendarInfo } from "@/components/calendar/types";
import {
  useChatStore,
  GENERAL_CHAT_SESSION_ID,
  SHARED_CHAT_PLACEHOLDER_TITLE,
  normalizeConversationIdValue,
  type ChatSession,
  type GrayReminderCreatedPayload,
} from "@/components/gray/ChatProvider";
import { DEFAULT_HISTORY_SECTIONS } from "@/components/gray/historySeed";
import { GrayWorkspaceHeader } from "@/components/gray/WorkspaceHeader";
import {
  type WorkspaceBackgroundOption,
  type WorkspaceBackgroundDraft,
  GREAT_WAVE_BACKGROUND,
  SOLID_WHITE_BACKGROUND,
  SOLID_BLACK_BACKGROUND,
} from "@/components/gray/PersonalizationPanel";
import { useProactivityNotifications } from "@/components/gray/ProactivityNotificationProvider";
import { GrayChatView } from "@/components/gray/ChatView";

// New Imports for Refactoring
import { useWorkspaceData } from "@/components/gray/hooks/useWorkspaceData";
import { useProactivity } from "@/components/gray/hooks/useProactivity";
import { usePulse } from "@/components/gray/hooks/usePulse";
import { sanitizeEventColor, DEFAULT_EVENT_COLOR, REMINDER_RETENTION_WINDOW_MS } from "./constants";
import { toDateKey, normalizeProactivityTimes, primaryProactivityTime, normalizeProactivityChannels } from "./utils";

const GrayDashboardView = dynamic(
  () => import("@/components/gray/DashboardView").then((mod) => mod.GrayDashboardView),
  { loading: () => null }
);

const GrayGeneralView = dynamic(
  () => import("@/components/gray/GeneralView").then((mod) => mod.GrayGeneralView),
  { loading: () => null }
);

const GrayHistoryView = dynamic(
  () => import("@/components/gray/HistoryView").then((mod) => mod.GrayHistoryView),
  { loading: () => null }
);

const PersonalizationPanel = dynamic(
  () =>
    import("@/components/gray/PersonalizationPanel").then((mod) => ({
      default: mod.PersonalizationPanel,
    })),
  { loading: () => null }
);

const SettingsModal = dynamic(
  () => import("@/components/gray/SettingsModal").then((mod) => mod.SettingsModal),
  { loading: () => null }
);

const SIDEBAR_EXPANDED_STORAGE_KEY = "gray-sidebar-expanded";

const buildGeneralChatSession = (): ChatSession => ({
  id: GENERAL_CHAT_SESSION_ID,
  title: "General Chat",
  titleMode: "auto",
  createdAt: Date.now(),
  updatedAt: Date.now(),
  messages: [],
  isResponding: false,
  scope: "general",
  conversationId: undefined,
  pendingAutoStream: false,
});

const deriveReminderScheduleIso = (reminder: GrayReminderCreatedPayload): string | null => {
  const reminderRecord = (reminder.data.reminder as Record<string, unknown> | null | undefined) ?? null;
  if (reminderRecord && typeof reminderRecord["remind_at"] === "string") {
    return reminderRecord["remind_at"] as string;
  }
  if (typeof reminder.data.time_iso === "string" && reminder.data.time_iso.trim().length > 0) {
    return reminder.data.time_iso.trim();
  }
  return null;
};

const buildReminderEventKey = (reminder: GrayReminderCreatedPayload): string => {
  const reminderRecord = (reminder.data.reminder as Record<string, unknown> | null | undefined) ?? null;
  const legacyId =
    typeof reminderRecord?.["reminder_id"] === "number"
      ? `${reminderRecord["reminder_id"]}`
      : typeof reminderRecord?.["reminder_id"] === "string"
        ? reminderRecord["reminder_id"]
        : typeof reminderRecord?.["id"] === "number"
          ? `${reminderRecord["id"]}`
          : typeof reminderRecord?.["id"] === "string"
            ? reminderRecord["id"]
            : undefined;
  const primaryId = reminder.data.id ?? legacyId ?? reminder.data.label ?? "reminder";
  const scheduleIso = deriveReminderScheduleIso(reminder) ?? "unscheduled";
  const source = reminder.source ?? "assistant";
  return `${source}-${primaryId}-${scheduleIso}`;
};

const buildCalendarEventFromReminder = (
  reminder: GrayReminderCreatedPayload,
  eventKey: string,
  calendarId: string,
  color: string
): CalendarEvent | null => {
  const scheduleIso = deriveReminderScheduleIso(reminder);
  if (!scheduleIso) {
    return null;
  }
  const start = new Date(scheduleIso);
  if (Number.isNaN(start.getTime())) {
    return null;
  }
  const end = new Date(start.getTime() + 60_000);
  const reminderRecord = (reminder.data.reminder as Record<string, unknown> | null | undefined) ?? null;
  const rawRecord = (reminder.data.raw as Record<string, unknown> | null | undefined) ?? null;

  // Check for color in metadata
  let effectiveColor = color;
  if (reminderRecord && typeof reminderRecord["metadata"] === "object" && reminderRecord["metadata"]) {
    const metadata = reminderRecord["metadata"] as Record<string, unknown>;
    if (typeof metadata["color"] === "string" && metadata["color"]) {
      effectiveColor = metadata["color"];
    }
  }

  const summaryCandidate =
    reminder.data.summary ??
    (reminderRecord && typeof reminderRecord["description"] === "string"
      ? reminderRecord["description"]
      : null) ??
    (rawRecord && typeof rawRecord["description"] === "string"
      ? rawRecord["description"]
      : null);
  const title = reminder.data.label?.trim() || "Reminder";
  const description = summaryCandidate ? String(summaryCandidate) : undefined;
  return {
    id: `reminder-${eventKey}`,
    calendarId,
    title,
    start,
    end,
    color: effectiveColor,
    entryType: "reminder",
    description,
    displayHint: "line",
  };
};

const shouldIncludeCalendarReminder = (reminder: Reminder, nowMs: number): boolean => {
  if (reminder.status === "pending") {
    return true;
  }
  if (reminder.status !== "delivered") {
    return false;
  }
  const remindAt = Date.parse(reminder.remind_at);
  if (!Number.isFinite(remindAt)) {
    return false;
  }
  return remindAt >= nowMs - REMINDER_RETENTION_WINDOW_MS;
};

const isGenericSessionTitle = (title: string | null | undefined): boolean => {
  if (!title) {
    return true;
  }
  const trimmed = title.trim();
  if (!trimmed) {
    return true;
  }
  const normalized = trimmed.toLowerCase();
  return normalized === "new chat" || normalized === "conversation start";
};

const HISTORY_DUPLICATE_WINDOW_MS = 8000;

type PlanCarrierUser = User & { plan_tier?: string | null };

const derivePlanTierLabel = (candidate?: PlanCarrierUser | null): string => {
  if (!candidate) {
    return "Scout";
  }
  const rawTier = (candidate.plan_tier ?? candidate.role ?? "").trim();
  if (!rawTier) {
    return "Scout";
  }
  const normalized = rawTier.toLowerCase();
  if (normalized === "voyager") {
    return "Voyager";
  }
  const premiumTokens = new Set(["depth", "pro", "premium", "operator", "admin"]);
  if (premiumTokens.has(normalized)) {
    return "Depth";
  }
  return "Scout";
};

const getSessionSeedFingerprint = (session: ChatSession): string | null => {
  if (!session || session.scope !== "thread" || !Array.isArray(session.messages)) {
    return null;
  }
  const seedMessage = session.messages.find(
    (message) => message.role === "user" && message.content.trim().length > 0
  );
  if (!seedMessage) {
    return null;
  }
  return seedMessage.content.trim().toLowerCase();
};

const getReadableSessionTitle = (session: ChatSession): string => {
  const title = session.title?.trim();
  if (title && title.length > 0) {
    return title;
  }
  return "New Chat";
};

const REMINDER_PLAN_ID_PREFIX = "reminder-";

const parseReminderPlanId = (planId: string): number | null => {
  if (!planId.startsWith(REMINDER_PLAN_ID_PREFIX)) {
    return null;
  }
  const candidate = planId.slice(REMINDER_PLAN_ID_PREFIX.length);
  if (!candidate) {
    return null;
  }
  const parsed = Number(candidate);
  return Number.isNaN(parsed) ? null : parsed;
};

const extractReminderId = (eventId: string): number | null => {
  if (!eventId.startsWith("reminder-")) return null;
  const parts = eventId.split("-");
  // Expected: reminder-{source}-{id}-{iso}
  // We assume source doesn't contain hyphens usually, but if it does, we might be in trouble.
  // However, based on buildReminderEventKey, source is usually 'assistant'.
  // Let's try to parse the 3rd part (index 2).
  if (parts.length >= 3) {
    const candidate = Number(parts[2]);
    if (!Number.isNaN(candidate)) {
      return candidate;
    }
  }
  // Fallback: try regex
  const match = eventId.match(/^reminder-[^-]+-(\d+)-/);
  if (match) {
    return Number(match[1]);
  }
  return null;
};

const SIDEBAR_ITEMS: SidebarNavItem[] = [
  { id: "general", label: "General", icon: Gem },
  { id: "threads", label: "Threads", icon: MessageSquarePlus },
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "history", label: "History", icon: History },
];

const SIDEBAR_RAIL_ITEMS: SidebarNavItem[] = [
  { id: "search", label: "Search", icon: Search },
  ...SIDEBAR_ITEMS,
];

const NAVIGATION_ROUTES: Partial<Record<SidebarNavKey, string>> = {
  general: "/g",
  threads: "/",
  dashboard: "/dashboard",
  history: "/history",
};

const deriveInitials = (fullName: string | null | undefined) => {
  if (!fullName) {
    return "";
  }

  const parts = fullName
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) {
    return "";
  }

  if (parts.length === 1) {
    const [first] = parts;
    return first.slice(0, Math.min(first.length, 2)).toUpperCase();
  }

  const firstInitial = parts[0][0] ?? "";
  const lastInitial = parts[parts.length - 1][0] ?? "";
  return `${firstInitial}${lastInitial}`.toUpperCase();
};

const greetingForDate = (date: Date) => {
  const hour = date.getHours();
  if (hour < 12) {
    return "morning";
  }
  if (hour < 18) {
    return "afternoon";
  }
  return "evening";
};

type GrayPageClientProps = {
  initialTimestamp: number;
  activeNav?: SidebarNavKey;
  variant?: "general" | "dashboard" | "chat";
  activeChatId?: string | null;
};

type ViewMode = "general" | "dashboard" | "history" | "chat";

type ChatDraftControls = {
  clear: () => void;
  restore: (value: string) => void;
};

type ChatDraftInputProps = Omit<GrayChatBarProps, "value" | "onChange" | "onSubmit"> & {
  variant: "composer" | "bar";
  onSubmitMessage: (draft: string, controls: ChatDraftControls) => void;
  showUnderline?: boolean;
  attachmentTray?: ReactNode;
};

const ChatDraftInput = ({
  variant,
  onSubmitMessage,
  showUnderline = true,
  attachmentTray,
  ...rest
}: ChatDraftInputProps) => {
  const [value, setValue] = useState("");
  const clear = useCallback(() => setValue(""), []);
  const restore = useCallback((nextValue: string) => setValue(nextValue), []);
  const controls = useMemo(
    () => ({
      clear,
      restore,
    }),
    [clear, restore]
  );

  const handleChange = useCallback((nextValue: string) => {
    setValue(nextValue);
  }, []);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = value.trim();
      if (!trimmed) {
        return;
      }
      onSubmitMessage(trimmed, controls);
    },
    [value, controls, onSubmitMessage]
  );

  if (variant === "composer") {
    return (
      <GrayChatComposer
        {...rest}
        value={value}
        onChange={handleChange}
        onSubmit={handleSubmit}
        showUnderline={showUnderline}
        attachmentTray={attachmentTray}
      />
    );
  }

  return (
    <GrayChatBar
      {...rest}
      value={value}
      onChange={handleChange}
      onSubmit={handleSubmit}
    />
  );
};

function GrayPageClientInner({
  initialTimestamp,
  activeNav,
  variant = "general",
  activeChatId = null,
}: GrayPageClientProps) {
  const { user, loading } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [now, setNow] = useState(() => new Date(initialTimestamp));
  const [isWorkspaceBackgroundAllowed, setIsWorkspaceBackgroundAllowed] = useState(false);

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

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const host = window.location.host.toLowerCase();
    const isAllowedHost = host === "gray.localhost:3000";
    const isRootPath = pathname === "/";
    setIsWorkspaceBackgroundAllowed(isAllowedHost && isRootPath);
  }, [pathname]);

  // Include reminderPlans in derivedPlans so they appear in the pulse
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
      new Notification(title, { body });
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("Failed to dispatch dashboard notification", error);
      }
    }
  }, []);

  const {
    pulseEntries,
    setPulseEntries,
    activePulseId,
    setActivePulseId,
    activePulse,
    isActivePulseEditable
  } = usePulse(userId, todayAnchor, nowDateKey, derivedPlans, derivedHabits, proactivity, sendDashboardNotification);

  const [habitEditorTarget, setHabitEditorTarget] = useState<HabitItem | null>(null);
  const [planTab, setPlanTab] = useState<"plans" | "habits">("plans");
  const chatSubmitInFlightRef = useRef(false);
  const [hasSeenGeneralChat, setHasSeenGeneralChat] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState<boolean>(true);
  const [hasLoadedSidebarPref, setHasLoadedSidebarPref] = useState(false);
  const [dashboardTab, setDashboardTab] = useState<"pulse" | "calendar">("pulse");
  const [isPersonalizationOpen, setIsPersonalizationOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [contextUsageSummary, setContextUsageSummary] = useState<ContextUsageSummary | null>(null);
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<Date>(() => new Date(initialTimestamp));
  const [workspaceBackgrounds, setWorkspaceBackgrounds] = useState<WorkspaceBackgroundOption[]>([
    SOLID_WHITE_BACKGROUND,
    SOLID_BLACK_BACKGROUND,
    GREAT_WAVE_BACKGROUND,
  ]);
  const [workspaceBackgroundId, setWorkspaceBackgroundId] = useState<string>(() =>
    user?.workspace_background_id ?? GREAT_WAVE_BACKGROUND.id
  );

  useEffect(() => {
    if (user?.workspace_background_id) {
      setWorkspaceBackgroundId(user.workspace_background_id);
    }
  }, [user?.workspace_background_id]);

  const [workspaceBackgroundsLoading, setWorkspaceBackgroundsLoading] = useState(false);
  const [workspaceBackgroundsError, setWorkspaceBackgroundsError] = useState<string | null>(null);
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
    appendMessage,
    uploadAttachments,
    attachments,
    isAttachmentUploading,
    attachmentError,
    removeAttachment,
  } = useChatStore();
  const reminderEventKeysRef = useRef<Set<string>>(new Set());
  const supportsInlineChat = variant !== "chat";
  const shouldShowDashboardChatBar = variant !== "dashboard";
  const [currentChatId, setCurrentChatId] = useState<string | null>(() => activeChatId ?? null);
  const [isCompactLayout, setIsCompactLayout] = useState(false);
  const ensureSessionRef = useRef(ensureSession);
  const { deliveredKeys: deliveredProactivityKeys } = useProactivityNotifications();

  const activeWorkspaceBackground = useMemo(() => {
    const list = workspaceBackgrounds.length > 0 ? workspaceBackgrounds : [GREAT_WAVE_BACKGROUND];
    return list.find((option) => option.id === workspaceBackgroundId) ?? list[0];
  }, [workspaceBackgroundId, workspaceBackgrounds]);
  const workspaceBackdropStyle =
    activeWorkspaceBackground?.backdropStyle ?? GREAT_WAVE_BACKGROUND.backdropStyle;

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

  // Dashboard appearance preferences (sidebar + background) are now per-session
  // only, so we no longer read from or write to localStorage here.

  const loadWorkspaceBackgrounds = useCallback(async () => {
    setWorkspaceBackgroundsLoading(true);
    setWorkspaceBackgroundsError(null);
    try {
      const payload = await apiService.listWorkspaceBackgrounds();
      const dynamicOptions: WorkspaceBackgroundOption[] = payload
        .map((background) => ({
          id: background.slug,
          label: background.label,
          description: background.description ?? null,
          previewStyle: background.preview_css,
          backdropStyle: background.backdrop_css,
          source: "database" as const,
        }))
        .filter((option) => option.id !== GREAT_WAVE_BACKGROUND.id);
      setWorkspaceBackgrounds([SOLID_WHITE_BACKGROUND, SOLID_BLACK_BACKGROUND, GREAT_WAVE_BACKGROUND, ...dynamicOptions]);
    } catch (error) {
      console.error("Failed to load workspace backgrounds:", error);
      setWorkspaceBackgroundsError(error instanceof Error ? error.message : "Failed to load backgrounds");
      setWorkspaceBackgrounds((current) => (current.length > 0 ? current : [SOLID_WHITE_BACKGROUND, SOLID_BLACK_BACKGROUND, GREAT_WAVE_BACKGROUND]));
    } finally {
      setWorkspaceBackgroundsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkspaceBackgrounds().catch((error) => {
      console.error("Unable to fetch workspace backgrounds:", error);
    });
  }, [loadWorkspaceBackgrounds]);

  const deriveBackgroundLabel = useCallback((fileName?: string) => {
    if (!fileName) {
      return "Custom background";
    }
    const trimmed = fileName.trim();
    if (!trimmed) {
      return "Custom background";
    }
    const withoutExtension = trimmed.replace(/\.[^.]+$/, "");
    const cleaned = withoutExtension
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return cleaned.length > 0 ? cleaned : "Custom background";
  }, []);

  const handleSelectBackground = useCallback(async (backgroundId: string) => {
    setWorkspaceBackgroundId(backgroundId);
    if (userId) {
      try {
        await apiService.updateUser(userId, { workspace_background_id: backgroundId });
      } catch (error) {
        console.error("Failed to persist workspace background preference:", error);
      }
    }
  }, [userId]);

  const handleCreateWorkspaceBackground = useCallback(
    async (draft: WorkspaceBackgroundDraft) => {
      if (!draft.assetFile) {
        throw new Error("Upload a workspace background image first.");
      }

      const asset = await apiService.uploadWorkspaceBackgroundAsset(draft.assetFile);
      const assetUrl = asset.asset_path;
      const backdropCss = `url('${assetUrl}') center / cover no-repeat`;
      const previewCss =
        `linear-gradient(135deg, rgba(7, 8, 15, 0.72), rgba(2, 4, 9, 0.93)), ${backdropCss}`;

      const payload = {
        label: deriveBackgroundLabel(draft.assetFile.name),
        description: "Uploaded custom background",
        preview_css: previewCss,
        backdrop_css: backdropCss,
      };
      const created = await apiService.createWorkspaceBackground(payload);
      await loadWorkspaceBackgrounds();
      if (created?.slug) {
        setWorkspaceBackgroundId(created.slug);
        if (userId) {
          apiService.updateUser(userId, { workspace_background_id: created.slug }).catch((err) => {
            console.error("Failed to persist new background selection:", err);
          });
        }
      }
    },
    [deriveBackgroundLabel, loadWorkspaceBackgrounds, userId]
  );

  const baseViewMode: ViewMode =
    variant === "chat"
      ? "chat"
      : variant === "dashboard"
        ? "dashboard"
        : "general";

  const [manualViewMode, setManualViewMode] = useState<ViewMode | null>(() => {
    if (supportsInlineChat && (activeChatId ?? null)) {
      return "chat";
    }
    return activeNav === "history" && baseViewMode !== "chat" ? "history" : null;
  });

  const effectiveManualViewMode = activeNav === "dashboard" ? null : manualViewMode;

  const viewMode: ViewMode =
    baseViewMode === "chat"
      ? "chat"
      : effectiveManualViewMode ?? (activeNav === "history" ? "history" : baseViewMode);
  const renderPrimaryView = () => {
    if (isDashboardView) {
      return (
        <GrayDashboardView
          pulseEntries={pulseEntries}
          currentPulse={activePulse}
          isCurrentPulseEditable={Boolean(isActivePulseEditable)}
          livePlans={derivedPlans}
          onSelectPulse={setActivePulseId}
          proactivityFallback={proactivity}
          onProactivitySelect={selectProactivityPreset}
          onProactivityRemove={removeProactivity}
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
          chatBar={
            shouldShowDashboardChatBar ? (
              <ChatDraftInput variant="bar" onSubmitMessage={handleChatSubmit} />
            ) : undefined
          }
          isCompactLayout={isCompactLayout}
          userId={userId}
          reminderPlans={reminderPlans}
          proactivityDeliveryKeys={deliveredProactivityKeys}
          onReminderMove={handleReminderMove}
        />
      );
    }
    if (isChatView) {
      return (
        <GrayChatView
          sessionId={currentChatId ?? null}
          onContextUsageChange={setContextUsageSummary}
          hideThinkingIndicator={hideChatThinkingIndicator}
          introContent={
            activeNav !== "threads" &&
              supportsInlineChat &&
              !hasSeenGeneralChat &&
              currentChatId &&
              generalSessionId &&
              currentChatId === generalSessionId ? (
              <div className={styles.introStack}>
                <GrayWorkspaceHeader
                  streakCount={streakCount}
                  planLabel={viewerPlanLabel}
                  onUpgradeClick={handleUpgradePlan}
                >
                  {renderWorkspaceGreeting()}
                </GrayWorkspaceHeader>
                <FirstChatOnboarding
                  viewerName={viewerName}
                  onComplete={handleFirstChatOnboardingDone}
                  onSkip={handleFirstChatOnboardingDone}
                />
              </div>
            ) : null
          }
        />
      );
    }
    if (isHistoryView) {
      return (
        <GrayHistoryView
          sections={historySections}
          onOpenEntry={handleOpenHistoryEntry}
          activeEntryId={currentChatId ?? null}
          onOpenEntryExternal={handleOpenHistoryEntryExternal}
          onRenameEntry={handleRenameHistoryEntry}
          onDeleteEntry={handleDeleteHistoryEntry}
        />
      );
    }
    return (
      <div className={styles.generalViewSection}>
        <GrayGeneralView
          greeting={greeting}
          dateLabel={workspaceDateLabel}
          calendarEvents={derivedEvents}
          plans={derivedPlans}
          habits={derivedHabits}
          activeTab={planTab}
          onChangeTab={setPlanTab}
          onTogglePlan={togglePlan}
          onToggleHabit={toggleHabit}
          onSavePlan={savePlan}
          onDeletePlan={deletePlan}
          currentDate={now}
          calendars={derivedCalendars}
          onCalendarsChange={handleCalendarsChange}
          onCalendarEventsChange={handleEventsChange}
          calendarSelectedDate={calendarSelectedDate}
          onCalendarSelectedDateChange={setCalendarSelectedDate}
          isCompactLayout={isCompactLayout}
          onEditHabit={editHabit}
          onDeleteHabit={deleteHabit}
          onRefreshData={refreshPlansAndHabits}
          showGreeting={false}
          userId={user?.id ?? null}
          onReminderMove={handleReminderMove}
        />
      </div>
    );
  };

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Close mobile sidebar on navigation
  const handleMobileNavigate = (nav: SidebarNavKey) => {
    handleNavigate(nav);
    setIsMobileSidebarOpen(false);
  };



  // Fetch context usage for general session when personalization is open
  useEffect(() => {
    if (!isPersonalizationOpen || !generalSessionId) {
      return;
    }

    // Avoid refetching if we already have usage for this conversation
    if (contextUsageSummary?.conversationId === generalSessionId) {
      return;
    }

    let cancelled = false;

    apiService
      .getConversationUsage(generalSessionId)
      .then((usage) => {
        if (!usage || cancelled) {
          return;
        }
        setContextUsageSummary({
          conversationId: usage.conversationId,
          messageCount: usage.messageCount,
          conversationTokens: usage.conversationTokens,
          workspaceTokens: 0,
          totalTokens: usage.conversationTokens,
          tokensRemaining:
            usage.limit > 0
              ? Math.max(0, usage.limit - usage.conversationTokens)
              : 0,
          limit: usage.limit,
          provider: usage.provider,
          modelName: usage.modelName ?? null,
          modelLabel: usage.modelLabel ?? null,
        });
      })
      .catch((err) => {
        console.error("Failed to fetch general session usage", err);
      });

    return () => {
      cancelled = true;
    };
  }, [isPersonalizationOpen, generalSessionId, contextUsageSummary?.conversationId]);

  const renderMainSurface = () => {
    if (viewMode === "general") {
      return (
        <div
          className={styles.mainContent}
          data-view={viewMode}
          data-compact={isCompactLayout ? "true" : "false"}
        >
          <GrayWorkspaceHeader
            streakCount={streakCount}
            planLabel={viewerPlanLabel}
            onUpgradeClick={handleUpgradePlan}
          >
            {renderWorkspaceGreeting()}
          </GrayWorkspaceHeader>
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
    if (loading) {
      return "Loading...";
    }
    return formatDisplayName(user?.full_name, user?.email);
  }, [loading, user?.email, user?.full_name]);

  const viewerAvatarUrl =
    user?.profile_picture_url && user.profile_picture_url.trim().length > 0
      ? user.profile_picture_url
      : "/astronauttest.jpg";

  const viewerPlanLabel = useMemo(() => {
    const planCarrier = (user ?? null) as PlanCarrierUser | null;
    return derivePlanTierLabel(planCarrier);
  }, [user]);

  const viewerInitials = useMemo(() => {
    if (loading) {
      return "--";
    }
    if (user?.initials) {
      return user.initials;
    }
    return deriveInitials(user?.full_name ?? viewerName) || "OP";
  }, [user, loading, viewerName]);
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

    dedupedThreadSessions.forEach((session) => {
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
      });
    });

    return Array.from(groups.values())
      .sort((a, b) => b.sortKey - a.sortKey)
      .map((group) => ({
        id: group.id,
        label: group.label,
        entries: group.entries.sort((a, b) => b.createdAt - a.createdAt),
      }));
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
  const isHistoryView = viewMode === "history";
  const sidebarActiveNav: SidebarNavKey =
    activeNav === "threads"
      ? "threads"
      : viewMode === "chat"
        ? currentChatId && generalSessionId && currentChatId === generalSessionId
          ? "general"
          : "history"
        : viewMode === "history"
          ? "history"
          : viewMode === "dashboard"
            ? "dashboard"
            : "general";

  const handleNavigate = (navId: SidebarNavKey) => {
    if (navId === "search") {
      setIsSidebarExpanded(true);
      return;
    }

    if (navId === "history") {
      // Navigate to the dedicated History page route
      const target = NAVIGATION_ROUTES[navId];
      if (target) {
        setManualViewMode(null);
        router.push(target);
      } else {
        // Fallback: force the in-layout history view if route is missing
        setManualViewMode("history");
      }
      setIsSidebarExpanded(true);
      return;
    }

    if (navId === "dashboard") {
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

  const handleOpenPersonalization = () => {
    setIsPersonalizationOpen(true);
  };

  const handleClosePersonalization = () => {
    setIsPersonalizationOpen(false);
  };

  const handleOpenSettings = () => {
    setIsSettingsOpen(true);
  };

  const handleCloseSettings = () => {
    setIsSettingsOpen(false);
  };

  const handleOpenHelp = () => {
    console.info("Help center is not implemented yet.");
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
      return "Threads";
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
    if (!user) {
      return null;
    }

    const sections: string[] = [];
    const currentCalendars = calendarCalendars;
    const currentPlans = plans;
    const currentHabits = habits;

    if (currentCalendars.length > 0) {
      sections.push(
        "Calendars:",
        currentCalendars
          .map((calendar) => `- ${calendar.label} (${calendar.isVisible ? "visible" : "hidden"})`)
          .join("\n")
      );
    }

    if (currentPlans.length > 0) {
      if (sections.length > 0) {
        sections.push("");
      }
      sections.push(
        "Plans:",
        currentPlans.map((plan) => `- ${plan.completed ? "done" : "pending"}: ${plan.label}`).join("\n")
      );
    }

    if (derivedEvents.length > 0) {
      if (sections.length > 0) {
        sections.push("");
      }
      const sortedEvents = [...derivedEvents].sort((a, b) => a.start.getTime() - b.start.getTime());
      sections.push(
        "Schedule:",
        sortedEvents
          .map((e) => {
            const dateLabel = e.start.toLocaleDateString([], {
              weekday: "short",
              month: "short",
              day: "numeric",
            });
            const startStr = e.start.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });
            const endStr = e.end.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });
            return `- ${dateLabel} [${startStr} - ${endStr}] ${e.title}${e.description ? ` (${e.description})` : ""
              }`;
          })
          .join("\n")
      );
    }

    if (currentHabits.length > 0) {
      if (sections.length > 0) {
        sections.push("");
      }
      sections.push(
        "Habits:",
        currentHabits
          .map(
            (habit) =>
              `- ${habit.label} (streak: ${habit.streakLabel}${habit.previousLabel ? ` | previous: ${habit.previousLabel}` : ""
              })`
          )
          .join("\n")
      );
    }

    const hasWorkspaceDetails = sections.length > 0;
    const shouldIncludeProactivity = hasWorkspaceDetails && proactivity !== null;

    if (shouldIncludeProactivity && proactivity) {
      sections.push(
        "",
        "Proactivity:",
        `- ${proactivity.label}: ${proactivity.description} (Cadence: ${proactivity.cadence}, Times: ${(proactivity.times ?? [proactivity.time]).join(", ")})`
      );
    }

    const visibleCalendarMap = new Map(currentCalendars.map((calendar) => [calendar.id, calendar.label]));
    const nowTime = now.getTime();
    const upcomingEvents = derivedEvents
      .filter((event) => {
        const startDate = event.start instanceof Date ? event.start : new Date(event.start);
        return startDate.getTime() >= nowTime - 30 * 60 * 1000;
      })
      .sort((a, b) => {
        const aTime = (a.start instanceof Date ? a.start : new Date(a.start)).getTime();
        const bTime = (b.start instanceof Date ? b.start : new Date(b.start)).getTime();
        return aTime - bTime;
      })
      .slice(0, 3);

    if (upcomingEvents.length > 0) {
      if (sections.length > 0) {
        sections.push("");
      }
      sections.push(
        "Upcoming events:",
        upcomingEvents
          .map((event) => {
            const startDate = event.start instanceof Date ? event.start : new Date(event.start);
            const dateLabel = startDate.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
            const timeLabel = startDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            const calendarLabel = visibleCalendarMap.get(event.calendarId) ?? "Calendar";
            return `- ${dateLabel} ${timeLabel}: ${event.title} [${calendarLabel}]`;
          })
          .join("\n")
      );
    }

    const todayKey = toDateKey(now);
    const recentPulses = [...pulseEntries]
      .filter(
        (entry) =>
          Number.isFinite(entry.timestamp) &&
          entry.dateKey === todayKey &&
          (entry.plans.length > 0 || entry.habits.length > 0)
      )
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 3);

    if (recentPulses.length > 0) {
      if (sections.length > 0) {
        sections.push("");
      }

      const pulseLines = recentPulses.map((pulse) => {
        const dateLabel = new Date(pulse.timestamp).toLocaleDateString([], {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
        const totalPlans = pulse.plans.length;
        const completedPlans = pulse.plans.filter((plan) => plan.completed).length;
        const totalHabits = pulse.habits.length;
        const activeHabits = pulse.habits.filter((habit) => Boolean(habit.completed)).length;
        const proactivityLabel = pulse.proactivity?.label ?? "No proactivity focus";
        return `- ${dateLabel}: ${completedPlans}/${totalPlans} plans complete, ${activeHabits}/${totalHabits} habits on track, Proactivity: ${proactivityLabel}`;
      });

      sections.push("Pulse snapshots:", pulseLines.join("\n"));
    }

    const summary = sections.join("\n").trim();
    return summary.length > 0 ? summary : null;
  }, [calendarCalendars, calendarEvents, habits, plans, proactivity, pulseEntries, user, now, derivedEvents]);

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
    console.log('[GrayPageClient] Looking for session:', activeChatId, 'found:', directSession?.id, 'messages:', directSession?.messages?.length);
    console.log('[GrayPageClient] All sessions:', sessions.map(s => ({ id: s.id, msgCount: s.messages?.length })));

    // Already selected the right session and it exists.
    if (currentChatId === activeChatId && directSession) {
      return;
    }

    // 1) Exact local session id match (/c/{session.id}).
    if (directSession) {
      console.log('[GrayPageClient] Found direct session, setting as current');
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
      const updatedCalendarEvents = previousCalendarEvents.filter(
        (event) => event.id !== planToDelete.id
      );

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

  const toggleHabit = (id: string) => {
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
    setHabits(updatedHabits);
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

  const handleChatSubmit = async (draft: string, controls: ChatDraftControls) => {
    const normalizedDraft = draft.trim();
    if (!normalizedDraft) {
      return;
    }
    if (chatSubmitInFlightRef.current) {
      return;
    }
    chatSubmitInFlightRef.current = true;
    controls.clear();

    try {
      const isGeneralChatActive =
        Boolean(currentChatId) &&
        Boolean(generalSessionId) &&
        currentChatId === generalSessionId;

      const isGeneralSurface = activeNav === "general";
      const shouldStartStandaloneThread =
        !isGeneralSurface && (!currentChatId || isGeneralChatActive);

      // When starting a standalone thread from non-general surfaces
      // (e.g. the dashboard quick compose),
      // immediately navigate to the thread route (no deferred redirect),
      // so the main chat view renders and begins streaming without extra delay.
      if (shouldStartStandaloneThread) {
        const session = await createThreadSession(normalizedDraft);
        setHasSeenGeneralChat(true);
        setCurrentChatId(session.id);
        if (supportsInlineChat) {
          setManualViewMode("chat");
          if (typeof window !== "undefined") {
            window.history.pushState(null, "", `/c/${session.id}`);
          }
        } else {
          router.push(`/c/${session.id}`);
        }
        return;
      }

      const sessionId = await sendGeneralMessage(normalizedDraft);
      setHasSeenGeneralChat(true);
      setCurrentChatId(sessionId);

      const generalId = generalSessionId ?? GENERAL_CHAT_SESSION_ID;
      const isGeneralSession = sessionId === generalId;

      if (supportsInlineChat) {
        // Switch layout immediately to chat mode so the user sees the reply begin
        // without waiting for an asynchronous redirect effect chain.
        setManualViewMode("chat");
        if (!isGeneralSession && typeof window !== "undefined") {
          window.history.pushState(null, "", `/c/${sessionId}`);
        }
      } else if (isGeneralSession) {
        router.push("/g");
      } else if (activeChatId !== sessionId) {
        router.push(`/c/${sessionId}`);
      }
    } catch (error) {
      console.error("Failed to send general message:", error);
      controls.restore(draft);
    } finally {
      chatSubmitInFlightRef.current = false;
    }
  };

  const handleFirstChatOnboardingDone = useCallback(
    (_result?: FirstChatOnboardingResult) => {
      setHasSeenGeneralChat(true);
    },
    [setHasSeenGeneralChat]
  );

  useEffect(() => {
    if (!supportsInlineChat || typeof window === "undefined") {
      return;
    }
    if (manualViewMode !== "chat" || !currentChatId) {
      return;
    }
    const pathname = window.location.pathname;
    const targetPath = `/c/${currentChatId}`;
    if (pathname !== targetPath) {
      window.history.replaceState(null, "", targetPath);
    }
  }, [currentChatId, manualViewMode, supportsInlineChat]);

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

  const handleRenameHistoryEntry = (entry: SidebarHistoryEntry) => {
    const nextTitle = window.prompt("Rename conversation", entry.title);
    if (!nextTitle) {
      return;
    }
    renameSession(entry.id, nextTitle);
  };

  const handleDeleteHistoryEntry = (entry: SidebarHistoryEntry) => {
    const confirmed = window.confirm("Delete this conversation? This cannot be undone.");
    if (!confirmed) {
      return;
    }
    deleteSession(entry.id);
    if (currentChatId === entry.id) {
      setCurrentChatId(null);
    }
  };

  const greeting = `Good ${greetingForDate(now)}, ${viewerName}`;
  const hideChatThinkingIndicator = false;
  const renderWorkspaceGreeting = useCallback(
    () => (
      <div className={styles.greetingStack}>
        <h1 className={styles.greeting}>{greeting}</h1>
        <p className={styles.greetingDate}>{workspaceDateLabel}</p>
      </div>
    ),
    [greeting, workspaceDateLabel]
  );
  const dashboardTabAttr = isDashboardView ? dashboardTab : undefined;

  const shouldShowWorkspaceBackground = isWorkspaceBackgroundAllowed && viewMode !== "chat";
  const isFullPageChatLayout = variant === "chat" && activeNav === "general";
  const generalAttachmentsActive =
    viewMode === "general" && (attachments.length > 0 || isAttachmentUploading);
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

  return (
    <>
      <div
        className={styles.page}
        data-variant={variant}
        data-dashboard-tab={dashboardTabAttr}
        data-compact={isCompactLayout ? "true" : "false"}
        data-general-attachments={generalAttachmentsActive ? "true" : "false"}
        data-workspace-background={shouldShowWorkspaceBackground ? "true" : "false"}
        data-chat-layout={isFullPageChatLayout ? "full" : "embedded"}
      >
        {shouldShowWorkspaceBackground ? (
          <>
            <div
              className={styles.backdrop}
              aria-hidden="true"
              style={{ background: workspaceBackdropStyle }}
            />
            <div className={styles.overlay} aria-hidden="true" />
          </>
        ) : null}
        <div className={styles.shell}>
          <div className={styles.layout} data-view={viewMode}>
            {/* Mobile Overlay */}
            <div
              className={styles.mobileSidebarOverlay}
              data-visible={isMobileSidebarOpen ? "true" : "false"}
              onClick={() => setIsMobileSidebarOpen(false)}
            />
            <GrayEnhancedSidebar
              isExpanded={isSidebarExpanded || isMobileSidebarOpen}
              viewerName={viewerName}
              viewerInitials={viewerInitials}
              viewerAvatarUrl={viewerAvatarUrl}
              viewerPlanLabel={viewerPlanLabel}
              activeNav={sidebarActiveNav}
              railItems={SIDEBAR_RAIL_ITEMS}
              navItems={SIDEBAR_ITEMS}
              historySections={historySections}
              onExpand={() => setIsSidebarExpanded(true)}
              onCollapse={() => {
                setIsSidebarExpanded(false);
                setIsMobileSidebarOpen(false);
              }}
              onToggle={() => setIsSidebarExpanded((previous) => !previous)}
              onNavigate={handleMobileNavigate}
              activeChatId={currentChatId}
              onOpenPersonalization={handleOpenPersonalization}
              onOpenSettings={handleOpenSettings}
              onOpenHelp={handleOpenHelp}
              onUpgradePlan={handleUpgradePlan}
              onLogOut={handleLogOut}
            />

            <div
              className={styles.main}
              data-dashboard={isDashboardView ? "true" : "false"}
              data-view={viewMode}
              data-dashboard-tab={dashboardTabAttr}
              data-compact={isCompactLayout ? "true" : "false"}
              data-general-attachments={generalAttachmentsActive ? "true" : "false"}
              data-dashboard-free="true"
            >
              {/* Mobile Header */}
              <div className={styles.mobileHeader}>
                <button
                  className={styles.mobileMenuButton}
                  onClick={() => setIsMobileSidebarOpen(true)}
                >
                  <LayoutDashboard size={24} />
                </button>
                <span style={{ fontWeight: 600 }}>Gray</span>
                <div style={{ width: 24 }} /> {/* Spacer */}
              </div>
              {isDashboardView ? renderPrimaryView() : renderMainSurface()}
              {viewMode === "general" ? (
                <>
                  <ChatDraftInput
                    variant="composer"
                    onSubmitMessage={handleChatSubmit}
                    showUnderline={false}
                    onAddAttachment={openAttachmentPicker}
                    attachmentTray={generalAttachmentTray}
                  />
                  <input
                    ref={attachmentInputRef}
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    className={styles.chatAttachmentInput}
                    onChange={handleAttachmentInputChange}
                  />
                </>
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
        {isPersonalizationOpen && (
          <PersonalizationPanel
            viewerName={viewerName}
            viewerRole={user?.role || "Operator"}
            userId={userId}
            profileNickname={user?.personalization_nickname ?? null}
            profileOccupation={user?.personalization_occupation ?? null}
            profileAbout={user?.personalization_about ?? null}
            profileCustomInstructions={user?.personalization_custom_instructions ?? null}
            contextUsage={contextUsageSummary}
            backgroundOptions={workspaceBackgrounds}
            selectedBackgroundId={workspaceBackgroundId}
            onSelectBackground={handleSelectBackground}
            onCreateBackground={handleCreateWorkspaceBackground}
            backgroundsLoading={workspaceBackgroundsLoading}
            backgroundError={workspaceBackgroundsError}
            onClose={handleClosePersonalization}
          />
        )}
        {isSettingsOpen && (
          <SettingsModal isOpen={isSettingsOpen} onClose={handleCloseSettings} />
        )}
      </div>
    </>
  );
}

export default function GrayPageClient(props: GrayPageClientProps) {
  const { variant = "general", activeChatId = null } = props;
  return (
    <GrayPageClientInner
      key={variant === "chat" ? `chat-${activeChatId ?? "new"}` : "gray-root"}
      {...props}
    />
  );
}
