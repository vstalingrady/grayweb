export type NotificationPreferences = {
  device: boolean;
  tasks: boolean;
  proactivity: boolean;
  calendarEvents: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  device: true,  // Default to true so push registration happens when browser permission is granted
  tasks: true,
  proactivity: true,
  calendarEvents: true,
};

const NOTIFICATIONS_STORAGE_PREFIX = "gray_notifications";

export const buildNotificationPreferencesStorageKey = (userId: number | string | null | undefined) =>
  `${NOTIFICATIONS_STORAGE_PREFIX}:${userId ?? "anon"}`;

const coerceBoolean = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;

export const parseNotificationPreferences = (value: unknown): NotificationPreferences => {
  if (!value || typeof value !== "object") {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
  const record = value as Record<string, unknown>;
  return {
    device: coerceBoolean(record.device, DEFAULT_NOTIFICATION_PREFERENCES.device),
    tasks: coerceBoolean(record.tasks, DEFAULT_NOTIFICATION_PREFERENCES.tasks),
    proactivity: coerceBoolean(record.proactivity, DEFAULT_NOTIFICATION_PREFERENCES.proactivity),
    calendarEvents: coerceBoolean(
      record.calendarEvents,
      DEFAULT_NOTIFICATION_PREFERENCES.calendarEvents
    ),
  };
};

export const loadNotificationPreferences = (storageKey: string): NotificationPreferences => {
  if (typeof window === "undefined") {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return DEFAULT_NOTIFICATION_PREFERENCES;
    }
    return parseNotificationPreferences(JSON.parse(raw));
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
};

export const saveNotificationPreferences = (storageKey: string, preferences: NotificationPreferences) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(preferences));
  } catch {
    // ignore storage failures
  }
};

export const clearNotificationPreferences = (storageKey: string) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // ignore storage failures
  }
};

