import {
  CalendarEvent,
  LayoutOptions,
  PositionedEvent,
} from "./types";

const MINUTES_IN_DAY = 24 * 60;

const minutesBetween = (start: Date, end: Date) =>
  Math.max(0, (end.getTime() - start.getTime()) / 60000);

const clampMinutes = (value: number) =>
  Math.max(0, Math.min(MINUTES_IN_DAY, value));

const startOfDay = (value: Date) => {
  const result = new Date(value);
  result.setHours(0, 0, 0, 0);
  return result;
};

type EventLayoutMeta = {
  column: number;
  columnSpan: number;
  totalColumns: number;
};

const doesOverlap = (a: CalendarEvent, b: CalendarEvent) =>
  a.start < b.end && b.start < a.end;

export const layoutDayEvents = (
  events: CalendarEvent[],
  options: LayoutOptions
): PositionedEvent[] => {
  if (events.length === 0) {
    return [];
  }

  const {
    hourHeight,
    minimumHeight = 20,
    dayStart = startOfDay(events[0].start),
  } = options;

  const minuteHeight = hourHeight / 60;

  const sorted = [...events].sort(
    (a, b) => a.start.getTime() - b.start.getTime()
  );

  const clusters: CalendarEvent[][] = [];
  let currentCluster: CalendarEvent[] = [];
  let clusterEnd = 0;

  sorted.forEach((event) => {
    const eventStartMinutes = clampMinutes(
      minutesBetween(dayStart, event.start)
    );
    const eventEndMinutes = clampMinutes(
      minutesBetween(dayStart, event.end)
    );

    if (currentCluster.length === 0) {
      currentCluster.push(event);
      clusterEnd = eventEndMinutes;
      return;
    }

    if (eventStartMinutes < clusterEnd) {
      currentCluster.push(event);
      clusterEnd = Math.max(clusterEnd, eventEndMinutes);
      return;
    }

    clusters.push(currentCluster);
    currentCluster = [event];
    clusterEnd = eventEndMinutes;
  });

  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  const placements = new Map<string, EventLayoutMeta>();

  clusters.forEach((cluster) => {
    const columns: CalendarEvent[][] = [];

    cluster.forEach((event) => {
      let placed = false;

      for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
        const column = columns[columnIndex];
        const lastEventInColumn = column[column.length - 1];
        if (lastEventInColumn.end.getTime() <= event.start.getTime()) {
          column.push(event);
          placements.set(event.id, {
            column: columnIndex,
            columnSpan: 1,
            totalColumns: 0, // filled later
          });
          placed = true;
          break;
        }
      }

      if (!placed) {
        columns.push([event]);
        placements.set(event.id, {
          column: columns.length - 1,
          columnSpan: 1,
          totalColumns: 0,
        });
      }
    });

    const totalColumns = columns.length;

    // Update total column count for cluster entries
    cluster.forEach((event) => {
      const meta = placements.get(event.id);
      if (!meta) return;
      meta.totalColumns = totalColumns;
    });

    // Determine how far each event can span into subsequent columns
    cluster.forEach((event) => {
      const meta = placements.get(event.id);
      if (!meta) return;

      let span = 1;
      for (let columnIndex = meta.column + 1; columnIndex < totalColumns; columnIndex += 1) {
        const columnEvents = columns[columnIndex];

        const overlaps = columnEvents.some((otherEvent) =>
          doesOverlap(event, otherEvent)
        );

        if (overlaps) {
          break;
        }
        span += 1;
      }

      meta.columnSpan = span;
    });
  });

  return sorted.map((event) => {
    const meta = placements.get(event.id);
    const startMinutes = clampMinutes(
      minutesBetween(dayStart, event.start)
    );
    const endMinutes = clampMinutes(
      minutesBetween(dayStart, event.end)
    );
    const durationMinutes = Math.max(endMinutes - startMinutes, 5);
    const height = Math.max(durationMinutes * minuteHeight, minimumHeight);
    const top = startMinutes * minuteHeight;

    if (!meta) {
      return {
        ...event,
        top,
        height,
        column: 0,
        columnSpan: 1,
        width: 1,
        columnCount: 1,
        zIndex: 1,
      };
    }

    const width =
      meta.totalColumns > 0
        ? Math.max(meta.columnSpan / meta.totalColumns, 0)
        : 1;
    return {
      ...event,
      top,
      height,
      column: meta.column,
      columnSpan: meta.columnSpan,
      width,
      columnCount: meta.totalColumns,
      zIndex: meta.column + 1,
    };
  });
};
