import type { ContextUsageSummary } from "@/components/gray/types";

export type SettingsSection =
  | "account"
  | "preferences"
  | "personalization"
  | "models"
  | "memory"
  | "data_controls"
  | "notifications";

export type ThemeMode = "dark" | "light" | "system";

export type SettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  initialSection?: SettingsSection;
  contextUsage?: ContextUsageSummary | null;
};

export type NotificationPreferences = {
  device: boolean;
  tasks: boolean;
  proactivity: boolean;
  calendarEvents: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  device: false,
  tasks: true,
  proactivity: true,
  calendarEvents: true,
};
