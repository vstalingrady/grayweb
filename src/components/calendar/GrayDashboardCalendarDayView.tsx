"use client";

import type { CSSProperties, HTMLAttributes, MouseEvent, MutableRefObject } from "react";

import styles from "./GrayDashboardCalendar.module.css";
import { EventCard } from "./EventCard";
import { HOURS, HOURS_LABEL } from "./timeGrid";
import type { CalendarEvent, PositionedEvent } from "./types";
import { isSameDay } from "./dateUtils";
import { ViewModeSelect } from "@/components/gray/ViewModeSelect";
import { useI18n } from "@/contexts/I18nContext";

import type { CalendarViewMode } from "./dashboardCalendarTypes";

type DragProps = Pick<HTMLAttributes<HTMLElement>, "onPointerDown">;

type DayViewProps = {
  selectedDate: Date;
  nowReference: Date | null;
  timeZoneLabel: string;
  rangeNavigationLabel: string;
  showViewSelect: boolean;
  showHeaderDates: boolean;
  dayIndicatorOffset: number | null;
  dayLayouts: PositionedEvent[];
  draggingEventIds: Set<string> | null;
  selectedEventIds: Set<string>;
  dayColumnRef: MutableRefObject<HTMLDivElement | null>;
  onNavigateRange: (direction: number) => void;
  onUpdateViewMode: (mode: CalendarViewMode) => void;
  onColumnClick: (event: MouseEvent<HTMLDivElement>, day: Date) => void;
  onEventClick: (
    event: PositionedEvent,
    anchorRect: DOMRect,
    mouseEvent: MouseEvent
  ) => void;
  isGoogleCalendarEvent: (event: CalendarEvent) => boolean;
  getDayDraggableProps: (event: CalendarEvent) => DragProps;
  getResizeProps: (
    event: PositionedEvent,
    edge: "start" | "end"
  ) => DragProps;
  onDeleteEvent: (event: PositionedEvent) => void;
};

export function GrayDashboardCalendarDayView({
  selectedDate,
  nowReference,
  timeZoneLabel,
  rangeNavigationLabel,
  showViewSelect,
  showHeaderDates,
  dayIndicatorOffset,
  dayLayouts,
  draggingEventIds,
  selectedEventIds,
  dayColumnRef,
  onNavigateRange,
  onUpdateViewMode,
  onColumnClick,
  onEventClick,
  isGoogleCalendarEvent,
  getDayDraggableProps,
  getResizeProps,
  onDeleteEvent,
}: DayViewProps) {
  const { t } = useI18n();

  const calendarGridStyle = {
    "--calendar-grid-columns": "1",
  } as CSSProperties;

  const isToday = nowReference ? isSameDay(selectedDate, nowReference) : false;

  return (
    <div className={styles.calendarGrid} style={calendarGridStyle}>
      <div className={styles.calendarBody}>
        <div className={styles.calendarMonthRow}>
          <div className={styles.calendarMonthTitleGroup}>
            {showViewSelect && (
              <div className={styles.calendarInlineViewSelect}>
                <ViewModeSelect
                  value="day"
                  options={[
                    { value: "week", label: t("Week") },
                    { value: "day", label: t("Day") },
                  ]}
                  onChange={(mode) => onUpdateViewMode(mode)}
                />
              </div>
            )}
            <div className={`${styles.calendarSurfaceNavArrows} ${styles.calendarMonthNavArrows}`}>
              <button
                type="button"
                aria-label={t("Previous {range}", { range: rangeNavigationLabel })}
                onClick={() => onNavigateRange(-1)}
              >
                {"<"}
              </button>
              <button
                type="button"
                aria-label={t("Next {range}", { range: rangeNavigationLabel })}
                onClick={() => onNavigateRange(1)}
              >
                {">"}
              </button>
            </div>
          </div>
        </div>
        {showHeaderDates && (
          <div className={styles.calendarHeaderRow}>
            <div className={styles.calendarHeaderPlaceholder}>
              <span className={styles.calendarTimezoneLabel}>+ {timeZoneLabel}</span>
            </div>
            <div
              className={styles.calendarHeaderCell}
              data-selected="true"
              data-today={isToday ? "true" : "false"}
            >
              <span>{selectedDate.toLocaleDateString(undefined, { weekday: "short" })}</span>
              <strong>{selectedDate.getDate()}</strong>
            </div>
          </div>
        )}
        <div className={styles.calendarBodyScroll} ref={dayColumnRef}>
          <div className={styles.calendarTimesColumn}>
            {HOURS_LABEL.map((label, hour) => (
              <span key={label} data-hour={hour}>
                {label}
              </span>
            ))}
          </div>
          <div className={styles.calendarDayColumn} data-selected="true" data-today={isToday ? "true" : "false"}>
            <div className={styles.calendarColumnScroller} onClick={(event) => onColumnClick(event, selectedDate)}>
              <div className={styles.calendarHourGrid} aria-hidden="true">
                {HOURS.map((hour) => (
                  <div key={hour} className={styles.calendarHourRow} />
                ))}
              </div>
              {dayIndicatorOffset !== null && (
                <div
                  className={styles.nowIndicator}
                  style={{ top: `${dayIndicatorOffset}px` }}
                  aria-hidden="true"
                />
              )}

              {dayLayouts.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onClick={(_e, anchorRect, mouseEvent) => onEventClick(event, anchorRect, mouseEvent)}
                  draggableProps={isGoogleCalendarEvent(event) ? undefined : getDayDraggableProps(event)}
                  resizeProps={isGoogleCalendarEvent(event) ? undefined : getResizeProps}
                  isDragging={draggingEventIds?.has(event.id) ?? false}
                  isSelected={selectedEventIds.has(event.id)}
                  onDelete={onDeleteEvent}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
