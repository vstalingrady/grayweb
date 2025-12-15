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
import { Plus, X } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";

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
const DEFAULT_COLORS: Record<CalendarEntryType, string> = {
  event: "#3D6F73",
  task: "#B77A2B",
  reminder: "#2F6B4F",
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
  const { t } = useI18n();
  const calendarFallbackId = useMemo(
    () => calendars[0]?.id ?? "default",
    [calendars]
  );

  const [state, dispatch] = useReducer(composerReducer, {
    ...DEFAULT_STATE,
    title: t("New event"),
    calendarId: calendarFallbackId,
  });
  const cardRef = useRef<HTMLDivElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const colorPickerRef = useRef<HTMLDivElement | null>(null);
  const colorPickerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const colorPickerPopoverRef = useRef<HTMLDivElement | null>(null);
  const [anchoredPosition, setAnchoredPosition] = useState<{ top: number; left: number } | null>(null);
  const [anchorSide, setAnchorSide] = useState<"left" | "right" | null>(null);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [hexDraft, setHexDraft] = useState(DEFAULT_STATE.color);
  const [colorPickerPosition, setColorPickerPosition] = useState<{ top: number; left: number } | null>(
    null
  );
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
          title: t("New event"),
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
        title: t("New event"),
        calendarId: calendarFallbackId,
        details: "",
      },
    });
  }, [activeEvent, calendarFallbackId, initialRange, isOpen, t]);

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
      title: state.title.trim() || t("Untitled"),
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

  useEffect(() => {
    if (!isOpen) {
      setIsColorPickerOpen(false);
    }
  }, [isOpen]);

  useEffect(() => {
    setHexDraft(state.color);
  }, [state.color]);

  useEffect(() => {
    if (!isColorPickerOpen) return;

    const handlePointerDown = (event: globalThis.MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
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

  const rgb = hexToRgb(state.color) ?? { red: 0, green: 0, blue: 0 };
  const colorPopoverStyle = useMemo<CSSProperties | undefined>(() => {
    if (!colorPickerPosition) return undefined;
    return { top: `${colorPickerPosition.top}px`, left: `${colorPickerPosition.left}px` };
  }, [colorPickerPosition]);

  if (!isOpen) {
    return null;
  }

  const handleSelectColor = (colorValue: string) => {
    dispatch({ type: "update", payload: { color: colorValue } });
    setIsColorPickerOpen(false);
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
      onRequestClose();
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
          <div>
            <h2 className={styles.composerHeaderTitle}>
              {activeEvent
                ? t("Edit {type}", { type: t(ENTRY_TYPE_LABELS[state.entryType]).toLowerCase() })
                : t("Create {type}", { type: t(ENTRY_TYPE_LABELS[state.entryType]).toLowerCase() })}
            </h2>
          </div>
          <button
            type="button"
            onClick={onRequestClose}
            aria-label={t("Close dialog")}
            className={styles.composerCloseButton}
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className={styles.composerForm}>

          <label className={styles.composerTitleRow}>
            <span className={styles.composerTitleLabel}>{t("Title")}</span>
            <input
              type="text"
              value={state.title}
              onChange={(event) =>
                dispatch({ type: "update", payload: { title: event.target.value } })
              }
              placeholder={t("Add title")}
              className={styles.composerTitleInput}
            />
          </label>

          <label className={styles.composerField}>
            <span>{t("Type")}</span>
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
                    {t(ENTRY_TYPE_LABELS[type])}
                  </option>
                ))}
              </select>
            </div>
          </label>

          {!isReminder ? (
            <div className={styles.composerDualField}>
              <label className={styles.composerField}>
                <span>{t("Start")}</span>
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
                <span>{t("End")}</span>
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
              <span>{t("Reminder time")}</span>
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
            <span>{t("Details")}</span>
            <textarea
              value={state.details}
              onChange={(event) =>
                dispatch({ type: "update", payload: { details: event.target.value } })
              }
              placeholder={t("Add context, agenda, or notes")}
              rows={3}
            />
          </label>

          <div className={styles.composerField}>
            <span>{t("Color")}</span>
            <div className={styles.composerColors} ref={colorPickerRef}>
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
                        onChange={(event) => handleSelectColor(rgbToHex(Number(event.target.value), rgb.green, rgb.blue))}
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
                        onChange={(event) => handleSelectColor(rgbToHex(rgb.red, Number(event.target.value), rgb.blue))}
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
                        onChange={(event) => handleSelectColor(rgbToHex(rgb.red, rgb.green, Number(event.target.value)))}
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
          </div>


          <footer className={styles.composerFooter}>
            {activeEvent && onDelete ? (
              <button type="button" className={styles.composerDeleteButton} onClick={handleDelete}>
                {t("Delete")}
              </button>
            ) : null}
            <button type="submit">{activeEvent ? t("Save changes") : t("Add event")}</button>
          </footer>
        </form>
      </div>
    </div>
  );
}
