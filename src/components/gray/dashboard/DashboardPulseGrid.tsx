"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Plus,
  Settings,
  Square,
} from "lucide-react";
import styles from "./DashboardPulseGrid.module.css";
import { useI18n } from "@/contexts/I18nContext";
import { useNotificationPreferences } from "@/contexts/NotificationPreferencesContext";
import {
  formatCustomTimeLabel,
  getProactivityTimes,
} from "@/components/gray/proactivityUtils";
import { PLAN_EVENT_ID_PREFIX } from "@/components/gray/planCalendarUtils";
import { requestNotificationPermission } from "@/lib/notificationUtils";
import { toDateKey } from "@/app/gray/utils";
import type { PlanItem, ProactivityItem } from "@/components/gray/types";
import type { CalendarEvent } from "@/components/calendar/types";

type ProactivityScheduleEntry = {
  label: string;
  delivered: boolean;
};

type VisibleTaskEntry = {
  id: string;
  label: string;
  completed: boolean;
  scheduleSlot: string | null;
  deadline: string | null;
};

type UnifiedEntry =
  | {
    kind: "event";
    id: string;
    title: string;
    color: string;
    meta: string;
    details: string | null;
  }
  | {
    kind: "task";
    id: string;
    title: string;
    completed: boolean;
    meta: string;
  };

const TIME_LABEL_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
};

const DATE_TIME_LABEL_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

const DATE_ONLY_LABEL_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
};

const DAY_MS = 24 * 60 * 60 * 1000;

const formatTimeLabel = (value: Date): string =>
  value.toLocaleTimeString(undefined, TIME_LABEL_OPTIONS);

const parseDateValue = (value: string | null | undefined): Date | null => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateTimeLabel = (value: Date): string =>
  value.toLocaleString(undefined, DATE_TIME_LABEL_OPTIONS);

const formatDateOnlyLabel = (value: Date): string =>
  value.toLocaleDateString(undefined, DATE_ONLY_LABEL_OPTIONS);

const isExactlyMidnight = (value: Date) =>
  value.getHours() === 0 &&
  value.getMinutes() === 0 &&
  value.getSeconds() === 0 &&
  value.getMilliseconds() === 0;

const isAllDayEvent = (event: CalendarEvent): boolean => {
  if (event.displayHint === "line" || event.entryType === "reminder") {
    return false;
  }
  const durationMs = event.end.getTime() - event.start.getTime();
  if (durationMs <= 0) {
    return false;
  }
  if (isExactlyMidnight(event.start) && isExactlyMidnight(event.end)) {
    return true;
  }
  return isExactlyMidnight(event.start) && durationMs >= DAY_MS && durationMs % DAY_MS === 0;
};

const getEventMetaLabel = (
  event: CalendarEvent,
  t: (value: string, vars?: Record<string, string | number>) => string
): string => {
  if (isAllDayEvent(event)) {
    return t("All day");
  }

  const crossesDayBoundary = toDateKey(event.start) !== toDateKey(event.end);
  if (crossesDayBoundary) {
    return t("{start} → {end}", {
      start: formatDateTimeLabel(event.start),
      end: formatDateTimeLabel(event.end),
    });
  }

  return t("{start} – {end}", {
    start: formatTimeLabel(event.start),
    end: formatTimeLabel(event.end),
  });
};

const doesEventIntersectDay = (event: CalendarEvent, day: Date): boolean => {
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  return event.start < dayEnd && event.end > dayStart;
};

const parseScheduleSlotRange = (
  baseDate: Date,
  slot: string | null | undefined
): { start: Date; end: Date } | null => {
  if (!slot) {
    return null;
  }
  const match = slot.match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }
  const startHours = Number(match[1]);
  const startMinutes = Number(match[2]);
  const endHours = Number(match[3]);
  const endMinutes = Number(match[4]);
  if (
    [startHours, startMinutes, endHours, endMinutes].some((value) => Number.isNaN(value)) ||
    startHours < 0 ||
    startHours > 23 ||
    endHours < 0 ||
    endHours > 23 ||
    startMinutes < 0 ||
    startMinutes > 59 ||
    endMinutes < 0 ||
    endMinutes > 59
  ) {
    return null;
  }

  const start = new Date(baseDate);
  start.setHours(startHours, startMinutes, 0, 0);
  const end = new Date(baseDate);
  end.setHours(endHours, endMinutes, 0, 0);
  if (end.getTime() <= start.getTime()) {
    end.setDate(end.getDate() + 1);
  }
  return { start, end };
};

