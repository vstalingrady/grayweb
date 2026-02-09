"use client";

import { useEffect, useMemo, useState, type ElementType } from "react";
import { Monitor, Moon, Smartphone, Sun } from "lucide-react";
import styles from "../SettingsStyles.module.css";
import type { Locale } from "@/lib/i18n";
import type { ThemeMode } from "@/components/gray/settings/types";
import { SettingsSelect } from "@/components/gray/settings/components/SettingsSelect";

type Translator = (message: string, vars?: Record<string, string | number>) => string;

export type PreferencesSectionProps = {
  t: Translator;
  theme: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
  activeLocale: Locale;
  onLocaleChange: (next: Locale) => void;
  responseLanguage: string;
  onResponseLanguageChange: (value: string) => void;
  themeIcon?: ElementType;
};

export function PreferencesSection({
  t,
  theme,
  onThemeChange,
  activeLocale,
  onLocaleChange,
  responseLanguage,
  onResponseLanguageChange,
}: PreferencesSectionProps) {
  const [systemPrefersLight, setSystemPrefersLight] = useState(false);
  const [preferMobileSystemIcon, setPreferMobileSystemIcon] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const colorSchemeQuery = window.matchMedia("(prefers-color-scheme: light)");
    const coarsePointerQuery = window.matchMedia("(pointer: coarse)");
    const narrowViewportQuery = window.matchMedia("(max-width: 768px)");

    const syncSystemTheme = () => {
      setSystemPrefersLight(colorSchemeQuery.matches);
    };
    const syncDeviceHint = () => {
      setPreferMobileSystemIcon(coarsePointerQuery.matches || narrowViewportQuery.matches);
    };
    syncSystemTheme();
    syncDeviceHint();

    const attachMediaListener = (
      query: MediaQueryList,
      handler: () => void
    ): (() => void) => {
      if (typeof query.addEventListener === "function") {
        query.addEventListener("change", handler);
        return () => query.removeEventListener("change", handler);
      }
      if (typeof query.addListener === "function") {
        query.addListener(handler);
        return () => query.removeListener(handler);
      }
      return () => {};
    };

    const cleanups = [
      attachMediaListener(colorSchemeQuery, syncSystemTheme),
      attachMediaListener(coarsePointerQuery, syncDeviceHint),
      attachMediaListener(narrowViewportQuery, syncDeviceHint),
    ];

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, []);

  const themeIcon = useMemo(() => {
    if (theme === "system") {
      return preferMobileSystemIcon ? Smartphone : Monitor;
    }
    return theme === "light" ? Sun : Moon;
  }, [theme, preferMobileSystemIcon]);
  const systemThemeLabel = systemPrefersLight ? t("System (Light)") : t("System (Dark)");

  return (
    <>
      <div className={styles.settingsPageHeader}>
        <h2 className={styles.settingsPageTitle}>{t("Preferences")}</h2>
      </div>

      <div className={styles.settingsSection}>
        <div className={styles.settingsRow}>
          <div className={styles.settingsLabelGroup}>
            <span className={styles.settingsLabel}>{t("Appearance")}</span>
            <span className={styles.settingsItemDescription}>{t("How Gray looks on your device")}</span>
          </div>
          <SettingsSelect
            value={theme}
            onChange={(val) => onThemeChange(val as ThemeMode)}
            icon={themeIcon}
            options={[
              { value: "system", label: systemThemeLabel },
              { value: "dark", label: t("Dark") },
              { value: "light", label: t("Light") },
            ]}
          />
        </div>

        <div className={styles.settingsRow}>
          <div className={styles.settingsLabelGroup}>
            <span className={styles.settingsLabel}>{t("Language")}</span>
            <span className={styles.settingsItemDescription}>
              {t("The language used in the user interface")}
            </span>
          </div>
          <SettingsSelect
            value={activeLocale}
            onChange={(val) => onLocaleChange(val as Locale)}
            options={[
              { value: "en", label: "English" },
              { value: "id", label: "Bahasa Indonesia" },
            ]}
          />
        </div>

        <div className={styles.settingsRow}>
          <div className={styles.settingsLabelGroup}>
            <span className={styles.settingsLabel}>{t("Preferred response language")}</span>
            <span className={styles.settingsItemDescription}>{t("The language used for AI responses")}</span>
          </div>
          <SettingsSelect
            value={responseLanguage}
            onChange={onResponseLanguageChange}
            options={[
              { value: "auto", label: t("Automatic (detect input)") },
              { value: "en", label: "English" },
              { value: "id", label: "Bahasa Indonesia" },
            ]}
          />
        </div>
      </div>
    </>
  );
}
