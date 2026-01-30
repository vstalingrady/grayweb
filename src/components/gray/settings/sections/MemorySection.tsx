"use client";

import { useEffect, useRef, useState, type ChangeEvent, type Dispatch, type SetStateAction } from "react";
import { ChevronDown } from "lucide-react";
import styles from "../SettingsStyles.module.css";
import { utilityService, supermemoryService, type UserUpdate } from "@/lib/api";
import { SettingsLogo } from "@/components/gray/settings/components/SettingsLogo";
import { SettingsToggle } from "@/components/gray/settings/components/SettingsToggle";
import { SettingsSelect } from "@/components/gray/settings/components/SettingsSelect";
import { PLAN_TIER_LEVELS } from "@/components/gray/utils/helperFunctions";
import {
  buildMemorySettingsStorageKey,
  memorySettingsToUserUpdate,
  mergeMemorySettings,
  loadMemorySettings,
  parseMemorySettings,
  saveMemorySettings,
  type MemorySettings,
} from "@/lib/memorySettings";

type Translator = (message: string, vars?: Record<string, string | number>) => string;

export type MemorySectionProps = {
  t: Translator;
  userId: number | null;
  tierLevel: number;
  updateUser: (userData: UserUpdate) => Promise<void>;
  accountMemorySettings?: Partial<MemorySettings> | null;
  conversationMemoryEnabled: boolean;
  setConversationMemoryEnabled: Dispatch<SetStateAction<boolean>>;
  conversationMemoryStorageKey: string;
  contextCacheId: number | null;
  setContextCacheId: (id: number | null) => void;
  onUpgradeClick: () => void;
};

