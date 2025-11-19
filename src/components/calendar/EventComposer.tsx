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

import styles from "./GrayDashboardCalendar.module.css";
import {
  CalendarEntryType,
  CalendarEvent,
  CalendarInfo,
  CalendarEventDisplayHint,
} from "./types";
import { Plus, X } from "lucide-react";

export type EventComposerPayload = {
  id?: string;
  title: string;
  start: Date;
  end: Date;
  color: string;
  entryType: CalendarEntryType;
  calendarId: string;
  description?: string;
  displayHint?: CalendarEventDisplayHint;
};

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
};

type ComposerState = {
  title: string;
  startTime: string;
  endTime: string;
  color: string;
  entryType: CalendarEntryType;
  calendarId: string;
  details: string;
};

type ComposerAction =
  | { type: "reset"; payload: ComposerState }
  | { type: "update"; payload: Partial<ComposerState> };

const COLOR_SWATCHES = ["#4C6FFF", "#0AD5B0", "#F6A623", "#D075FF", "#E36D7D", "#CDD1D5"] as const;

// Default colors  by entry type
const DEFAULT_COLORS: Record<CalendarEntryType, string> = {
  event: "#6f8bff",      // Blue for general events
  task: "#F6A623",       // Orange for tasks
  reminder: "#0AD5B0",   // Teal for reminders
};

const DEFAULT_STATE: ComposerState = {
  title: "New event",
  startTime: "09:00",
  endTime: "10:00",
  color: DEFAULT_COLORS.event,
  entryType: "event",
  calendarId: "default",
  details: "",
};

export const DEFAULT_EVENT_DURATION_MINUTES = 60;

const ENTRY_TYPES: CalendarEntryType[] = ["event", "task", "reminder"];
const ENTRY_TYPE_LABELS: Record<CalendarEntryType, string> = {
  event: "Event",
  task: "Task",
  reminder: "Reminder",
};

const composerReducer = (state: ComposerState, action: ComposerAction): ComposerState => {
  switch (action.type) {
    case "reset":
      return action.payload;
    case "update":
      return { ...state, ...action.payload };
    default:
      return state;
  }
};

const formatTimeInput = (date: Date) =>
  date
    .toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .padStart(5, "0");

const resolveStateFromEvent = (
  event: CalendarEvent,
  fallbackCalendarId: string
): ComposerState => ({
  title: event.title,
  startTime: formatTimeInput(event.start),
  endTime: formatTimeInput(event.end),
  color: event.color,
  entryType: event.entryType,
  calendarId: event.calendarId ?? fallbackCalendarId,
  details: event.description ?? "",
});

const combineDateWithTime = (date: Date, timeValue: string) => {
  const [hours, minutes] = timeValue.split(":").map((value) => Number.parseInt(value, 10));
  const result = new Date(date);
  result.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return result;
};

