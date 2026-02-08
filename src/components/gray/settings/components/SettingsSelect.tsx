"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ElementType } from "react";
import { Check, ChevronDown } from "lucide-react";
import styles from "../SettingsStyles.module.css";

type SelectOption = { value: string; label: string };

export type SettingsSelectProps = {
  id?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  icon?: ElementType;
  disabled?: boolean;
};

export function SettingsSelect({
  id,
  value,
  options,
  onChange,
  icon: Icon,
  disabled = false,
}: SettingsSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listboxId = useId();
  const menuIsOpen = isOpen && !disabled;
  const activeLabel = useMemo(() => {
    const match = options.find((option) => option.value === value);
    return match?.label ?? value;
  }, [options, value]);
  const selectedIndex = useMemo(
    () => options.findIndex((option) => option.value === value),
    [options, value]
  );
  const resolvedActiveIndex =
    options.length === 0
      ? -1
      : Math.min(Math.max(activeIndex, 0), options.length - 1);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
  }, []);

  const focusOption = useCallback((index: number) => {
    optionRefs.current[index]?.focus();
  }, []);

  const selectOptionAtIndex = useCallback(
    (index: number) => {
      const option = options[index];
      if (!option) {
        return;
      }
      onChange(option.value);
      closeMenu();
      triggerRef.current?.focus();
    },
    [closeMenu, onChange, options]
  );

  const moveActiveOption = useCallback(
    (nextIndex: number) => {
      if (options.length === 0) {
        return;
      }
      const boundedIndex = Math.max(0, Math.min(options.length - 1, nextIndex));
      setActiveIndex(boundedIndex);
      focusOption(boundedIndex);
    },
    [focusOption, options.length]
  );

  useEffect(() => {
    if (!menuIsOpen) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        closeMenu();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
        triggerRef.current?.focus();
      }
      if (event.key === "Tab") {
        closeMenu();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMenu, menuIsOpen]);

  useEffect(() => {
    if (!menuIsOpen || options.length === 0) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      focusOption(resolvedActiveIndex >= 0 ? resolvedActiveIndex : 0);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [focusOption, menuIsOpen, options.length, resolvedActiveIndex]);

  return (
    <div className={styles.settingsSelectButton} style={{ position: "relative" }} ref={containerRef}>
      <button
        type="button"
        ref={triggerRef}
        id={id}
        className={styles.settingsSelectTrigger}
        onClick={() => {
          if (disabled) return;
          setIsOpen((prev) => {
            const nextIsOpen = !prev;
            if (nextIsOpen) {
              setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
            }
            return nextIsOpen;
          });
        }}
        onKeyDown={(event) => {
          if (disabled || options.length === 0) {
            return;
          }

          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
            return;
          }

          event.preventDefault();
          const initialIndex =
            event.key === "ArrowUp"
              ? selectedIndex >= 0
                ? selectedIndex
                : options.length - 1
              : selectedIndex >= 0
                ? selectedIndex
                : 0;
          setActiveIndex(initialIndex);
          setIsOpen(true);
        }}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-expanded={menuIsOpen ? "true" : "false"}
        aria-disabled={disabled ? "true" : "false"}
        disabled={disabled}
      >
        {Icon ? <Icon size={14} /> : null}
        <span className={styles.settingsSelectValue}>{activeLabel}</span>
        <ChevronDown
          size={14}
          className={styles.settingsSelectChevron}
          aria-hidden="true"
          data-open={menuIsOpen ? "true" : "false"}
        />
      </button>

      {menuIsOpen ? (
        <div
          className={styles.settingsSelectMenu}
          role="listbox"
          id={listboxId}
          aria-labelledby={id}
          onKeyDown={(event) => {
            if (options.length === 0) {
              return;
            }

            if (event.key === "Escape") {
              event.preventDefault();
              closeMenu();
              triggerRef.current?.focus();
              return;
            }

            if (event.key === "ArrowDown") {
              event.preventDefault();
              moveActiveOption((resolvedActiveIndex + 1) % options.length);
              return;
            }

            if (event.key === "ArrowUp") {
              event.preventDefault();
              moveActiveOption((resolvedActiveIndex - 1 + options.length) % options.length);
              return;
            }

            if (event.key === "Home") {
              event.preventDefault();
              moveActiveOption(0);
              return;
            }

            if (event.key === "End") {
              event.preventDefault();
              moveActiveOption(options.length - 1);
              return;
            }

            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              selectOptionAtIndex(resolvedActiveIndex);
            }
          }}
        >
          {options.map((option, index) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                id={`${listboxId}-option-${index}`}
                ref={(node) => {
                  optionRefs.current[index] = node;
                }}
                type="button"
                role="option"
                aria-selected={selected ? "true" : "false"}
                className={styles.settingsSelectOption}
                data-selected={selected ? "true" : "false"}
                tabIndex={index === resolvedActiveIndex ? 0 : -1}
                onFocus={() => setActiveIndex(index)}
                onClick={() => {
                  selectOptionAtIndex(index);
                }}
              >
                <span>{option.label}</span>
                {selected ? <Check size={14} aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
