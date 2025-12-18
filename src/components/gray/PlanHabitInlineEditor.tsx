"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Calendar, ChevronDown, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import calendarStyles from "@/components/calendar/GrayDashboardCalendar.module.css";
import { MiniMonth } from "@/components/calendar/MiniMonth";
import { useUser } from "@/contexts/UserContext";
import { useI18n } from "@/contexts/I18nContext";
import { workspaceService } from "@/lib/api";
import type { HabitItem, HabitUpdates, PlanItem, PlanUpdates } from "./types";
import { useDismissableLayer } from "./hooks/useDismissableLayer";
import {
  EARTHY_PALETTE,
  NEUTRAL_PALETTE,
  PASTEL_PALETTE,
  QUICK_COLOR_SWATCHES,
  clamp,
  hexToRgb,
  normalizeHex,
  rgbToHex,
} from "./planHabitInlineEditor/colorUtils";
import {
  combineDateWithTime,
  splitScheduleSlot,
  startOfDay,
  startOfMonth,
  toDateTimeLocalString,
} from "./planHabitInlineEditor/dateUtils";
import { formatInlineDurationLabel } from "./planHabitInlineEditor/timeUtils";
import {
  deriveReminderPresetFromReminderAt,
  parseReminderLeadMinutes,
  type ReminderPreset,
} from "./planHabitInlineEditor/reminderUtils";
import { ReminderControls } from "./planHabitInlineEditor/ReminderControls";

type PlanHabitInlineEditorProps = {
  type: "plan" | "habit";
  onTypeChange?: (type: "plan" | "habit") => void;
  planToEdit?: PlanItem | null;
  habitToEdit?: HabitItem | null;
  onCancel: () => void;
  onSuccess: () => Promise<void> | void;
  onSubmitPlan?: (planId: string | null, updates: PlanUpdates) => Promise<void> | void;
  onSubmitHabit?: (habitId: string | null, updates: HabitUpdates) => Promise<void> | void;
};

