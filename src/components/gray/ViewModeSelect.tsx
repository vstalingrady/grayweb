"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import styles from "@/components/calendar/GrayDashboardCalendar.module.css";
import { useDismissableLayer } from "./hooks/useDismissableLayer";

export type ViewModeOption = {
  value: "week" | "day";
  label: string;
};

type ViewModeSelectProps = {
  value: "week" | "day";
  options: ViewModeOption[];
  onChange: (mode: "week" | "day") => void;
};

export function ViewModeSelect({ value, options, onChange }: ViewModeSelectProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? options[0],
    [value, options]
  );

  const closeMenu = useCallback(() => {
    setIsOpen(false);
  }, []);

  const dismissRefs = useMemo(() => [wrapperRef], []);

  useDismissableLayer({
    isOpen,
    ignoreRefs: dismissRefs,
    onDismiss: closeMenu,
  });

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleOptionSelect = useCallback(
    (nextValue: "week" | "day") => {
      onChange(nextValue);
      closeMenu();
    },
    [closeMenu, onChange]
  );

  return (
    <div className={styles.calendarViewToggle} ref={wrapperRef}>
      <button
        type="button"
        className={styles.calendarViewSelect}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={handleToggle}
      >
        <span>{selectedOption?.label}</span>
        <span className={styles.calendarViewSelectCaret} aria-hidden="true" />
      </button>
      {isOpen && (
        <div className={styles.calendarViewMenu} role="menu">
          {options.map((option) => (
            <button
              type="button"
              key={option.value}
              className={styles.calendarViewMenuItem}
              role="menuitemradio"
              aria-checked={option.value === value}
              data-active={option.value === value ? "true" : "false"}
              onClick={() => handleOptionSelect(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