type DashboardPulseGridProps = {
  currentDate: Date;
  selectedDate: Date;
  viewerName: string | null;
  proactivity: ProactivityItem | null;
  events: CalendarEvent[];
  plans?: PlanItem[];
  proactivityDeliveryKeys?: ReadonlySet<string>;
  canConfigureProactivity: boolean;
  onConfigureProactivity: () => void;
  onAddEvent?: (date: Date) => void;
  onTogglePlan?: (id: string) => void;
};

export function DashboardPulseGrid({
  currentDate,
  selectedDate,
  viewerName: _viewerName,
  proactivity,
  events,
  plans = [],
  proactivityDeliveryKeys,
  canConfigureProactivity,
  onConfigureProactivity,
  onAddEvent,
  onTogglePlan,
}: DashboardPulseGridProps) {
  const { t } = useI18n();
  const { notificationPreferences, setNotificationPreference } = useNotificationPreferences();

  const scheduleEntries = useMemo<ProactivityScheduleEntry[]>(() => {
    const times = getProactivityTimes(proactivity)
      .map((time) => time.trim())
      .filter(Boolean);

    if (times.length === 0) {
      return [];
    }

    const targetKey = toDateKey(selectedDate ?? currentDate);
    return times.map((time) => ({
      label: formatCustomTimeLabel(time),
      delivered: proactivityDeliveryKeys?.has(`${targetKey}T${time}`) ?? false,
    }));
  }, [currentDate, proactivity, proactivityDeliveryKeys, selectedDate]);

  const shouldPromptForProactivityAlerts =
    proactivity?.id === "proactivity-daily" || proactivity?.id === "proactivity-frequent";

  const resolveNotificationPermission = useCallback((): NotificationPermission | "unsupported" => {
    if (typeof window === "undefined" || typeof Notification === "undefined") {
      return "unsupported";
    }
    if (window.isSecureContext === false) {
      return "unsupported";
    }
    return Notification.permission;
  }, []);

  const [notificationPermission, setNotificationPermissionState] = useState<
    NotificationPermission | "unsupported"
  >(() => resolveNotificationPermission());

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncPermission = () => {
      const next = resolveNotificationPermission();
      setNotificationPermissionState((previous) => (previous === next ? previous : next));
    };

    syncPermission();
    window.addEventListener("focus", syncPermission);
    document.addEventListener("visibilitychange", syncPermission);

    return () => {
      window.removeEventListener("focus", syncPermission);
      document.removeEventListener("visibilitychange", syncPermission);
    };
  }, [resolveNotificationPermission]);

  const shouldShowNotificationBanner =
    shouldPromptForProactivityAlerts &&
    notificationPermission !== "unsupported" &&
    notificationPreferences.proactivity &&
    notificationPermission !== "granted" &&
    (notificationPermission === "denied" || notificationPreferences.device);

  const notificationBannerLabel =
    notificationPermission === "denied"
      ? t("Desktop alerts are off. Allow notifications in your browser settings to get nudges.")
      : t("Enable desktop alerts so Gray can nudge you when check-ins land.");

  const handleNotificationEnable = useCallback(async () => {
    const permission = await requestNotificationPermission();
    if (!permission) return;

    setNotificationPermissionState(permission);
    setNotificationPreference("device", permission === "granted");
  }, [setNotificationPreference]);

  const selectedDay = selectedDate ?? currentDate;
  const selectedDayKey = toDateKey(selectedDay);
  const isViewingToday = selectedDayKey === toDateKey(currentDate);

  const eventsForDay = useMemo(() => {
    return events
      .filter((event) => doesEventIntersectDay(event, selectedDay))
      .filter(
        (event) => event.entryType !== "plan" && !event.id.startsWith(PLAN_EVENT_ID_PREFIX)
      )
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [events, selectedDay]);

  const visibleTasks = useMemo<VisibleTaskEntry[]>(
    () => {
      const uniquePlans = new Map<string, VisibleTaskEntry>();
      plans.forEach((plan) => {
        if (!plan || uniquePlans.has(plan.id)) {
          return;
        }
        const deadlineDate = parseDateValue(plan.deadline);
        const shouldInclude = deadlineDate
          ? toDateKey(deadlineDate) === selectedDayKey
          : isViewingToday;
        if (!shouldInclude) {
          return;
        }
        uniquePlans.set(plan.id, {
          id: plan.id,
          label: plan.label,
          completed: Boolean(plan.completed),
          scheduleSlot: plan.scheduleSlot ?? null,
          deadline: plan.deadline ?? null,
        });
      });
      return Array.from(uniquePlans.values());
    },
    [isViewingToday, plans, selectedDayKey]
  );

  const unifiedEntries = useMemo<UnifiedEntry[]>(() => {
    type SortableEntry = {
      entry: UnifiedEntry;
      sortStart: number;
      sortEnd: number;
      sequence: number;
    };

    const buildTaskTimeline = (task: VisibleTaskEntry) => {
      const deadlineDate = parseDateValue(task.deadline);
      const scheduleRange = parseScheduleSlotRange(selectedDay, task.scheduleSlot);
      return {
        deadlineDate,
        scheduleRange,
      };
    };

    const taskMetadata = (timeline: ReturnType<typeof buildTaskTimeline>): string => {
      const labels: string[] = [];
      if (timeline.scheduleRange) {
        labels.push(
          t("{start} – {end}", {
            start: formatTimeLabel(timeline.scheduleRange.start),
            end: formatTimeLabel(timeline.scheduleRange.end),
          })
        );
      }

      if (timeline.deadlineDate) {
        const hasTime =
          timeline.deadlineDate.getHours() !== 0 || timeline.deadlineDate.getMinutes() !== 0;
        const deadlineLabel = hasTime
          ? formatDateTimeLabel(timeline.deadlineDate)
          : formatDateOnlyLabel(timeline.deadlineDate);
        labels.push(t("Due {date}", { date: deadlineLabel }));
      }

      return labels.length > 0 ? labels.join(" • ") : t("Task");
    };

    const sortableEntries: SortableEntry[] = [];

    eventsForDay.forEach((event, index) => {
      sortableEntries.push({
        entry: {
          kind: "event",
          id: event.id,
          title: event.title,
          color: event.color,
          meta: getEventMetaLabel(event, t),
          details: event.description?.trim() || null,
        },
        sortStart: event.start.getTime(),
        sortEnd: event.end.getTime(),
        sequence: index,
      });
    });

    visibleTasks.forEach((task, index) => {
      const timeline = buildTaskTimeline(task);
      const scheduleStart = timeline.scheduleRange?.start.getTime();
      const scheduleEnd = timeline.scheduleRange?.end.getTime();
      const deadlineTime = timeline.deadlineDate?.getTime();
      const sortStart = scheduleStart ?? deadlineTime ?? Number.POSITIVE_INFINITY;
      const sortEnd = scheduleEnd ?? deadlineTime ?? sortStart;

      sortableEntries.push({
        entry: {
          kind: "task",
          id: task.id,
          title: task.label,
          completed: task.completed,
          meta: taskMetadata(timeline),
        },
        sortStart,
        sortEnd,
        sequence: eventsForDay.length + index,
      });
    });

    sortableEntries.sort((left, right) => {
      if (left.sortStart !== right.sortStart) {
        return left.sortStart - right.sortStart;
      }
      if (left.sortEnd !== right.sortEnd) {
        return left.sortEnd - right.sortEnd;
      }
      if (left.entry.kind !== right.entry.kind) {
        return left.entry.kind === "event" ? -1 : 1;
      }
      const titleComparison = left.entry.title.localeCompare(right.entry.title);
      if (titleComparison !== 0) {
        return titleComparison;
      }
      const idComparison = left.entry.id.localeCompare(right.entry.id);
      if (idComparison !== 0) {
        return idComparison;
      }
      return left.sequence - right.sequence;
    });

    return sortableEntries.map((item) => item.entry);
  }, [eventsForDay, selectedDay, t, visibleTasks]);

  return (
    <div className={styles.dashboardGridFinal}>
      {/* EVENTS + TASKS */}
      <div className={`${styles.dashboardCard} ${styles.dashboardCardEvents}`}>
        <div className={styles.dashboardCardHeader}>
          <h2 className={styles.dashboardCardTitle}>{t("Events + Tasks")}</h2>
          {onAddEvent && (
            <button
              type="button"
              className={styles.dashboardCardAction}
              onClick={() => onAddEvent(selectedDay)}
              aria-label={t("Add event")}
            >
              <Plus size={18} />
            </button>
          )}
        </div>
        <div className={styles.dashboardCardBody}>
          <div className={styles.dashboardSection}>
            {unifiedEntries.length > 0 ? (
              <ul className={styles.dashboardEventList}>
                {unifiedEntries.map((entry) =>
                  entry.kind === "event" ? (
                    <li key={`event-${entry.id}`} className={styles.dashboardEventItem}>
                      <div
                        className={styles.dashboardEventMarker}
                        style={{ backgroundColor: entry.color }}
                      />
                      <div className={styles.dashboardEventInfo}>
                        <div className={styles.dashboardEventTitle}>{entry.title}</div>
                        <div className={styles.dashboardEventTime}>{entry.meta}</div>
                        {entry.details ? (
                          <div className={styles.dashboardEventDetails}>{entry.details}</div>
                        ) : null}
                      </div>
                    </li>
                  ) : (
                    <li key={`task-${entry.id}`} className={styles.dashboardEventItem}>
                      <button
                        type="button"
                        className={styles.planCheckboxButton}
                        data-completed={entry.completed ? "true" : "false"}
                        role="checkbox"
                        aria-checked={entry.completed}
                        disabled={!onTogglePlan}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          if (!onTogglePlan) {
                            return;
                          }
                          onTogglePlan(entry.id);
                        }}
                        aria-label={
                          entry.completed
                            ? t("Mark task {title} as incomplete", { title: entry.title })
                            : t("Mark task {title} as complete", { title: entry.title })
                        }
                      >
                        {entry.completed ? <Check size={14} /> : <Square size={14} />}
                      </button>
                      <div className={styles.dashboardEventInfo}>
                        <div
                          className={styles.dashboardTaskLabel}
                          data-completed={entry.completed ? "true" : "false"}
                        >
                          {entry.title}
                        </div>
                        <div className={styles.dashboardEventTime}>{entry.meta}</div>
                      </div>
                    </li>
                  )
                )}
              </ul>
            ) : (
              <div className={styles.dashboardListEmpty}>
                {isViewingToday
                  ? t("No events or tasks for today")
                  : t("No events or tasks for selected day")}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PROACTIVITY CARD SECOND */}
      <div className={`${styles.dashboardCard} ${styles.dashboardCardProactivity}`}>
        <div className={styles.dashboardCardHeader}>
          <h2 className={styles.dashboardCardTitle}>{t("Proactivity")}</h2>
          {canConfigureProactivity && (
            <button
              type="button"
              className={styles.dashboardCardAction}
              onClick={onConfigureProactivity}
              aria-label={t("Configure proactivity")}
            >
              <Settings size={18} />
            </button>
          )}
        </div>
        <div className={styles.dashboardCardBody}>
          {shouldShowNotificationBanner ? (
            <div className={styles.proactivityNotificationBanner}>
              <p>{notificationBannerLabel}</p>
              {notificationPermission !== "denied" ? (
                <button
                  type="button"
                  onClick={handleNotificationEnable}
                  className={styles.proactivityNotificationButton}
                >
                  {t("Enable alerts")}
                </button>
              ) : null}
            </div>
          ) : null}
          {scheduleEntries.length > 0 ? (
            <ul className={styles.proactivityChecklist}>
              {scheduleEntries.map(({ label, delivered }, index) => (
                <li key={`${label}-${index}`} className={styles.proactivityChecklistItem}>
                  <span className={styles.proactivityChecklistIcon} aria-hidden="true">
                    {delivered ? <Check size={14} /> : <Square size={14} />}
                  </span>
                  <span className={styles.proactivityChecklistLabel}>{label}</span>
                  <span className={styles.srOnly}>
                    {delivered ? t("Delivered") : t("Pending")}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className={styles.proactivityEmptyState}>
              <span>{t("No check-ins scheduled")}</span>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
