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
import {
  CalendarEntryType,
  CalendarEvent,
  CalendarInfo,
  CalendarEventDisplayHint,
} from "./types";
import { ArrowRight, Calendar, ChevronDown, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { MiniMonth } from "./MiniMonth";

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
  reminderMinutesBefore?: number | null;
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
  onStateChange?: (state: ComposerState) => void;
};

export type ComposerState = {
  title: string;
  startTime: string;
  endTime: string;
  color: string;
  entryType: CalendarEntryType;
  calendarId: string;
  details: string;
  reminderMinutesBefore: number | null;
};

type ComposerAction =
  | { type: "reset"; payload: ComposerState }
  | { type: "update"; payload: Partial<ComposerState> };

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

// Default colors  by entry type
// Default colors  by entry type
const DEFAULT_COLORS: Record<CalendarEntryType, string> = {
  event: "#3D6F73",
  task: "#B77A2B",
  plan: "#5E7E91",
  habit: "#5E9182",
};

const DEFAULT_STATE: ComposerState = {
  title: "",
  startTime: "09:00",
  endTime: "10:00",
  color: DEFAULT_COLORS.event,
  entryType: "event",
  calendarId: "default",
  details: "",
  reminderMinutesBefore: null,
};

export const DEFAULT_EVENT_DURATION_MINUTES = 60;

const VISIBLE_ENTRY_TYPES: CalendarEntryType[] = ["plan", "habit", "event"];
const ENTRY_TYPE_LABELS: Record<CalendarEntryType, string> = {
  event: "Event",
  task: "Task",
  plan: "Plans",
  habit: "Habits",
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
  reminderMinutesBefore:
    typeof event.reminderMinutesBefore === "number" ? event.reminderMinutesBefore : null,
});

const combineDateWithTime = (date: Date, timeValue: string) => {
  const [hours, minutes] = timeValue.split(":").map((value) => Number.parseInt(value, 10));
  const result = new Date(date);
  result.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return result;
};

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

