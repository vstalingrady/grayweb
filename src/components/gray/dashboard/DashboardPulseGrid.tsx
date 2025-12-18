"use client";

import { useCallback, useMemo, useState } from "react";
import { Check, Square } from "lucide-react";
import styles from "@/app/gray/GrayPageClient.module.css";
import { useI18n } from "@/contexts/I18nContext";
import { useNotificationPreferences } from "@/contexts/NotificationPreferencesContext";
import { requestNotificationPermission } from "@/lib/notificationUtils";
import { greetingForDate } from "@/components/gray/utils/helperFunctions";
import { PlanHabitInlineEditor } from "@/components/gray/PlanHabitInlineEditor";
import type { HabitItem, PlanItem, ProactivityItem } from "@/components/gray/types";
import { formatCustomTimeLabel, getProactivityTimes } from "@/components/gray/proactivityUtils";

type ProactivityScheduleEntry = { label: string; delivered: boolean };

type DashboardPulseGridProps = {
  currentDate: Date;
  viewerName?: string | null;
  isEditable: boolean;
  plans: PlanItem[];
  habits: HabitItem[];
  proactivity: ProactivityItem | null;
  proactivityDeliveryKeys?: ReadonlySet<string>;
  onTogglePlan: (id: string) => void;
  onToggleHabit?: (id: string) => void;
  canConfigureProactivity: boolean;
  onConfigureProactivity: () => void;
  onRefreshData: () => Promise<void>;
};

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function DashboardPulseGrid({
  currentDate,
  viewerName,
  isEditable,
  plans,
  habits,
  proactivity,
  proactivityDeliveryKeys,
  onTogglePlan,
  onToggleHabit,
  canConfigureProactivity,
  onConfigureProactivity,
  onRefreshData,
}: DashboardPulseGridProps) {
  const { t } = useI18n();
  const { notificationPreferences, setNotificationPreference } = useNotificationPreferences();
  const [inlineEditorType, setInlineEditorType] = useState<"plan" | "habit" | null>(null);

  const viewerFirstName = useMemo(() => {
    const trimmed = viewerName?.trim();
    if (!trimmed) return "there";
    return trimmed.split(/\s+/)[0] || "there";
  }, [viewerName]);

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
    (!notificationPreferences.device || notificationPermission !== "granted");

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

  const handleModalSuccess = useCallback(async () => {
    await onRefreshData();
  }, [onRefreshData]);

  const openInlineEditor = useCallback(
    (type: "plan" | "habit") => {
      if (!isEditable) return;
      setInlineEditorType(type);
    },
    [isEditable]
  );

  const closeInlineEditor = useCallback(() => {
    setInlineEditorType(null);
  }, []);

  const handlePlanToggle = useCallback(
    (planId: string) => {
      if (!isEditable) return;
      onTogglePlan(planId);
    },
    [isEditable, onTogglePlan]
  );

  const handleHabitToggle = useCallback(
    (habitId: string) => {
      if (!isEditable || !onToggleHabit) return;
      onToggleHabit(habitId);
    },
    [isEditable, onToggleHabit]
  );

  return (
    <div className={styles.dashboardGridFinal}>
      <div className={styles.dashboardHeaderArea}>
        <h1 className={styles.dashboardGreeting}>
          {greetingForDate(currentDate)}, {viewerFirstName}
        </h1>
        <div className={styles.dashboardDate}>
          {currentDate.toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </div>
      </div>

      <div className={`${styles.dashboardCard} ${styles.dashboardCardProactivity}`}>
        <div className={styles.dashboardCardHeader}>
          <h2 className={styles.dashboardCardTitle}>{t("Proactivity")}</h2>
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
          <button
            type="button"
            className={styles.dashboardButtonNeutral}
            onClick={onConfigureProactivity}
            disabled={!canConfigureProactivity}
          >
            {t("Configure")}
          </button>
        </div>
      </div>

      <div className={`${styles.dashboardCard} ${styles.dashboardCardPlans}`}>
        <div className={styles.dashboardCardHeader}>
          <div className={`${styles.dashboardCardIcon} ${styles.iconBlue}`}>
            <Square size={16} />
          </div>
          <h2 className={styles.dashboardCardTitle}>{t("Plans")}</h2>
        </div>
        <div className={styles.dashboardCardBody}>
          {plans.length > 0 ? (
            <ul className={styles.dashboardList}>
              {plans.map((plan) => (
                <li key={plan.id} className={styles.dashboardListItem}>
                  <button
                    type="button"
                    className={styles.planCheckboxButton}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      handlePlanToggle(plan.id);
                    }}
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
          <button type="button" className={styles.dashboardButtonNeutral} onClick={() => openInlineEditor("plan")}>
            {t("Add plans")}
          </button>
          {inlineEditorType === "plan" ? (
            <PlanHabitInlineEditor
              type="plan"
              onCancel={closeInlineEditor}
              onSuccess={handleModalSuccess}
              onTypeChange={openInlineEditor}
            />
          ) : null}
        </div>
      </div>

      <div className={`${styles.dashboardCard} ${styles.dashboardCardHabits}`}>
        <div className={styles.dashboardCardHeader}>
          <div className={`${styles.dashboardCardIcon} ${styles.iconCyan}`}>
            <Check size={16} />
          </div>
          <h2 className={styles.dashboardCardTitle}>{t("Habits")}</h2>
        </div>
        <div className={styles.dashboardCardBody}>
          {habits.length > 0 ? (
            <ul className={styles.dashboardList}>
              {habits.map((habit) => (
                <li key={habit.id} className={styles.dashboardListItem}>
                  <button
                    type="button"
                    className={styles.planCheckboxButton}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleHabitToggle(habit.id);
                    }}
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
          <button type="button" className={styles.dashboardButtonNeutral} onClick={() => openInlineEditor("habit")}>
            {t("Add habits")}
          </button>
          {inlineEditorType === "habit" ? (
            <PlanHabitInlineEditor
              type="habit"
              onCancel={closeInlineEditor}
              onSuccess={handleModalSuccess}
              onTypeChange={openInlineEditor}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

