import { useEffect, useRef } from "react";
import { apiService, type ReminderCreatePayload } from "@/lib/api";
import { WORKSPACE_REFRESH_EVENT } from "../../hooks/useWorkspaceData";
import { buildReminderKey } from "../reminderUtils";
import type { ChatSession } from "../types";

type UsePersistAiCreatedRemindersOptions = {
  sessions: ChatSession[];
  userId: number | undefined;
};

export const usePersistAiCreatedReminders = ({
  sessions,
  userId,
}: UsePersistAiCreatedRemindersOptions) => {
  const persistedReminderKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) {
      return;
    }

    const allMessages = sessions.flatMap((session) => session.messages);
    const messagesWithReminders = allMessages.filter(
      (message) => message.role === "assistant" && message.reminders && message.reminders.length > 0
    );

    for (const message of messagesWithReminders) {
      if (!message.reminders) continue;

      for (const reminder of message.reminders) {
        const reminderKey = buildReminderKey(reminder);

        // Skip if already persisted
        if (persistedReminderKeysRef.current.has(reminderKey)) {
          continue;
        }

        // Reminders created via backend tool calls are already persisted server-side.
        if (String(reminder.source || "").toLowerCase() === "native/backend") {
          persistedReminderKeysRef.current.add(reminderKey);
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent(WORKSPACE_REFRESH_EVENT));
          }
          continue;
        }

        // Extract reminder data
        const data = reminder.data;
        const reminderRecord = (data.reminder as Record<string, unknown> | null) ?? null;
        const remindAtIso =
          (reminderRecord && typeof reminderRecord.remind_at === "string" && reminderRecord.remind_at) ||
          (typeof data.time_iso === "string" ? data.time_iso : null);

        if (!remindAtIso) {
          console.warn("Skipping reminder without valid remind_at time:", reminder);
          continue;
        }

        // Check for color in metadata
        let color: string | undefined = undefined;
        if (reminderRecord && typeof reminderRecord["metadata"] === "object" && reminderRecord["metadata"]) {
          const metadata = reminderRecord["metadata"] as Record<string, unknown>;
          if (typeof metadata["color"] === "string" && metadata["color"]) {
            color = metadata["color"];
          }
        }

        const payload: ReminderCreatePayload = {
          label: data.label || "Reminder",
          remind_at: remindAtIso,
          description: data.summary ?? reminder.data.raw?.description as string | undefined ?? null,
          entity_type: reminder.entity,
          delivery_mode: reminder.delivery_mode ?? reminder.entity,
          summary: data.summary ?? null,
          metadata: reminderRecord?.metadata as Record<string, unknown> | undefined ?? null,
          color,
        };

        // Persist to Supabase
        persistedReminderKeysRef.current.add(reminderKey);
        apiService
          .createReminder(userId, payload)
          .then(() => {
            // Dispatch custom event so useWorkspaceData can refresh reminder list
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent(WORKSPACE_REFRESH_EVENT));
            }
          })
          .catch((error) => {
            console.error("Failed to persist AI-created reminder:", error);
            // Remove from persisted set so it can be retried
            persistedReminderKeysRef.current.delete(reminderKey);
          });
      }
    }
  }, [sessions, userId]);
};

