"use client";

import type { Dispatch, SetStateAction } from "react";
import { ChevronRight } from "lucide-react";
import styles from "@/app/gray/GrayPageClient.module.css";
import { apiService, type UserUpdate } from "@/lib/api";
import { SettingsToggle } from "@/components/gray/settings/components/SettingsToggle";

type Translator = (message: string, vars?: Record<string, string | number>) => string;

export type DataControlsSectionProps = {
  t: Translator;
  userId: number | null;
  updateUser: (userData: UserUpdate) => Promise<void>;
  modelImprovementEnabled: boolean;
  setModelImprovementEnabled: Dispatch<SetStateAction<boolean>>;
  modelImprovementStorageKey: string;
  conversationMemoryEnabled: boolean;
  setConversationMemoryEnabled: Dispatch<SetStateAction<boolean>>;
  conversationMemoryStorageKey: string;
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
  conversationMemoryEnabled,
  setConversationMemoryEnabled,
  conversationMemoryStorageKey,
  onClearLocalCache,
  isDeletingAllConversations,
  setIsDeletingAllConversations,
  clearAllConversations,
}: DataControlsSectionProps) {
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
          <button
            type="button"
            className={styles.settingsRowLink}
            aria-pressed={modelImprovementEnabled}
            aria-label={t("Toggle Improve the model for everyone")}
            onClick={() => {
              const previous = modelImprovementEnabled;
              const next = !previous;
              setModelImprovementEnabled(next);
              if (typeof window !== "undefined") {
                try {
                  window.localStorage.setItem(modelImprovementStorageKey, next ? "1" : "0");
                } catch {
                  // ignore storage failures
                }
              }
              if (typeof userId !== "number") {
                return;
              }
              void updateUser({ improve_model_for_everyone: next }).catch((error) => {
                console.error("Failed to update model improvement preference:", error);
                setModelImprovementEnabled(previous);
                if (typeof window !== "undefined") {
                  try {
                    window.localStorage.setItem(modelImprovementStorageKey, previous ? "1" : "0");
                  } catch {
                    // ignore storage failures
                  }
                }
              });
            }}
          >
            <span className={styles.settingsValue}>{modelImprovementEnabled ? t("On") : t("Off")}</span>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>

        <div className={styles.settingsRow}>
          <div className={styles.settingsLabelGroup}>
            <span className={styles.settingsLabel}>{t("Conversation memory")}</span>
            <span className={styles.settingsItemDescription}>
              {t("Allow Gray to remember details from your previous conversations.")}
            </span>
          </div>
          <SettingsToggle
            checked={conversationMemoryEnabled}
            onChange={() => {
              const next = !conversationMemoryEnabled;
              setConversationMemoryEnabled(next);
              if (typeof window !== "undefined") {
                try {
                  window.localStorage.setItem(conversationMemoryStorageKey, next ? "1" : "0");
                } catch {
                  // ignore storage failures
                }
              }
            }}
            label={t("Toggle Conversation memory")}
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
              try {
                if (typeof userId === "number") {
                  await apiService.deleteAllConversations(userId);
                }
                clearAllConversations();
              } catch (error) {
                console.error("Failed to delete all conversations:", error);
                alert(t("Failed to delete conversations. Please try again."));
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
