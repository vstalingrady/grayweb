"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, X } from "lucide-react";
import styles from "@/app/gray/GrayPageClient.module.css";
import { useUser } from "@/contexts/UserContext";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { clearSupabaseAuthStorage } from "@/lib/supabaseStorage";

type GeneralSetting = {
  label: string;
  helper: string;
  options: string[];
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setConfirmDelete(false);
      setDeleteError(null);
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

  useEffect(() => {
    if (!confirmDelete) {
      return;
    }
    const timeout = window.setTimeout(() => setConfirmDelete(false), 6000);
    return () => window.clearTimeout(timeout);
  }, [confirmDelete]);

  const handleDeleteAccount = async () => {
    if (!confirmDelete) {
      setDeleteError(null);
      setConfirmDelete(true);
      return;
    }
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase.auth.signOut({ scope: "local" });
      }
      clearSupabaseAuthStorage();
      const redirect = encodeURIComponent("/delete-account");
      window.location.href = `/login?redirect=${redirect}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start deletion flow";
      setDeleteError(message);
      setIsDeleting(false);
      setConfirmDelete(false);
      return;
    } finally {
      // Navigation will replace the page; no-op in finally block.
    }
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
                className={`${styles.settingsControl} ${
                  disabled ? styles.settingsControlDisabled : ""
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

        <section className={`${styles.settingsCard} ${styles.settingsDangerCard}`}>
          {deleteError ? (
            <p className={styles.settingsDangerError}>{deleteError}</p>
          ) : confirmDelete ? (
            <p className={styles.settingsDangerHelper}>Select confirm again to permanently delete your account.</p>
          ) : null}
          <button
            type="button"
            className={`${styles.settingsDangerButton} ${
              confirmDelete ? styles.settingsDangerButtonConfirm : ""
            }`}
            onClick={handleDeleteAccount}
            disabled={!user || isDeleting}
          >
            {isDeleting ? "Deleting..." : confirmDelete ? "Confirm delete" : "Delete account"}
          </button>
        </section>
      </div>
    </div>
  );
}
