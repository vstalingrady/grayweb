"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, X } from "lucide-react";
import styles from "@/app/gray/GrayPageClient.module.css";
import { useUser } from "@/contexts/UserContext";

type GeneralSetting = {
  label: string;
  helper: string;
  options?: string[];
  disabled?: boolean;
};

const GENERAL_SETTINGS: GeneralSetting[] = [
  {
    label: "Appearance",
    helper: "Dark",
    options: undefined,
  },
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

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const router = useRouter();
  const { user } = useUser();
  const [mapsEnabled, setMapsEnabled] = useState(false);

  useEffect(() => {
    if (user) {
      // setMapsEnabled(Boolean(user.maps_enabled));
    }
  }, [user]);

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
            <p className={styles.personalizationEyebrow}>Workspace</p>
            <h2 id="settings-title">Settings</h2>
          </div>
          <button
            type="button"
            className={styles.personalizationClose}
            onClick={onClose}
            aria-label="Close settings"
          >
            <X size={18} />
          </button>
        </header>

        <div className={styles.settingsList}>
          {GENERAL_SETTINGS.map(({ label, helper, options, disabled }) => (
            <div key={label} className={styles.settingsRow}>
              <span>{label}</span>
              <button
                type="button"
                className={`${styles.settingsControl} ${disabled ? styles.settingsControlDisabled : ""
                  }`}
                aria-disabled={disabled ? "true" : "false"}
                disabled={disabled}
              >
                <div className={styles.settingsControlMeta}>
                  <span className={styles.settingsControlHelper}>{helper}</span>
                  {options && options.length > 0 ? (
                    <div className={styles.settingsControlOptions}>
                      {options.map((option) => (
                        <span key={option} className={styles.settingsControlOption}>
                          {option}
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
          Delete Account
        </button>
      </div>
    </div>
  );
}
