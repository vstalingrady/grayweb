"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import styles from "@/components/calendar/GrayDashboardCalendar.module.css";

export type ViewModeOption<TValue extends string> = {
  value: TValue;
  label: string;
};

type ViewModeSelectProps<TValue extends string> = {
  value: TValue;
  options: Array<ViewModeOption<TValue>>;
  onChange: (mode: TValue) => void;
};

export function ViewModeSelect<TValue extends string>({
  value,
  options,
  onChange,
}: ViewModeSelectProps<TValue>) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? options[0],
    [value, options]
  );

  const closeMenu = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleOptionSelect = useCallback(
    (nextValue: TValue) => {
      onChange(nextValue);
      closeMenu();
    },
    [closeMenu, onChange]
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        closeMenu();
      }
    };

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleKeydown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeydown);
    };
  }, [closeMenu, isOpen]);

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
              <span className={styles.calendarViewMenuItemCheck} aria-hidden="true">
                <Check
                  size={14}
                  style={{ opacity: option.value === value ? 1 : 0 }}
                />
              </span>
              <span className={styles.calendarViewMenuItemLabel}>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
