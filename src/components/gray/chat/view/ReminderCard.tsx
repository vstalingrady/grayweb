"use client";

import { CalendarClock } from "lucide-react";
import styles from "@/components/gray/chat/ChatStyles.module.css";
import { useI18n } from "@/contexts/I18nContext";
import { formatReminderDisplayLabels } from "../../reminderTimeUtils";
import type { GrayReminderCreatedPayload, GrayReminderEntityType } from "../types";

const REMINDER_STATUS_LABELS: Record<string, string> = {
  pending: "Scheduled",
  delivered: "Sent",
  completed: "Completed",
  cancelled: "Cancelled",
  failed: "Failed",
  created: "Scheduled",
};

const resolveReminderMode = (
  deliveryMode?: string | null,
  entity?: GrayReminderEntityType
): "plan" | "habit" | "reminder" => {
  const normalized = (deliveryMode ?? entity ?? "").toString().trim().toLowerCase();
  if (normalized.startsWith("plan")) {
    return "plan";
  }
  if (normalized.startsWith("habit")) {
    return "habit";
  }
  return "reminder";
};

const resolveReminderStatusLabel = (status?: string | null) => {
  if (!status) {
    return REMINDER_STATUS_LABELS.pending;
  }
  const normalized = status.trim().toLowerCase();
  return REMINDER_STATUS_LABELS[normalized as keyof typeof REMINDER_STATUS_LABELS] ?? status;
};

export const ReminderCard = ({ reminder }: { reminder: GrayReminderCreatedPayload }) => {
  const { t } = useI18n();
  const data = reminder.data;
  const reminderRecord = (data.reminder as Record<string, unknown> | null | undefined) ?? null;
  const rawRecord = (data.raw as Record<string, unknown> | null | undefined) ?? null;
  const reminderTime =
    reminderRecord && typeof reminderRecord["remind_at"] === "string" ? (reminderRecord["remind_at"] as string) : null;
  const scheduleIso = reminderTime ?? data.time_iso ?? null;
  const summaryCandidate =
    data.summary ??
    (rawRecord && typeof rawRecord["description"] === "string" ? (rawRecord["description"] as string) : undefined);
  const statusLabel = t(resolveReminderStatusLabel(data.reminder_status));
  const mode = resolveReminderMode(data.delivery_mode, reminder.entity);
  const typeLabels: Record<"plan" | "habit" | "reminder", string> = {
    plan: t("Plan"),
    habit: t("Habit"),
    reminder: t("Reminder"),
  };
  const { primary: scheduleLabel } = formatReminderDisplayLabels(scheduleIso);

  return (
    <article className={styles.reminderCard} data-mode={mode}>
      <header className={styles.reminderCardHeader}>
        <div>
          <h4>{data.label || t("Untitled reminder")}</h4>
          <h2 className={styles.reminderCardType}>{typeLabels[mode]}</h2>
          {summaryCandidate ? <p className={styles.reminderCardSummary}>{summaryCandidate}</p> : null}
        </div>
        <span className={styles.reminderCardStatus} data-status={data.reminder_status ?? "pending"}>
          {statusLabel}
        </span>
      </header>
      {scheduleLabel && (
        <div className={styles.reminderCardTimeRow}>
          <div className={styles.reminderCardTimeIcon}>
            <CalendarClock size={16} />
          </div>
          <div>
            <strong>{scheduleLabel}</strong>
          </div>
        </div>
      )}
    </article>
  );
};
