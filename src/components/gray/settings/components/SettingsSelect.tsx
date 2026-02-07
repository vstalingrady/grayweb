"use client";

import { useEffect, useMemo, useRef, useState, type ElementType } from "react";
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const menuIsOpen = isOpen && !disabled;
  const activeLabel = useMemo(() => {
    const match = options.find((option) => option.value === value);
    return match?.label ?? value;
  }, [options, value]);

  useEffect(() => {
    if (!menuIsOpen) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuIsOpen]);

  return (
    <div className={styles.settingsSelectButton} style={{ position: "relative" }} ref={containerRef}>
      <button
        type="button"
        id={id}
        className={styles.settingsSelectTrigger}
        onClick={() => {
          if (disabled) return;
          setIsOpen((prev) => !prev);
        }}
        aria-haspopup="listbox"
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
        <div className={styles.settingsSelectMenu} role="listbox">
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected ? "true" : "false"}
                className={styles.settingsSelectOption}
                data-selected={selected ? "true" : "false"}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
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
