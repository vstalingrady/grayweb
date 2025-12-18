"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { X, ChevronDown } from "lucide-react";
import styles from "@/app/gray/GrayPageClient.module.css";
import { useUser } from "@/contexts/UserContext";
import { workspaceService } from "@/lib/api";
import type { HabitItem, HabitUpdates, PlanItem, PlanUpdates } from "./types";
import { useI18n } from "@/contexts/I18nContext";
import { splitScheduleSlot, toDateTimeLocalValue } from "./planHabitInlineEditor/dateUtils";

type AddPlanHabitModalProps = {
  isOpen: boolean;
  onClose: () => void;
  type: "plan" | "habit";
  onSuccess: () => Promise<void> | void;
  planToEdit?: PlanItem | null;
  onSubmitPlan?: (planId: string | null, updates: PlanUpdates) => Promise<void> | void;
  habitToEdit?: HabitItem | null;
  onSubmitHabit?: (habitId: string | null, updates: HabitUpdates) => Promise<void> | void;
};

export function AddPlanHabitModal({
  isOpen,
  onClose,
  type,
  onSuccess,
  planToEdit,
  onSubmitPlan,
  habitToEdit,
  onSubmitHabit,
}: AddPlanHabitModalProps) {
  const { t } = useI18n();
  const [inputValue, setInputValue] = useState("");
  const [detailsValue, setDetailsValue] = useState("");
  const [planDeadline, setPlanDeadline] = useState("");
  const [planScheduleStart, setPlanScheduleStart] = useState("");
  const [planScheduleEnd, setPlanScheduleEnd] = useState("");
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useUser();
  const [activeType, setActiveType] = useState<"plan" | "habit">(type);

  useEffect(() => {
    setActiveType(type);
  }, [type, isOpen]);
  useEffect(() => {
    if (type !== "plan" || !planToEdit || !isOpen) {
      return;
    }
    setInputValue(planToEdit.label);
    setDetailsValue(planToEdit.details ?? "");
    const slot = splitScheduleSlot(planToEdit.scheduleSlot);
    setPlanScheduleStart(slot?.start ?? "");
    setPlanScheduleEnd(slot?.end ?? "");
    const deadlineValue = toDateTimeLocalValue(planToEdit.deadline ?? "");
    setPlanDeadline(deadlineValue);
    setReminderEnabled(Boolean(deadlineValue));
    setError(null);
  }, [isOpen, planToEdit, type]);

  useEffect(() => {
    if (type !== "habit" || !habitToEdit || !isOpen) {
      return;
    }
    setInputValue(habitToEdit.label);
    setDetailsValue(habitToEdit.details ?? "");
    setError(null);
  }, [habitToEdit, isOpen, type]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setInputValue("");
      setDetailsValue("");
      setPlanDeadline("");
      setPlanScheduleStart("");
      setPlanScheduleEnd("");
      setReminderEnabled(false);
      setIsSubmitting(false);
      setError(null);
    }
  }, [isOpen]);

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {

    e.preventDefault();

    // console.log('[AddPlanHabitModal] handleSubmit called', { type: activeType, inputValue, user: !!user });



    if (!user) {

      setError(t("You must be signed in to perform this action."));

      return;

    }



    if (!inputValue.trim()) {

      // console.log('[AddPlanHabitModal] Input value is empty, returning');

      return;

    }



    if ((planScheduleStart && !planScheduleEnd) || (!planScheduleStart && planScheduleEnd)) {

      setError(t("Please provide both a start and end time for the schedule."));

      return;

    }



    if (reminderEnabled && !planDeadline) {

      setError(t("Please provide a reminder time when reminder is checked."));

      return;

    }



    setIsSubmitting(true);

    setError(null);

    // console.log('[AddPlanHabitModal] Starting submission...');



    const isEditingPlan = activeType === "plan" && Boolean(planToEdit);

    const isEditingHabit = activeType === "habit" && Boolean(habitToEdit);

    try {

      const trimmed = inputValue.trim();

      const details = detailsValue.trim();

      if (activeType === "plan") {

        const scheduleSlotValue =

          planScheduleStart && planScheduleEnd

            ? `${planScheduleStart}-${planScheduleEnd}`

            : null;

        const deadlineValue = planDeadline ? planDeadline : null;

        const descriptionValue = details.length > 0 ? details : null;

        const payload: PlanUpdates = {

          label: trimmed,

          details: descriptionValue,

          deadline: deadlineValue,

          scheduleSlot: scheduleSlotValue,

        };

        // console.log('[AddPlanHabitModal] Saving plan', { isEditing: isEditingPlan, payload, hasOnSubmitPlan: !!onSubmitPlan });

        if (onSubmitPlan) {

          await onSubmitPlan(planToEdit?.id ?? null, payload);

        } else {

          await workspaceService.createPlan(user.id, {

            label: trimmed,

            completed: false,

            deadline: deadlineValue,

            scheduleSlot: scheduleSlotValue,

            description: descriptionValue,

          });

        }

      } else {

        if (isEditingHabit) {

          const payload: HabitUpdates = {

            label: trimmed,

            details: details.length > 0 ? details : null,

          };

          // console.log('[AddPlanHabitModal] Updating habit', { payload, hasOnSubmitHabit: !!onSubmitHabit });

          if (onSubmitHabit) {

            await onSubmitHabit(habitToEdit?.id ?? null, payload);

          } else if (user && habitToEdit) {

            const habitId = Number(habitToEdit.id);

            await workspaceService.updateHabit(user.id, habitId, {

              label: payload.label,

              description: payload.details ?? null,

            });

          }

        } else {

          // console.log('[AddPlanHabitModal] Creating new habit');

          await workspaceService.createHabit(user.id, {

            label: trimmed,

            previous_label: t("No history yet"),

            description: details.length > 0 ? details : null,

          });

        }

      }



      setInputValue("");

      setDetailsValue("");

      setPlanDeadline("");

      setPlanScheduleStart("");

      setPlanScheduleEnd("");

      // console.log('[AddPlanHabitModal] Calling onSuccess...');

      await onSuccess();

      // console.log('[AddPlanHabitModal] onSuccess completed, closing modal');

      onClose();

    } catch (err) {

      const typeLabel = activeType === "plan" ? t("Plan") : t("Habit");
      const fallbackError = isEditingPlan || isEditingHabit
        ? t("Failed to update {type}", { type: typeLabel })
        : t("Failed to add {type}", { type: typeLabel });

      console.error(`[AddPlanHabitModal] Failed to ${isEditingPlan || isEditingHabit ? "update" : "add"} ${activeType}:`, err);

      setError(err instanceof Error ? err.message : fallbackError);

    } finally {

      setIsSubmitting(false);

    }

  };

  const handleInputChange = (value: string) => {
    setInputValue(value);
    setError(null);
  };

  const handleDetailsChange = (value: string) => {
    setDetailsValue(value);
  };

  if (!isOpen) {
    return null;
  }

  const isPlan = activeType === "plan";
  const isEditing = Boolean(planToEdit || habitToEdit);
  const title = isPlan ? t("Add Plan") : t("Add Habit");

  return (
    <div
      className={styles.personalizationOverlay}
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        className={styles.personalizationPanel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-item-title"
        onClick={(event) => event.stopPropagation()}
        style={{ maxWidth: "520px" }}
      >
        <header className={styles.personalizationPanelHeader}>
          <div>
            {!isEditing ? (
              <div className={styles.personalizationHeaderTypeSelect}>
                <span className={styles.personalizationEyebrow} style={{ position: "absolute", top: "-18px", left: "2px" }}>
                  {t("Create new")}
                </span>
                <select
                  value={activeType}
                  onChange={(e) => setActiveType(e.target.value as "plan" | "habit")}
                  className={styles.personalizationHeaderSelect}
                  aria-label={t("Select item type")}
                >
                  <option value="plan">{t("Add Plan")}</option>
                  <option value="habit">{t("Add Habit")}</option>
                </select>
                <ChevronDown className={styles.personalizationHeaderSelectArrow} />
              </div>
            ) : (
              <h2 id="add-item-title">{title}</h2>
            )}
          </div>
          <button
            type="button"
            className={styles.personalizationClose}
            onClick={onClose}
            aria-label={t("Close modal")}
          >
            <X size={18} />
          </button>
        </header>

        <form
          onSubmit={handleSubmit}
          className={styles.personalizationGrid}
          style={{
            marginTop: "12px",
            gridTemplateColumns: "minmax(0, 1fr)",
            alignItems: "stretch",
          }}
        >
          <div className={styles.personalizationColumn}>
            {isPlan ? (
              <>
                <div className={styles.personalizationFieldGroup}>
                  <label htmlFor="plan-description">{t("Plan *")}</label>
                  <textarea
                    id="plan-description"
                    className={styles.personalizationField}
                    value={inputValue}
                    onChange={(event) => handleInputChange(event.target.value)}
                    placeholder={t("What needs to happen?")}
                    disabled={isSubmitting}
                    rows={3}
                    autoFocus
                    required
                  />
                </div>

                <div className={styles.personalizationFieldGroup}>
                  <label htmlFor="plan-details">{t("Details")}</label>
                  <textarea
                    id="plan-details"
                    className={styles.personalizationField}
                    value={detailsValue}
                    onChange={(event) => handleDetailsChange(event.target.value)}
                    placeholder={t("Add notes, links, or context")}
                    disabled={isSubmitting}
                    rows={3}
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "20px",
                    marginTop: "20px",
                    alignItems: "flex-end",
                  }}
                >
                  <div
                    className={styles.personalizationFieldGroup}
                    style={{ minWidth: "260px", flex: "1 1 260px" }}
                  >
                    <label htmlFor="plan-schedule-start">{t("Schedule window")}</label>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, minmax(110px, 1fr))",
                        gap: "14px",
                        marginTop: "12px",
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <span
                          className={styles.personalizationHint}
                          style={{ textTransform: "uppercase", letterSpacing: "0.2em" }}
                        >
                          {t("Start")}
                        </span>
                        <input
                          id="plan-schedule-start"
                          type="time"
                          className={styles.personalizationField}
                          value={planScheduleStart}
                          onChange={(event) => setPlanScheduleStart(event.target.value)}
                          disabled={isSubmitting}
                          step={300}
                        />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <span
                          className={styles.personalizationHint}
                          style={{ textTransform: "uppercase", letterSpacing: "0.2em" }}
                        >
                          {t("End")}
                        </span>
                        <input
                          id="plan-schedule-end"
                          type="time"
                          className={styles.personalizationField}
                          value={planScheduleEnd}
                          onChange={(event) => setPlanScheduleEnd(event.target.value)}
                          disabled={isSubmitting}
                          step={300}
                        />
                      </div>
                    </div>
                  </div>
                  <div
                    className={styles.personalizationFieldGroup}
                    style={{
                      minWidth: "200px",
                      flex: "1 1 200px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <div className={styles.reminderCheckboxRow}>
                      <label className={styles.reminderCheckboxLabel}>
                        <input
                          type="checkbox"
                          checked={reminderEnabled}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setReminderEnabled(checked);
                            if (!checked) {
                              setPlanDeadline("");
                            }
                          }}
                          disabled={isSubmitting}
                          className={styles.reminderCheckboxInput}
                        />
                        {t("Reminder")}
                      </label>
                    </div>
                    <div
                      className={styles.reminderDatePicker}
                      data-hidden={!reminderEnabled}
                    >
                      <input
                        id="plan-reminder"
                        type="datetime-local"
                        className={styles.personalizationField}
                        value={planDeadline}
                        onChange={(event) => setPlanDeadline(event.target.value)}
                        disabled={isSubmitting || !reminderEnabled}
                      />
                    </div>
                  </div>
                </div>

                {error && (
                  <p className={styles.personalizationHint} style={{ color: "#ff6b6b", marginTop: "12px" }}>
                    {error}
                  </p>
                )}
              </>
            ) : (
              <>
                <div className={styles.personalizationFieldGroup}>
                  <label htmlFor="habit-label">{t("Habit *")}</label>
                  <input
                    id="habit-label"
                    type="text"
                    className={styles.personalizationField}
                    value={inputValue}
                    onChange={(event) => handleInputChange(event.target.value)}
                    placeholder={t("Name the habit...")}
                    disabled={isSubmitting}
                    autoFocus
                    required
                  />
                </div>
                <div className={styles.personalizationFieldGroup} style={{ marginTop: "16px" }}>
                  <label htmlFor="habit-details">{t("Details")}</label>
                  <textarea
                    id="habit-details"
                    className={styles.personalizationField}
                    value={detailsValue}
                    onChange={(event) => handleDetailsChange(event.target.value)}
                    placeholder={t("What does success look like?")}
                    disabled={isSubmitting}
                    rows={3}
                  />
                </div>
                {error && (
                  <p className={styles.personalizationHint} style={{ color: "#ff6b6b", marginTop: "12px" }}>
                    {error}
                  </p>
                )}
              </>
            )}

            <div style={{ display: "flex", gap: "12px", marginTop: "28px" }}>
              <button
                type="button"
                className={styles.personalizationLink}
                onClick={onClose}
                disabled={isSubmitting}
                style={{ flex: 1 }}
              >
                {t("Cancel")}
              </button>
              <button
                type="submit"
                className={styles.secondaryAction}
                disabled={!inputValue.trim() || isSubmitting}
                style={{ flex: 1 }}
              >
                {isSubmitting ? t("Saving...") : t("Save")}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
