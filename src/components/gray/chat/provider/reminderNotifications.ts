import { formatReminderDateLabel } from "../../reminderTimeUtils";
import type { Reminder } from "@/lib/api";

const normalizeReminderLabel = (label?: string | null) => {
  if (!label) {
    return "that thing we planned";
  }
  const trimmed = label.trim();
  return trimmed.length > 0 ? trimmed : "that thing we planned";
};

const formatReminderScheduleLabel = (iso?: string | null) => {
  return formatReminderDateLabel(iso) ?? iso ?? "sometime soon";
};

export const buildReminderPingMessage = (reminder: Reminder): string => {
  const label = normalizeReminderLabel(reminder.label);
  const note = reminder.summary ?? reminder.description ?? null;

  // Use a cleaner, less "bot-like" format for delivered reminders
  const parts = [`🔔 ${label}`];
  if (note) {
    parts.push(note);
  }
  return parts.join("\n\n");
};

const REMINDER_NOTIFICATION_ICON = "/grayaiwhite.svg";

const buildReminderNotificationTitle = (reminder: Reminder) => `Reminder: ${normalizeReminderLabel(reminder.label)}`;

const buildReminderNotificationBody = (reminder: Reminder) => {
  const scheduleLabel = formatReminderScheduleLabel(reminder.remind_at);
  const note = reminder.summary ?? reminder.description ?? null;
  const segments: string[] = [];
  if (scheduleLabel) {
    segments.push(`Scheduled for ${scheduleLabel}`);
  }
  if (note) {
    segments.push(note);
  }
  return segments.length > 0 ? segments.join(" • ") : "Tap to view details.";
};

export const sendReminderNotification = (reminder: Reminder) => {
  if (
    typeof window === "undefined" ||
    typeof Notification === "undefined" ||
    (typeof window !== "undefined" && !window.isSecureContext)
  ) {
    return;
  }
  if (!reminder.id) {
    return;
  }
  if (Notification.permission !== "granted") {
    return;
  }
  try {
    const notification = new Notification(buildReminderNotificationTitle(reminder), {
      body: buildReminderNotificationBody(reminder),
      icon: REMINDER_NOTIFICATION_ICON,
      badge: REMINDER_NOTIFICATION_ICON,
      tag: `gray-reminder-${reminder.id}`,
      requireInteraction: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    notification.addEventListener("click", () => {
      if (typeof window !== "undefined" && window.focus) {
        window.focus();
      }
      notification.close();
    });
  } catch (error) {
    console.error("Failed to show reminder notification:", error);
  }
};

