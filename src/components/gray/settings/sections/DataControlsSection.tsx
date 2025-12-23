"use client";

import { useRef, useState, type ChangeEvent, type Dispatch, type SetStateAction } from "react";
import styles from "../SettingsStyles.module.css";
import { chatService, utilityService, type UserUpdate } from "@/lib/api";
import { SettingsLogo } from "@/components/gray/settings/components/SettingsLogo";
import { SettingsToggle } from "@/components/gray/settings/components/SettingsToggle";
import { PLAN_TIER_LEVELS } from "@/components/gray/utils/helperFunctions";

type Translator = (message: string, vars?: Record<string, string | number>) => string;

export type DataControlsSectionProps = {
  t: Translator;
  userId: number | null;
  tierLevel: number;
  updateUser: (userData: UserUpdate) => Promise<void>;
  modelImprovementEnabled: boolean;
  setModelImprovementEnabled: Dispatch<SetStateAction<boolean>>;
  modelImprovementStorageKey: string;
  conversationMemoryEnabled: boolean;
  setConversationMemoryEnabled: Dispatch<SetStateAction<boolean>>;
  conversationMemoryStorageKey: string;
  contextCacheId: number | null;
  setContextCacheId: (id: number | null) => void;
  onClearLocalCache: () => void;
  isDeletingAllConversations: boolean;
  setIsDeletingAllConversations: Dispatch<SetStateAction<boolean>>;
  clearAllConversations: () => void;
  onUpgradeClick: () => void;
};

export function DataControlsSection({
  t,
  userId,
  tierLevel,
  updateUser,
  modelImprovementEnabled,
  setModelImprovementEnabled,
  modelImprovementStorageKey,
  conversationMemoryEnabled,
  setConversationMemoryEnabled,
  conversationMemoryStorageKey,
  contextCacheId,
  setContextCacheId,
  onClearLocalCache,
  isDeletingAllConversations,
  setIsDeletingAllConversations,
  clearAllConversations,
  onUpgradeClick,
}: DataControlsSectionProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isDeletingImport, setIsDeletingImport] = useState(false);
  const canImportChatGpt = tierLevel >= PLAN_TIER_LEVELS.voyager;

  const handleImportClick = () => {
    if (!canImportChatGpt) {
      onUpgradeClick();
      return;
    }
    fileInputRef.current?.click();
  };

  const handleImportChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) {
      return;
    }
    if (!file.name.toLowerCase().endsWith(".zip")) {
      setImportStatus(t("Please upload a ChatGPT .zip export."));
      return;
    }
    setIsImporting(true);
    setImportStatus(null);
    try {
      const response = await utilityService.importChatGptMemory(file);
      setContextCacheId(response.context_cache_id);
      setImportStatus(
        t("Imported ChatGPT memory: {conversations} conversations, {messages} messages, {facts} features.", {
          conversations: response.conversation_count,
          messages: response.message_count,
          facts: response.fact_count,
        })
      );
    } catch (error) {
      console.error("Failed to import ChatGPT memory:", error);
      setImportStatus(t("Failed to import ChatGPT export. Please try again."));
    } finally {
      setIsImporting(false);
    }
  };

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
              const previous = conversationMemoryEnabled;
              const next = !previous;
              setConversationMemoryEnabled(next);
              if (typeof userId !== "number") {
                if (typeof window !== "undefined") {
                  try {
                    window.localStorage.setItem(conversationMemoryStorageKey, next ? "1" : "0");
                  } catch {
                    // ignore storage failures
                  }
                }
                return;
              }
              void updateUser({ conversation_memory_enabled: next }).catch((error) => {
                console.error("Failed to update conversation memory preference:", error);
                setConversationMemoryEnabled(previous);
              });
            }}
            label={t("Toggle Conversation memory")}
          />
        </div>

        <div
          className={`${styles.settingsRow} ${styles.settingsRowFlexStart} ${!canImportChatGpt ? styles.settingsRowMuted : ""}`}
        >
          <div className={styles.settingsLabelGroup}>
            <div className={styles.settingsLabelRow}>
              <SettingsLogo src="/logos/chatgpt.svg" alt="ChatGPT" />
              <span className={styles.settingsLabel}>{t("Import ChatGPT memory")}</span>
            </div>
            <span className={styles.settingsItemDescription}>
              {t("Upload your ChatGPT export (.zip) to add memories to Gray.")}
            </span>
            {!canImportChatGpt ? (
              <span className={styles.settingsItemDescription}>
                {t("Upgrade to Voyager or Pioneer to access.")}
              </span>
            ) : null}
            {importStatus ? (
              <span className={styles.settingsItemDescription}>{importStatus}</span>
            ) : null}
          </div>
          <div className={styles.settingsFlexRow}>
            {contextCacheId ? (
              <>
                <button
                  type="button"
                  className={styles.settingsAction}
                  onClick={() => {
                    setContextCacheId(null);
                    setImportStatus(t("ChatGPT memory disabled."));
                  }}
                >
                  {t("Disable")}
                </button>
                <button
                  type="button"
                  className={styles.settingsAction}
                  disabled={isDeletingImport}
                  onClick={async () => {
                    if (!confirm(t("Delete ChatGPT memory? This cannot be undone."))) {
                      return;
                    }
                    setIsDeletingImport(true);
                    try {
                      await utilityService.deleteContextCache(contextCacheId);
                      setContextCacheId(null);
                      setImportStatus(t("ChatGPT memory deleted."));
                    } catch (error) {
                      console.error("Failed to delete ChatGPT memory:", error);
                      setImportStatus(t("Failed to delete ChatGPT memory. Please try again."));
                    } finally {
                      setIsDeletingImport(false);
                    }
                  }}
                >
                  {isDeletingImport ? t("Deleting…") : t("Delete")}
                </button>
              </>
            ) : null}
            {canImportChatGpt ? (
              <button
                type="button"
                className={styles.settingsAction}
                onClick={handleImportClick}
                disabled={isImporting}
              >
                {isImporting ? t("Importing...") : t("Import")}
              </button>
            ) : (
              <button
                type="button"
                className={styles.settingsAction}
                onClick={onUpgradeClick}
              >
                {t("Upgrade")}
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,application/zip"
              onChange={handleImportChange}
              disabled={!canImportChatGpt}
              style={{ display: "none" }}
            />
          </div>
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
                  await chatService.deleteAllConversations(userId);
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
