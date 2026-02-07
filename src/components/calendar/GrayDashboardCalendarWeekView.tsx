"use client";

import type { CSSProperties, HTMLAttributes, MouseEvent, MutableRefObject } from "react";

import styles from "./GrayDashboardCalendar.module.css";
import { EventCard } from "./EventCard";
import { HOURS, HOURS_LABEL } from "./timeGrid";
import type { CalendarEvent, PositionedEvent } from "./types";
import { isSameDay } from "./dateUtils";
import { ViewModeSelect } from "@/components/gray/ViewModeSelect";
import { useI18n } from "@/contexts/I18nContext";

import type { CalendarViewMode, WeekNowIndicator } from "./dashboardCalendarTypes";

type DragProps = Pick<HTMLAttributes<HTMLElement>, "onPointerDown">;

type WeekViewProps = {
  weekDays: Date[];
  selectedDate: Date;
  nowReference: Date | null;
  timeZoneLabel: string;
  rangeNavigationLabel: string;
  showViewSelect: boolean;
  showHeaderDates: boolean;
  weekNowIndicator: WeekNowIndicator | null;
  weekLayouts: PositionedEvent[][];
  draggingEventIds: Set<string> | null;
  selectedEventIds: Set<string>;
  weekScrollRef: MutableRefObject<HTMLDivElement | null>;
  weekColumnsRef: MutableRefObject<HTMLDivElement | null>;
  onNavigateRange: (direction: number) => void;
  onUpdateViewMode: (mode: CalendarViewMode) => void;
  onColumnClick: (event: MouseEvent<HTMLDivElement>, day: Date) => void;
  onEventClick: (
    event: PositionedEvent,
    anchorRect: DOMRect,
    mouseEvent: MouseEvent
  ) => void;
  isGoogleCalendarEvent: (event: CalendarEvent) => boolean;
  getWeekDraggableProps: (event: CalendarEvent) => DragProps;
  getResizeProps: (
    event: PositionedEvent,
    edge: "start" | "end"
  ) => DragProps;
  onDeleteEvent: (event: PositionedEvent) => void;
};

export function GrayDashboardCalendarWeekView({
  weekDays,
  selectedDate,
  nowReference,
  timeZoneLabel,
  rangeNavigationLabel,
  showViewSelect,
  showHeaderDates,
  weekNowIndicator,
  weekLayouts,
  draggingEventIds,
  selectedEventIds,
  weekScrollRef,
  weekColumnsRef,
  onNavigateRange,
  onUpdateViewMode,
  onColumnClick,
  onEventClick,
  isGoogleCalendarEvent,
  getWeekDraggableProps,
  getResizeProps,
  onDeleteEvent,
}: WeekViewProps) {
  const { t } = useI18n();

  const calendarGridStyle = {
    "--calendar-grid-columns": "7",
  } as CSSProperties;

  return (
    <div className={styles.calendarGrid} style={calendarGridStyle}>
      <div className={styles.calendarBody}>
        <div className={`${styles.calendarBodyScroll} ${styles.calendarBodyScrollWithStickyHeader}`} ref={weekScrollRef}>
          <div className={styles.stickyHeaderGroup}>
            <div className={styles.calendarMonthRow}>
              <div className={styles.calendarMonthTitleGroup}>
                {showViewSelect && (
                  <div className={styles.calendarInlineViewSelect}>
                    <ViewModeSelect
                      value="week"
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
                  <span className={styles.calendarTimezoneLabel}>{timeZoneLabel}</span>
                </div>
                {weekDays.map((day) => {
                  const isSelectedDay = isSameDay(day, selectedDate);
                  const isToday = nowReference ? isSameDay(day, nowReference) : false;
                  return (
                    <div
                      key={day.toISOString()}
                      className={styles.calendarHeaderCell}
                      data-selected={isSelectedDay ? "true" : "false"}
                      data-today={isToday ? "true" : "false"}
                    >
                      <span>{day.toLocaleDateString(undefined, { weekday: "short" })}</span>
                      <strong>{day.getDate()}</strong>
                    </div>
                  );
                })}
              </div>
            )}
            <div className={styles.calendarAllDayRow}>
              <div className={styles.calendarAllDayLabel}>
                <span>{t("All day")}</span>
              </div>
              {weekDays.map((day) => (
                <div key={day.toISOString()} className={styles.calendarAllDayCell}>
                  {/* All-day events will go here later */}
                </div>
              ))}
            </div>
          </div>
          <div className={styles.calendarTimesColumn}>
            {HOURS_LABEL.map((label, hour) => (
              <span key={label} data-hour={hour}>
                {label}
              </span>
            ))}
          </div>
          <div className={styles.calendarWeekColumns} ref={weekColumnsRef}>
            {weekDays.map((day, columnIndex) => {
              const isToday = nowReference ? isSameDay(day, nowReference) : false;
              const columnNowIndicatorOffset =
                weekNowIndicator?.dayIndex === columnIndex ? weekNowIndicator.offset : null;

              const eventsToRender = weekLayouts[columnIndex] || [];

              return (
                <div
                  key={day.toISOString()}
                  className={styles.calendarWeekColumn}
                  data-today={isToday ? "true" : "false"}
                  data-selected={isSameDay(day, selectedDate) ? "true" : "false"}
                >
                  <div className={styles.calendarColumnScroller} onClick={(event) => onColumnClick(event, day)}>
                    <div className={styles.calendarHourGrid} aria-hidden="true">
                      {HOURS.map((hour) => (
                        <div key={hour} className={styles.calendarHourRow} />
                      ))}
                    </div>
                    {columnNowIndicatorOffset !== null && (
                      <div
                        className={styles.nowIndicator}
                        style={{ top: `${columnNowIndicatorOffset}px` }}
                        aria-hidden="true"
                      />
                    )}

                    {eventsToRender.map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        onClick={(_e, anchorRect, mouseEvent) => onEventClick(event, anchorRect, mouseEvent)}
                        draggableProps={isGoogleCalendarEvent(event) ? undefined : getWeekDraggableProps(event)}
                        resizeProps={isGoogleCalendarEvent(event) ? undefined : getResizeProps}
                        isDragging={draggingEventIds?.has(event.id) ?? false}
                        isSelected={selectedEventIds.has(event.id)}
                        onDelete={onDeleteEvent}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