const isPointerEventInside = (
  event: globalThis.PointerEvent,
  element: HTMLElement | null
) => {
  if (!element) return false;
  const target = event.target as Node | null;
  if (!target) return false;
  if (typeof event.composedPath === "function") {
    return event.composedPath().includes(element);
  }
  return element.contains(target);
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
  }, [currentStart, selectedDate, state.endTime]);

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

  const rgb = hexToRgb(state.color) ?? { red: 0, green: 0, blue: 0 };
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

  const handlePickCustomColor = () => {
    setIsColorPickerOpen((previous) => !previous);
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
	                    {(() => {
	                      const start = new Date(`2000-01-01T${state.startTime}`);
	                      const end = new Date(`2000-01-01T${state.endTime}`);
	                      let diff = end.getTime() - start.getTime();
	                      if (diff < 0) diff += 24 * 60 * 60 * 1000;
	                      const mins = Math.floor(diff / 60000);
	                      const h = Math.floor(mins / 60);
	                      const m = mins % 60;
	                      if (h <= 0) {
	                        return `${mins}m`;
	                      }
	                      if (m === 0) {
	                        return `${h}h`;
	                      }
	                      return `${h}h ${m}m`;
	                    })()}
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
                <div className={styles.composerDateRow}>
                  <button
                    type="button"
                    className={styles.composerDateTrigger}
                    onClick={() => {
                      setMonthDate(startOfMonth(selectedDate));
                      setIsDatePickerOpen((previous) => !previous);
                    }}
                    aria-expanded={isDatePickerOpen ? "true" : "false"}
                    aria-label={t("Choose date")}
                    ref={datePickerTriggerRef}
                  >
                    <Calendar
                      size={14}
                      aria-hidden="true"
                      className={styles.composerInlineControlIcon}
                    />
                    <span className={styles.composerInlineControlLabel}>
                      {selectedDate.toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <ChevronDown
                      size={14}
                      aria-hidden="true"
                      className={styles.composerInlineControlChevron}
                    />
                  </button>
                </div>
              </div>
            </>
          ) : null}

          {isDatePickerOpen ? (
            <div
              ref={datePickerPopoverRef}
              className={styles.composerDatePopover}
              style={datePopoverStyle}
              role="dialog"
              aria-label={t("Date picker")}
            >
              <div className={styles.composerDatePopoverHeader}>
                <span className={styles.composerDatePopoverMonthLabel}>
                  {monthDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                </span>
                <span className={styles.composerDatePopoverControls}>
                  <button
                    type="button"
                    className={styles.composerDatePopoverNavButton}
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
                    className={styles.composerDatePopoverNavButton}
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

              <div className={styles.composerMiniCalendarCompact}>
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
              <div className={styles.composerColors} ref={colorPickerRef}>
                <div className={styles.composerQuickSwatches}>
                  {QUICK_COLOR_SWATCHES.map((swatch) => (
                    <button
                      key={swatch}
                      type="button"
                      className={styles.composerColorDot}
                      style={{ backgroundColor: swatch }}
                      data-active={state.color === swatch ? "true" : "false"}
                      onClick={() => handleSelectColor(swatch)}
                      aria-label={t("Select {color} color", { color: swatch })}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className={styles.composerColorDot}
                  data-active={
                    QUICK_COLOR_SWATCHES.includes(state.color as (typeof QUICK_COLOR_SWATCHES)[number])
                      ? "false"
                      : "true"
                  }
                  onClick={handlePickCustomColor}
                  aria-label={t("Pick custom color")}
                  aria-expanded={isColorPickerOpen ? "true" : "false"}
                  ref={colorPickerTriggerRef}
                >
                  <Plus size={18} strokeWidth={1.75} aria-hidden="true" />
                </button>

                {isColorPickerOpen ? (
                  <div
                    ref={colorPickerPopoverRef}
                    className={styles.composerColorPopover}
                    style={colorPopoverStyle}
                    role="dialog"
                    aria-label={t("Color picker")}
                  >
                    <div className={styles.composerColorPopoverHeader}>
                      <div
                        className={styles.composerColorPreview}
                        style={{ backgroundColor: state.color }}
                        aria-hidden="true"
                      />
                      <label className={styles.composerColorHexLabel}>
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
                        />
                      </label>
                    </div>

                    <div className={styles.composerColorSliders} aria-label={t("RGB sliders")}>
                      <label>
                        <span>R</span>
                        <input
                          type="range"
                          min={0}
                          max={255}
                          value={rgb.red}
                          onChange={(event) => handleUpdateColorWithoutClosing(rgbToHex(Number(event.target.value), rgb.green, rgb.blue))}
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
                          onChange={(event) => handleUpdateColorWithoutClosing(rgbToHex(rgb.red, Number(event.target.value), rgb.blue))}
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
                          onChange={(event) => handleUpdateColorWithoutClosing(rgbToHex(rgb.red, rgb.green, Number(event.target.value)))}
                        />
                        <output>{rgb.blue}</output>
                      </label>
                    </div>

                    <div className={styles.composerColorPaletteSection}>
                      <h3>Earthy</h3>
                      <div className={styles.composerColorPaletteGrid}>
                        {EARTHY_PALETTE.map((swatch) => (
                          <button
                            key={`earthy-${swatch}`}
                            type="button"
                            className={styles.composerColorSwatch}
                            style={{ backgroundColor: swatch }}
                            data-active={state.color === swatch ? "true" : "false"}
                            onClick={() => handleSelectColor(swatch)}
                            aria-label={t("Select {color} color", { color: swatch })}
                          />
                        ))}
                      </div>
                    </div>

                    <div className={styles.composerColorPaletteSection}>
                      <h3>Pastel</h3>
                      <div className={styles.composerColorPaletteGrid}>
                        {PASTEL_PALETTE.map((swatch) => (
                          <button
                            key={`pastel-${swatch}`}
                            type="button"
                            className={styles.composerColorSwatch}
                            style={{ backgroundColor: swatch }}
                            data-active={state.color === swatch ? "true" : "false"}
                            onClick={() => handleSelectColor(swatch)}
                            aria-label={t("Select {color} color", { color: swatch })}
                          />
                        ))}
                      </div>
                    </div>

                    <div className={styles.composerColorPaletteSection}>
                      <h3>Neutrals</h3>
                      <div className={styles.composerColorPaletteGrid}>
                        {NEUTRAL_PALETTE.map((swatch) => (
                          <button
                            key={`neutral-${swatch}`}
                            type="button"
                            className={styles.composerColorSwatch}
                            style={{ backgroundColor: swatch }}
                            data-active={state.color === swatch ? "true" : "false"}
                            onClick={() => handleSelectColor(swatch)}
                            aria-label={t("Select {color} color", { color: swatch })}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

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
