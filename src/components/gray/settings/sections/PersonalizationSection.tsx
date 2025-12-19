"use client";

import { Check } from "lucide-react";
import styles from "../SettingsStyles.module.css";
import { SettingsToggle } from "@/components/gray/settings/components/SettingsToggle";
import { SettingsSelect } from "@/components/gray/settings/components/SettingsSelect";

type Translator = (message: string, vars?: Record<string, string | number>) => string;

export type PersonalizationSectionProps = {
  t: Translator;
  autoWebSearchEnabled: boolean;
  onToggleAutoWebSearch: () => void;
  nickname: string;
  onNicknameChange: (value: string) => void;
  occupation: string;
  onOccupationChange: (value: string) => void;
  about: string;
  onAboutChange: (value: string) => void;
  aboutSaveState: "idle" | "saving" | "success" | "error";
  onSaveBio: () => void;
  location: string;
  onLocationChange: (value: string) => void;
  timeZone: string;
  onTimeZoneChange: (value: string) => void;
  resolvedDeviceTimeZone: string;
  supportedTimeZones: string[];
  localeSaveState: "idle" | "saving" | "success" | "error";
  onUseDeviceTimeZone: () => void;
  onSaveLocale: () => void;
  customInstructions: string;
  onCustomInstructionsChange: (value: string) => void;
  customSaveState: "idle" | "saving" | "success" | "error";
  onClearCustomInstructions: () => void;
  onSaveCustomInstructions: () => void;
};

export function PersonalizationSection({
  t,
  autoWebSearchEnabled,
  onToggleAutoWebSearch,
  nickname,
  onNicknameChange,
  occupation,
  onOccupationChange,
  about,
  onAboutChange,
  aboutSaveState,
  onSaveBio,
  location,
  onLocationChange,
  timeZone,
  onTimeZoneChange,
  resolvedDeviceTimeZone,
  supportedTimeZones,
  localeSaveState,
  onUseDeviceTimeZone,
  onSaveLocale,
  customInstructions,
  onCustomInstructionsChange,
  customSaveState,
  onClearCustomInstructions,
  onSaveCustomInstructions,
}: PersonalizationSectionProps) {
  return (
    <>
      <div className={styles.settingsPageHeader}>
        <h2 className={styles.settingsPageTitle}>{t("Personalization")}</h2>
      </div>

      <div className={styles.settingsSection}>
        <h3 className={styles.settingsSectionTitle}>{t("Quick toggles")}</h3>

        <div className={styles.settingsRow}>
          <div className={styles.settingsLabelGroup}>
            <span className={styles.settingsLabel}>{t("Automatic web search")}</span>
            <span className={styles.settingsItemDescription}>{t("Let Gray search for answers automatically.")}</span>
          </div>
          <SettingsToggle
            checked={autoWebSearchEnabled}
            onChange={onToggleAutoWebSearch}
            label={t("Toggle automatic web search")}
          />
        </div>
      </div>

      <div className={styles.settingsSection}>
        <div className={styles.settingsFormGrid}>
          <div className={styles.settingsFormField}>
            <label className={styles.settingsFormLabel} htmlFor="settings-nickname">
              {t("Nickname")}
            </label>
            <input
              id="settings-nickname"
              className={styles.settingsInput}
              value={nickname}
              onChange={(e) => onNicknameChange(e.target.value)}
              placeholder={t("What should Gray call you?")}
            />
          </div>

          <div className={styles.settingsFormField}>
            <label className={styles.settingsFormLabel} htmlFor="settings-occupation">
              {t("Occupation")}
            </label>
            <input
              id="settings-occupation"
              className={styles.settingsInput}
              value={occupation}
              onChange={(e) => onOccupationChange(e.target.value)}
              placeholder={t("Role, industry, or focus")}
            />
          </div>
        </div>

        <label className={styles.settingsFormLabel} htmlFor="settings-about" style={{ marginTop: 12 }}>
          {t("About")}
        </label>
        <textarea
          id="settings-about"
          className={styles.settingsTextarea}
          value={about}
          onChange={(e) => onAboutChange(e.target.value)}
          placeholder={t("Share anything that helps Gray personalize responses.")}
        />
        <div className={styles.settingsButtonGroup}>
          <button
            type="button"
            className={`${styles.settingsAction} ${styles.settingsPrimaryButton}`}
            onClick={onSaveBio}
          >
            {aboutSaveState === "saving" ? t("Saving...") : aboutSaveState === "success" ? t("Saved") : t("Save")}
          </button>
        </div>
      </div>

      <div className={styles.settingsSection}>
        <h3 className={styles.settingsSectionTitle}>{t("Location & time")}</h3>
        <div className={styles.settingsFormGrid}>
          <div className={styles.settingsFormField}>
            <label className={styles.settingsFormLabel} htmlFor="settings-location">
              {t("Location")}
            </label>
            <input
              id="settings-location"
              className={styles.settingsInput}
              value={location}
              onChange={(e) => onLocationChange(e.target.value)}
              placeholder={t("City, region, and/or country")}
            />
          </div>

          <div className={styles.settingsFormField}>
            <label className={styles.settingsFormLabel} htmlFor="settings-timezone">
              {t("Time zone")}
            </label>
            {supportedTimeZones.length > 0 ? (
              <SettingsSelect
                id="settings-timezone"
                value={timeZone}
                onChange={onTimeZoneChange}
                options={supportedTimeZones.map((zone) => ({ value: zone, label: zone }))}
              />
            ) : (
              <input
                id="settings-timezone"
                className={styles.settingsInput}
                value={timeZone}
                onChange={(e) => onTimeZoneChange(e.target.value)}
                placeholder={resolvedDeviceTimeZone}
              />
            )}
          </div>
        </div>

        <div className={styles.settingsButtonGroup}>
          <button type="button" className={styles.settingsSecondaryButton} onClick={onUseDeviceTimeZone}>
            <Check size={14} />
            {t("Use device time zone")}
          </button>
          <button
            type="button"
            className={`${styles.settingsAction} ${styles.settingsPrimaryButton}`}
            onClick={onSaveLocale}
          >
            {localeSaveState === "saving"
              ? t("Saving...")
              : localeSaveState === "success"
                ? t("Saved")
                : t("Save")}
          </button>
        </div>
      </div>

      <div className={styles.settingsSection}>
        <h3 className={styles.settingsSectionTitle}>{t("Custom instructions")}</h3>
        <textarea
          className={styles.settingsTextarea}
          value={customInstructions}
          onChange={(e) => onCustomInstructionsChange(e.target.value)}
          placeholder={t("Paste instructions here if you prefer to edit them manually.")}
        />
        <div className={styles.settingsButtonGroup}>
          <button type="button" className={styles.settingsSecondaryButton} onClick={onClearCustomInstructions}>
            <Trash2 size={14} />
            {t("Clear")}
          </button>
          <button
            type="button"
            className={`${styles.settingsAction} ${styles.settingsPrimaryButton}`}
            onClick={onSaveCustomInstructions}
          >
            {customSaveState === "saving"
              ? t("Saving...")
              : customSaveState === "success"
                ? t("Saved")
                : t("Save")}
          </button>
        </div>
      </div>
    </>
  );
}
