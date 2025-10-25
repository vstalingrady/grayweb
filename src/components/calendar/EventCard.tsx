import { HTMLAttributes, useMemo } from "react";

import styles from "./GrayDashboardCalendar.module.css";
import { PositionedEvent } from "./types";

type EventCardProps = {
  event: PositionedEvent;
  isPreview?: boolean;
  isDragging?: boolean;
  draggableProps?: Pick<
    HTMLAttributes<HTMLDivElement>,
    "onPointerDown"
  >;
  onClick?: (event: PositionedEvent) => void;
};

const formatTimeRange = (start: Date, end: Date) => {
  const options: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
  };

  const formatter = new Intl.DateTimeFormat(undefined, options);
  return `${formatter.format(start)} — ${formatter.format(end)}`;
};

export function EventCard({
  event,
  isPreview = false,
  isDragging = false,
  draggableProps,
  onClick,
}: EventCardProps) {
  const timeLabel = useMemo(
    () => formatTimeRange(event.start, event.end),
    [event.start, event.end]
  );

  return (
    <div
      className={styles.eventCard}
      data-entry-type={event.entryType}
      data-preview={isPreview ? "true" : "false"}
      data-dragging={isDragging ? "true" : "false"}
      style={{
        top: `${event.top}px`,
        height: `${event.height}px`,
        left: `calc(${(event.column / Math.max(event.columnCount, 1)) * 100}% + ${
          event.column * 8
        }px)`,
        width: `calc(${event.width * 100}% - ${
          Math.max(event.columnSpan - 1, 0) * 8 + 12
        }px)`,
        background: event.color,
        zIndex: event.zIndex,
      }}
      role="button"
      tabIndex={0}
      onClick={() => onClick?.(event)}
      {...draggableProps}
    >
      <span className={styles.eventCardTime}>{timeLabel}</span>
      <strong className={styles.eventCardTitle}>{event.title}</strong>
    </div>
  );
}
