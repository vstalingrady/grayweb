import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Trash2, SendHorizontal, Pencil, Plus } from "lucide-react";
import styles from "@/app/gray/GrayPageClient.module.css";
import { apiService, type Reminder, type ReminderStatus } from "@/lib/api";
import { AddReminderModal } from "./AddReminderModal";

type ReminderPanelProps = {
  userId?: number | null;
  maxVisible?: number;
};

const STATUS_LABELS: Record<ReminderStatus, string> = {
  pending: "Scheduled",
  delivered: "Sent",
  completed: "Completed",
  cancelled: "Cancelled",
  failed: "Failed",
};

const formatReminderDate = (value?: string | null) => {
  if (!value) {
    return "No time set";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMinutes = Math.round(diffMs / 60000);
  const relative =
    diffMinutes > 0
      ? `in ${diffMinutes} min`
      : diffMinutes < 0
        ? `${Math.abs(diffMinutes)} min ago`
        : "now";
  return `${date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })} • ${relative}`;
};

/* eslint-disable react/no-unescaped-entities */
const CHAT_HANDLE = "Vstalin";

const pickFromList = <T,>(items: T[], seed: number): T => {
  const index = Math.abs(seed) % items.length;
  return items[index];
};

const friendlyOpeners = [
  "Hey {name}, gentle ping from mission control.",
  "Hi {name}, I've got a tiny spark for you.",
  "Yo {name}, calendar spirit checking in.",
  "Heads up {name} - future-you left a note.",
  "Sup {name}? Gray here with a quick vibe check.",
];

const friendlyPrompts = [
  "Let's not let {topic} drift into tomorrow.",
  "Could we land {topic} while momentum is high?",
  "If you give {topic} a few minutes, the rest of the day opens up.",
  "{topic} is hovering near the top of the stack again.",
  "Time to give {topic} a little spotlight?",
];

const friendlyFollowUps = [
  "Need me to circle back closer to {time}? Tap snooze and I'm on it.",
  "If the plan changes, tweak or delete this right here - no judgment.",
  "Want me to pair this with another habit? I can chain reminders together.",
  "Once {topic} is done, mark it complete and I'll log the win.",
  "You can hand off {mode} duties anytime; I'll keep watch.",
];

const normalizeLabel = (input?: string | null) => {
  if (!input) {
    return "that thing we planned";
  }
  const trimmed = input.trim();
  if (trimmed.length <= 64) {
    return trimmed;
  }
  return `${trimmed.slice(0, 61)}...`;
};

const getModeLabel = (input?: string | null) =>
  (input ?? "reminder").replace(/^[a-z]/, (char) => char.toUpperCase());

const buildFriendlyCopy = (reminder: Reminder) => {
  const topic = normalizeLabel(reminder.label);
  const seed = reminder.id ?? topic.length;
  const greeting = pickFromList(friendlyOpeners, seed).replace("{name}", CHAT_HANDLE);
  const prompt = pickFromList(friendlyPrompts, seed + 7).replace("{topic}", topic);
  const followUp = pickFromList(friendlyFollowUps, seed + 17)
    .replace("{topic}", topic)
    .replace("{mode}", (reminder.delivery_mode ?? reminder.entity_type ?? "reminder").toLowerCase())
    .replace("{time}", formatReminderDate(reminder.remind_at));

  return {
    greeting,
    prompt,
    followUp,
    topic,
    summary: reminder.summary ?? reminder.description ?? null,
  };
};

export function ReminderPanel({ userId, maxVisible = 5 }: ReminderPanelProps) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);

  const loadReminders = useCallback(async () => {
    if (!userId) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiService.getUserReminders(userId, {
        limit: 50,
        includeArchived: true,
      });
      const sorted = (data ?? []).slice().sort((a, b) => {
        const aTime = new Date(a.remind_at).getTime();
        const bTime = new Date(b.remind_at).getTime();
        return aTime - bTime;
      });
      setReminders(sorted);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load reminders.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadReminders();
  }, [loadReminders]);

  useEffect(() => {
    if (!userId) {
      return;
    }
    const id = window.setInterval(loadReminders, 60_000);
    return () => window.clearInterval(id);
  }, [loadReminders, userId]);

  const visibleReminders = useMemo(() => reminders.slice(0, maxVisible), [reminders, maxVisible]);

  const requireUserId = () => {
    if (!userId) {
      throw new Error("User id is required for reminder actions.");
    }
    return userId;
  };

  const handleMarkComplete = async (reminderId: number) => {
    try {
      const uid = requireUserId();
      await apiService.updateReminder(uid, reminderId, { status: "completed" });
      await loadReminders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update reminder.");
    }
  };

  const handleSnooze = async (reminderId: number, minutes: number) => {
    const target = reminders.find((reminder) => reminder.id === reminderId);
    if (!target) {
      return;
    }
    const baseTime = new Date(target.remind_at);
    if (Number.isNaN(baseTime.getTime())) {
      return;
    }
    const newTime = new Date(baseTime.getTime() + minutes * 60_000).toISOString();
    try {
      const uid = requireUserId();
      await apiService.updateReminder(uid, reminderId, { remind_at: newTime });
      await loadReminders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to snooze reminder.");
    }
  };

  const handleDelete = async (reminderId: number) => {
    try {
      const uid = requireUserId();
      await apiService.deleteReminder(uid, reminderId);
      setReminders((previous) => previous.filter((reminder) => reminder.id !== reminderId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete reminder.");
    }
  };

  const handleOpenModal = (reminder?: Reminder) => {
    setEditingReminder(reminder ?? null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setEditingReminder(null);
    setIsModalOpen(false);
  };

  const handleModalSuccess = async () => {
    await loadReminders();
  };

  const panelState =
    isLoading && reminders.length === 0
      ? "loading"
      : reminders.length === 0
        ? "empty"
        : "ready";

  console.debug("[ReminderPanel.render]", {
    state: panelState,
    reminderCount: reminders.length,
    className: styles.reminderPanel,
  });

  return (
    <section className={styles.reminderPanel}>
      {error ? <div className={styles.reminderError}>{error}</div> : null}

      <div className={styles.reminderPanelHeaderRow}>
        <div>
          <h3>Reminders</h3>
          <p className={styles.reminderHint}>Log nudges, tweak timing, or mark them done.</p>
        </div>
        <button
          type="button"
          className={styles.secondaryAction}
          onClick={() => handleOpenModal()}
          disabled={!userId}
        >
          <Plus size={14} />
          Add reminder
        </button>
      </div>

      {panelState === "ready" ? (
        <ul className={styles.reminderList}>
          {visibleReminders.map((reminder) => {
            const friendlyCopy = buildFriendlyCopy(reminder);
            const modeLabel = getModeLabel(reminder.delivery_mode ?? reminder.entity_type ?? "reminder");
            const scheduledLabel = formatReminderDate(reminder.remind_at);

            return (
              <li key={reminder.id} className={styles.reminderListItem}>
                <div className={styles.reminderChatRow}>
                  <div className={styles.reminderAvatar} aria-hidden="true">
                    <span role="img" aria-label="Orbiting assistant">
                      🛰️
                    </span>
                  </div>
                  <div className={styles.reminderChatBubble}>
                    <div className={styles.reminderChatIntro}>
                      <span>{friendlyCopy.greeting}</span>
                      <span className={styles.reminderModeBadge}>{modeLabel}</span>
                    </div>
                    <p className={styles.reminderChatText}>
                      {friendlyCopy.prompt} <span className={styles.reminderTaskName}>{friendlyCopy.topic}</span>.
                    </p>
                    {friendlyCopy.summary ? (
                      <p className={styles.reminderChatSummary}>"{friendlyCopy.summary}"</p>
                    ) : null}
                    <p className={styles.reminderChatFollowUp}>{friendlyCopy.followUp}</p>
                    <div className={styles.reminderMetaRow}>
                      <span className={styles.reminderTime}>{scheduledLabel}</span>
                      <span className={styles.reminderStatusPill}>{STATUS_LABELS[reminder.status]}</span>
                    </div>
                  </div>
                </div>
                <div className={styles.reminderActions}>
                  <button
                    type="button"
                    onClick={() => handleOpenModal(reminder)}
                    title="Edit reminder"
                  >
                    <Pencil size={14} />
                    Edit
                  </button>
                  <button type="button" onClick={() => handleMarkComplete(reminder.id)} title="Mark done">
                    <Check size={14} />
                    Done
                  </button>
                  <button type="button" onClick={() => handleSnooze(reminder.id, 15)} title="Snooze 15 minutes">
                    <SendHorizontal size={14} />
                    +15m
                  </button>
                  <button
                    type="button"
                    className={styles.reminderDangerButton}
                    onClick={() => handleDelete(reminder.id)}
                    title="Delete reminder"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {panelState === "empty" ? (
        <div className={styles.reminderEmpty}>
          Nothing queued right now - want me to dream up a fresh reminder?
        </div>
      ) : null}

      {isModalOpen ? (
        <AddReminderModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          userId={userId}
          onSuccess={handleModalSuccess}
          defaultMode={editingReminder?.delivery_mode === "reminder" ? "reminder" : "plan"}
          reminderToEdit={editingReminder ?? undefined}
        />
      ) : null}
    </section>
  );
}
