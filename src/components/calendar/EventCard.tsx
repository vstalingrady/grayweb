import { CSSProperties, HTMLAttributes, MouseEvent, memo, useMemo } from "react";
import { Check } from "lucide-react";

import styles from "./GrayDashboardCalendar.module.css";
import { PositionedEvent } from "./types";
import { formatEventTime } from "./timeUtils";

const DEFAULT_CARD_COLOR = "#4f63ff";
const COLUMN_GUTTER_PX = 1;
const COLUMN_PADDING_PX = 4;

type RGB = { r: number; g: number; b: number };

type TaskToggleAction = {
  checked?: boolean;
  disabled?: boolean;
  onToggle: () => void;
  ariaLabel?: string;
};

const clampChannel = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

const parseHexColor = (input: string): RGB | null => {
  const normalized = input.replace("#", "");
  if (normalized.length === 3) {
    const r = normalized[0];
    const g = normalized[1];
    const b = normalized[2];
    return {
      r: parseInt(`${r}${r}`, 16),
      g: parseInt(`${g}${g}`, 16),
      b: parseInt(`${b}${b}`, 16),
    };
  }
  if (normalized.length === 6) {
    return {
      r: parseInt(normalized.slice(0, 2), 16),
      g: parseInt(normalized.slice(2, 4), 16),
      b: parseInt(normalized.slice(4, 6), 16),
    };
  }
  return null;
};

const parseRgbColor = (input: string): RGB | null => {
  const match = input.match(/rgba?\(([^)]+)\)/i);
  if (!match) {
    return null;
  }
  const parts = match[1]
    .split(",")
    .slice(0, 3)
    .map((token) => clampChannel(Number.parseFloat(token.trim())));
  if (parts.length !== 3 || parts.some((channel) => Number.isNaN(channel))) {
    return null;
  }
  return { r: parts[0], g: parts[1], b: parts[2] };
};

const parseColorString = (input?: string | null): RGB | null => {
  if (!input) {
    return null;
  }
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith("#")) {
    return parseHexColor(trimmed);
  }
  if (trimmed.toLowerCase().startsWith("rgb")) {
    return parseRgbColor(trimmed);
  }
  return null;
};

const channelToLinear = (channel: number) => {
  const normalized = channel / 255;
  if (normalized <= 0.03928) {
    return normalized / 12.92;
  }
  return Math.pow((normalized + 0.055) / 1.055, 2.4);
};

const getRelativeLuminance = (rgb: RGB | null): number => {
  if (!rgb) {
    return 0;
  }
  const r = channelToLinear(rgb.r);
  const g = channelToLinear(rgb.g);
  const b = channelToLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

type EventCardProps = {
  event: PositionedEvent;
  isPreview?: boolean;
  isDragging?: boolean;
  isSelected?: boolean;
  draggableProps?: Pick<HTMLAttributes<HTMLElement>, "onPointerDown">;
  onClick?: (event: PositionedEvent, anchor: DOMRect, mouseEvent: MouseEvent) => void;
  taskAction?: TaskToggleAction;
};

type EventCardStyle = CSSProperties & {
  "--event-line-color"?: string;
  "--event-card-color"?: string;
  "--event-card-text-color"?: string;
  "--event-card-time-color"?: string;
  "--event-card-detail-color"?: string;
};

export const EventCard = memo(function EventCard({
  event,
  isPreview = false,
  isDragging = false,
  isSelected = false,
  draggableProps,
  onClick,
  taskAction,
}: EventCardProps) {
  const timeLabel = useMemo(() => {
    const startLabel = formatEventTime(event.start);
    if (event.entryType === "reminder" || event.start.getTime() === event.end.getTime()) {
      return startLabel;
    }
    return `${startLabel} — ${formatEventTime(event.end)}`;
  }, [event.start, event.end, event.entryType]);
  const tooltipLabel = useMemo(() => {
    const segments = [event.title];
    if (event.description) {
      segments.push(event.description);
    }
    segments.push(timeLabel);
    return segments.join("\n");
  }, [event.title, event.description, timeLabel]);

  const backgroundColor = event.color || DEFAULT_CARD_COLOR;
  const luminance = getRelativeLuminance(parseColorString(backgroundColor));
  const isLight = luminance > 0.6;
  const textColor = isLight ? "#050505" : "rgba(247, 247, 247, 0.94)";
  const timeColor = isLight ? "rgba(15, 15, 20, 0.65)" : "rgba(247, 247, 247, 0.78)";
  const detailColor = isLight ? "rgba(18, 18, 24, 0.68)" : "rgba(240, 240, 244, 0.78)";
  const columnCount = Math.max(event.columnCount ?? 1, 1);
  const columnIndex = event.column ?? 0;
  const isStacked = columnCount > 1;

  const cardStyle: EventCardStyle = {
    top: `${event.top}px`,
    height: `${event.height}px`,
    left: `calc(${(columnIndex / columnCount) * 100}% + ${columnIndex * COLUMN_GUTTER_PX}px)`,
    width: `calc(${event.width * 100}% - ${Math.max(event.columnSpan - 1, 0) * COLUMN_GUTTER_PX + COLUMN_PADDING_PX}px)`,
    zIndex: event.zIndex,
    color: textColor,
  };

  cardStyle["--event-card-color"] = backgroundColor;
  cardStyle["--event-line-color"] = backgroundColor;
  cardStyle.backgroundColor = backgroundColor;
  cardStyle["--event-card-text-color"] = textColor;
  cardStyle["--event-card-time-color"] = timeColor;
  cardStyle["--event-card-detail-color"] = detailColor;

  const taskCompleted = Boolean(taskAction?.checked);
  const handleTaskToggleClick = (domEvent: MouseEvent<HTMLButtonElement>) => {
    domEvent.stopPropagation();
    domEvent.preventDefault();
    if (!taskAction || taskAction.disabled) {
      return;
    }
    taskAction.onToggle();
  };

  return (
    <div
      className={styles.eventCard}
      data-entry-type={event.entryType}
      data-display-hint={event.displayHint ?? undefined}
      data-stacked={isStacked ? "true" : undefined}
      data-preview={isPreview ? "true" : "false"}
      data-dragging={isDragging ? "true" : "false"}
      data-selected={isSelected ? "true" : "false"}
      data-task-completed={taskCompleted ? "true" : undefined}
      data-task-disabled={taskAction?.disabled ? "true" : undefined}
      style={cardStyle}
      role="button"
      tabIndex={0}
      onClick={(domEvent) => {
        const anchorRect = domEvent.currentTarget.getBoundingClientRect();
        onClick?.(event, anchorRect, domEvent);
      }}
      title={tooltipLabel}
      {...draggableProps}
    >
      <div className={styles.eventCardText}>
        <strong
          className={styles.eventCardTitle}
          data-task-completed={taskCompleted ? "true" : undefined}
        >
          {event.title}
        </strong>
        <span
          className={styles.eventCardTime}
          data-task-completed={taskCompleted ? "true" : undefined}
        >
          {timeLabel}
        </span>
      </div>
      {taskAction ? (
        <button
          type="button"
          className={styles.eventCardTaskToggle}
          onClick={handleTaskToggleClick}
          disabled={taskAction.disabled}
          aria-pressed={taskCompleted ? "true" : "false"}
          aria-label={taskAction.ariaLabel}
          data-disabled={taskAction.disabled ? "true" : undefined}
        >
          {taskCompleted ? <Check size={12} /> : null}
        </button>
      ) : null}
    </div>
  );
});
