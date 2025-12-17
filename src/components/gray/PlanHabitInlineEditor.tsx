"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Bell, Calendar, ChevronDown, ChevronLeft, ChevronRight, Clock, Plus, X } from "lucide-react";
import calendarStyles from "@/components/calendar/GrayDashboardCalendar.module.css";
import { MiniMonth } from "@/components/calendar/MiniMonth";
import { useUser } from "@/contexts/UserContext";
import { useI18n } from "@/contexts/I18nContext";
import { apiService } from "@/lib/api";
import type { HabitItem, HabitUpdates, PlanItem, PlanUpdates } from "./types";

type ReminderPreset = "none" | "0" | "5" | "10" | "15" | "30" | "60" | "1440" | "custom";

const QUICK_COLOR_SWATCHES = [
  "#2F6B4F",
  "#3D6F73",
  "#B77A2B",
  "#C45A3C",
  "#7A5A3A",
  "#7A6A55",
  "#BEB5A7",
  "#8A7F73",
] as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const rgbToHex = (red: number, green: number, blue: number) =>
  `#${[red, green, blue]
    .map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();

const hexToRgb = (hex: string) => {
  const normalized = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return { red, green, blue };
};

const normalizeHex = (raw: string) => {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  const expanded =
    withHash.length === 4
      ? `#${withHash[1]}${withHash[1]}${withHash[2]}${withHash[2]}${withHash[3]}${withHash[3]}`
      : withHash;
  if (!/^#[0-9a-fA-F]{6}$/.test(expanded)) return null;
  return expanded.toUpperCase();
};

const hslToHex = (hue: number, saturation: number, lightness: number) => {
  const normalizedHue = ((hue % 360) + 360) % 360;
  const normalizedSaturation = clamp(saturation, 0, 100) / 100;
  const normalizedLightness = clamp(lightness, 0, 100) / 100;

  const chroma = (1 - Math.abs(2 * normalizedLightness - 1)) * normalizedSaturation;
  const huePrime = normalizedHue / 60;
  const secondComponent = chroma * (1 - Math.abs((huePrime % 2) - 1));
  const match = normalizedLightness - chroma / 2;

  const channelVariants: Array<[number, number, number]> = [
    [chroma, secondComponent, 0],
    [secondComponent, chroma, 0],
    [0, chroma, secondComponent],
    [0, secondComponent, chroma],
    [secondComponent, 0, chroma],
    [chroma, 0, secondComponent],
  ];

  const [redVariant, greenVariant, blueVariant] =
    channelVariants[Math.floor(clamp(huePrime, 0, 5.999))] ?? channelVariants[0];

  return rgbToHex(
    (redVariant + match) * 255,
    (greenVariant + match) * 255,
    (blueVariant + match) * 255
  );
};

const buildHslPalette = (options: {
  hues: number[];
  saturations: number[];
  lightnesses: number[];
}) => {
  const colors: string[] = [];
  for (const lightness of options.lightnesses) {
    for (const saturation of options.saturations) {
      for (const hue of options.hues) {
        colors.push(hslToHex(hue, saturation, lightness));
      }
    }
  }
  return Array.from(new Set(colors));
};

const EARTHY_PALETTE = buildHslPalette({
  hues: [18, 28, 40, 52, 75, 98, 130, 160, 190, 210, 240, 285, 320],
  saturations: [28, 38],
  lightnesses: [34, 44],
});

const PASTEL_PALETTE = buildHslPalette({
  hues: [16, 28, 40, 52, 75, 98, 130, 160, 190, 210, 240, 285, 320],
  saturations: [32, 44],
  lightnesses: [72, 80],
});

const NEUTRAL_PALETTE = [
  "#F3F0EA",
  "#E6DED3",
  "#D5CCBF",
  "#C2B8AA",
  "#A79D8F",
  "#8C8275",
  "#6F665B",
  "#574F46",
] as const;