export function MemorySection({
  t,
  userId,
  tierLevel,
  updateUser,
  accountMemorySettings = null,
  conversationMemoryEnabled,
  setConversationMemoryEnabled,
  conversationMemoryStorageKey,
  contextCacheId,
  setContextCacheId,
  onUpgradeClick,
}: MemorySectionProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isDeletingImport, setIsDeletingImport] = useState(false);
  const [supermemoryInput, setSupermemoryInput] = useState("");
  const [supermemoryStatus, setSupermemoryStatus] = useState<string | null>(null);
  const [supermemoryOutput, setSupermemoryOutput] = useState<string | null>(null);
  const [isSupermemoryBusy, setIsSupermemoryBusy] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const canImportChatGpt = tierLevel >= PLAN_TIER_LEVELS.voyager;
  const canUseSupermemory = tierLevel >= PLAN_TIER_LEVELS.pathfinder;
  const memoryControlsDisabled = !canUseSupermemory || !conversationMemoryEnabled;
  const supermemoryActionsDisabled = memoryControlsDisabled || isSupermemoryBusy;

  const memorySettingsKey = buildMemorySettingsStorageKey(userId ?? "anon");
  const [memorySettings, setMemorySettings] = useState<MemorySettings>(() =>
    loadMemorySettings(memorySettingsKey)
  );
  const autoMemoryEnabled = memorySettings.autoRecall && memorySettings.autoCapture;

  useEffect(() => {
    const localSettings = loadMemorySettings(memorySettingsKey);
    const mergedSettings = mergeMemorySettings(localSettings, accountMemorySettings);
    setMemorySettings(mergedSettings);
    saveMemorySettings(memorySettingsKey, mergedSettings);
  }, [accountMemorySettings, memorySettingsKey]);

  const updateMemorySettings = (patch: Partial<MemorySettings>) => {
    setMemorySettings((prev) => {
      const normalized = parseMemorySettings({ ...prev, ...patch });
      saveMemorySettings(memorySettingsKey, normalized);
      if (typeof userId === "number") {
        const previous = prev;
        void updateUser(memorySettingsToUserUpdate(normalized)).catch((error) => {
          console.error("Failed to update memory settings:", error);
          setMemorySettings(previous);
          saveMemorySettings(memorySettingsKey, previous);
        });
      }
      return normalized;
    });
  };

  const handleNumberChange = (
    value: string,
    field: "maxRecallResults" | "profileFrequency",
    min: number,
    max: number
  ) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
      return;
    }
    const clamped = Math.min(max, Math.max(min, parsed));
    updateMemorySettings({ [field]: clamped } as Partial<MemorySettings>);
  };

  const resetSupermemoryOutput = () => {
    setSupermemoryStatus(null);
    setSupermemoryOutput(null);
  };

  const handleSupermemoryStore = async () => {
    const text = supermemoryInput.trim();
    if (!text) {
      setSupermemoryStatus(t("Enter something to remember."));
      return;
    }
    setIsSupermemoryBusy(true);
    resetSupermemoryOutput();
    try {
      const response = await supermemoryService.store(text);
      setSupermemoryStatus(response.message || t("Memory stored."));
    } catch (error) {
      console.error("Failed to store supermemory:", error);
      setSupermemoryStatus(t("Memory request failed. Please try again."));
    } finally {
      setIsSupermemoryBusy(false);
    }
  };

  const handleSupermemorySearch = async () => {
    const query = supermemoryInput.trim();
    if (!query) {
      setSupermemoryStatus(t("Enter a search query."));
      return;
    }
    setIsSupermemoryBusy(true);
    resetSupermemoryOutput();
    try {
      const response = await supermemoryService.search(query, 5);
      if (!response.results.length) {
        setSupermemoryStatus(t("No memories found."));
        return;
      }
      const lines = response.results.map((result, index) => {
        const score =
          typeof result.similarity === "number"
            ? ` (${Math.round(result.similarity * 100)}%)`
            : "";
        return `${index + 1}. ${result.memory}${score}`;
      });
      setSupermemoryOutput(
        `${t("Found {count} memories:", { count: response.count })}\n\n${lines.join("\n")}`
      );
    } catch (error) {
      console.error("Failed to search supermemory:", error);
      setSupermemoryStatus(t("Memory request failed. Please try again."));
    } finally {
      setIsSupermemoryBusy(false);
    }
  };

  const handleSupermemoryProfile = async () => {
    setIsSupermemoryBusy(true);
    resetSupermemoryOutput();
    try {
      const query = supermemoryInput.trim() || undefined;
      const response = await supermemoryService.profile(query);
      const staticFacts = response.static ?? [];
      const dynamicFacts = response.dynamic ?? [];
      if (!staticFacts.length && !dynamicFacts.length) {
        setSupermemoryStatus(t("No profile information yet."));
        return;
      }
      const sections: string[] = [];
      if (staticFacts.length) {
        sections.push(
          `## ${t("User Profile (Persistent)")}\n${staticFacts.map((fact) => `- ${fact}`).join("\n")}`
        );
      }
      if (dynamicFacts.length) {
        sections.push(
          `## ${t("Recent Context")}\n${dynamicFacts.map((fact) => `- ${fact}`).join("\n")}`
        );
      }
      setSupermemoryOutput(sections.join("\n\n"));
    } catch (error) {
      console.error("Failed to fetch supermemory profile:", error);
      setSupermemoryStatus(t("Memory request failed. Please try again."));
    } finally {
      setIsSupermemoryBusy(false);
    }
  };

  const handleSupermemoryForget = async () => {
    const query = supermemoryInput.trim();
    if (!query) {
      setSupermemoryStatus(t("Enter a memory to forget."));
      return;
    }
    setIsSupermemoryBusy(true);
    resetSupermemoryOutput();
    try {
      const response = await supermemoryService.forget(query);
      setSupermemoryStatus(response.message || t("Memory forgotten."));
    } catch (error) {
      console.error("Failed to forget supermemory:", error);
      setSupermemoryStatus(t("Memory request failed. Please try again."));
    } finally {
      setIsSupermemoryBusy(false);
    }
  };

  const handleSupermemoryWipe = async () => {
    if (!confirm(t("Delete all long-term memories? This cannot be undone."))) {
      return;
    }
    setIsSupermemoryBusy(true);
    resetSupermemoryOutput();
    try {
      const response = await supermemoryService.wipe(true);
      if (response.deletedCount) {
        setSupermemoryStatus(t("Deleted {count} memories.", { count: response.deletedCount }));
      } else {
        setSupermemoryStatus(t("No memories to delete."));
      }
    } catch (error) {
      console.error("Failed to wipe supermemory:", error);
      setSupermemoryStatus(t("Memory request failed. Please try again."));
    } finally {
      setIsSupermemoryBusy(false);
    }
  };

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
        <h2 className={styles.settingsPageTitle}>{t("Memory")}</h2>
      </div>

      <div className={styles.settingsSection}>
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
      </div>

      <div className={styles.settingsSection}>
        <div className={`${styles.settingsRow} ${memoryControlsDisabled ? styles.settingsRowMuted : ""}`}>
          <div className={styles.settingsLabelGroup}>
            <span className={styles.settingsLabel}>{t("Automatic memory")}</span>
            <span className={styles.settingsItemDescription}>
              {t("Let Gray automatically recall and save helpful details.")}
            </span>
            {!canUseSupermemory ? (
              <span className={styles.settingsItemDescription}>
                {t("Upgrade to Pathfinder to access.")}
              </span>
            ) : null}
            {canUseSupermemory && !conversationMemoryEnabled ? (
              <span className={styles.settingsItemDescription}>
                {t("Enable Conversation memory to use long-term memory.")}
              </span>
            ) : null}
          </div>
          <SettingsToggle
            checked={autoMemoryEnabled}
            onChange={() => {
              const next = !autoMemoryEnabled;
              updateMemorySettings({ autoRecall: next, autoCapture: next });
            }}
            label={t("Toggle Automatic memory")}
            disabled={memoryControlsDisabled}
          />
        </div>
      </div>

      <div className={styles.settingsSection}>
        <div
          className={`${styles.settingsRow} ${styles.settingsRowFlexStart} ${!canUseSupermemory ? styles.settingsRowMuted : ""}`}
        >
          <div className={styles.settingsLabelGroup}>
            <span className={styles.settingsLabel}>{t("Memory tools")}</span>
            <span className={styles.settingsItemDescription}>
              {t("Store or recall something specific.")}
            </span>
            {!canUseSupermemory ? (
              <span className={styles.settingsItemDescription}>
                {t("Upgrade to Pathfinder to access.")}
              </span>
            ) : null}
            {canUseSupermemory && !conversationMemoryEnabled ? (
              <span className={styles.settingsItemDescription}>
                {t("Enable Conversation memory to use long-term memory.")}
              </span>
            ) : null}
            {supermemoryStatus ? (
              <span className={styles.settingsItemDescription}>{supermemoryStatus}</span>
            ) : null}
            {supermemoryOutput ? (
              <span className={`${styles.settingsItemDescription} ${styles.settingsItemDescriptionPre}`}>
                {supermemoryOutput}
              </span>
            ) : null}
            <div className={styles.settingsFullWidthInput}>
              <input
                className={styles.settingsInput}
                value={supermemoryInput}
                onChange={(event) => setSupermemoryInput(event.target.value)}
                placeholder={t("Enter a memory or search query...")}
                disabled={!canUseSupermemory || !conversationMemoryEnabled || isSupermemoryBusy}
              />
            </div>
          </div>
          <div className={`${styles.settingsFlexRow} ${styles.settingsFlexRowWrap}`}>
            {canUseSupermemory ? (
              <>
                <button
                  type="button"
                  className={styles.settingsAction}
                  disabled={supermemoryActionsDisabled}
                  onClick={handleSupermemoryStore}
                >
                  {t("Remember")}
                </button>
                <button
                  type="button"
                  className={styles.settingsAction}
                  disabled={supermemoryActionsDisabled}
                  onClick={handleSupermemorySearch}
                >
                  {t("Recall")}
                </button>
                {showAdvanced ? (
                  <>
                    <button
                      type="button"
                      className={styles.settingsAction}
                      disabled={supermemoryActionsDisabled}
                      onClick={handleSupermemoryProfile}
                    >
                      {t("Profile")}
                    </button>
                    <button
                      type="button"
                      className={styles.settingsAction}
                      disabled={supermemoryActionsDisabled}
                      onClick={handleSupermemoryForget}
                    >
                      {t("Forget")}
                    </button>
                    <button
                      type="button"
                      className={`${styles.settingsAction} ${styles.settingsActionDanger}`}
                      disabled={supermemoryActionsDisabled}
                      onClick={handleSupermemoryWipe}
                    >
                      {t("Wipe")}
                    </button>
                  </>
                ) : null}
              </>
            ) : (
              <button type="button" className={styles.settingsAction} onClick={onUpgradeClick}>
                {t("Upgrade")}
              </button>
            )}
          </div>
        </div>
        <div className={styles.settingsAdvancedToggle}>
          <button
            type="button"
            className={styles.settingsRowLink}
            onClick={() => setShowAdvanced((prev) => !prev)}
          >
            {showAdvanced ? t("Hide advanced settings") : t("Show advanced settings")}
            <ChevronDown className={showAdvanced ? styles.settingsActionChevron : undefined} size={14} />
          </button>
        </div>
      </div>

      {showAdvanced ? (
        <>
          <div className={styles.settingsSection}>
            <div className={`${styles.settingsRow} ${!canUseSupermemory ? styles.settingsRowMuted : ""}`}>
              <div className={styles.settingsLabelGroup}>
                <span className={styles.settingsLabel}>{t("Advanced memory behavior")}</span>
                <span className={styles.settingsItemDescription}>
                  {t("Tune how long-term memory is recalled and captured.")}
                </span>
                <span className={styles.settingsItemDescription}>
                  {t("Tier caps: Pathfinder 4 recalls / 200 turns, Voyager 8 / 75, Pioneer full limits.")}
                </span>
                {!canUseSupermemory ? (
                  <span className={styles.settingsItemDescription}>
                    {t("Upgrade to Pathfinder to access.")}
                  </span>
                ) : null}
                {canUseSupermemory && !conversationMemoryEnabled ? (
                  <span className={styles.settingsItemDescription}>
                    {t("Enable Conversation memory to use long-term memory.")}
                  </span>
                ) : null}
              </div>
            </div>

            <div className={`${styles.settingsRow} ${memoryControlsDisabled ? styles.settingsRowMuted : ""}`}>
              <div className={styles.settingsLabelGroup}>
                <span className={styles.settingsLabel}>{t("Auto-recall")}</span>
                <span className={styles.settingsItemDescription}>
                  {t("Inject relevant memories before each reply.")}
                </span>
              </div>
              <SettingsToggle
                checked={memorySettings.autoRecall}
                onChange={() => updateMemorySettings({ autoRecall: !memorySettings.autoRecall })}
                label={t("Toggle Auto-recall")}
                disabled={memoryControlsDisabled}
              />
            </div>

            <div className={`${styles.settingsRow} ${memoryControlsDisabled ? styles.settingsRowMuted : ""}`}>
              <div className={styles.settingsLabelGroup}>
                <span className={styles.settingsLabel}>{t("Auto-capture")}</span>
                <span className={styles.settingsItemDescription}>
                  {t("Save new memories after each reply.")}
                </span>
              </div>
              <SettingsToggle
                checked={memorySettings.autoCapture}
                onChange={() => updateMemorySettings({ autoCapture: !memorySettings.autoCapture })}
                label={t("Toggle Auto-capture")}
                disabled={memoryControlsDisabled}
              />
            </div>

            <div className={`${styles.settingsRow} ${memoryControlsDisabled ? styles.settingsRowMuted : ""}`}>
              <div className={styles.settingsLabelGroup}>
                <span className={styles.settingsLabel}>{t("Capture mode")}</span>
                <span className={styles.settingsItemDescription}>
                  {t("Control how much of each turn is stored.")}
                </span>
              </div>
              <SettingsSelect
                value={memorySettings.captureMode}
                disabled={memoryControlsDisabled}
                onChange={(value) =>
                  updateMemorySettings({ captureMode: value as MemorySettings["captureMode"] })
                }
                options={[
                  { value: "all", label: t("All (filter short context)") },
                  { value: "everything", label: t("Everything (capture all messages)") },
                ]}
              />
            </div>

            <div className={`${styles.settingsRow} ${memoryControlsDisabled ? styles.settingsRowMuted : ""}`}>
              <div className={styles.settingsLabelGroup}>
                <span className={styles.settingsLabel}>{t("Max recall results")}</span>
                <span className={styles.settingsItemDescription}>
                  {t("Limit how many memories get injected per response.")}
                </span>
              </div>
              <input
                className={styles.settingsInput}
                type="number"
                min={1}
                max={20}
                step={1}
                inputMode="numeric"
                value={memorySettings.maxRecallResults}
                onChange={(event) => handleNumberChange(event.target.value, "maxRecallResults", 1, 20)}
                disabled={memoryControlsDisabled}
                style={{ maxWidth: 110 }}
              />
            </div>

            <div className={`${styles.settingsRow} ${memoryControlsDisabled ? styles.settingsRowMuted : ""}`}>
              <div className={styles.settingsLabelGroup}>
                <span className={styles.settingsLabel}>{t("Profile injection frequency")}</span>
                <span className={styles.settingsItemDescription}>
                  {t("Inject the full profile every N user turns.")}
                </span>
              </div>
              <input
                className={styles.settingsInput}
                type="number"
                min={1}
                max={500}
                step={1}
                inputMode="numeric"
                value={memorySettings.profileFrequency}
                onChange={(event) => handleNumberChange(event.target.value, "profileFrequency", 1, 500)}
                disabled={memoryControlsDisabled}
                style={{ maxWidth: 110 }}
              />
            </div>
          </div>

          <div className={styles.settingsSection}>
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
                  <button type="button" className={styles.settingsAction} onClick={onUpgradeClick}>
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
        </>
      ) : null}
    </>
  );
}
