"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { X } from "lucide-react";
import styles from "@/app/gray/GrayPageClient.module.css";
import { useI18n } from "@/contexts/I18nContext";
import { useUser } from "@/contexts/UserContext";
import { apiService } from "@/lib/api";

export type InlineAddType = "plan" | "habit" | "reminder";

type InlineAddPanelProps = {
  activeType: InlineAddType;
  onTypeChange: (next: InlineAddType) => void;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
  disabled?: boolean;
};

const toIsoOrNull = (value: string) => {
  if (!value.trim()) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
};

export function InlineAddPanel({ activeType, onTypeChange, onClose, onSuccess, disabled }: InlineAddPanelProps) {
  const { t } = useI18n();
  const { user } = useUser();

  const [label, setLabel] = useState("");
  const [details, setDetails] = useState("");

  const [planScheduleStart, setPlanScheduleStart] = useState("");
  const [planScheduleEnd, setPlanScheduleEnd] = useState("");
  const [planReminderEnabled, setPlanReminderEnabled] = useState(false);
  const [planReminderAt, setPlanReminderAt] = useState("");

  const [reminderAt, setReminderAt] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDisabled = Boolean(disabled) || isSubmitting;

  const title = useMemo(() => {
    if (activeType === "plan") return t("Add plan");
    if (activeType === "habit") return t("Add habit");
    return t("Add reminder");
  }, [activeType, t]);

  useEffect(() => {
    setError(null);
    setIsSubmitting(false);
  }, [activeType]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!user) {
      setError(t("You must be signed in to perform this action."));
      return;
    }

    const trimmedLabel = label.trim();
    const trimmedDetails = details.trim();
    if (!trimmedLabel) {
      return;
    }

    if (activeType === "plan") {
      if ((planScheduleStart && !planScheduleEnd) || (!planScheduleStart && planScheduleEnd)) {
        setError(t("Please provide both a start and end time for the schedule."));
        return;
      }
      if (planReminderEnabled && !planReminderAt) {
        setError(t("Please provide a reminder time when reminder is checked."));
        return;
      }
    }

    if (activeType === "reminder") {
      const iso = toIsoOrNull(reminderAt);
      if (!iso) {
        setError(t("Please provide a reminder time."));
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (activeType === "plan") {
        const scheduleSlotValue =
          planScheduleStart && planScheduleEnd ? `${planScheduleStart}-${planScheduleEnd}` : null;
        const deadlineValue = planReminderEnabled && planReminderAt ? planReminderAt : null;
        const descriptionValue = trimmedDetails.length > 0 ? trimmedDetails : null;

        await apiService.createPlan(user.id, {
          label: trimmedLabel,
          completed: false,
          deadline: deadlineValue,
          scheduleSlot: scheduleSlotValue,
          description: descriptionValue,
        });
      } else if (activeType === "habit") {
        await apiService.createHabit(user.id, {
          label: trimmedLabel,
          previous_label: t("No history yet"),
          description: trimmedDetails.length > 0 ? trimmedDetails : null,
        });
      } else {
        const remindAtIso = toIsoOrNull(reminderAt);
        if (!remindAtIso) {
          setError(t("Please provide a reminder time."));
          return;
        }
        await apiService.createReminder(user.id, {
          label: trimmedLabel,
          remind_at: remindAtIso,
          description: trimmedDetails.length > 0 ? trimmedDetails : null,
        });
      }

      setLabel("");
      setDetails("");
      setPlanScheduleStart("");
      setPlanScheduleEnd("");
      setPlanReminderEnabled(false);
      setPlanReminderAt("");
      setReminderAt("");

      await onSuccess();
      onClose();
    } catch (submitError) {
      const fallbackMessage =
        activeType === "plan"
          ? t("Failed to add {type}", { type: t("Plan") })
          : activeType === "habit"
            ? t("Failed to add {type}", { type: t("Habit") })
            : t("Failed to add {type}", { type: t("Reminder") });

      console.error("[InlineAddPanel] Failed to submit:", submitError);
      setError(submitError instanceof Error ? submitError.message : fallbackMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLabelChange = (event: ChangeEvent<HTMLInputElement>) => {
    setLabel(event.target.value);
  };

  const handleDetailsChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setDetails(event.target.value);
  };

  return (
    <section className={styles.inlineAddPanel} aria-label={title}>
      <header className={styles.inlineAddPanelHeader}>
        <div className={styles.inlineAddPanelTitleRow}>
          <h3 className={styles.inlineAddPanelTitle}>{title}</h3>
          <button
            type="button"
            className={styles.inlineAddPanelClose}
            onClick={onClose}
            aria-label={t("Close")}
            disabled={isDisabled}
          >
            <X size={16} />
          </button>
        </div>
        <div className={styles.dashboardTasksToggle} role="tablist" aria-label={t("Choose item type")}>
          <button
            type="button"
            className={styles.dashboardTasksToggleButton}
            role="tab"
            aria-selected={activeType === "plan"}
            data-active={activeType === "plan" ? "true" : "false"}
            onClick={() => onTypeChange("plan")}
            disabled={isDisabled}
          >
            {t("Plan")}
          </button>
          <button
            type="button"
            className={styles.dashboardTasksToggleButton}
            role="tab"
            aria-selected={activeType === "habit"}
            data-active={activeType === "habit" ? "true" : "false"}
            onClick={() => onTypeChange("habit")}
            disabled={isDisabled}
          >
            {t("Habit")}
          </button>
          <button
            type="button"
            className={styles.dashboardTasksToggleButton}
            role="tab"
            aria-selected={activeType === "reminder"}
            data-active={activeType === "reminder" ? "true" : "false"}
            onClick={() => onTypeChange("reminder")}
            disabled={isDisabled}
          >
            {t("Reminder")}
          </button>
        </div>
      </header>

      <form className={styles.inlineAddPanelBody} onSubmit={handleSubmit}>
        <div className={styles.personalizationFieldGroup}>
          <label htmlFor="inline-add-label">
            {activeType === "plan"
              ? t("Plan *")
              : activeType === "habit"
                ? t("Habit *")
                : t("Reminder *")}
          </label>
          <input
            id="inline-add-label"
            type="text"
            className={styles.personalizationField}
            value={label}
            onChange={handleLabelChange}
            placeholder={
              activeType === "plan"
                ? t("What needs to happen?")
                : activeType === "habit"
                  ? t("Name the habit...")
                  : t("Remind me to...")
            }
            disabled={isDisabled}
            required
          />
        </div>

        <div className={styles.personalizationFieldGroup}>
          <label htmlFor="inline-add-details">{t("Details")}</label>
          <textarea
            id="inline-add-details"
            className={styles.personalizationField}
            value={details}
            onChange={handleDetailsChange}
            placeholder={
              activeType === "plan"
                ? t("Add notes, links, or context")
                : activeType === "habit"
                  ? t("What does success look like?")
                  : t("Add notes, links, or context")
            }
            disabled={isDisabled}
            rows={3}
          />
        </div>

        {activeType === "plan" ? (
          <div className={styles.inlineAddPanelPlanRow}>
            <div className={styles.personalizationFieldGroup}>
              <label htmlFor="inline-add-plan-schedule-start">{t("Schedule window")}</label>
              <div className={styles.inlineAddPanelTwoCol}>
                <div className={styles.inlineAddPanelStack}>
                  <span className={styles.personalizationHint}>{t("Start")}</span>
                  <input
                    id="inline-add-plan-schedule-start"
                    type="time"
                    className={styles.personalizationField}
                    value={planScheduleStart}
                    onChange={(event) => setPlanScheduleStart(event.target.value)}
                    disabled={isDisabled}
                    step={300}
                  />
                </div>
                <div className={styles.inlineAddPanelStack}>
                  <span className={styles.personalizationHint}>{t("End")}</span>
                  <input
                    id="inline-add-plan-schedule-end"
                    type="time"
                    className={styles.personalizationField}
                    value={planScheduleEnd}
                    onChange={(event) => setPlanScheduleEnd(event.target.value)}
                    disabled={isDisabled}
                    step={300}
                  />
                </div>
              </div>
            </div>

            <div className={styles.personalizationFieldGroup}>
              <div className={styles.reminderCheckboxRow}>
                <label className={styles.reminderCheckboxLabel}>
                  <input
                    type="checkbox"
                    checked={planReminderEnabled}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setPlanReminderEnabled(checked);
                      if (!checked) {
                        setPlanReminderAt("");
                      }
                    }}
                    disabled={isDisabled}
                    className={styles.reminderCheckboxInput}
                  />
                  {t("Reminder")}
                </label>
              </div>
              <div className={styles.reminderDatePicker} data-hidden={!planReminderEnabled}>
                <input
                  id="inline-add-plan-reminder"
                  type="datetime-local"
                  className={styles.personalizationField}
                  value={planReminderAt}
                  onChange={(event) => setPlanReminderAt(event.target.value)}
                  disabled={isDisabled || !planReminderEnabled}
                />
              </div>
            </div>
          </div>
        ) : null}

        {activeType === "reminder" ? (
          <div className={styles.personalizationFieldGroup}>
            <label htmlFor="inline-add-reminder-at">{t("Remind at *")}</label>
            <input
              id="inline-add-reminder-at"
              type="datetime-local"
              className={styles.personalizationField}
              value={reminderAt}
              onChange={(event) => setReminderAt(event.target.value)}
              disabled={isDisabled}
              required
            />
          </div>
        ) : null}

        {error ? (
          <p className={styles.personalizationHint} style={{ color: "#ff6b6b" }}>
            {error}
          </p>
        ) : null}

        <div className={styles.inlineAddPanelActions}>
          <button type="button" className={styles.dashboardButtonNeutral} onClick={onClose} disabled={isDisabled}>
            {t("Cancel")}
          </button>
          <button type="submit" className={styles.secondaryAction} disabled={!label.trim() || isDisabled}>
            {isSubmitting ? t("Saving...") : t("Save")}
          </button>
        </div>
      </form>
    </section>
  );
}
