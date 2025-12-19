import { useEffect, useRef } from "react";
import { workspaceService, isApiNetworkError, type Reminder } from "@/lib/api";
import { REMINDER_POLL_MIN_INTERVAL, REMINDER_POLL_SHORT_INTERVAL } from "../constants";
import type { ChatContextValue } from "../types";
import { buildReminderPingMessage, sendReminderNotification } from "./reminderNotifications";
import { useNotificationPreferences } from "@/contexts/NotificationPreferencesContext";

type UseReminderPollingOptions = {
  userId: number | undefined;
  generalSessionId: string | null;
  appendMessage: ChatContextValue["appendMessage"];
};

const isServerErrorStatus = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }
  if (!("status" in error)) {
    return false;
  }
  const { status } = error as Error & { status?: unknown };
  return typeof status === "number" && status >= 500;
};

export const useReminderPolling = ({
  userId,
  generalSessionId,
  appendMessage,
}: UseReminderPollingOptions) => {
  const reminderDeliveryCacheRef = useRef<Set<number>>(new Set());
  const { notificationPreferences } = useNotificationPreferences();

  useEffect(() => {
    if (!userId || !generalSessionId) {
      reminderDeliveryCacheRef.current.clear();
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const computeNextReminderPollDelay = (candidates: Reminder[]): number => {
      if (!candidates.length) {
        return REMINDER_POLL_MIN_INTERVAL;
      }
      const now = Date.now();
      const delays = candidates
        .map((reminder) => {
          const remindAt = new Date(reminder.remind_at).getTime();
          if (!Number.isFinite(remindAt)) {
            return null;
          }
          return remindAt - now;
        })
        .filter((candidate): candidate is number => candidate !== null);
      if (!delays.length) {
        return REMINDER_POLL_MIN_INTERVAL;
      }
      const soonest = Math.min(...delays);
      if (soonest <= 0) {
        return REMINDER_POLL_SHORT_INTERVAL;
      }
      return Math.min(soonest, REMINDER_POLL_MIN_INTERVAL);
    };

    const pollDueReminders = async () => {
      if (cancelled || !userId || !generalSessionId) {
        return;
      }
      let fetchedReminders: Reminder[] = [];
      try {
        const reminders = await workspaceService.getUserReminders(userId, { status: "pending", limit: 50 });
        fetchedReminders = reminders;
        const now = Date.now();
        for (const reminder of reminders) {
          if (!reminder.id) {
            continue;
          }
          const remindAt = new Date(reminder.remind_at).getTime();
          if (!Number.isFinite(remindAt) || remindAt > now) {
            continue;
          }
          if (reminderDeliveryCacheRef.current.has(reminder.id)) {
            continue;
          }
          reminderDeliveryCacheRef.current.add(reminder.id);

          // Client-side stale check: If > 15 mins late, mark delivered but don't nag.
          // This protects against backend returning old pending items.
          const isStale = (now - remindAt) > (15 * 60 * 1000);

          if (!isStale) {
            appendMessage(generalSessionId, "assistant", buildReminderPingMessage(reminder));
            const deliveryMode = (reminder.delivery_mode || reminder.entity_type || "").toLowerCase();
            const isCalendarReminder = deliveryMode === "event";
            const isTaskReminder = !isCalendarReminder;
            if (
              notificationPreferences.device &&
              ((isCalendarReminder && notificationPreferences.calendarEvents) ||
                (isTaskReminder && notificationPreferences.tasks))
            ) {
              sendReminderNotification(reminder);
            }
          }

          try {
            await workspaceService.updateReminder(userId, reminder.id, { status: "delivered" });
          } catch (updateError) {
            console.error("Failed to update reminder status:", updateError);
          }
        }
      } catch (error) {
        // Soft-handle network/unavailable backend errors to avoid noisy logs
        const isNetworkish = isApiNetworkError(error) || isServerErrorStatus(error);
        if (isNetworkish) {
          if (process.env.NODE_ENV !== "production") {
            console.debug("Skipping reminder poll; backend unavailable.", error);
          }
        } else {
          console.error("Failed to poll reminders:", error);
        }
      } finally {
        if (!cancelled) {
          const nextDelay = computeNextReminderPollDelay(fetchedReminders);
          timeoutId = setTimeout(pollDueReminders, nextDelay);
        }
      }
    };

    void pollDueReminders();
    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [appendMessage, generalSessionId, notificationPreferences, userId]);
};
