"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, X } from "lucide-react";
import styles from "@/app/gray/GrayPageClient.module.css";
import { useI18n } from "@/contexts/I18nContext";

type GeneralSetting = {
  label: string;
  helper: string;
  options?: string[];
  disabled?: boolean;
};

const GENERAL_SETTINGS: GeneralSetting[] = [
  {
    label: "Language",
    helper: "English",
    options: undefined,
    disabled: true,
  },
];

type SettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

type ThemeMode = "dark" | "light" | "system";

const THEME_STORAGE_KEY = "gray_theme";

const resolveInitialTheme = (): ThemeMode => {
  if (typeof window === "undefined") {
    return "system";
  }

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }

  return "system";
};

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [theme, setTheme] = useState<ThemeMode>("system");

  useEffect(() => {
    setTheme(resolveInitialTheme());
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  const handleDeleteAccount = () => {
    onClose();
    router.push("/delete-account");
  };

  if (!isOpen) {
    return null;
  }

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const applyTheme = (nextTheme: ThemeMode) => {
    const root = document.documentElement;
    const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    const shouldBeLight = nextTheme === "light" || (nextTheme === "system" && prefersLight);
    root.classList.toggle("light", shouldBeLight);

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // ignore storage failures
    }

    setTheme(nextTheme);
  };

  const themeOptions: Array<{ value: ThemeMode; label: string }> = [
    { value: "system", label: t("System") },
    { value: "dark", label: t("Dark") },
    { value: "light", label: t("Light") },
  ];

  const currentLabel =
    theme === "system"
      ? t("System")
      : theme === "light"
        ? t("Light")
        : t("Dark");

  return (
    <div
      className={styles.personalizationOverlay}
      role="presentation"
      onClick={handleOverlayClick}
    >
      <div
        className={styles.personalizationPanel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.personalizationPanelHeader}>
          <div>
            <p className={styles.personalizationEyebrow}>{t("Workspace")}</p>
            <h2 id="settings-title">{t("Settings")}</h2>
          </div>
          <button
            type="button"
            className={styles.personalizationClose}
            onClick={onClose}
            aria-label={t("Close settings")}
          >
            <X size={18} />
          </button>
        </header>

        <div className={styles.settingsList}>
          <div className={styles.settingsRow}>
            <span>{t("Appearance")}</span>
            <div className={styles.settingsControl} role="group" aria-label={t("Appearance")}>
              <div className={styles.settingsControlMeta}>
                <span className={styles.settingsControlHelper}>{currentLabel}</span>
                <div className={styles.settingsControlOptions}>
                  {themeOptions.map((option) => {
                    const isActive = theme === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`${styles.settingsControlOption} ${isActive ? styles.settingsControlOptionActive : ""}`}
                        onClick={() => applyTheme(option.value)}
                        aria-pressed={isActive}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <ChevronDown size={14} />
            </div>
          </div>
          {GENERAL_SETTINGS.map(({ label, helper, options, disabled }) => (
            <div key={label} className={styles.settingsRow}>
              <span>{t(label)}</span>
              <button
                type="button"
                className={`${styles.settingsControl} ${
                  disabled ? styles.settingsControlDisabled : ""
                }`}
                aria-disabled={disabled ? "true" : "false"}
                disabled={disabled}
              >
                <div className={styles.settingsControlMeta}>
                  <span className={styles.settingsControlHelper}>{t(helper)}</span>
                  {options && options.length > 0 ? (
                    <div className={styles.settingsControlOptions}>
                      {options.map((option) => (
                        <span key={option} className={styles.settingsControlOption}>
                          {t(option)}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <ChevronDown size={14} />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          className={styles.settingsDeleteLink}
          onClick={handleDeleteAccount}
        >
          {t("Delete Account")}
        </button>
      </div>
    </div>
  );
}
