"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import { Bell, ChevronDown, Clock } from "lucide-react";

import calendarStyles from "@/components/calendar/GrayDashboardCalendar.module.css";
import { useDismissableLayer } from "@/components/gray/hooks/useDismissableLayer";
import { useI18n } from "@/contexts/I18nContext";

import { clamp } from "./colorUtils";
import type { ReminderPreset } from "./reminderUtils";

type ReminderControlsProps = {
  reminderPreset: ReminderPreset;
  setReminderPreset: Dispatch<SetStateAction<ReminderPreset>>;
  customReminderMinutes: string;
  setCustomReminderMinutes: Dispatch<SetStateAction<string>>;
  isSubmitting: boolean;
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  onBeforeToggle: () => void;
};

export function ReminderControls({
  reminderPreset,
  setReminderPreset,
  customReminderMinutes,
  setCustomReminderMinutes,
  isSubmitting,
  isOpen,
  setIsOpen,
  onBeforeToggle,
}: ReminderControlsProps) {
  const { t } = useI18n();

  const reminderMenuRef = useRef<HTMLDivElement | null>(null);
  const reminderTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [reminderMenuPosition, setReminderMenuPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

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

  const closeReminderMenu = useCallback(() => {
    setIsOpen(false);
  }, [setIsOpen]);

  const reminderMenuDismissRefs = useMemo(() => [reminderTriggerRef, reminderMenuRef], []);

  const handleReminderMenuEscape = useCallback(() => {
    closeReminderMenu();
    reminderTriggerRef.current?.focus();
  }, [closeReminderMenu]);

  useDismissableLayer({
    isOpen,
    ignoreRefs: reminderMenuDismissRefs,
    onDismiss: closeReminderMenu,
    onEscape: handleReminderMenuEscape,
  });

  useEffect(() => {
    if (!isOpen) return;
    const focusTarget = () => {
      const optionButton = reminderMenuRef.current?.querySelector<HTMLButtonElement>(
        `[data-reminder-option="${reminderPreset}"]`
      );
      optionButton?.focus();
    };
    const handle = requestAnimationFrame(focusTarget);
    return () => cancelAnimationFrame(handle);
  }, [isOpen, reminderPreset]);

  const updateReminderMenuPosition = useCallback(() => {
    if (!isOpen) return;
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
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const handle = requestAnimationFrame(updateReminderMenuPosition);
    return () => cancelAnimationFrame(handle);
  }, [isOpen, updateReminderMenuPosition]);

  useEffect(() => {
    if (!isOpen) return;

    const scheduleUpdate = () => {
      requestAnimationFrame(updateReminderMenuPosition);
    };

    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("scroll", scheduleUpdate, true);
    return () => {
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate, true);
    };
  }, [isOpen, updateReminderMenuPosition]);

  return (
    <>
      <div className={calendarStyles.composerInlineSelect}>
        <button
          type="button"
          ref={reminderTriggerRef}
          className={`${calendarStyles.composerDateTrigger} ${calendarStyles.composerInlineSelectTrigger}`}
          onClick={() => {
            onBeforeToggle();
            setIsOpen((previous) => !previous);
          }}
          aria-haspopup="listbox"
          aria-expanded={isOpen ? "true" : "false"}
          aria-label={t("Notification")}
          disabled={isSubmitting}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onBeforeToggle();
              setIsOpen(true);
            }
          }}
        >
          <Bell size={14} aria-hidden="true" className={calendarStyles.composerInlineControlIcon} />
          <span className={calendarStyles.composerInlineControlLabel}>{reminderLabel}</span>
          <ChevronDown
            size={14}
            aria-hidden="true"
            className={calendarStyles.composerInlineControlChevron}
          />
        </button>
        {isOpen ? (
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
                closeReminderMenu();
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
                  closeReminderMenu();
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
    </>
  );
}
