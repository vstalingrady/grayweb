"use client";

import styles from "../SettingsStyles.module.css";
import type { NotificationPreferences } from "@/components/gray/settings/types";
import { SettingsToggle } from "@/components/gray/settings/components/SettingsToggle";

type Translator = (message: string, vars?: Record<string, string | number>) => string;

export type NotificationsSectionProps = {
  t: Translator;
  notificationPermission: NotificationPermission | "unsupported";
  notificationPreferences: NotificationPreferences;
  onToggleDeviceNotifications: () => void | Promise<void>;
  setNotificationPreference: <Key extends keyof NotificationPreferences>(key: Key, value: boolean) => void;
};

export function NotificationsSection({
  t,
  notificationPermission,
  notificationPreferences,
  onToggleDeviceNotifications,
  setNotificationPreference,
}: NotificationsSectionProps) {
  return (
    <>
      <div className={styles.settingsPageHeader}>
        <h2 className={styles.settingsPageTitle}>{t("Notifications")}</h2>
      </div>

      <div className={styles.settingsSection}>
        <h3 className={styles.settingsSectionTitle}>{t("Device notifications")}</h3>

        <div className={styles.settingsRow}>
          <div className={styles.settingsLabelGroup}>
            <span className={styles.settingsLabel}>{t("Desktop & mobile")}</span>
            <span className={styles.settingsItemDescription}>
              {notificationPermission === "unsupported"
                ? t("Notifications are not supported on this device.")
                : notificationPermission === "denied"
                  ? t("Notifications are blocked in your browser settings.")
                  : t("Show notifications on this device.")}
            </span>
          </div>
          <SettingsToggle
            checked={notificationPreferences.device && notificationPermission === "granted"}
            onChange={() => void onToggleDeviceNotifications()}
            label={t("Toggle device notifications")}
          />
        </div>
      </div>

      <div className={styles.settingsSection}>
        <h3 className={styles.settingsSectionTitle}>{t("What to notify")}</h3>

        <div className={styles.settingsRow}>
          <div className={styles.settingsLabelGroup}>
            <span className={styles.settingsLabel}>{t("Tasks")}</span>
            <span className={styles.settingsItemDescription}>{t("Reminders and updates about your tasks.")}</span>
          </div>
          <SettingsToggle
            checked={notificationPreferences.tasks}
            onChange={() => setNotificationPreference("tasks", !notificationPreferences.tasks)}
            label={t("Toggle task notifications")}
          />
        </div>

        <div className={styles.settingsRow}>
          <div className={styles.settingsLabelGroup}>
            <span className={styles.settingsLabel}>{t("Proactivity")}</span>
            <span className={styles.settingsItemDescription}>{t("Daily check-ins and proactive summaries.")}</span>
          </div>
          <SettingsToggle
            checked={notificationPreferences.proactivity}
            onChange={() => setNotificationPreference("proactivity", !notificationPreferences.proactivity)}
            label={t("Toggle proactivity notifications")}
          />
        </div>

        <div className={styles.settingsRow}>
          <div className={styles.settingsLabelGroup}>
            <span className={styles.settingsLabel}>{t("Calendar events")}</span>
            <span className={styles.settingsItemDescription}>{t("Upcoming event reminders and changes.")}</span>
          </div>
          <SettingsToggle
            checked={notificationPreferences.calendarEvents}
            onChange={() => setNotificationPreference("calendarEvents", !notificationPreferences.calendarEvents)}
            label={t("Toggle calendar event notifications")}
          />
        </div>
      </div>
    </>
  );
}
