import { FormEvent, useEffect, useMemo, useReducer } from "react";

import styles from "./GrayDashboardCalendar.module.css";
import {
  CalendarEntryType,
  CalendarEvent,
  CalendarInfo,
} from "./types";

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

  return (
    <div className={styles.composerOverlay} role="dialog" aria-modal="true">
      <div className={styles.composerCard}>
        <header>
          <h2>{activeEvent ? "Edit event" : "Create event"}</h2>
          <button type="button" onClick={onRequestClose}>
            Close
          </button>
        </header>

        <form onSubmit={handleSubmit} className={styles.composerForm}>
          <label>
            <span>Title</span>
            <input
              type="text"
              value={state.title}
              onChange={(event) =>
                dispatch({ type: "update", payload: { title: event.target.value } })
              }
              placeholder="What's on your schedule?"
              required
            />
          </label>

          <div className={styles.composerTimeRow}>
            <label>
              <span>Starts</span>
              <input
                type="time"
                value={state.startTime}
                onChange={(event) =>
                  dispatch({ type: "update", payload: { startTime: event.target.value } })
                }
                step={900}
                required
              />
            </label>
            <label>
              <span>Ends</span>
              <input
                type="time"
                value={state.endTime}
                onChange={(event) =>
                  dispatch({ type: "update", payload: { endTime: event.target.value } })
                }
                step={900}
                required
              />
            </label>
          </div>

          <label>
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

          <div className={styles.composerMetaRow}>
            <label>
              <span>Color</span>
              <input
                type="color"
                value={state.color}
                onChange={(event) =>
                  dispatch({ type: "update", payload: { color: event.target.value } })
                }
              />
            </label>

            <label className={styles.composerToggleLabel}>
              <span>Entry type</span>
              <div className={styles.composerToggleGroup}>
                {(["event", "task"] as CalendarEntryType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    data-active={state.entryType === type ? "true" : "false"}
                    onClick={() => dispatch({ type: "update", payload: { entryType: type } })}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </label>
          </div>

          <footer className={styles.composerFooter}>
            <button type="button" onClick={onRequestClose}>
              Cancel
            </button>
            <button type="submit">Save</button>
          </footer>
        </form>
      </div>
    </div>
  );
}
