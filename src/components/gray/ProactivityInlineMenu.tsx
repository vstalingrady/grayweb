"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Plus, Pencil, X } from "lucide-react";
import calendarStyles from "@/components/calendar/GrayDashboardCalendar.module.css";
import styles from "@/app/gray/GrayPageClient.module.css";
import { useI18n } from "@/contexts/I18nContext";
import { useDismissableLayer } from "@/components/gray/hooks/useDismissableLayer";
import { type ProactivityItem } from "./types";
import {
  CUSTOM_PROACTIVITY_ID,
  DEFAULT_CUSTOM_SETTINGS,
  DEFAULT_PROACTIVITY_TIME,
  PROACTIVITY_PRESETS,
  DEFAULT_PROACTIVITY_MESSAGE_LENGTH,
  PROACTIVITY_MESSAGE_LENGTH_OPTIONS,
  type ProactivityMessageLength,
  buildCustomProactivityItem,
  dedupeTimes,
  findNextCustomTime,
  formatCustomTimeLabel,
  normalizeTimeForInput,
} from "./proactivityUtils";

type ProactivityInlineMenuProps = {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  activeProactivity?: ProactivityItem | null;
  activeProactivityTimes: string[];
  onSelectProactivity: (next: ProactivityItem) => void;
  onRemoveProactivity: () => void;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function ProactivityInlineMenu({
  isOpen,
  onClose,
  anchorRef,
  activeProactivity,
  activeProactivityTimes,
  onSelectProactivity,
  onRemoveProactivity,
}: ProactivityInlineMenuProps) {
  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <ProactivityInlineMenuContent
      isOpen={isOpen}
      onClose={onClose}
      anchorRef={anchorRef}
      activeProactivity={activeProactivity}
      activeProactivityTimes={activeProactivityTimes}
      onSelectProactivity={onSelectProactivity}
      onRemoveProactivity={onRemoveProactivity}
    />,
    document.body
  );
}

