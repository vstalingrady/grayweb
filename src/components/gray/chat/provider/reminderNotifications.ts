import type { Reminder } from "@/lib/api";
import {
  buildReminderNotificationBody,
  buildReminderNotificationTitle,
  buildReminderPingMessage,
} from "../utils";

export { buildReminderPingMessage };

const REMINDER_NOTIFICATION_ICON = "/grayaiwhite.svg";

type ExtendedNotificationOptions = NotificationOptions & {
  requireInteraction?: boolean;
  badge?: string;
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
    const options: ExtendedNotificationOptions = {
      body: buildReminderNotificationBody(reminder),
      icon: REMINDER_NOTIFICATION_ICON,
      badge: REMINDER_NOTIFICATION_ICON,
      tag: `gray-reminder-${reminder.id}`,
      requireInteraction: true,
    };
    const notification = new Notification(buildReminderNotificationTitle(reminder), options);
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
