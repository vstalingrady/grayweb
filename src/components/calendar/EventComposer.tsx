import { FormEvent, useEffect, useMemo, useReducer, useRef } from "react";

import styles from "./GrayDashboardCalendar.module.css";
import {
  CalendarEntryType,
  CalendarEvent,
  CalendarInfo,
} from "./types";
import { Clock3, X } from "lucide-react";

export type EventComposerPayload = {
  id?: string;
  title: string;
  start: Date;
  end: Date;
  color: string;
  entryType: CalendarEntryType;
  calendarId: string;
  description?: string;
};

type EventComposerProps = {
  isOpen: boolean;
  referenceDate: Date;
  activeEvent?: CalendarEvent | null;
  initialRange?: { start: Date; end: Date } | null;
  calendars: CalendarInfo[];
  onRequestClose: () => void;
  onSubmit: (payload: EventComposerPayload) => void;
};

type ComposerState = {
  title: string;
  startTime: string;
  endTime: string;
  color: string;
  entryType: CalendarEntryType;
  calendarId: string;
};

type ComposerAction =
  | { type: "reset"; payload: ComposerState }
  | { type: "update"; payload: Partial<ComposerState> };

const COLOR_SWATCHES = ["#4C6FFF", "#0AD5B0", "#F6A623", "#D075FF", "#E36D7D", "#CDD1D5"] as const;

const DEFAULT_STATE: ComposerState = {
  title: "",
  startTime: "09:00",
  endTime: "10:00",
  color: "#5b8def",
  entryType: "event",
  calendarId: "default",
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
        },
      });
      return;
    }

    dispatch({
      type: "reset",
      payload: {
        ...DEFAULT_STATE,
        calendarId: calendarFallbackId,
      },
    });
  }, [activeEvent, calendarFallbackId, initialRange, isOpen]);

  const formattedRangeLabel = useMemo(() => {
    const start = combineDateWithTime(referenceDate, state.startTime);
    const end = combineDateWithTime(referenceDate, state.endTime);
    const datePart = start.toLocaleDateString(undefined, {
      weekday: "short",
      month: "long",
      day: "numeric",
    });
    const startLabel = start.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    const endLabel = end.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    return `${datePart} - ${startLabel} to ${endLabel}`;
  }, [referenceDate, state.startTime, state.endTime]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    const start = combineDateWithTime(referenceDate, state.startTime);
    const end = combineDateWithTime(referenceDate, state.endTime);
    const normalizedEnd = end <= start ? new Date(start.getTime() + 30 * 60000) : end;

    onSubmit({
      id: activeEvent?.id,
      title: state.title.trim() || "Untitled",
      start,
      end: normalizedEnd,
      color: state.color,
      entryType: state.entryType,
      calendarId: state.calendarId,
    });
    onRequestClose();
  };

  if (!isOpen) {
    return null;
  }

  const handleSelectColor = (colorValue: string) => {
    dispatch({ type: "update", payload: { color: colorValue } });
  };

  const handlePickCustomColor = () => {
    customColorInputRef.current?.click();
  };

  const isTask = state.entryType === "task";

  return (
    <div className={styles.composerOverlay} role="dialog" aria-modal="true">
      <div className={styles.composerCard}>
        <header className={styles.composerHeader}>
          <div>
            <p className={styles.composerEyebrow}>{activeEvent ? "Edit" : "Add"} event</p>
            <h2>{activeEvent ? "Edit event" : "Add event"}</h2>
          </div>
          <button type="button" onClick={onRequestClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className={styles.composerForm}>
          <div className={styles.composerSummary}>{formattedRangeLabel}</div>

          <label className={styles.composerField}>
            <span>Title</span>
            <input
              type="text"
              value={state.title}
              onChange={(event) =>
                dispatch({ type: "update", payload: { title: event.target.value } })
              }
              placeholder="Event title"
            />
          </label>

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
                <Clock3 size={16} />
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
                <Clock3 size={16} />
              </div>
            </label>
          </div>

          <button
            type="button"
            className={styles.composerTaskToggle}
            data-active={isTask ? "true" : "false"}
            onClick={() =>
              dispatch({
                type: "update",
                payload: { entryType: isTask ? "event" : "task" },
              })
            }
          >
            <span>Task</span>
          </button>

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
                <span>+</span>
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

          <label className={styles.composerField}>
            <span>Calendar</span>
            <select
              value={state.calendarId}
              onChange={(event) =>
                dispatch({ type: "update", payload: { calendarId: event.target.value } })
              }
            >
              {calendars.map((calendar) => (
                <option key={calendar.id} value={calendar.id}>
                  {calendar.label}
                </option>
              ))}
            </select>
          </label>

          <footer className={styles.composerFooter}>
            <button type="button" onClick={onRequestClose}>
              Cancel
            </button>
            <button type="submit">{activeEvent ? "Save changes" : "Add event"}</button>
          </footer>
        </form>
      </div>
    </div>
  );
}
