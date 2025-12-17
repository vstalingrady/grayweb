/* eslint-disable react-hooks/set-state-in-effect */
import {
  FormEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import type { MouseEvent } from "react";
import type { CSSProperties } from "react";

import styles from "./GrayDashboardCalendar.module.css";
import { EventComposerColorPicker } from "./EventComposerColorPicker";
import { EventComposerDatePicker } from "./EventComposerDatePicker";
import {
  CalendarEntryType,
  CalendarEvent,
  CalendarInfo,
} from "./types";
import { ArrowRight, ChevronDown, X } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import {
  DEFAULT_COLORS,
  clamp,
  combineDateWithTime,
  formatDurationLabel,
  formatTimeInput,
  isPointerEventInside,
  normalizeHex,
  startOfDay,
  startOfMonth,
} from "./eventComposerUtils";

import type { ComposerState, EventComposerPayload } from "./eventComposerState";
import {
  DEFAULT_EVENT_DURATION_MINUTES,
  DEFAULT_STATE,
  ENTRY_TYPE_LABELS,
  VISIBLE_ENTRY_TYPES,
  composerReducer,
  resolveStateFromEvent,
} from "./eventComposerState";

export type { ComposerState, EventComposerPayload };
export { DEFAULT_EVENT_DURATION_MINUTES };

type AnchorRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type EventComposerProps = {
  isOpen: boolean;
  referenceDate: Date;
  activeEvent?: CalendarEvent | null;
  initialRange?: { start: Date; end: Date } | null;
  calendars: CalendarInfo[];
  onRequestClose: () => void;
  onSubmit: (payload: EventComposerPayload) => void;
  onDelete?: (eventId: string) => void;
  anchorRect?: AnchorRect | null;
  onStateChange?: (state: ComposerState) => void;
};

export function EventComposer({
  isOpen,
  referenceDate,
  activeEvent,
  initialRange = null,
  calendars,
  onRequestClose,
  onSubmit,
  onStateChange,
  onDelete,
  anchorRect = null,
}: EventComposerProps) {
  const { t } = useI18n();
  const calendarFallbackId = useMemo(
    () => calendars[0]?.id ?? "default",
    [calendars]
  );

  const [state, dispatch] = useReducer(composerReducer, {
    ...DEFAULT_STATE,
    title: "",
    calendarId: calendarFallbackId,
  });
  const cardRef = useRef<HTMLDivElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const colorPickerRef = useRef<HTMLDivElement | null>(null);
  const colorPickerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const colorPickerPopoverRef = useRef<HTMLDivElement | null>(null);
  const datePickerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const datePickerPopoverRef = useRef<HTMLDivElement | null>(null);
  const [anchoredPosition, setAnchoredPosition] = useState<{ top: number; left: number } | null>(null);
  const [anchorSide, setAnchorSide] = useState<"left" | "right" | null>(null);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [hexDraft, setHexDraft] = useState(DEFAULT_STATE.color);
  const [colorPickerPosition, setColorPickerPosition] = useState<{ top: number; left: number } | null>(
    null
  );
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [datePickerPosition, setDatePickerPosition] = useState<{ top: number; left: number } | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(referenceDate));
  const [monthDate, setMonthDate] = useState(() => startOfMonth(referenceDate));
  const activeEventId = activeEvent?.id;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const initialDateSource = activeEvent?.start ?? initialRange?.start ?? referenceDate;
    const normalizedInitialDate = startOfDay(initialDateSource);
    setSelectedDate(normalizedInitialDate);
    setMonthDate(startOfMonth(normalizedInitialDate));

    if (activeEvent) {
      dispatch({ type: "reset", payload: resolveStateFromEvent(activeEvent, calendarFallbackId) });
      return;
    }

    if (initialRange) {
      dispatch({
        type: "reset",
        payload: {
          ...DEFAULT_STATE,
          title: "",
          calendarId: calendarFallbackId,
          startTime: formatTimeInput(initialRange.start),
          endTime: formatTimeInput(initialRange.end),
          details: "",
          reminderMinutesBefore: null,
        },
      });
      return;
    }

    dispatch({
      type: "reset",
      payload: {
        ...DEFAULT_STATE,
        title: "",
        calendarId: calendarFallbackId,
        details: "",
        reminderMinutesBefore: null,
      },
    });
  }, [activeEvent, calendarFallbackId, initialRange, isOpen, referenceDate]);

  useLayoutEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!isOpen || !anchorRect) {
      setAnchoredPosition(null);
      setAnchorSide(null);
      return;
    }

    const updatePosition = () => {
      if (!anchorRect) {
        setAnchoredPosition(null);
        setAnchorSide(null);
        return;
      }

      const card = cardRef.current;
      const cardRect = card?.getBoundingClientRect();
      const cardWidth = cardRect?.width ?? 360;
      const cardHeight = cardRect?.height ?? 420;
      const padding = 16;
      const maxLeft = Math.max(padding, window.innerWidth - padding - cardWidth);
      const preferredRight = anchorRect.left + anchorRect.width + padding;
      let left = Math.min(preferredRight, maxLeft);
      let side: "left" | "right" = "right";

      if (preferredRight > maxLeft) {
        const altLeft = anchorRect.left - cardWidth - padding;
        left = Math.min(Math.max(padding, altLeft), maxLeft);
        side = "left";
      } else {
        left = Math.max(padding, left);
      }

      let top = anchorRect.top + anchorRect.height / 2 - cardHeight / 2;
      const maxTop = Math.max(padding, window.innerHeight - padding - cardHeight);
      top = Math.min(Math.max(padding, top), maxTop);

      setAnchoredPosition({ top, left });
      setAnchorSide(side);
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [anchorRect, isOpen, state.entryType, state.startTime, state.endTime, state.details, state.title]);

  const isHabit = state.entryType === "habit";
  const showReminderControl = state.entryType === "event";

  useEffect(() => {
    if (isHabit) {
      setIsDatePickerOpen(false);
    }
  }, [isHabit]);

  const handleSelectEntryType = (nextType: CalendarEntryType) => {
    if (state.entryType === nextType) {
      return;
    }
    const payload: Partial<ComposerState> = {
      entryType: nextType,
      color: DEFAULT_COLORS[nextType], // Apply default color for the new type
    };
    dispatch({ type: "update", payload });
  };

  const currentStart = useMemo(
    () => combineDateWithTime(selectedDate, state.startTime),
    [selectedDate, state.startTime]
  );
  const currentEnd = useMemo(() => {
    return combineDateWithTime(selectedDate, state.endTime);
  }, [selectedDate, state.endTime]);

  const closeWithOptionalAutoCreate = useCallback(
    (options?: { allowAutoCreate?: boolean }) => {
      const allowAutoCreate = options?.allowAutoCreate ?? true;

      if (!allowAutoCreate) {
        onRequestClose();
        return;
      }

      const trimmedTitle = state.title.trim();

      if (activeEventId || trimmedTitle.length === 0) {
        onRequestClose();
        return;
      }

      const start = currentStart;
      const rawEnd = currentEnd;
      const normalizedEnd =
        rawEnd <= start
          ? new Date(start.getTime() + DEFAULT_EVENT_DURATION_MINUTES * 60000)
          : rawEnd;

      onSubmit({
        id: activeEvent?.id,
        title: trimmedTitle || t("Untitled"),
        start,
        end: normalizedEnd,
        color: state.color,
        entryType: state.entryType,
        calendarId: state.calendarId,
        description: state.details.trim() ? state.details.trim() : undefined,
        reminderMinutesBefore: showReminderControl ? state.reminderMinutesBefore : null,
      });

      onRequestClose();
    },
    [
      activeEvent,
      activeEventId,
      currentEnd,
      currentStart,
      onRequestClose,
      onSubmit,
      showReminderControl,
      state.calendarId,
      state.color,
      state.details,
      state.entryType,
      state.reminderMinutesBefore,
      state.title,
      t,
    ]
  );

  useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const start = currentStart;
    const rawEnd = currentEnd;
    const normalizedEnd =
      rawEnd <= start
        ? new Date(start.getTime() + DEFAULT_EVENT_DURATION_MINUTES * 60000)
        : rawEnd;

    onSubmit({
      id: activeEvent?.id,
      title: state.title.trim() || t("Untitled"),
      start,
      end: normalizedEnd,
      color: state.color,
      entryType: state.entryType,
      calendarId: state.calendarId,
      description: state.details.trim() ? state.details.trim() : undefined,
      reminderMinutesBefore: showReminderControl ? state.reminderMinutesBefore : null,
    });
    onRequestClose();
  };

  const handleDelete = useCallback(() => {
    if (!activeEventId) {
      return;
    }
    onDelete?.(activeEventId);
  }, [activeEventId, onDelete]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeWithOptionalAutoCreate();
        return;
      }
      if (event.key === "Delete" && activeEventId) {
        event.preventDefault();
        handleDelete();
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
  }, [activeEventId, closeWithOptionalAutoCreate, handleDelete, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setIsColorPickerOpen(false);
      setIsDatePickerOpen(false);
    }
  }, [isOpen]);

  useEffect(() => {
    setHexDraft(state.color);
  }, [state.color]);

  useEffect(() => {
    if (!isDatePickerOpen) return;

    const handlePointerDown = (event: globalThis.PointerEvent) => {
      if (isPointerEventInside(event, datePickerTriggerRef.current)) return;
      if (isPointerEventInside(event, datePickerPopoverRef.current)) return;
      setIsDatePickerOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsDatePickerOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown, { capture: true });
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, { capture: true });
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDatePickerOpen]);

  useEffect(() => {
    if (!isColorPickerOpen) return;

    const handlePointerDown = (event: globalThis.PointerEvent) => {
      if (isPointerEventInside(event, colorPickerRef.current)) return;
      setIsColorPickerOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsColorPickerOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown, { capture: true });
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, { capture: true });
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isColorPickerOpen]);

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

  useLayoutEffect(() => {
    if (!isDatePickerOpen) {
      setDatePickerPosition(null);
      return;
    }

    const viewportPadding = 12;
    const gap = 10;

    const updatePosition = () => {
      const triggerRect = datePickerTriggerRef.current?.getBoundingClientRect();
      if (!triggerRect) return;

      const popoverRect = datePickerPopoverRef.current?.getBoundingClientRect();
      const popoverWidth = popoverRect?.width ?? 320;
      const popoverHeight = popoverRect?.height ?? 340;

      const maxLeft = window.innerWidth - viewportPadding - popoverWidth;
      const preferredLeftOfTrigger = triggerRect.left - gap - popoverWidth;
      const preferredRightAligned = triggerRect.right - popoverWidth;

      const left =
        preferredLeftOfTrigger >= viewportPadding
          ? Math.min(preferredLeftOfTrigger, maxLeft)
          : clamp(preferredRightAligned, viewportPadding, maxLeft);

      const preferredTop = triggerRect.bottom + gap;
      const canPlaceBelow = preferredTop + popoverHeight <= window.innerHeight - viewportPadding;
      const top = canPlaceBelow
        ? preferredTop
        : clamp(
          triggerRect.top - gap - popoverHeight,
          viewportPadding,
          window.innerHeight - viewportPadding - popoverHeight
        );

      setDatePickerPosition({ top, left });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [isDatePickerOpen, monthDate]);

  const colorPopoverStyle = useMemo<CSSProperties | undefined>(() => {
    if (!colorPickerPosition) return undefined;
    return { top: `${colorPickerPosition.top}px`, left: `${colorPickerPosition.left}px` };
  }, [colorPickerPosition]);

  const datePopoverStyle = useMemo<CSSProperties | undefined>(() => {
    if (!datePickerPosition) return undefined;
    return { top: `${datePickerPosition.top}px`, left: `${datePickerPosition.left}px` };
  }, [datePickerPosition]);

  if (!isOpen) {
    return null;
  }

  const handleSelectColor = (colorValue: string) => {
    dispatch({ type: "update", payload: { color: colorValue } });
    setIsColorPickerOpen(false);
  };

  const handleUpdateColorWithoutClosing = (colorValue: string) => {
    dispatch({ type: "update", payload: { color: colorValue } });
  };

  const handleHexCommit = () => {
    const normalized = normalizeHex(hexDraft);
    if (!normalized) {
      setHexDraft(state.color);
      return;
    }
    handleSelectColor(normalized);
  };

  const overlayClassName = [
    styles.composerOverlay,
    anchoredPosition ? styles.composerOverlayAnchored : null,
  ]
    .filter(Boolean)
    .join(" ");

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      closeWithOptionalAutoCreate();
    }
  };

  return (
    <div
      className={overlayClassName}
      role="dialog"
      aria-modal="true"
      onClick={handleOverlayClick}
    >
      <div
        ref={cardRef}
        className={styles.composerCard}
        data-anchored={anchoredPosition ? "true" : "false"}
        data-anchor-side={anchorSide ?? undefined}
        style={
          anchoredPosition
            ? {
              position: "fixed",
              top: `${anchoredPosition.top}px`,
              left: `${anchoredPosition.left}px`,
            }
            : undefined
        }
      >
        <div className={styles.composerHeader}>
          <div className={styles.composerHeaderTypeSelect}>
            <select
              value={state.entryType}
              onChange={(event) =>
                handleSelectEntryType(event.target.value as CalendarEntryType)
              }
              className={styles.composerHeaderSelect}
            >
              {(() => {
                const entryTypes = VISIBLE_ENTRY_TYPES.includes(state.entryType)
                  ? VISIBLE_ENTRY_TYPES
                  : [state.entryType, ...VISIBLE_ENTRY_TYPES];
                return entryTypes.map((type) => (
                  <option
                    key={type}
                    value={type}
                    disabled={!VISIBLE_ENTRY_TYPES.includes(type)}
                  >
                    {t(ENTRY_TYPE_LABELS[type])}
                  </option>
                ));
              })()}
            </select>
            <ChevronDown size={16} className={styles.composerHeaderSelectArrow} />
          </div>
          <button
            type="button"
            onClick={() => closeWithOptionalAutoCreate()}
            aria-label={t("Close dialog")}
            className={styles.composerCloseButton}
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className={styles.composerForm}>
          <button type="submit" style={{ display: "none" }} aria-hidden="true" tabIndex={-1} />
          <div className={styles.composerTitleRow}>
            <input
              type="text"
              value={state.title}
              onChange={(event) =>
                dispatch({ type: "update", payload: { title: event.target.value } })
              }
              placeholder={t("Title")}
              className={styles.composerTitleInput}
            />
          </div>
          {!isHabit ? (
            <>
              <div className={styles.composerTimeSection}>
                <div className={styles.composerTimeRow}>
                  <div className={styles.composerTimeInputGroup}>
                    <input
                      type="time"
                      value={state.startTime}
                      onChange={(event) =>
                        dispatch({ type: "update", payload: { startTime: event.target.value } })
                      }
                      className={styles.composerTimeInput}
                      required
                    />
                    <ArrowRight size={14} className={styles.composerTimeArrow} />
                    <input
                      type="time"
                      value={state.endTime}
                      onChange={(event) =>
                        dispatch({ type: "update", payload: { endTime: event.target.value } })
                      }
                      className={styles.composerTimeInput}
                      required
                    />
                  </div>
		                  <span className={styles.composerDuration}>
		                    {formatDurationLabel(state.startTime, state.endTime)}
		                  </span>
                </div>
                {showReminderControl ? (
                  <div className={styles.composerField}>
                    <span>{t("Notification")}</span>
                    <select
                      value={state.reminderMinutesBefore === null ? "" : String(state.reminderMinutesBefore)}
                      onChange={(event) => {
                        const raw = event.target.value;
                        const next = raw ? Number.parseInt(raw, 10) : null;
                        dispatch({
                          type: "update",
                          payload: {
                            reminderMinutesBefore: Number.isFinite(next) ? next : null,
                          },
                        });
                      }}
                    >
                      <option value="">{t("No reminder")}</option>
                      <option value="0">{t("When event starts")}</option>
                      <option value="5">{t("5 minutes before")}</option>
                      <option value="10">{t("10 minutes before")}</option>
                      <option value="15">{t("15 minutes before")}</option>
                      <option value="30">{t("30 minutes before")}</option>
                      <option value="60">{t("1 hour before")}</option>
                    </select>
                  </div>
	                ) : null}
                <EventComposerDatePicker
                  selectedDate={selectedDate}
                  monthDate={monthDate}
                  setSelectedDate={setSelectedDate}
                  setMonthDate={setMonthDate}
                  isDatePickerOpen={isDatePickerOpen}
                  setIsDatePickerOpen={setIsDatePickerOpen}
                  datePickerTriggerRef={datePickerTriggerRef}
                  datePickerPopoverRef={datePickerPopoverRef}
                  datePopoverStyle={datePopoverStyle}
                />
	              </div>
	            </>
	          ) : null}

	          <label className={styles.composerField}>
	            <textarea
	              value={state.details}
              onChange={(event) =>
                dispatch({ type: "update", payload: { details: event.target.value } })
              }
              placeholder={t("Description")}
              rows={3}
              aria-label={t("Description")}
            />
          </label>

          <div className={styles.composerField}>
            <span>{t("Color")}</span>
            <div className={styles.composerColorRow}>
              <EventComposerColorPicker
                color={state.color}
                isColorPickerOpen={isColorPickerOpen}
                setIsColorPickerOpen={setIsColorPickerOpen}
                hexDraft={hexDraft}
                setHexDraft={setHexDraft}
                colorPopoverStyle={colorPopoverStyle}
                colorPickerRef={colorPickerRef}
                colorPickerTriggerRef={colorPickerTriggerRef}
                colorPickerPopoverRef={colorPickerPopoverRef}
                onSelectColor={handleSelectColor}
                onUpdateColorWithoutClosing={handleUpdateColorWithoutClosing}
                onHexCommit={handleHexCommit}
              />

              <div className={styles.composerFooter}>
                {activeEvent && onDelete ? (
                  <button type="button" className={styles.composerDeleteButton} onClick={handleDelete}>
                    {t("Delete")}
                  </button>
                ) : null}
                <button type="submit">
                  {activeEvent ? t("Save") : t("Add")}
                </button>
              </div>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
}