export function PlanHabitInlineEditor({
  type,
  onTypeChange,
  planToEdit,
  habitToEdit,
  onCancel,
  onSuccess,
  onSubmitPlan,
  onSubmitHabit,
}: PlanHabitInlineEditorProps) {
  const { t } = useI18n();
  const { user } = useUser();
  const planTier = (user?.plan_tier || "scout").toLowerCase();
  const isScout = planTier === "scout";
  const isPlan = type === "plan";
  const isEditing = Boolean(planToEdit || habitToEdit);
  const submitLabel = isEditing ? t("Save") : t("Add");
  const submittingLabel = isEditing ? t("Saving...") : t("Adding...");

  const formRef = useRef<HTMLFormElement | null>(null);
  const colorPickerRef = useRef<HTMLDivElement | null>(null);
  const colorPickerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const colorPickerPopoverRef = useRef<HTMLDivElement | null>(null);

  const [title, setTitle] = useState("");
  const [detailsValue, setDetailsValue] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [monthDate, setMonthDate] = useState(() => startOfMonth(new Date()));
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [color, setColor] = useState<string>(QUICK_COLOR_SWATCHES[1]);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [hexDraft, setHexDraft] = useState<string>(QUICK_COLOR_SWATCHES[1]);
  const [colorPickerPosition, setColorPickerPosition] = useState<{ top: number; left: number } | null>(null);
  const [reminderPreset, setReminderPreset] = useState<ReminderPreset>("none");
  const [isReminderMenuOpen, setIsReminderMenuOpen] = useState(false);
  const [customReminderMinutes, setCustomReminderMinutes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headerLabel = useMemo(() => t("Events"), [t]);
  const eventStart = useMemo(() => combineDateWithTime(selectedDate, startTime), [selectedDate, startTime]);
  const rgb = useMemo(() => hexToRgb(color) ?? { red: 0, green: 0, blue: 0 }, [color]);
  const colorPopoverStyle = useMemo(() => {
    if (!colorPickerPosition) return undefined;
    return { top: `${colorPickerPosition.top}px`, left: `${colorPickerPosition.left}px` };
  }, [colorPickerPosition]);

  useEffect(() => {
    if (isScout) {
      setIsColorPickerOpen(false);
    }
  }, [isScout]);

  useEffect(() => {
    const now = new Date();
    if (isPlan) {
      if (planToEdit) {
        setTitle(planToEdit.label ?? "");
        setDetailsValue(planToEdit.details ?? "");
        const slot = splitScheduleSlot(planToEdit.scheduleSlot);
        setStartTime(slot?.start ?? "09:00");
        setEndTime(slot?.end ?? "10:00");
        const referenceValue = planToEdit.deadline ? new Date(planToEdit.deadline) : null;
        if (referenceValue && !Number.isNaN(referenceValue.getTime())) {
          const normalizedDay = startOfDay(referenceValue);
          setSelectedDate(normalizedDay);
          setMonthDate(startOfMonth(normalizedDay));
        } else {
          setSelectedDate(startOfDay(now));
          setMonthDate(startOfMonth(now));
        }
        setColor(planToEdit.color ?? QUICK_COLOR_SWATCHES[1]);
      } else {
        setTitle("");
        setDetailsValue("");
        setStartTime("09:00");
        setEndTime("10:00");
        setSelectedDate(startOfDay(now));
        setMonthDate(startOfMonth(now));
      }
    } else {
      if (habitToEdit) {
        setTitle(habitToEdit.label ?? "");
        setDetailsValue(habitToEdit.details ?? "");
      } else {
        setTitle("");
        setDetailsValue("");
      }
      setSelectedDate(startOfDay(now));
      setMonthDate(startOfMonth(now));
      setColor(QUICK_COLOR_SWATCHES[1]);
    }
    setReminderPreset("none");
    setCustomReminderMinutes("");
    setIsColorPickerOpen(false);
    setError(null);
  }, [habitToEdit, isPlan, planToEdit]);

  useEffect(() => {
    setHexDraft(color);
  }, [color]);

  const closeColorPicker = useCallback(() => {
    setIsColorPickerOpen(false);
  }, []);

  const colorPickerDismissRefs = useMemo(
    () => [colorPickerTriggerRef, colorPickerPopoverRef, colorPickerRef],
    []
  );

  useDismissableLayer({
    isOpen: isColorPickerOpen,
    ignoreRefs: colorPickerDismissRefs,
    onDismiss: closeColorPicker,
  });

  useLayoutEffect(() => {
    if (!isColorPickerOpen) {
      setColorPickerPosition(null);
      return;
    }

    const triggerRect = colorPickerTriggerRef.current?.getBoundingClientRect();
    if (!triggerRect) return;

    const popoverRect = colorPickerPopoverRef.current?.getBoundingClientRect();
    const popoverWidth = popoverRect?.width ?? 360;
    const popoverHeight = popoverRect?.height ?? 420;

    const viewportPadding = 12;
    const gap = 12;

    const spaceRight = window.innerWidth - triggerRect.right - gap;
    const spaceLeft = triggerRect.left - gap;

    let left = triggerRect.right + gap;
    if (spaceRight < popoverWidth && spaceLeft >= popoverWidth) {
      left = triggerRect.left - gap - popoverWidth;
    } else if (spaceRight < popoverWidth) {
      left = clamp(
        triggerRect.left - popoverWidth / 2,
        viewportPadding,
        window.innerWidth - viewportPadding - popoverWidth
      );
    }

    const top = clamp(
      triggerRect.top,
      viewportPadding,
      window.innerHeight - viewportPadding - popoverHeight
    );

    setColorPickerPosition({ top, left });
  }, [isColorPickerOpen]);

  useEffect(() => {
    const editingItem = planToEdit ?? habitToEdit;
    if (!editingItem) {
      setReminderPreset("none");
      setCustomReminderMinutes("");
      return;
    }

    const derived = deriveReminderPresetFromReminderAt({
      reminderAt: editingItem.reminderAt,
      eventStart,
    });
    setReminderPreset(derived.preset);
    setCustomReminderMinutes(derived.customMinutes);
  }, [eventStart, habitToEdit, planToEdit]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key === "Enter") {
        if (event.target instanceof HTMLTextAreaElement) {
          return;
        }
        event.preventDefault();
        formRef.current?.requestSubmit();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!user) {
      setError(t("You must be signed in to perform this action."));
      return;
    }

    if (!title.trim()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const trimmed = title.trim();
      const details = detailsValue.trim();
      const descriptionValue = details.length > 0 ? details : null;
      const reminderLeadMinutes = parseReminderLeadMinutes(reminderPreset, customReminderMinutes);
      const reminderAtIso =
        reminderLeadMinutes === null
          ? null
          : new Date(eventStart.getTime() - reminderLeadMinutes * 60000).toISOString();

      if (isPlan) {
        const scheduleSlotValue = `${startTime}-${endTime}`;
        const deadlineValue = toDateTimeLocalString(combineDateWithTime(selectedDate, endTime));

        const payload: PlanUpdates = {
          label: trimmed,
          details: descriptionValue,
          deadline: deadlineValue,
          scheduleSlot: scheduleSlotValue,
          reminderAt: reminderAtIso,
          color,
        };

        if (planToEdit) {
          if (onSubmitPlan) {
            await onSubmitPlan(planToEdit.id ?? null, payload);
          } else {
            const numericId = Number(planToEdit.id);
            if (Number.isNaN(numericId)) {
              throw new Error(t("Invalid plan id."));
            }
            await workspaceService.updatePlan(user.id, numericId, {
              label: payload.label,
              description: payload.details ?? null,
              deadline: payload.deadline ?? null,
              scheduleSlot: payload.scheduleSlot ?? null,
              reminderAt: payload.reminderAt ?? null,
              color: payload.color ?? null,
            });
          }
        } else {
          await workspaceService.createPlan(user.id, {
            label: payload.label,
            completed: false,
            deadline: payload.deadline ?? null,
            scheduleSlot: payload.scheduleSlot ?? null,
            description: payload.details ?? null,
            reminderAt: payload.reminderAt ?? null,
            color: payload.color ?? null,
          });
        }
      } else {
        const payload: HabitUpdates = {
          label: trimmed,
          details: details.length > 0 ? details : null,
          reminderAt: reminderAtIso,
        };

        if (habitToEdit) {
          if (onSubmitHabit) {
            await onSubmitHabit(habitToEdit.id ?? null, payload);
          } else {
            const numericId = Number(habitToEdit.id);
            if (Number.isNaN(numericId)) {
              throw new Error(t("Invalid habit id."));
            }
            await workspaceService.updateHabit(user.id, numericId, {
              label: payload.label,
              description: payload.details ?? null,
              reminderAt: payload.reminderAt ?? null,
            });
          }
        } else {
          await workspaceService.createHabit(user.id, {
            label: payload.label,
            previous_label: t("No history yet"),
            description: payload.details ?? null,
            reminderAt: payload.reminderAt ?? null,
          });
        }
      }

      setTitle("");
      setDetailsValue("");
      await onSuccess();
      onCancel();
    } catch (submitError) {
      const typeLabel = isPlan ? t("Plan") : t("Habit");
      const fallbackError = isEditing
        ? t("Failed to update {type}", { type: typeLabel })
        : t("Failed to add {type}", { type: typeLabel });
      console.error("[PlanHabitInlineEditor] Failed to submit:", submitError);
      setError(submitError instanceof Error ? submitError.message : fallbackError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectColor = (colorValue: string) => {
    setColor(colorValue);
    setIsColorPickerOpen(false);
  };

  const handleUpdateColorWithoutClosing = (colorValue: string) => {
    setColor(colorValue);
  };

  const handlePickCustomColor = () => {
    setIsColorPickerOpen((previous) => !previous);
  };

  const handleHexCommit = () => {
    const normalized = normalizeHex(hexDraft);
    if (!normalized) {
      setHexDraft(color);
      return;
    }
    handleSelectColor(normalized);
  };

  return (
    <div className={calendarStyles.composerCard} style={{ width: "100%", marginTop: "12px" }}>
      <div className={calendarStyles.composerHeader}>
        <div className={calendarStyles.composerHeaderTypeSelect}>
          {onTypeChange ? (
            <>
              <select
                value={type}
                onChange={(event) => onTypeChange(event.target.value as "plan" | "habit")}
                className={calendarStyles.composerHeaderSelect}
                disabled={isSubmitting || Boolean(planToEdit || habitToEdit)}
                aria-label={headerLabel}
              >
                <option value="plan">{t("Plan")}</option>
                <option value="habit">{t("Habit")}</option>
              </select>
              <ChevronDown size={16} className={calendarStyles.composerHeaderSelectArrow} />
            </>
          ) : (
            <>
              <span className={calendarStyles.composerHeaderSelect}>{headerLabel}</span>
              <ChevronDown size={16} className={calendarStyles.composerHeaderSelectArrow} />
            </>
          )}
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label={t("Close dialog")}
          className={calendarStyles.composerCloseButton}
          disabled={isSubmitting}
        >
          <X size={18} strokeWidth={1.75} />
        </button>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className={calendarStyles.composerForm}>
        <button type="submit" style={{ display: "none" }} aria-hidden="true" tabIndex={-1} />

        <div className={calendarStyles.composerTitleRow}>
          <input
            type="text"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setError(null);
            }}
            placeholder={t("Title")}
            className={calendarStyles.composerTitleInput}
            disabled={isSubmitting}
            autoFocus
            required
          />
        </div>

        <hr className={calendarStyles.composerSectionDivider} />

        <div className={calendarStyles.composerTimeSection}>
          <div className={calendarStyles.composerTimeRow}>
            <div className={calendarStyles.composerTimeInputGroup}>
              <input
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                className={calendarStyles.composerTimeInput}
                required
                disabled={isSubmitting}
              />
              <ArrowRight size={14} className={calendarStyles.composerTimeArrow} />
              <input
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                className={calendarStyles.composerTimeInput}
                required
                disabled={isSubmitting}
              />
            </div>
            <span className={calendarStyles.composerDuration}>
              {formatInlineDurationLabel(startTime, endTime)}
            </span>
          </div>
          <div className={calendarStyles.composerTimeMetaRow}>
            <div className={calendarStyles.composerDateRow}>
              <button
                type="button"
                className={calendarStyles.composerDateTrigger}
                onClick={() => {
                  setMonthDate(startOfMonth(selectedDate));
                  setIsReminderMenuOpen(false);
                  setIsDatePickerOpen((previous) => !previous);
                }}
                aria-expanded={isDatePickerOpen ? "true" : "false"}
                aria-label={t("Choose date")}
                disabled={isSubmitting}
              >
                <Calendar
                  size={14}
                  aria-hidden="true"
                  className={calendarStyles.composerInlineControlIcon}
                />
                <span className={calendarStyles.composerInlineControlLabel}>
                  {selectedDate.toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <ChevronDown
                  size={14}
                  aria-hidden="true"
                  className={calendarStyles.composerInlineControlChevron}
                />
              </button>
            </div>

            <ReminderControls
              reminderPreset={reminderPreset}
              setReminderPreset={setReminderPreset}
              customReminderMinutes={customReminderMinutes}
              setCustomReminderMinutes={setCustomReminderMinutes}
              isSubmitting={isSubmitting}
              isOpen={isReminderMenuOpen}
              setIsOpen={setIsReminderMenuOpen}
              onBeforeToggle={() => setIsDatePickerOpen(false)}
            />
          </div>
        </div>
        <hr className={calendarStyles.composerSectionDivider} />

        {isDatePickerOpen ? (
          <div
            className={calendarStyles.composerDatePopover}
            role="dialog"
            aria-label={t("Date picker")}
          >
            <div className={calendarStyles.composerDatePopoverHeader}>
              <span className={calendarStyles.composerDatePopoverMonthLabel}>
                {monthDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              </span>
              <span className={calendarStyles.composerDatePopoverControls}>
                <button
                  type="button"
                  className={calendarStyles.composerDatePopoverNavButton}
                  aria-label={t("Previous")}
                  title={t("Go to previous month")}
                  onClick={() =>
                    setMonthDate((previous) => {
                      const next = startOfMonth(previous);
                      next.setMonth(previous.getMonth() - 1);
                      return next;
                    })
                  }
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  type="button"
                  className={calendarStyles.composerDatePopoverNavButton}
                  aria-label={t("Next")}
                  title={t("Go to next month")}
                  onClick={() =>
                    setMonthDate((previous) => {
                      const next = startOfMonth(previous);
                      next.setMonth(previous.getMonth() + 1);
                      return next;
                    })
                  }
                >
                  <ChevronRight size={14} />
                </button>
              </span>
            </div>

            <div className={calendarStyles.composerMiniCalendarCompact}>
              <MiniMonth
                referenceDate={monthDate}
                selectedDate={selectedDate}
                onSelectDate={(nextDate) => {
                  const normalized = startOfDay(nextDate);
                  setSelectedDate(normalized);
                  if (
                    normalized.getMonth() !== monthDate.getMonth() ||
                    normalized.getFullYear() !== monthDate.getFullYear()
                  ) {
                    setMonthDate(startOfMonth(normalized));
                  }
                  setIsDatePickerOpen(false);
                }}
              />
            </div>
          </div>
        ) : null}

        <label className={calendarStyles.composerField}>
          <textarea
            value={detailsValue}
            onChange={(event) => setDetailsValue(event.target.value)}
            placeholder={t("Description")}
            disabled={isSubmitting}
            aria-label={t("Description")}
          />
        </label>

        <hr className={calendarStyles.composerSectionDivider} />

        <label className={calendarStyles.composerField}>
          {!isScout && isPlan ? <span>{t("Color")}</span> : null}
          <div className={calendarStyles.composerColors} ref={colorPickerRef}>
            {!isScout && isPlan ? (
              <>
                {QUICK_COLOR_SWATCHES.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    className={calendarStyles.composerColorDot}
                    style={{ backgroundColor: swatch }}
                    data-active={color === swatch ? "true" : "false"}
                    onClick={() => handleSelectColor(swatch)}
                    aria-label={t("Select {color} color", { color: swatch })}
                    disabled={isSubmitting}
                  />
                ))}
                <button
                  type="button"
                  className={calendarStyles.composerColorDot}
                  data-active={
                    QUICK_COLOR_SWATCHES.includes(color as (typeof QUICK_COLOR_SWATCHES)[number])
                      ? "false"
                      : "true"
                  }
                  onClick={handlePickCustomColor}
                  aria-label={t("Pick custom color")}
                  aria-expanded={isColorPickerOpen ? "true" : "false"}
                  ref={colorPickerTriggerRef}
                  disabled={isSubmitting}
                >
                  <Plus size={18} strokeWidth={1.75} aria-hidden="true" />
                </button>
              </>
            ) : null}

            <button
              type="submit"
              className={calendarStyles.composerInlineSubmit}
              disabled={isSubmitting || !title.trim() || !user}
              aria-label={isSubmitting ? submittingLabel : submitLabel}
            >
              {isSubmitting ? submittingLabel : submitLabel}
            </button>

            {!isScout && isPlan && isColorPickerOpen ? (
              <div
                ref={colorPickerPopoverRef}
                className={calendarStyles.composerColorPopover}
                style={colorPopoverStyle}
                role="dialog"
                aria-label={t("Color picker")}
              >
                <div className={calendarStyles.composerColorPopoverHeader}>
                  <div
                    className={calendarStyles.composerColorPreview}
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                  <label className={calendarStyles.composerColorHexLabel}>
                    <span>HEX</span>
                    <input
                      value={hexDraft}
                      onChange={(event) => setHexDraft(event.target.value)}
                      onBlur={handleHexCommit}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          handleHexCommit();
                        }
                      }}
                      inputMode="text"
                      autoComplete="off"
                      spellCheck={false}
                      disabled={isSubmitting}
                    />
                  </label>
                </div>

                <div className={calendarStyles.composerColorSliders} aria-label={t("RGB sliders")}>
                  <label>
                    <span>R</span>
                    <input
                      type="range"
                      min={0}
                      max={255}
                      value={rgb.red}
                      onChange={(event) =>
                        handleUpdateColorWithoutClosing(
                          rgbToHex(Number(event.target.value), rgb.green, rgb.blue)
                        )
                      }
                      disabled={isSubmitting}
                    />
                    <output>{rgb.red}</output>
                  </label>
                  <label>
                    <span>G</span>
                    <input
                      type="range"
                      min={0}
                      max={255}
                      value={rgb.green}
                      onChange={(event) =>
                        handleUpdateColorWithoutClosing(
                          rgbToHex(rgb.red, Number(event.target.value), rgb.blue)
                        )
                      }
                      disabled={isSubmitting}
                    />
                    <output>{rgb.green}</output>
                  </label>
                  <label>
                    <span>B</span>
                    <input
                      type="range"
                      min={0}
                      max={255}
                      value={rgb.blue}
                      onChange={(event) =>
                        handleUpdateColorWithoutClosing(
                          rgbToHex(rgb.red, rgb.green, Number(event.target.value))
                        )
                      }
                      disabled={isSubmitting}
                    />
                    <output>{rgb.blue}</output>
                  </label>
                </div>

                <div className={calendarStyles.composerColorPaletteSection}>
                  <h3>Earthy</h3>
                  <div className={calendarStyles.composerColorPaletteGrid}>
                    {EARTHY_PALETTE.map((swatch) => (
                      <button
                        key={`earthy-${swatch}`}
                        type="button"
                        className={calendarStyles.composerColorSwatch}
                        style={{ backgroundColor: swatch }}
                        data-active={color === swatch ? "true" : "false"}
                        onClick={() => handleSelectColor(swatch)}
                        aria-label={t("Select {color} color", { color: swatch })}
                        disabled={isSubmitting}
                      />
                    ))}
                  </div>
                </div>

                <div className={calendarStyles.composerColorPaletteSection}>
                  <h3>Pastel</h3>
                  <div className={calendarStyles.composerColorPaletteGrid}>
                    {PASTEL_PALETTE.map((swatch) => (
                      <button
                        key={`pastel-${swatch}`}
                        type="button"
                        className={calendarStyles.composerColorSwatch}
                        style={{ backgroundColor: swatch }}
                        data-active={color === swatch ? "true" : "false"}
                        onClick={() => handleSelectColor(swatch)}
                        aria-label={t("Select {color} color", { color: swatch })}
                        disabled={isSubmitting}
                      />
                    ))}
                  </div>
                </div>

                <div className={calendarStyles.composerColorPaletteSection}>
                  <h3>Neutrals</h3>
                  <div className={calendarStyles.composerColorPaletteGrid}>
                    {NEUTRAL_PALETTE.map((swatch) => (
                      <button
                        key={`neutral-${swatch}`}
                        type="button"
                        className={calendarStyles.composerColorSwatch}
                        style={{ backgroundColor: swatch }}
                        data-active={color === swatch ? "true" : "false"}
                        onClick={() => handleSelectColor(swatch)}
                        aria-label={t("Select {color} color", { color: swatch })}
                        disabled={isSubmitting}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </label>

        {error ? <div className={calendarStyles.composerSummary}>{error}</div> : null}
      </form>
    </div>
  );
}
