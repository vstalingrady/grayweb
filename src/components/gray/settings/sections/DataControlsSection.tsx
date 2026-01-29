"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import styles from "../SettingsStyles.module.css";
import { chatService, type UserUpdate } from "@/lib/api";
import { SettingsToggle } from "@/components/gray/settings/components/SettingsToggle";

type Translator = (message: string, vars?: Record<string, string | number>) => string;

export type DataControlsSectionProps = {
  t: Translator;
  userId: number | null;
  updateUser: (userData: UserUpdate) => Promise<void>;
  modelImprovementEnabled: boolean;
  setModelImprovementEnabled: Dispatch<SetStateAction<boolean>>;
  modelImprovementStorageKey: string;
  onClearLocalCache: () => void;
  isDeletingAllConversations: boolean;
  setIsDeletingAllConversations: Dispatch<SetStateAction<boolean>>;
  clearAllConversations: () => void;
};

export function DataControlsSection({
  t,
  userId,
  updateUser,
  modelImprovementEnabled,
  setModelImprovementEnabled,
  modelImprovementStorageKey,
  onClearLocalCache,
  isDeletingAllConversations,
  setIsDeletingAllConversations,
  clearAllConversations,
}: DataControlsSectionProps) {
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null);

  return (
    <>
      <div className={styles.settingsPageHeader}>
        <h2 className={styles.settingsPageTitle}>{t("Data Controls")}</h2>
      </div>

      <div className={styles.settingsSection}>
        <div className={styles.settingsRow}>
          <div className={styles.settingsLabelGroup}>
            <span className={styles.settingsLabel}>{t("Improve the model for everyone")}</span>
          </div>
          <SettingsToggle
            checked={modelImprovementEnabled}
            onChange={() => {
              const previous = modelImprovementEnabled;
              const next = !previous;
              setModelImprovementEnabled(next);
              if (typeof userId !== "number") {
                if (typeof window !== "undefined") {
                  try {
                    window.localStorage.setItem(modelImprovementStorageKey, next ? "1" : "0");
                  } catch {
                    // ignore storage failures
                  }
                }
                return;
              }
              void updateUser({ improve_model_for_everyone: next }).catch((error) => {
                console.error("Failed to update model improvement preference:", error);
                setModelImprovementEnabled(previous);
              });
            }}
            label={t("Toggle Improve the model for everyone")}
          />
        </div>
      </div>

      <div className={styles.settingsSection}>
        <div className={styles.settingsRow}>
          <div className={styles.settingsLabelGroup}>
            <span className={styles.settingsLabel}>{t("Clear local cache")}</span>
            <span className={styles.settingsItemDescription}>
              {t("Reset local preferences and cached state on this device.")}
            </span>
          </div>
          <button className={styles.settingsAction} type="button" onClick={onClearLocalCache}>
            {t("Clear")}
          </button>
        </div>

        <div className={styles.settingsRow}>
          <div className={styles.settingsLabelGroup}>
            <span className={styles.settingsLabel}>{t("Delete All Conversations")}</span>
            <span className={styles.settingsItemDescription}>{t("Delete all of your conversation data.")}</span>
            {deleteStatus ? (
              <span className={styles.settingsItemDescription}>{deleteStatus}</span>
            ) : null}
          </div>
          <button
            className={styles.settingsAction}
            type="button"
            disabled={isDeletingAllConversations}
            onClick={async () => {
              if (!confirm(t("Are you sure you want to delete ALL conversations? This cannot be undone."))) {
                return;
              }

              setIsDeletingAllConversations(true);
              setDeleteStatus(null);
              try {
                if (typeof userId === "number") {
                  await chatService.deleteAllConversations(userId);
                }
                clearAllConversations();
                setDeleteStatus(t("Conversations deleted."));
              } catch (error) {
                console.error("Failed to delete all conversations:", error);
                setDeleteStatus(t("Failed to delete conversations. Please try again."));
              } finally {
                setIsDeletingAllConversations(false);
              }
            }}
          >
            {isDeletingAllConversations ? t("Deleting…") : t("Delete")}
          </button>
        </div>
      </div>
    </>
  );
}
