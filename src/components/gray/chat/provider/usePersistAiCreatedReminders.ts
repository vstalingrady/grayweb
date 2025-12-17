import { useEffect, useRef } from "react";
import { apiService, type ReminderCreatePayload } from "@/lib/api";
import { WORKSPACE_REFRESH_EVENT } from "../../hooks/useWorkspaceData";
import { buildReminderKey } from "../reminderUtils";
import type { ChatSession } from "../types";

type UsePersistAiCreatedRemindersOptions = {
  sessions: ChatSession[];
  userId: number | undefined;
};

const resolveRawDescription = (raw: unknown): string | null => {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const description = record["description"];
  return typeof description === "string" ? description : null;
};

const getCandidateMessages = (
  previous: ChatSession["messages"] | undefined,
  next: ChatSession["messages"]
): ChatSession["messages"] => {
  if (!previous) {
    return next;
  }
  if (previous === next) {
    return [];
  }
  const previousLength = previous.length;
  const nextLength = next.length;

  if (nextLength < previousLength) {
    return next;
  }
  if (previousLength === 0) {
    return next;
  }

  if (nextLength > previousLength) {
    const likelyAppended = previous[previousLength - 1] === next[previousLength - 1];
    return likelyAppended ? next.slice(previousLength) : next;
  }

  if (previous[previousLength - 1] !== next[nextLength - 1]) {
    return [next[nextLength - 1]];
  }

  for (let index = nextLength - 2; index >= 0; index -= 1) {
    if (previous[index] !== next[index]) {
      return next.slice(index);
    }
  }

  return [];
};

export const usePersistAiCreatedReminders = ({
  sessions,
  userId,
}: UsePersistAiCreatedRemindersOptions) => {
  const persistedReminderKeysRef = useRef<Set<string>>(new Set());
  const previousSessionsByIdRef = useRef<Map<string, ChatSession>>(new Map());
  const trackedMessagesByIdRef = useRef<
    Map<string, { sessionId: string; message: ChatSession["messages"][number] }>
  >(new Map());
  const retryMessageIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) {
      return;
    }

    const previousSessionsById = previousSessionsByIdRef.current;
    const nextSessionsById = new Map<string, ChatSession>();
    const messagesToProcess: Array<{ sessionId: string; message: ChatSession["messages"][number] }> =
      [];

    for (const session of sessions) {
      nextSessionsById.set(session.id, session);
      const previousSession = previousSessionsById.get(session.id);

      if (previousSession === session) {
        continue;
      }

      const candidateMessages = getCandidateMessages(previousSession?.messages, session.messages);
      for (const message of candidateMessages) {
        trackedMessagesByIdRef.current.set(message.id, { sessionId: session.id, message });
        if (message.role === "assistant" && message.reminders && message.reminders.length > 0) {
          messagesToProcess.push({ sessionId: session.id, message });
        }
      }
    }

    for (const messageId of retryMessageIdsRef.current) {
      const tracked = trackedMessagesByIdRef.current.get(messageId);
      if (!tracked) {
        retryMessageIdsRef.current.delete(messageId);
        continue;
      }
      const session = nextSessionsById.get(tracked.sessionId);
      if (!session) {
        trackedMessagesByIdRef.current.delete(messageId);
        retryMessageIdsRef.current.delete(messageId);
        continue;
      }
      const currentMessage = session.messages.find((message) => message.id === messageId);
      if (!currentMessage) {
        trackedMessagesByIdRef.current.delete(messageId);
        retryMessageIdsRef.current.delete(messageId);
        continue;
      }
      trackedMessagesByIdRef.current.set(messageId, { sessionId: session.id, message: currentMessage });
      if (currentMessage.role === "assistant" && currentMessage.reminders && currentMessage.reminders.length > 0) {
        messagesToProcess.push({ sessionId: session.id, message: currentMessage });
      } else {
        retryMessageIdsRef.current.delete(messageId);
      }
    }

    const processedMessageIds = new Set<string>();
    for (const { message } of messagesToProcess) {
      if (processedMessageIds.has(message.id)) {
        continue;
      }
      processedMessageIds.add(message.id);

      if (!message.reminders) {
        retryMessageIdsRef.current.delete(message.id);
        continue;
      }

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
        let color: string | undefined;
        if (reminderRecord && typeof reminderRecord["metadata"] === "object" && reminderRecord["metadata"]) {
          const metadata = reminderRecord["metadata"] as Record<string, unknown>;
          if (typeof metadata["color"] === "string" && metadata["color"]) {
            color = metadata["color"];
          }
        }

        const rawDescription = resolveRawDescription(reminder.data.raw);
        const metadata =
          reminderRecord?.metadata && typeof reminderRecord.metadata === "object"
            ? (reminderRecord.metadata as Record<string, unknown>)
            : null;

        const payload: ReminderCreatePayload = {
          label: data.label || "Reminder",
          remind_at: remindAtIso,
          description: data.summary ?? rawDescription ?? null,
          entity_type: reminder.entity,
          delivery_mode: reminder.delivery_mode ?? reminder.entity,
          summary: data.summary ?? null,
          metadata,
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
            retryMessageIdsRef.current.add(message.id);
          });
      }

      const hasPendingReminders = message.reminders.some(
        (reminder) => !persistedReminderKeysRef.current.has(buildReminderKey(reminder))
      );
      if (hasPendingReminders) {
        retryMessageIdsRef.current.add(message.id);
      } else {
        retryMessageIdsRef.current.delete(message.id);
      }
    }

    previousSessionsByIdRef.current = nextSessionsById;
  }, [sessions, userId]);
};