const startOfDay = (value: Date) => {
  const result = new Date(value);
  result.setHours(0, 0, 0, 0);
  return result;
};

const startOfMonth = (value: Date) => {
  const result = startOfDay(value);
  result.setDate(1);
  return result;
};

const combineDateWithTime = (date: Date, timeValue: string) => {
  const [hours, minutes] = timeValue.split(":").map((value) => Number.parseInt(value, 10));
  const result = new Date(date);
  result.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return result;
};

const toDateTimeLocalString = (value: Date): string => {
  const offset = value.getTimezoneOffset();
  const normalized = new Date(value.getTime() - offset * 60000);
  return normalized.toISOString().slice(0, 16);
};

const splitScheduleSlot = (slot: string | null | undefined) => {
  if (!slot) {
    return null;
  }
  const match = slot.match(/^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/);
  if (!match) {
    return null;
  }
  return {
    start: match[1],
    end: match[2],
  };
};

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
  const reminderMenuRef = useRef<HTMLDivElement | null>(null);
  const reminderTriggerRef = useRef<HTMLButtonElement | null>(null);

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
  const [reminderMenuPosition, setReminderMenuPosition] = useState<{ top: number; left: number; width: number } | null>(
    null
  );
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

  const reminderOptions = useMemo(
    () =>
      [
        { value: "none", label: t("No reminder") },
        { value: "0", label: t("When event starts") },
        { value: "5", label: t("5 minutes before") },
        { value: "10", label: t("10 minutes before") },
        { value: "15", label: t("15 minutes before") },
        { value: "30", label: t("30 minutes before") },
        { value: "60", label: t("1 hour before") },
        { value: "1440", label: t("1 day before") },
        { value: "custom", label: t("Custom...") },
      ] satisfies ReadonlyArray<{ value: ReminderPreset; label: string }>,
    [t]
  );

  const reminderLabel = useMemo(() => {
    return reminderOptions.find((option) => option.value === reminderPreset)?.label ?? t("No reminder");
  }, [reminderOptions, reminderPreset, t]);

  useEffect(() => {
    if (!isColorPickerOpen) return;

    const handlePointerDown = (event: globalThis.MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (colorPickerTriggerRef.current?.contains(target)) return;
      if (colorPickerPopoverRef.current?.contains(target)) return;
      if (colorPickerRef.current?.contains(target)) return;
      setIsColorPickerOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsColorPickerOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isColorPickerOpen]);

  useEffect(() => {
    if (!isReminderMenuOpen) return;

    const handlePointerDown = (event: globalThis.MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (reminderTriggerRef.current?.contains(target)) return;
      if (reminderMenuRef.current?.contains(target)) return;
      setIsReminderMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsReminderMenuOpen(false);
      reminderTriggerRef.current?.focus();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isReminderMenuOpen]);

  useEffect(() => {
    if (!isReminderMenuOpen) return;
    const focusTarget = () => {
      const optionButton = reminderMenuRef.current?.querySelector<HTMLButtonElement>(
        `[data-reminder-option="${reminderPreset}"]`
      );
      optionButton?.focus();
    };
    const handle = requestAnimationFrame(focusTarget);
    return () => cancelAnimationFrame(handle);
  }, [isReminderMenuOpen, reminderPreset]);

  const updateReminderMenuPosition = useCallback(() => {
    if (!isReminderMenuOpen) return;
    const triggerRect = reminderTriggerRef.current?.getBoundingClientRect();
    const menuRect = reminderMenuRef.current?.getBoundingClientRect();
    if (!triggerRect || !menuRect) return;

    const viewportPadding = 12;
    const gap = 8;
    const maxWidth = Math.max(0, window.innerWidth - viewportPadding * 2);
    const desiredWidth = Math.max(220, triggerRect.width);
    const width = Math.min(desiredWidth, maxWidth);
    const left = clamp(triggerRect.left, viewportPadding, window.innerWidth - viewportPadding - width);

    const spaceBelow = window.innerHeight - triggerRect.bottom - viewportPadding;
    const spaceAbove = triggerRect.top - viewportPadding;
    const height = menuRect.height;
    const shouldOpenUp = spaceBelow < height && spaceAbove > spaceBelow;
    const top = shouldOpenUp ? Math.max(viewportPadding, triggerRect.top - gap - height) : triggerRect.bottom + gap;

    setReminderMenuPosition({ top, left, width });
  }, [isReminderMenuOpen]);

  useLayoutEffect(() => {
    if (!isReminderMenuOpen) {
      setReminderMenuPosition(null);
      return;
    }
    updateReminderMenuPosition();
  }, [isReminderMenuOpen, updateReminderMenuPosition]);

  useEffect(() => {
    if (!isReminderMenuOpen) return;

    const scheduleUpdate = () => {
      requestAnimationFrame(updateReminderMenuPosition);
    };

    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("scroll", scheduleUpdate, true);
    return () => {
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate, true);
    };
  }, [isReminderMenuOpen, updateReminderMenuPosition]);

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

    const reminderAt = editingItem.reminderAt;
    if (!reminderAt) {
      setReminderPreset("none");
      setCustomReminderMinutes("");
      return;
    }

    const remindAtMs = Date.parse(reminderAt);
    if (!Number.isFinite(remindAtMs)) {
      setReminderPreset("none");
      setCustomReminderMinutes("");
      return;
    }

    const deltaMinutes = Math.max(0, Math.round((eventStart.getTime() - remindAtMs) / 60000));
    const presets: Array<Exclude<typeof reminderPreset, "custom" | "none">> = [
      "0",
      "5",
      "10",
      "15",
      "30",
      "60",
      "1440",
    ];
    const matched = presets.find((value) => Number(value) === deltaMinutes);
    if (matched) {
      setReminderPreset(matched);
      setCustomReminderMinutes("");
    } else {
      setReminderPreset("custom");
      setCustomReminderMinutes(String(deltaMinutes));
    }
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
      const resolveReminderLeadMinutes = (): number | null => {
        if (reminderPreset === "none") {
          return null;
        }
        if (reminderPreset === "custom") {
          const parsed = Number.parseInt(customReminderMinutes.trim(), 10);
          if (!Number.isFinite(parsed) || parsed < 0) {
            return null;
          }
          return parsed;
        }
        return Number.parseInt(reminderPreset, 10);
      };
      const reminderLeadMinutes = resolveReminderLeadMinutes();
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
            await apiService.updatePlan(user.id, numericId, {
              label: payload.label,
              description: payload.details ?? null,
              deadline: payload.deadline ?? null,
              scheduleSlot: payload.scheduleSlot ?? null,
              reminderAt: payload.reminderAt ?? null,
              color: payload.color ?? null,
            });
          }
        } else {
          await apiService.createPlan(user.id, {
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
            await apiService.updateHabit(user.id, numericId, {
              label: payload.label,
              description: payload.details ?? null,
              reminderAt: payload.reminderAt ?? null,
            });
          }
        } else {
          await apiService.createHabit(user.id, {
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
	              {(() => {
	                const start = new Date(`2000-01-01T${startTime}`);
	                const end = new Date(`2000-01-01T${endTime}`);
	                let diff = end.getTime() - start.getTime();
	                if (!Number.isFinite(diff)) {
	                  return "";
	                }
	                if (diff < 0) {
	                  diff += 24 * 60 * 60 * 1000;
	                }
	                const totalMinutes = Math.floor(diff / 60000);
	                if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) {
	                  return "";
	                }
	                const hours = Math.floor(totalMinutes / 60);
	                const minutes = totalMinutes % 60;
	                if (hours <= 0) {
	                  return `${totalMinutes}m`;
	                }
	                if (minutes === 0) {
	                  return `${hours}h`;
	                }
	                return `${hours}h ${minutes}m`;
	              })()}
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

            <div className={calendarStyles.composerInlineSelect}>
              <button
                type="button"
                ref={reminderTriggerRef}
                className={`${calendarStyles.composerDateTrigger} ${calendarStyles.composerInlineSelectTrigger}`}
                onClick={() => {
                  setIsDatePickerOpen(false);
                  setIsReminderMenuOpen((previous) => !previous);
                }}
                aria-haspopup="listbox"
                aria-expanded={isReminderMenuOpen ? "true" : "false"}
                aria-label={t("Notification")}
                disabled={isSubmitting}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setIsReminderMenuOpen(true);
                  }
                }}
              >
                <Bell
                  size={14}
                  aria-hidden="true"
                  className={calendarStyles.composerInlineControlIcon}
                />
                <span className={calendarStyles.composerInlineControlLabel}>{reminderLabel}</span>
                <ChevronDown
                  size={14}
                  aria-hidden="true"
                  className={calendarStyles.composerInlineControlChevron}
                />
              </button>
              {isReminderMenuOpen ? (
                <div
                  ref={reminderMenuRef}
                  className={calendarStyles.composerInlineSelectPopover}
                  style={
                    reminderMenuPosition
                      ? {
                        top: reminderMenuPosition.top,
                        left: reminderMenuPosition.left,
                        width: reminderMenuPosition.width,
                      }
                      : undefined
                  }
                  role="listbox"
                  aria-label={t("Notification")}
                  tabIndex={-1}
                  onKeyDown={(event) => {
                    const optionButtons = Array.from(
                      reminderMenuRef.current?.querySelectorAll<HTMLButtonElement>(
                        "button[data-reminder-option]"
                      ) ?? []
                    );
                    if (optionButtons.length === 0) return;
                    const activeIndex = optionButtons.findIndex((button) => button === document.activeElement);
                    const selectedIndex = Math.max(
                      0,
                      reminderOptions.findIndex((option) => option.value === reminderPreset)
                    );
                    const currentIndex = activeIndex >= 0 ? activeIndex : selectedIndex;

                    if (event.key === "Escape") {
                      event.preventDefault();
                      setIsReminderMenuOpen(false);
                      reminderTriggerRef.current?.focus();
                      return;
                    }
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      optionButtons[(currentIndex + 1) % optionButtons.length]?.focus();
                      return;
                    }
                    if (event.key === "ArrowUp") {
                      event.preventDefault();
                      optionButtons[(currentIndex - 1 + optionButtons.length) % optionButtons.length]?.focus();
                      return;
                    }
                    if (event.key === "Home") {
                      event.preventDefault();
                      optionButtons[0]?.focus();
                      return;
                    }
                    if (event.key === "End") {
                      event.preventDefault();
                      optionButtons[optionButtons.length - 1]?.focus();
                    }
                  }}
                >
                  {reminderOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={option.value === reminderPreset}
                      data-reminder-option={option.value}
                      className={calendarStyles.composerInlineSelectOption}
                      onClick={() => {
                        setReminderPreset(option.value);
                        setIsReminderMenuOpen(false);
                        reminderTriggerRef.current?.focus();
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {reminderPreset === "custom" ? (
              <div className={calendarStyles.composerInlineNumber}>
                <Clock size={14} aria-hidden="true" className={calendarStyles.composerInlineControlIcon} />
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={customReminderMinutes}
                  onChange={(event) => setCustomReminderMinutes(event.target.value)}
                  placeholder="30"
                  aria-label={t("Minutes before")}
                  className={calendarStyles.composerInlineNumberInput}
                  disabled={isSubmitting}
                />
                <span className={calendarStyles.composerInlineNumberSuffix} aria-hidden="true">
                  min
                </span>
              </div>
            ) : null}
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
