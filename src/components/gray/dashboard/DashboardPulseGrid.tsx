"use client";

import { useCallback, useMemo, useState } from "react";
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
import { requestNotificationPermission } from "@/lib/notificationUtils";
import type { HabitItem, PlanItem, ProactivityItem } from "@/components/gray/types";
import type { CalendarEvent } from "@/components/calendar/types";

type ProactivityScheduleEntry = {
  label: string;
  delivered: boolean;
};

type DashboardPulseGridProps = {
  currentDate: Date;
  selectedDate: Date;
  viewerName: string | null;
  proactivity: ProactivityItem | null;
  events: CalendarEvent[];
  plans?: PlanItem[];
  habits?: HabitItem[];
  proactivityDeliveryKeys?: ReadonlySet<string>;
  canConfigureProactivity: boolean;
  onConfigureProactivity: () => void;
  onAddEvent?: (date: Date) => void;
  onTogglePlan?: (id: string) => void;
  onToggleHabit?: (id: string) => void;
};

const toDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export function DashboardPulseGrid({
  currentDate,
  selectedDate,
  viewerName: _viewerName,
  proactivity,
  events,
  plans = [],
  habits = [],
  proactivityDeliveryKeys,
  canConfigureProactivity,
  onConfigureProactivity,
  onAddEvent,
  onTogglePlan,
  onToggleHabit,
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

    const todayKey = toDateKey(currentDate);
    return times.map((time) => ({
      label: formatCustomTimeLabel(time),
      delivered: proactivityDeliveryKeys?.has(`${todayKey}T${time}`) ?? false,
    }));
  }, [currentDate, proactivity, proactivityDeliveryKeys]);

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

  const shouldShowNotificationBanner =
    shouldPromptForProactivityAlerts &&
    notificationPermission !== "unsupported" &&
    notificationPreferences.device &&
    notificationPermission !== "granted";

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

  const eventsForDay = useMemo(() => {
    const target = selectedDate ?? currentDate;
    const targetKey = toDateKey(target);
    return events
      .filter((event) => toDateKey(event.start) === targetKey)
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [currentDate, events, selectedDate]);

  const visiblePlans = useMemo(() => plans.filter((plan) => plan), [plans]);
  const visibleHabits = useMemo(() => habits.filter((habit) => habit), [habits]);

  return (
    <div className={styles.dashboardGridFinal}>
      {/* EVENTS + PLANS + HABITS */}
      <div className={`${styles.dashboardCard} ${styles.dashboardCardEvents}`}>
        <div className={styles.dashboardCardHeader}>
          <h2 className={styles.dashboardCardTitle}>{t("Events")}</h2>
          {onAddEvent && (
            <button
              type="button"
              className={styles.dashboardCardAction}
              onClick={() => onAddEvent(selectedDate ?? currentDate)}
              aria-label={t("Add event")}
            >
              <Plus size={18} />
            </button>
          )}
        </div>
        <div className={styles.dashboardCardBody}>
          <div className={styles.dashboardSection}>
            <div className={styles.dashboardEventList}>
              {eventsForDay.length > 0 ? (
                eventsForDay.map((event) => (
                  <div key={event.id} className={styles.dashboardEventItem}>
                    <div
                      className={styles.dashboardEventMarker}
                      style={{ backgroundColor: event.color }}
                    />
                    <div className={styles.dashboardEventInfo}>
                      <div className={styles.dashboardEventTitle}>{event.title}</div>
                      <div className={styles.dashboardEventTime}>
                        {event.start.toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                      {event.description?.trim() ? (
                        <div className={styles.dashboardEventDetails}>
                          {event.description.trim()}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <div className={styles.dashboardListEmpty}>{t("No events for today")}</div>
              )}
            </div>
          </div>

          <div className={styles.dashboardSection}>
            <div className={styles.dashboardSectionHeader}>
              <h3 className={styles.dashboardSectionTitle}>{t("Plans")}</h3>
            </div>
            {visiblePlans.length > 0 ? (
              <ul className={styles.dashboardList}>
                {visiblePlans.map((plan) => (
                  <li key={plan.id} className={styles.dashboardListItem}>
                    <button
                      type="button"
                      className={styles.planCheckboxButton}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onTogglePlan?.(plan.id);
                      }}
                      aria-label={
                        plan.completed ? t("Mark plan as incomplete") : t("Mark plan as complete")
                      }
                    >
                      {plan.completed ? <Check size={14} /> : <Square size={14} color="#52525b" />}
                    </button>
                    <span
                      className={styles.dashboardTaskLabel}
                      data-completed={plan.completed ? "true" : "false"}
                    >
                      {plan.label}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className={styles.dashboardListEmpty}>{t("No active plans")}</div>
            )}
          </div>

          <div className={styles.dashboardSection}>
            <div className={styles.dashboardSectionHeader}>
              <h3 className={styles.dashboardSectionTitle}>{t("Habits")}</h3>
            </div>
            {visibleHabits.length > 0 ? (
              <ul className={styles.dashboardList}>
                {visibleHabits.map((habit) => (
                  <li key={habit.id} className={styles.dashboardListItem}>
                    <button
                      type="button"
                      className={styles.planCheckboxButton}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onToggleHabit?.(habit.id);
                      }}
                      aria-label={
                        habit.completed ? t("Mark habit as incomplete") : t("Mark habit as complete")
                      }
                    >
                      {habit.completed ? <Check size={14} /> : <Square size={14} color="#52525b" />}
                    </button>
                    <span
                      className={styles.dashboardTaskLabel}
                      data-completed={habit.completed ? "true" : "false"}
                    >
                      {habit.label}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className={styles.dashboardListEmpty}>{t("No active habits")}</div>
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