export function EventComposer({
  isOpen,
  referenceDate,
  activeEvent,
  initialRange = null,
  calendars,
  onRequestClose,
  onSubmit,
  onDelete,
  anchorRect = null,
}: EventComposerProps) {
  const calendarFallbackId = useMemo(
    () => calendars[0]?.id ?? "default",
    [calendars]
  );

  const [state, dispatch] = useReducer(composerReducer, {
    ...DEFAULT_STATE,
    calendarId: calendarFallbackId,
  });
  const customColorInputRef = useRef<HTMLInputElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const [anchoredPosition, setAnchoredPosition] = useState<{ top: number; left: number } | null>(null);
  const [anchorSide, setAnchorSide] = useState<"left" | "right" | null>(null);
  const activeEventId = activeEvent?.id;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (activeEvent) {
      dispatch({ type: "reset", payload: resolveStateFromEvent(activeEvent, calendarFallbackId) });
      return;
    }

    if (initialRange) {
      dispatch({
        type: "reset",
        payload: {
          ...DEFAULT_STATE,
          calendarId: calendarFallbackId,
          startTime: formatTimeInput(initialRange.start),
          endTime: formatTimeInput(initialRange.end),
          details: "",
        },
      });
      return;
    }

    dispatch({
      type: "reset",
      payload: {
        ...DEFAULT_STATE,
        calendarId: calendarFallbackId,
        details: "",
      },
    });
  }, [activeEvent, calendarFallbackId, initialRange, isOpen]);

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

  const isReminder = state.entryType === "reminder";

  const handleSelectEntryType = (nextType: CalendarEntryType) => {
    if (state.entryType === nextType) {
      return;
    }
    const payload: Partial<ComposerState> = {
      entryType: nextType,
      color: DEFAULT_COLORS[nextType], // Apply default color for the new type
    };
    if (nextType === "reminder") {
      payload.endTime = state.startTime;
    }
    dispatch({ type: "update", payload });
  };

  const currentStart = useMemo(
    () => combineDateWithTime(referenceDate, state.startTime),
    [referenceDate, state.startTime]
  );
  const currentEnd = useMemo(() => {
    if (isReminder) {
      return currentStart;
    }
    return combineDateWithTime(referenceDate, state.endTime);
  }, [currentStart, referenceDate, state.endTime, isReminder]);
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const start = currentStart;
    const rawEnd = isReminder ? new Date(start) : currentEnd;
    const normalizedEnd = isReminder
      ? new Date(start)
      : rawEnd <= start
        ? new Date(start.getTime() + DEFAULT_EVENT_DURATION_MINUTES * 60000)
        : rawEnd;

    onSubmit({
      id: activeEvent?.id,
      title: state.title.trim() || "Untitled",
      start,
      end: normalizedEnd,
      color: state.color,
      entryType: state.entryType,
      calendarId: state.calendarId,
      description: state.details.trim() ? state.details.trim() : undefined,
      displayHint: isReminder ? "line" : undefined,
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
  }, [activeEventId, handleDelete, isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSelectColor = (colorValue: string) => {
    dispatch({ type: "update", payload: { color: colorValue } });
  };

  const handlePickCustomColor = () => {
    customColorInputRef.current?.click();
  };

  const overlayClassName = [
    styles.composerOverlay,
    anchoredPosition ? styles.composerOverlayAnchored : null,
  ]
    .filter(Boolean)
    .join(" ");

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onRequestClose();
    }
  };

  const isPlanSyntheticEvent = Boolean(activeEvent?.calendarId === "plan");
  const isReminderSyntheticEvent =
    typeof activeEvent?.id === "string" && activeEvent.id.startsWith("reminder-");
  const isSyntheticEvent = isPlanSyntheticEvent || isReminderSyntheticEvent;

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
          <div>
            <h2 className={styles.composerHeaderTitle}>
              {activeEvent
                ? `Edit ${ENTRY_TYPE_LABELS[state.entryType].toLowerCase()}`
                : `Create ${ENTRY_TYPE_LABELS[state.entryType].toLowerCase()}`}
            </h2>
          </div>
          <button
            type="button"
            onClick={onRequestClose}
            aria-label="Close dialog"
            className={styles.composerCloseButton}
          >
            <X size={18} />
          </button>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className={styles.composerForm}>

          <label className={styles.composerTitleRow}>
            <span className={styles.composerTitleLabel}>Title</span>
            <input
              type="text"
              value={state.title}
              onChange={(event) =>
                dispatch({ type: "update", payload: { title: event.target.value } })
              }
              placeholder="Add title"
              className={styles.composerTitleInput}
            />
          </label>

          <label className={styles.composerField}>
            <span>Type</span>
            <div className={styles.composerTypeSelectShell}>
              <select
                className={styles.composerTypeSelect}
                value={state.entryType}
                onChange={(event) =>
                  handleSelectEntryType(event.target.value as CalendarEntryType)
                }
              >
                {ENTRY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {ENTRY_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
          </label>

          {!isReminder ? (
            <div className={styles.composerDualField}>
              <label className={styles.composerField}>
                <span>Start</span>
                <div className={styles.composerInputShell}>
                  <input
                    type="time"
                    value={state.startTime}
                    onChange={(event) =>
                      dispatch({ type: "update", payload: { startTime: event.target.value } })
                    }
                    step={300}
                    required
                  />
                </div>
              </label>
              <label className={styles.composerField}>
                <span>End</span>
                <div className={styles.composerInputShell}>
                  <input
                    type="time"
                    value={state.endTime}
                    onChange={(event) =>
                      dispatch({ type: "update", payload: { endTime: event.target.value } })
                    }
                    step={300}
                    required
                  />
                </div>
              </label>
            </div>
          ) : (
            <label className={styles.composerField}>
              <span>Reminder time</span>
              <div className={styles.composerInputShell}>
                <input
                  type="time"
                  value={state.startTime}
                  onChange={(event) =>
                    dispatch({ type: "update", payload: { startTime: event.target.value } })
                  }
                  step={300}
                  required
                />
              </div>
            </label>
          )}

          <label className={styles.composerField}>
            <span>Details</span>
            <textarea
              value={state.details}
              onChange={(event) =>
                dispatch({ type: "update", payload: { details: event.target.value } })
              }
              placeholder="Add context, agenda, or notes"
              rows={3}
            />
          </label>

          <div className={styles.composerField}>
            <span>Color</span>
            <div className={styles.composerColors}>
              {COLOR_SWATCHES.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  className={styles.composerColorDot}
                  style={{ backgroundColor: swatch }}
                  data-active={state.color === swatch ? "true" : "false"}
                  onClick={() => handleSelectColor(swatch)}
                  aria-label={`Select ${swatch} color`}
                />
              ))}
              <button
                type="button"
                className={styles.composerColorDot}
                data-active={
                  COLOR_SWATCHES.includes(state.color as (typeof COLOR_SWATCHES)[number]) ? "false" : "true"
                }
                onClick={handlePickCustomColor}
                aria-label="Pick custom color"
              >
                <Plus size={18} strokeWidth={2.5} aria-hidden="true" />
              </button>
              <input
                ref={customColorInputRef}
                type="color"
                value={state.color}
                onChange={(event) => handleSelectColor(event.target.value)}
                className={styles.composerHiddenColor}
              />
            </div>
          </div>


          <footer className={styles.composerFooter}>
            {activeEvent && !isPlanSyntheticEvent ? (
              <button type="button" className={styles.composerDeleteButton} onClick={handleDelete}>
                Delete
              </button>
            ) : null}
            <button type="submit">{activeEvent ? "Save changes" : "Add event"}</button>
          </footer>
        </form>
      </div>
    </div>
  );
}