function ProactivityInlineMenuContent({
  isOpen,
  onClose,
  anchorRef,
  activeProactivity,
  activeProactivityTimes,
  onSelectProactivity,
  onRemoveProactivity,
}: ProactivityInlineMenuProps) {
  const { t } = useI18n();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const presetTriggerRef = useRef<HTMLButtonElement | null>(null);
  const presetMenuRef = useRef<HTMLDivElement | null>(null);
  const [isPresetMenuOpen, setIsPresetMenuOpen] = useState(false);

  const activeProactivityId = activeProactivity?.id ?? "";
  const initialPresetId = useMemo(() => {
    if (activeProactivityId && PROACTIVITY_PRESETS.some((preset) => preset.id === activeProactivityId)) {
      return activeProactivityId;
    }
    if (activeProactivityId === CUSTOM_PROACTIVITY_ID) {
      return CUSTOM_PROACTIVITY_ID;
    }
    if (!activeProactivity) {
      return "off";
    }
    return "";
  }, [activeProactivity, activeProactivityId]);

  const [selectedPresetId, setSelectedPresetId] = useState<string>(() => initialPresetId);
  const [customTimes, setCustomTimes] = useState<string[]>(() =>
    activeProactivityTimes.length > 0 ? activeProactivityTimes : [...DEFAULT_CUSTOM_SETTINGS.times]
  );
  const [messageLength, setMessageLength] = useState<ProactivityMessageLength>(
    () => activeProactivity?.messageLength ?? DEFAULT_PROACTIVITY_MESSAGE_LENGTH
  );
  const [editingCustomTimeIndex, setEditingCustomTimeIndex] = useState<number | null>(null);
  const [editingCustomTimeDraft, setEditingCustomTimeDraft] = useState<string>("");

  const isCustomPresetSelected = selectedPresetId === CUSTOM_PROACTIVITY_ID;

  useEffect(() => {
    if (activeProactivity?.messageLength) {
      setMessageLength(activeProactivity.messageLength);
    }
  }, [activeProactivity?.messageLength]);

  useLayoutEffect(() => {
    const anchorEl = anchorRef.current;
    const panelEl = panelRef.current;
    if (!anchorEl || !panelEl) {
      return;
    }

    const update = () => {
      const anchorRect = anchorEl.getBoundingClientRect();
      const panelRect = panelEl.getBoundingClientRect();
      const viewportPadding = 12;
      const gap = 10;

      const top = clamp(
        anchorRect.top - gap - panelRect.height,
        viewportPadding,
        window.innerHeight - viewportPadding - panelRect.height
      );

      const left = clamp(
        anchorRect.left,
        viewportPadding,
        window.innerWidth - viewportPadding - panelRect.width
      );

      panelEl.style.top = `${Math.round(top)}px`;
      panelEl.style.left = `${Math.round(left)}px`;
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchorRef, selectedPresetId, customTimes.length, isPresetMenuOpen]);

  useLayoutEffect(() => {
    if (!isPresetMenuOpen) {
      return;
    }

    const triggerEl = presetTriggerRef.current;
    const menuEl = presetMenuRef.current;
    if (!triggerEl || !menuEl) {
      return;
    }

    const update = () => {
      const triggerRect = triggerEl.getBoundingClientRect();
      const viewportPadding = 12;
      const gap = 8;

      const width = Math.round(triggerRect.width);
      menuEl.style.width = `${width}px`;

      const menuRect = menuEl.getBoundingClientRect();

      const preferredTop = triggerRect.bottom + gap;
      const canPlaceBelow = preferredTop + menuRect.height <= window.innerHeight - viewportPadding;
      const top = canPlaceBelow
        ? preferredTop
        : clamp(triggerRect.top - gap - menuRect.height, viewportPadding, window.innerHeight - viewportPadding - menuRect.height);

      const left = clamp(triggerRect.left, viewportPadding, window.innerWidth - viewportPadding - width);

      menuEl.style.top = `${Math.round(top)}px`;
      menuEl.style.left = `${Math.round(left)}px`;
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [isPresetMenuOpen, selectedPresetId]);

  useDismissableLayer({
    isOpen,
    ignoreRefs: [anchorRef, panelRef],
    onDismiss: onClose,
  });

  const applyCustomProactivity = useCallback(
    (nextTimes: string[]) => {
      onSelectProactivity(buildCustomProactivityItem(nextTimes, messageLength));
    },
    [messageLength, onSelectProactivity]
  );

  const presetOptions = useMemo(() => {
    return [
      { id: "off", label: t("Off") },
      ...PROACTIVITY_PRESETS.map((preset) => ({ id: preset.id, label: t(preset.title) })),
      { id: CUSTOM_PROACTIVITY_ID, label: t("Custom") },
    ];
  }, [t]);

  const selectedPresetLabel = useMemo(() => {
    return presetOptions.find((option) => option.id === selectedPresetId)?.label ?? t("Off");
  }, [presetOptions, selectedPresetId, t]);

  const handlePresetSelect = useCallback(
    (nextId: string) => {
      setSelectedPresetId(nextId);

      if (nextId === "off") {
        onRemoveProactivity();
        setIsPresetMenuOpen(false);
        onClose();
        return;
      }

      if (nextId === CUSTOM_PROACTIVITY_ID) {
        setIsPresetMenuOpen(false);
        applyCustomProactivity(customTimes);
        return;
      }

      const preset = PROACTIVITY_PRESETS.find((option) => option.id === nextId);
      if (!preset) {
        return;
      }

      const presetTimes =
        preset.defaultTimes && preset.defaultTimes.length > 0
          ? dedupeTimes(preset.defaultTimes)
          : dedupeTimes([preset.defaultTime ?? DEFAULT_PROACTIVITY_TIME]);
      const primaryTime = presetTimes[0] ?? DEFAULT_PROACTIVITY_TIME;

      onSelectProactivity({
        id: preset.id,
        label: preset.label,
        description: preset.description,
        cadence: preset.cadence,
        time: primaryTime,
        times: presetTimes,
        messageLength,
      });
      setIsPresetMenuOpen(false);
      onClose();
    },
    [applyCustomProactivity, customTimes, messageLength, onClose, onRemoveProactivity, onSelectProactivity]
  );

  const handleMessageLengthSelect = useCallback(
    (next: ProactivityMessageLength) => {
      setMessageLength(next);
      if (activeProactivity) {
        onSelectProactivity({
          ...activeProactivity,
          messageLength: next,
        });
      }
    },
    [activeProactivity, onSelectProactivity]
  );

  const handleCustomTimeEdit = useCallback(
    (index: number) => {
      setEditingCustomTimeIndex(index);
      setEditingCustomTimeDraft(customTimes[index] ?? DEFAULT_PROACTIVITY_TIME);
    },
    [customTimes]
  );

  const commitCustomTimeEdit = useCallback(
    (index: number, draftValue: string) => {
      setCustomTimes((previous) => {
        const nextTimes = [...previous];
        const previousValue = nextTimes[index] ?? DEFAULT_PROACTIVITY_TIME;
        const normalized = normalizeTimeForInput(draftValue || previousValue);
        nextTimes[index] = normalized;
        const finalTimes = dedupeTimes(nextTimes);
        applyCustomProactivity(finalTimes);
        return finalTimes;
      });
      setEditingCustomTimeIndex(null);
      setEditingCustomTimeDraft("");
    },
    [applyCustomProactivity]
  );

  const handleCustomTimeAdd = useCallback(() => {
    const nextTime = findNextCustomTime(customTimes);
    const nextTimes = [...customTimes, nextTime];
    setCustomTimes(nextTimes);
    setEditingCustomTimeIndex(nextTimes.length - 1);
    setEditingCustomTimeDraft(nextTime);
    applyCustomProactivity(nextTimes);
  }, [applyCustomProactivity, customTimes]);

  const handleCustomTimeRemove = useCallback(
    (index: number) => {
      const nextTimes = customTimes.filter((_, currentIndex) => currentIndex !== index);
      const finalTimes = nextTimes.length > 0 ? nextTimes : [...DEFAULT_CUSTOM_SETTINGS.times];
      setCustomTimes(finalTimes);
      setEditingCustomTimeIndex(null);
      setEditingCustomTimeDraft("");
      applyCustomProactivity(finalTimes);
    },
    [applyCustomProactivity, customTimes]
  );

  const panel = (
    <div
      ref={panelRef}
      className={calendarStyles.composerColorPopover}
      style={{ width: "min(420px, 92vw)" }}
      role="dialog"
      aria-label={t("Proactivity")}
    >
      <div className={calendarStyles.composerColorPopoverHeader}>
        <span style={{ fontSize: "0.86rem", color: "rgba(240, 240, 240, 0.88)" }}>{t("Proactivity")}</span>
        <button
          type="button"
          className={styles.listItemActionButton}
          onClick={onClose}
          aria-label={t("Close proactivity options")}
        >
          <X size={14} />
        </button>
      </div>

      <div className={calendarStyles.composerInlineSelect} style={{ marginBottom: 14 }}>
        <button
          type="button"
          ref={presetTriggerRef}
          className={`${calendarStyles.composerDateTrigger} ${calendarStyles.composerInlineSelectTrigger}`}
          onClick={() => setIsPresetMenuOpen((previous) => !previous)}
          aria-haspopup="listbox"
          aria-expanded={isPresetMenuOpen ? "true" : "false"}
          aria-label={t("Preset cadence")}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setIsPresetMenuOpen(true);
            }
          }}
        >
          <span className={calendarStyles.composerInlineControlLabel}>{selectedPresetLabel}</span>
          <ChevronDown size={14} aria-hidden="true" className={calendarStyles.composerInlineControlChevron} />
        </button>
        {isPresetMenuOpen ? (
          <div
            ref={presetMenuRef}
            className={calendarStyles.composerInlineSelectPopover}
            role="listbox"
            aria-label={t("Preset cadence")}
            tabIndex={-1}
            onKeyDown={(event) => {
              const optionButtons = Array.from(
                presetMenuRef.current?.querySelectorAll<HTMLButtonElement>("button[data-proactivity-option]") ?? []
              );
              if (optionButtons.length === 0) return;
              const activeIndex = optionButtons.findIndex((button) => button === document.activeElement);
              const selectedIndex = Math.max(0, presetOptions.findIndex((option) => option.id === selectedPresetId));
              const currentIndex = activeIndex >= 0 ? activeIndex : selectedIndex;

              if (event.key === "Escape") {
                event.preventDefault();
                setIsPresetMenuOpen(false);
                presetTriggerRef.current?.focus();
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
            {presetOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={option.id === selectedPresetId}
                data-proactivity-option={option.id}
                className={calendarStyles.composerInlineSelectOption}
                onClick={() => {
                  handlePresetSelect(option.id);
                  presetTriggerRef.current?.focus();
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {isCustomPresetSelected ? (
        <section className={styles.proactivityCustomSection} style={{ padding: 0, border: "none" }}>
          <header className={styles.proactivityCustomHeader} style={{ marginTop: 10 }}>
            <div>
              <span className={styles.proactivityCustomEyebrow}>{t("Custom setup")}</span>
            </div>
          </header>
          <div className={styles.proactivityCustomControls}>
            <div className={styles.proactivityCustomField}>
              <div className={styles.proactivityTimes}>
                {customTimes.map((time, index) => (
                  <div key={`${time}-${index}`} className={styles.proactivityTimeListItem}>
                    {editingCustomTimeIndex === index ? (
                      <input
                        type="time"
                        value={editingCustomTimeDraft}
                        onChange={(event) => setEditingCustomTimeDraft(event.target.value)}
                        className={styles.proactivityTimeInput}
                        autoFocus
                        step={300}
                        onBlur={() => commitCustomTimeEdit(index, editingCustomTimeDraft)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === "Escape") {
                            event.preventDefault();
                            commitCustomTimeEdit(index, editingCustomTimeDraft);
                          }
                        }}
                        aria-label={t("Edit custom start time {time}", { time })}
                      />
                    ) : (
                      <button
                        type="button"
                        className={styles.proactivityTimeListButton}
                        onClick={() => handleCustomTimeEdit(index)}
                      >
                        <span className={styles.proactivityTimeLabel}>{t(formatCustomTimeLabel(time))}</span>
                      </button>
                    )}
                    <div className={styles.proactivityTimeActions}>
                      <button
                        type="button"
                        className={styles.listItemActionButton}
                        onClick={() => handleCustomTimeEdit(index)}
                        aria-label={t("Edit custom start time {time}", { time })}
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        className={styles.listItemActionButton}
                        onClick={() => handleCustomTimeRemove(index)}
                        aria-label={t("Remove custom start time {time}", { time })}
                        disabled={customTimes.length <= 1}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                ))}
                <button type="button" className={styles.proactivityTimeAdd} onClick={handleCustomTimeAdd}>
                  <Plus size={14} />
                  <span>{t("Add time")}</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : null}
      <section className={styles.proactivityCustomSection} style={{ padding: 0, border: "none" }}>
        <header className={styles.proactivityCustomHeader} style={{ marginTop: 14 }}>
          <div>
            <span className={styles.proactivityCustomEyebrow}>{t("Message length")}</span>
            <h3 className={styles.proactivityCustomTitle}>{t("How long should check-ins be?")}</h3>
          </div>
        </header>
        <div className={styles.proactivityLengthOptions}>
          {PROACTIVITY_MESSAGE_LENGTH_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={styles.proactivityLengthOption}
              data-active={messageLength === option.id ? "true" : "false"}
              onClick={() => handleMessageLengthSelect(option.id)}
            >
              {t(option.label)}
            </button>
          ))}
        </div>
      </section>
      <footer className={styles.proactivityModalFooter} style={{ marginTop: 16 }}>
        <button type="button" className={styles.proactivityModalDismiss} onClick={onClose}>
          {t("Done")}
        </button>
      </footer>
    </div>
  );

  return panel;
}
