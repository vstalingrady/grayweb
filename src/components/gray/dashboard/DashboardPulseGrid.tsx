"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
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
import { MiniMonth } from "@/components/calendar/MiniMonth";
import type { ProactivityItem } from "@/components/gray/types";
import type { CalendarEvent } from "@/components/calendar/types";

type ProactivityScheduleEntry = {
  label: string;
  delivered: boolean;
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

const DAY_MS = 24 * 60 * 60 * 1000;

const formatTimeLabel = (value: Date): string =>
  value.toLocaleTimeString(undefined, TIME_LABEL_OPTIONS);

const formatDateTimeLabel = (value: Date): string =>
  value.toLocaleString(undefined, DATE_TIME_LABEL_OPTIONS);

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

type DashboardPulseGridProps = {
  currentDate: Date;
  selectedDate: Date;
  viewerName: string | null;
  proactivity: ProactivityItem | null;
  events: CalendarEvent[];
  proactivityDeliveryKeys?: ReadonlySet<string>;
  canConfigureProactivity: boolean;
  onConfigureProactivity: () => void;
  onAddEvent?: (date: Date) => void;
  onSelectDate?: (date: Date) => void;
  isCompactLayout?: boolean;
};

export function DashboardPulseGrid({
  currentDate,
  selectedDate,
  viewerName: _viewerName,
  proactivity,
  events,
  proactivityDeliveryKeys,
  canConfigureProactivity,
  onConfigureProactivity,
  onAddEvent,
  onSelectDate,
  isCompactLayout = false,
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
  const [calendarReferenceDate, setCalendarReferenceDate] = useState(() => {
    const initial = new Date(selectedDay);
    initial.setDate(1);
    initial.setHours(0, 0, 0, 0);
    return initial;
  });

  useEffect(() => {
    const nextReference = new Date(selectedDay);
    nextReference.setDate(1);
    nextReference.setHours(0, 0, 0, 0);

    setCalendarReferenceDate((previous) => {
      if (
        previous.getFullYear() === nextReference.getFullYear() &&
        previous.getMonth() === nextReference.getMonth()
      ) {
        return previous;
      }
      return nextReference;
    });
  }, [selectedDay]);

  const shiftCalendarMonth = useCallback((delta: number) => {
    setCalendarReferenceDate((previous) => {
      const next = new Date(previous);
      next.setMonth(previous.getMonth() + delta, 1);
      next.setHours(0, 0, 0, 0);
      return next;
    });
  }, []);

  const calendarMonthLabel = useMemo(
    () =>
      calendarReferenceDate.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      }),
    [calendarReferenceDate]
  );

  const handleMiniMonthSelect = useCallback(
    (nextDate: Date) => {
      const normalized = new Date(nextDate);
      normalized.setHours(0, 0, 0, 0);

      setCalendarReferenceDate((previous) => {
        if (
          previous.getFullYear() === normalized.getFullYear() &&
          previous.getMonth() === normalized.getMonth()
        ) {
          return previous;
        }
        const nextReference = new Date(normalized);
        nextReference.setDate(1);
        return nextReference;
      });

      onSelectDate?.(normalized);
    },
    [onSelectDate]
  );

  const eventsForDay = useMemo(() => {
    return events
      .filter((event) => doesEventIntersectDay(event, selectedDay))
      .filter(
        (event) => event.entryType !== "plan" && !event.id.startsWith(PLAN_EVENT_ID_PREFIX)
      )
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [events, selectedDay]);

  const eventEntries = useMemo(
    () =>
      eventsForDay.map((event) => ({
        id: event.id,
        title: event.title,
        color: event.color,
        meta: getEventMetaLabel(event, t),
        details: event.description?.trim() || null,
      })),
    [eventsForDay, t]
  );

  const selectedDayLabel = useMemo(
    () =>
      selectedDay.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
    [selectedDay]
  );

  if (isCompactLayout) {
    return (
      <div className={styles.compactPulseStack}>
        <section className={`${styles.compactPulseSection} ${styles.compactCalendarSection}`}>
          <div className={styles.compactSectionHeader}>
            <div className={styles.compactHeaderCopy}>
              <h2 className={styles.compactSectionTitle}>{t("Calendar")}</h2>
              <span className={styles.compactSectionMeta}>{selectedDayLabel}</span>
            </div>
            <div className={styles.miniCalendarHeaderControls}>
              <button
                type="button"
                className={styles.miniCalendarNavButton}
                aria-label={t("Previous")}
                title={t("Go to previous month")}
                onClick={() => shiftCalendarMonth(-1)}
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                className={styles.miniCalendarNavButton}
                aria-label={t("Next")}
                title={t("Go to next month")}
                onClick={() => shiftCalendarMonth(1)}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
          <div className={`${styles.compactSectionBody} ${styles.compactCalendarBody}`}>
            <div className={styles.compactMonthLabel}>{calendarMonthLabel}</div>
            <div className={styles.compactMiniMonthShell}>
              <div className={styles.miniCalendarCompact}>
                <MiniMonth
                  referenceDate={calendarReferenceDate}
                  selectedDate={selectedDay}
                  onSelectDate={handleMiniMonthSelect}
                />
              </div>
            </div>
          </div>
        </section>

        <section className={`${styles.compactPulseSection} ${styles.compactEventsSection}`}>
          <div className={styles.compactSectionHeader}>
            <h2 className={styles.compactSectionTitle}>{t("Events")}</h2>
            {onAddEvent ? (
              <button
                type="button"
                className={styles.dashboardCardAction}
                onClick={() => onAddEvent(selectedDay)}
                aria-label={t("Add event")}
              >
                <Plus size={18} />
              </button>
            ) : null}
          </div>
          <div className={styles.compactSectionBody}>
            {eventEntries.length > 0 ? (
              <ul className={`${styles.dashboardEventList} ${styles.compactEventList}`}>
                {eventEntries.map((entry) => (
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
                ))}
              </ul>
            ) : (
              <div className={styles.dashboardListEmpty}>
                {isViewingToday
                  ? t("No events for today")
                  : t("No events for selected day")}
              </div>
            )}
          </div>
        </section>

        <section className={`${styles.compactPulseSection} ${styles.compactProactivitySection}`}>
          <div className={styles.compactSectionHeader}>
            <h2 className={styles.compactSectionTitle}>{t("Proactivity")}</h2>
            {canConfigureProactivity ? (
              <button
                type="button"
                className={styles.dashboardCardAction}
                onClick={onConfigureProactivity}
                aria-label={t("Configure proactivity")}
              >
                <Settings size={18} />
              </button>
            ) : null}
          </div>
          <div className={styles.compactSectionBody}>
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
              <ul className={`${styles.proactivityChecklist} ${styles.compactProactivityChecklist}`}>
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
        </section>
      </div>
    );
  }

  const rootClassName = styles.dashboardGridFinal;
  const calendarSectionClassName = `${styles.dashboardCard} ${styles.dashboardCardCalendar}`;
  const eventsSectionClassName = `${styles.dashboardCard} ${styles.dashboardCardEvents}`;
  const proactivitySectionClassName = `${styles.dashboardCard} ${styles.dashboardCardProactivity}`;
  const bodyClassName = styles.dashboardCardBody;
  const miniCalendarBodyClassName = `${bodyClassName} ${styles.miniCalendarBody}`;
  const eventListClassName = styles.dashboardEventList;
  const checklistClassName = styles.proactivityChecklist;

  return (
    <div className={rootClassName}>
      <div className={calendarSectionClassName}>
        <div className={styles.dashboardCardHeader}>
          <span className={styles.miniCalendarHeader}>
            <span className={styles.miniCalendarMonthLabel}>{calendarMonthLabel}</span>
            <span className={styles.miniCalendarHeaderControls}>
              <button
                type="button"
                className={styles.miniCalendarNavButton}
                aria-label={t("Previous")}
                title={t("Go to previous month")}
                onClick={() => shiftCalendarMonth(-1)}
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                className={styles.miniCalendarNavButton}
                aria-label={t("Next")}
                title={t("Go to next month")}
                onClick={() => shiftCalendarMonth(1)}
              >
                <ChevronRight size={14} />
              </button>
            </span>
          </span>
        </div>
        <div className={miniCalendarBodyClassName}>
          <div className={styles.miniCalendarCompact}>
            <MiniMonth
              referenceDate={calendarReferenceDate}
              selectedDate={selectedDay}
              onSelectDate={handleMiniMonthSelect}
            />
          </div>
        </div>
      </div>

      <div className={eventsSectionClassName}>
        <div className={styles.dashboardCardHeader}>
          <h2 className={styles.dashboardCardTitle}>{t("Events")}</h2>
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
        <div className={bodyClassName}>
          <div className={styles.dashboardSection}>
            {eventEntries.length > 0 ? (
              <ul className={eventListClassName}>
                {eventEntries.map((entry) => (
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
                ))}
              </ul>
            ) : (
              <div className={styles.dashboardListEmpty}>
                {isViewingToday
                  ? t("No events for today")
                  : t("No events for selected day")}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={proactivitySectionClassName}>
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
        <div className={bodyClassName}>
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
            <ul className={checklistClassName}>
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
