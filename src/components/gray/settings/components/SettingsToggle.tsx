"use client";

import styles from "@/app/gray/GrayPageClient.module.css";

export type SettingsToggleProps = {
  checked: boolean;
  onChange: () => void;
  label?: string;
  disabled?: boolean;
};

export function SettingsToggle({ checked, onChange, label, disabled = false }: SettingsToggleProps) {
  return (
    <button
      type="button"
      className={styles.settingsToggle}
      role="switch"
      aria-checked={checked ? "true" : "false"}
      aria-disabled={disabled ? "true" : "false"}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        onChange();
      }}
      aria-label={label}
    >
      <span className={styles.settingsToggleThumb} />
    </button>
  );
}
