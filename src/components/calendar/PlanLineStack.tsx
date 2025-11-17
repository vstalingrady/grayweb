import { useMemo, type HTMLAttributes, type MutableRefObject } from "react";

import styles from "./GrayDashboardCalendar.module.css";
import { PositionedEvent } from "./types";

type DraggableProps = Pick<HTMLAttributes<HTMLElement>, "onPointerDown">;

type PlanLineStackProps = {
  events: PositionedEvent[];
  getDraggableProps?: (event: PositionedEvent) => DraggableProps | undefined;
  suppressClickRef?: MutableRefObject<boolean>;
  onNodeClick?: (event: PositionedEvent, anchorRect: DOMRect | DOMRectReadOnly) => void;
};

const STACK_HEIGHT = 24;

const buildDistribution = (events: PositionedEvent[]) => {
  if (events.length === 0) {
    return [];
  }
  const sorted = [...events].sort((a, b) => {
    const startDelta = a.start.getTime() - b.start.getTime();
    if (startDelta !== 0) {
      return startDelta;
    }
    return a.id.localeCompare(b.id);
  });
  return sorted.map((event, index) => ({
    event,
    position: (index + 1) / (sorted.length + 1),
  }));
};

export function PlanLineStack({
  events,
  getDraggableProps,
  suppressClickRef,
  onNodeClick,
}: PlanLineStackProps) {
  const distribution = useMemo(() => buildDistribution(events), [events]);
  if (distribution.length === 0) {
    return null;
  }
  const referenceEvent = distribution[0].event;
  const center = referenceEvent.top + referenceEvent.height / 2;
  const lineColor = referenceEvent.color ?? "#6f8bff";
  const stackTop = Math.max(center - STACK_HEIGHT / 2, 0);

  return (
    <div
      className={styles.planLineStack}
      style={{
        top: `${stackTop}px`,
        height: `${STACK_HEIGHT}px`,
        "--plan-line-color": lineColor,
      } as any}
    >
      <div className={styles.planLineTrack} aria-hidden="true" />
      {distribution.map(({ event, position }) => {
        const draggableProps = getDraggableProps?.(event);
        return (
          <div
            key={event.id}
            className={styles.planLineNodeWrapper}
            style={{ left: `${position * 100}%` }}
          >
            <button
              type="button"
              className={styles.planLineNode}
              {...draggableProps}
              onClick={(clickEvent) => {
                clickEvent.stopPropagation();
                if (suppressClickRef?.current) {
                  return;
                }
                const rect = clickEvent.currentTarget.getBoundingClientRect();
                onNodeClick?.(event, rect);
              }}
              aria-label={`Open plan: ${event.title}`}
            >
              <span className={styles.planLineNodeInner} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
