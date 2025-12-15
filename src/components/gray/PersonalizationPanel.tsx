"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState, type MouseEvent, type ChangeEvent, type FormEvent } from "react";
import { X } from "lucide-react";
import styles from "@/app/gray/GrayPageClient.module.css";
import type { ContextUsageSummary } from "@/components/gray/types";
import { clampPercent, getContextUsageUsedTokens, getContextUsageVisualizationLimit } from "@/components/gray/contextUsage";
import { useUser } from "@/contexts/UserContext";
import { useI18n } from "@/contexts/I18nContext";
import { useChatStore } from "@/components/gray/ChatProvider";
import { apiService } from "@/lib/api";

type ApiStatus = {
  tone: "idle" | "loading" | "success" | "error";
  message?: string;
};

type PersonalizationPanelProps = {
  onClose: () => void;
  viewerName: string;
  viewerRole?: string;
  viewerPlan?: string;
  contextUsage?: ContextUsageSummary | null;
  userId: number | null;
  profileNickname?: string | null;
  profileOccupation?: string | null;
  profileAbout?: string | null;
  profileCustomInstructions?: string | null;
  profileSystemPromptOverride?: string | null;
  profileLocation?: string | null;
  profileTimeZone?: string | null;
  backgroundOptions: WorkspaceBackgroundOption[];
  selectedBackgroundId: string;
  onSelectBackground: (backgroundId: string) => void;
  onCreateBackground?: (draft: WorkspaceBackgroundDraft) => Promise<void>;
  backgroundsLoading?: boolean;
  backgroundError?: string | null;
};

const formatNumber = (value: number | null | undefined) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }
  return value.toLocaleString();
};

const formatContextLabel = (usage?: ContextUsageSummary | null) => {
  if (!usage) {
    return null;
  }
  const label = usage.modelLabel?.trim() || usage.modelName?.trim() || usage.provider?.trim();
  return label ?? null;
};


export type WorkspaceBackgroundOption = {
  id: string;
  label: string;
  description?: string | null;
  previewStyle: string;
  backdropStyle: string;
  source?: "builtin" | "database";
};

export type WorkspaceBackgroundDraft = {
  assetFile?: File | null;
};

export const GREAT_WAVE_BACKGROUND: WorkspaceBackgroundOption = {
  id: "great-wave",
  label: "Great Wave",
  description: "Classic ukiyo-e energy.",
  previewStyle:
    "linear-gradient(135deg, rgba(16, 18, 28, 0.9), rgba(36, 44, 66, 0.9)), url('https://upload.wikimedia.org/wikipedia/commons/a/a5/Tsunami_by_hokusai_19th_century.jpg')",
  backdropStyle:
    "url('https://upload.wikimedia.org/wikipedia/commons/a/a5/Tsunami_by_hokusai_19th_century.jpg') center / cover no-repeat",
  source: "builtin",
};

export const SOLID_WHITE_BACKGROUND: WorkspaceBackgroundOption = {
  id: "solid-white",
  label: "Clean White",
  description: "Minimalist and bright.",
  previewStyle: "#ffffff",
  backdropStyle: "#ffffff",
  source: "builtin",
};

export const SOLID_BLACK_BACKGROUND: WorkspaceBackgroundOption = {
  id: "solid-black",
  label: "Deep Black",
  description: "Focus and contrast.",
  previewStyle: "#000000",
  backdropStyle: "#000000",
  source: "builtin",
};

const MAX_CUSTOM_INSTRUCTION_FILE_BYTES = 512 * 1024;
const CUSTOM_INSTRUCTION_FILE_ACCEPT =
  ".txt,.md,.json,text/plain,application/json";

const WORKSPACE_BACKGROUND_UPLOAD_MB = 8;
const WORKSPACE_BACKGROUND_UPLOAD_BYTES = WORKSPACE_BACKGROUND_UPLOAD_MB * 1024 * 1024;
const WORKSPACE_BACKGROUND_FILE_ACCEPT =
  ".png,.jpg,.jpeg,.webp,.avif,image/png,image/jpeg,image/webp,image/avif";
const WORKSPACE_BACKGROUND_ALLOWED_MIMES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
];

export function PersonalizationPanel({
  onClose,
  viewerName,
  viewerRole = "Operator",
  viewerPlan,
  contextUsage,
  userId,
  profileNickname,
  profileOccupation,
  profileAbout,
  profileCustomInstructions,
  profileSystemPromptOverride,
  profileLocation,
  profileTimeZone,
  backgroundOptions,
  selectedBackgroundId,
  onSelectBackground,
  onCreateBackground,
  backgroundsLoading = false,
  backgroundError = null,
}: PersonalizationPanelProps) {
  const { t } = useI18n();
  const { autoWebSearchEnabled, setAutoWebSearchEnabled } = useChatStore();

  // Derived context usage display metadata from backend payload only.
  const contextProviderLabel = formatContextLabel(contextUsage);

  const hasContextUsage = Boolean(contextUsage);
  const contextLimit = typeof contextUsage?.limit === "number" ? contextUsage.limit : 0;
  const contextTokensUsed = Math.max(0, getContextUsageUsedTokens(contextUsage));

  const hasFiniteLimit = contextLimit > 0;
  const contextTokensRemaining = hasFiniteLimit
    ? Math.max(0, contextLimit - contextTokensUsed)
    : 0;
  const effectiveContextLimit = hasFiniteLimit ? contextLimit : getContextUsageVisualizationLimit(contextUsage);
  const contextPercent =
    effectiveContextLimit > 0
      ? clampPercent((contextTokensUsed / effectiveContextLimit) * 100)
      : 0;
  const contextPercentLabel = `${Math.round(contextPercent)}%`;
  const contextLimitLabel = hasContextUsage
    ? hasFiniteLimit
      ? t("{count} total tokens", { count: formatNumber(contextLimit) })
      : t("Unlimited context (visualized against {count} tokens)", { count: formatNumber(effectiveContextLimit) })
    : "";
  const contextFooterLabel = hasFiniteLimit
    ? t("{count} tokens left", { count: formatNumber(contextTokensRemaining) })
    : t("No cap active");
  const contextMeterValueText = hasFiniteLimit
    ? t("{used} of {limit} tokens used", {
      used: formatNumber(contextTokensUsed),
      limit: formatNumber(contextLimit),
    })
    : t("{used} tokens used while limit is unlimited", {
      used: formatNumber(contextTokensUsed),
    });
  const contextMeterDescription = hasContextUsage ? contextMeterValueText : "";
  const contextFooterDescription = hasContextUsage ? contextFooterLabel : "";
  const contextMessagesLabel =
    hasContextUsage && contextUsage
      ? t("{count} messages", {
        count: contextUsage.messageCount.toLocaleString(),
      })
      : "";
  const contextTokensLabel = contextUsage
    ? `${contextTokensUsed.toLocaleString()}`
    : "0";

  const { user, updateUser: updateUserProfile } = useUser();
  const mapsEnabled = user?.maps_enabled ?? false;

  const handleMapsToggle = async () => {
    if (!user?.id) return;
    try {
      await updateUserProfile({ maps_enabled: !mapsEnabled });
    } catch (e) {
      console.error("Failed to toggle maps", e);
    }
  };

  const resolvedBackgroundOptions = useMemo(
    () => backgroundOptions,
    [backgroundOptions]
  );
  const [nickname, setNickname] = useState(() => profileNickname ?? "");
  const [occupation, setOccupation] = useState(() => profileOccupation ?? "");
  const [moreAboutYou, setMoreAboutYou] = useState(() => profileAbout ?? "");
  const [customInstructions, setCustomInstructions] = useState(
    () => profileCustomInstructions ?? ""
  );
  const [systemPromptOverride, setSystemPromptOverride] = useState(
    () => profileSystemPromptOverride ?? ""
  );
  const resolvedDeviceTimeZone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
    } catch {
      return "UTC";
    }
  }, []);
  const [location, setLocation] = useState(() => profileLocation ?? "");
  const [timeZone, setTimeZone] = useState(() => profileTimeZone ?? resolvedDeviceTimeZone);
  const [customInstructionsFileName, setCustomInstructionsFileName] = useState<string | null>(null);
  const [customInstructionsFileError, setCustomInstructionsFileError] = useState<string | null>(null);
  const [aboutSaveState, setAboutSaveState] = useState<"idle" | "saving" | "success" | "error">(
    "idle"
  );
  const [aboutSaveMessage, setAboutSaveMessage] = useState<string | null>(null);
  const [customSaveState, setCustomSaveState] = useState<"idle" | "saving" | "success" | "error">(
    "idle"
  );
  const [customSaveMessage, setCustomSaveMessage] = useState<string | null>(null);
  const [localeSaveState, setLocaleSaveState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [localeSaveMessage, setLocaleSaveMessage] = useState<string | null>(null);
  const [overrideSaveState, setOverrideSaveState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [overrideSaveMessage, setOverrideSaveMessage] = useState<string | null>(null);
  const [newBackgroundFile, setNewBackgroundFile] = useState<File | null>(null);
  const [newBackgroundFileName, setNewBackgroundFileName] = useState<string | null>(null);
  const [newBackgroundFileError, setNewBackgroundFileError] = useState<string | null>(null);
  const [backgroundSaveState, setBackgroundSaveState] = useState<ApiStatus>({ tone: "idle" });
  const [compressState, setCompressState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [compressMessage, setCompressMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // Keep nickname in sync with the saved profile value only.
  // Do NOT overwrite it with viewerName, otherwise it keeps snapping back.
  useEffect(() => {
    if (typeof profileNickname === "string") {
      setNickname(profileNickname);
    } else {
      // If there is no saved nickname yet, fall back to the current input value
      // and do NOT auto-inject viewerName, so user edits are preserved.
      setNickname((current) => (current === "" ? "" : current));
    }
  }, [profileNickname]);

  useEffect(() => {
    // Only use the saved profile occupation; do NOT auto-fill from role.
    // This ensures the field is blank until the user explicitly sets it.
    setOccupation(profileOccupation ?? "");
  }, [profileOccupation]);

  useEffect(() => {
    setMoreAboutYou(profileAbout ?? "");
  }, [profileAbout]);

  useEffect(() => {
    setCustomInstructions(profileCustomInstructions ?? "");
    setCustomInstructionsFileName(null);
    setCustomInstructionsFileError(null);
  }, [profileCustomInstructions]);

  useEffect(() => {
    setSystemPromptOverride(profileSystemPromptOverride ?? "");
  }, [profileSystemPromptOverride]);

  useEffect(() => {
    setLocation(profileLocation ?? "");
  }, [profileLocation]);

  useEffect(() => {
    setTimeZone(profileTimeZone ?? resolvedDeviceTimeZone);
  }, [profileTimeZone, resolvedDeviceTimeZone]);

  useEffect(() => {
    if (aboutSaveState !== "success") {
      return;
    }
    const timeout = window.setTimeout(() => {
      setAboutSaveState("idle");
      setAboutSaveMessage(null);
    }, 2400);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [aboutSaveState]);

  useEffect(() => {
    if (customSaveState !== "success") {
      return;
    }
    const timeout = window.setTimeout(() => {
      setCustomSaveState("idle");
      setCustomSaveMessage(null);
    }, 2400);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [customSaveState]);

  useEffect(() => {
    if (localeSaveState !== "success") {
      return;
    }
    const timeout = window.setTimeout(() => {
      setLocaleSaveState("idle");
      setLocaleSaveMessage(null);
    }, 2400);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [localeSaveState]);

  useEffect(() => {
    if (overrideSaveState !== "success") {
      return;
    }
    const timeout = window.setTimeout(() => {
      setOverrideSaveState("idle");
      setOverrideSaveMessage(null);
    }, 2400);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [overrideSaveState]);

  useEffect(() => {
    if (backgroundSaveState.tone !== "success") {
      return;
    }
    const timeout = window.setTimeout(() => {
      setBackgroundSaveState({ tone: "idle" });
    }, 2400);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [backgroundSaveState.tone]);

  const baselineNickname = (profileNickname ?? "").trim();
  const baselineOccupation = (profileOccupation ?? "").trim();
  const baselineAbout = (profileAbout ?? "").trim();
  const baselineCustomInstructions = (profileCustomInstructions ?? "").trim();
  const baselineSystemPromptOverride = (profileSystemPromptOverride ?? "").trim();
  const normalizedNickname = nickname.trim();
  const normalizedOccupation = occupation.trim();
  const normalizedAbout = moreAboutYou.trim();
  const normalizedCustomInstructions = customInstructions.trim();
  const normalizedSystemPromptOverride = systemPromptOverride.trim();
  const hasUploadedBackground = Boolean(newBackgroundFile);
  const aboutHasChanges =
    normalizedNickname !== baselineNickname ||
    normalizedOccupation !== baselineOccupation ||
    normalizedAbout !== baselineAbout;
  const canSubmitAbout =
    Boolean(userId) && (aboutHasChanges || aboutSaveState === "error") && aboutSaveState !== "saving";
  const customInstructionsChanged = normalizedCustomInstructions !== baselineCustomInstructions;
  const canSubmitCustomInstructions =
    Boolean(userId) &&
    (customInstructionsChanged || customSaveState === "error") &&
    customSaveState !== "saving";
  const systemPromptOverrideChanged = normalizedSystemPromptOverride !== baselineSystemPromptOverride;
  const canSubmitSystemPromptOverride =
    Boolean(userId) &&
    (systemPromptOverrideChanged || overrideSaveState === "error") &&
    overrideSaveState !== "saving";
  const canSubmitNewBackground =
    Boolean(onCreateBackground) &&
    hasUploadedBackground &&
    !newBackgroundFileError &&
    backgroundSaveState.tone !== "loading";

  const resetAboutStatus = () => {
    if (aboutSaveState !== "idle") {
      setAboutSaveState("idle");
      setAboutSaveMessage(null);
    }
  };

  const resetCustomInstructionsStatus = () => {
    if (customSaveState !== "idle") {
      setCustomSaveState("idle");
      setCustomSaveMessage(null);
      setCustomInstructionsFileError(null);
    }
  };

  const resetOverrideStatus = () => {
    if (overrideSaveState !== "idle") {
      setOverrideSaveState("idle");
      setOverrideSaveMessage(null);
    }
  };

  const resetBackgroundSaveStatus = () => {
    if (backgroundSaveState.tone !== "idle") {
      setBackgroundSaveState({ tone: "idle" });
    }
    if (newBackgroundFileError !== null) {
      setNewBackgroundFileError(null);
    }
  };

  const handleNicknameChange = (event: ChangeEvent<HTMLInputElement>) => {
    resetAboutStatus();
    setNickname(event.target.value);
  };

  const handleOccupationChange = (event: ChangeEvent<HTMLInputElement>) => {
    resetAboutStatus();
    setOccupation(event.target.value);
  };

  const handleAboutChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    resetAboutStatus();
    setMoreAboutYou(event.target.value);
  };

  const handleCustomInstructionsChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    resetCustomInstructionsStatus();
    setCustomInstructions(event.target.value);
  };

  const handleSystemPromptOverrideChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    resetOverrideStatus();
    setSystemPromptOverride(event.target.value);
  };

  const handleLocationChange = (event: ChangeEvent<HTMLInputElement>) => {
    setLocaleSaveState("idle");
    setLocaleSaveMessage(null);
    setLocation(event.target.value);
  };

  const handleTimeZoneChange = (event: ChangeEvent<HTMLInputElement>) => {
    setLocaleSaveState("idle");
    setLocaleSaveMessage(null);
    setTimeZone(event.target.value);
  };

  const handleCustomInstructionsFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (!file) {
      setCustomInstructionsFileName(null);
      setCustomInstructionsFileError(null);
      return;
    }

    if (file.size > MAX_CUSTOM_INSTRUCTION_FILE_BYTES) {
      setCustomInstructionsFileName(null);
      setCustomInstructionsFileError(t("Files must be smaller than 512 KB."));
      return;
    }

    resetCustomInstructionsStatus();
    setCustomInstructionsFileError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setCustomInstructions(text);
      setCustomInstructionsFileName(file.name);
    };
    reader.onerror = () => {
      setCustomInstructionsFileName(null);
      setCustomInstructionsFileError(t("Unable to read this file."));
    };
    reader.readAsText(file);
  };

  const resetBackgroundFileState = () => {
    if (newBackgroundFile || newBackgroundFileName || newBackgroundFileError) {
      setNewBackgroundFile(null);
      setNewBackgroundFileName(null);
      setNewBackgroundFileError(null);
    }
  };

  const handleBackgroundFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    resetBackgroundSaveStatus();
    resetBackgroundFileState();
    if (!file) {
      return;
    }

    const normalizedType = (file.type || "").toLowerCase();
    if (!WORKSPACE_BACKGROUND_ALLOWED_MIMES.includes(normalizedType)) {
      setNewBackgroundFileError(t("Only PNG, JPG, WebP, or AVIF images are supported."));
      return;
    }

    if (file.size > WORKSPACE_BACKGROUND_UPLOAD_BYTES) {
      setNewBackgroundFileError(
        t("Files must be smaller than {mb} MB.", {
          mb: WORKSPACE_BACKGROUND_UPLOAD_MB,
        })
      );
      return;
    }

    setNewBackgroundFile(file);
    setNewBackgroundFileName(file.name);
  };

  const handleAboutSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!userId) {
      return;
    }
    setAboutSaveState("saving");
    setAboutSaveMessage(t("Saving..."));
    try {
      await updateUserProfile({
        personalization_nickname: normalizedNickname || null,
        personalization_occupation: normalizedOccupation || null,
        personalization_about: normalizedAbout || null,
      });

      // Optimistically sync local baseline values so the form reflects saved state
      // as soon as the update succeeds and when the panel is reopened.
      profileNickname = normalizedNickname || null;
      profileOccupation = normalizedOccupation || null;
      profileAbout = normalizedAbout || null;

      setAboutSaveState("success");
      setAboutSaveMessage(t("Saved"));
    } catch (error) {
      setAboutSaveState("error");
      setAboutSaveMessage(error instanceof Error ? error.message : t("Failed to save"));
    }
  };

  const handleCustomInstructionsSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!userId) {
      return;
    }
    setCustomSaveState("saving");
    setCustomSaveMessage(t("Saving..."));
    try {
      await updateUserProfile({
        personalization_custom_instructions: normalizedCustomInstructions || null,
      });
      setCustomSaveState("success");
      setCustomSaveMessage(t("Saved"));
    } catch (error) {
      setCustomSaveState("error");
      setCustomSaveMessage(error instanceof Error ? error.message : t("Failed to save"));
    }
  };

  const handleSystemPromptOverrideSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!userId) {
      return;
    }
    setOverrideSaveState("saving");
    setOverrideSaveMessage(t("Saving..."));
    try {
      await updateUserProfile({
        personalization_system_prompt_override: normalizedSystemPromptOverride || null,
      });
      setOverrideSaveState("success");
      setOverrideSaveMessage(t("Saved"));
    } catch (error) {
      setOverrideSaveState("error");
      setOverrideSaveMessage(error instanceof Error ? error.message : t("Failed to save"));
    }
  };

  const handleLocaleSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!userId) {
      return;
    }
    setLocaleSaveState("saving");
    setLocaleSaveMessage(t("Saving..."));
    try {
      const normalizedLocation = location.trim();
      const normalizedTimeZone = timeZone.trim();
      await updateUserProfile({
        personalization_location: normalizedLocation.length > 0 ? normalizedLocation : null,
        personalization_time_zone: normalizedTimeZone.length > 0 ? normalizedTimeZone : null,
      });
      setLocaleSaveState("success");
      setLocaleSaveMessage(t("Saved"));
    } catch (error) {
      setLocaleSaveState("error");
      setLocaleSaveMessage(error instanceof Error ? error.message : t("Failed to save"));
    }
  };

  const handleBackgroundSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!onCreateBackground || !canSubmitNewBackground) {
      return;
    }
    setBackgroundSaveState({ tone: "loading", message: t("Saving...") });
    try {
      if (!newBackgroundFile) {
        throw new Error(t("Please choose an image to upload."));
      }
      await onCreateBackground({
        assetFile: newBackgroundFile ?? undefined,
      });
      setBackgroundSaveState({ tone: "success", message: t("Background added") });
      resetBackgroundFileState();
    } catch (error) {
      setBackgroundSaveState({
        tone: "error",
        message: error instanceof Error ? error.message : t("Failed to add background"),
      });
    }
  };

  const handleCompressConversation = async () => {
    const conversationId = contextUsage?.conversationId;
    if (!conversationId) {
      setCompressState("error");
      setCompressMessage(t("No active conversation to compress"));
      return;
    }

    setCompressState("loading");
    setCompressMessage(t("Compressing..."));

    try {
      const result = await apiService.compressConversation(conversationId);
      setCompressState("success");
      setCompressMessage(result.message || t("Conversation compressed successfully"));

      // Auto-clear success message after 3 seconds
      setTimeout(() => {
        setCompressState("idle");
        setCompressMessage(null);
      }, 3000);
    } catch (error) {
      setCompressState("error");
      setCompressMessage(error instanceof Error ? error.message : t("Failed to compress conversation"));
    }
  };

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className={styles.personalizationOverlay}
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        className={styles.personalizationPanel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="personalization-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.personalizationPanelHeader}>
          <div>
            <p className={styles.personalizationEyebrow}>{t("Personalization")}</p>
            <h2 id="personalization-title">{viewerName}</h2>
          </div>
          <button
            type="button"
            className={styles.personalizationClose}
            onClick={onClose}
            aria-label={t("Close personalization")}
          >
            <X size={18} />
          </button>
        </header>

        <div className={styles.personalizationGrid}>
          <div className={styles.personalizationColumn}>
            <section className={styles.personalizationCard}>
              <div className={styles.personalizationCardHeader}>
                <div>
                  <h3>{t("Settings")}</h3>
                  <p>{t("Quick toggles for Gray's automations.")}</p>
                </div>
              </div>
              <div className={styles.personalizationToggleList}>
                <button
                  type="button"
                  className={styles.personalizationToggle}
                  data-active={autoWebSearchEnabled ? "true" : "false"}
                  aria-pressed={autoWebSearchEnabled}
                  onClick={() => setAutoWebSearchEnabled(!autoWebSearchEnabled)}
                >
                  <span>
                    <span>{t("Automatic web search")}</span>
                    <span className={styles.personalizationToggleHint}>
                      {t("Let Gray search for answers automatically.")}
                    </span>
                  </span>
                  <span className={styles.personalizationSwitch} data-active={autoWebSearchEnabled ? "true" : "false"}>
                    <span className={styles.personalizationSlider} />
                  </span>
                </button>

                {/* Maps toggle temporarily hidden; feature remains wired but dormant in the UI. */}

              </div>
            </section>

            <section className={styles.personalizationCard}>
              <div className={styles.personalizationCardHeader}>
                <div>
                  <h3>{t("Custom instructions")}</h3>
                </div>
              </div>
              <form className={styles.personalizationForm} onSubmit={handleCustomInstructionsSubmit}>
                <textarea
                  className={styles.personalizationTextarea}
                  value={customInstructions}
                  onChange={handleCustomInstructionsChange}
                  placeholder={t("Paste instructions here if you prefer to edit them manually.")}
                />
                <div className={styles.personalizationFormActions}>
                  {customSaveMessage ? (
                    <span
                      className={styles.personalizationFormStatus}
                      data-status={customSaveState}
                      aria-live="polite"
                    >
                      {customSaveMessage}
                    </span>
                  ) : null}
                  <button
                    type="submit"
                    className={styles.personalizationFormButton}
                    disabled={!canSubmitCustomInstructions}
                  >
                    {customSaveState === "saving" ? t("Saving...") : t("Save")}
                  </button>
                </div>
              </form>
            </section>


            <section className={`${styles.personalizationCard} ${styles.personalizationAboutCard}`}>
              <div className={styles.personalizationCardHeader}>
                <div>
                  <h3>{t("About you")}</h3>
                </div>
              </div>
              <form className={styles.personalizationForm} onSubmit={handleAboutSubmit}>
                <dl className={styles.personalizationAboutList}>
                  <div className={styles.personalizationAboutItem}>
                    <dt>
                      <label htmlFor="personalization-nickname">{t("Nickname")}</label>
                    </dt>
                    <dd>
                      <input
                        id="personalization-nickname"
                        className={styles.personalizationAboutInput}
                        value={nickname}
                        onChange={handleNicknameChange}
                        type="text"
                      />
                    </dd>
                  </div>
                  <div className={styles.personalizationAboutItem}>
                    <dt>
                      <label htmlFor="personalization-occupation">{t("Occupation")}</label>
                    </dt>
                    <dd>
                      <input
                        id="personalization-occupation"
                        className={styles.personalizationAboutInput}
                        value={occupation}
                        onChange={handleOccupationChange}
                        type="text"
                      />
                    </dd>
                  </div>
                  <div className={styles.personalizationAboutItem}>
                    <dt>
                      <label htmlFor="personalization-about">{t("More about you")}</label>
                    </dt>
                    <dd>
                      <textarea
                        id="personalization-about"
                        className={styles.personalizationAboutTextarea}
                        value={moreAboutYou}
                        onChange={handleAboutChange}
                      />
                    </dd>
                  </div>
                </dl>
                <div className={styles.personalizationFormActions}>
                  <button
                    type="submit"
                    className={styles.personalizationFormButton}
                    disabled={!canSubmitAbout}
                  >
                    {aboutSaveState === "saving" ? t("Saving...") : t("Save")}
                  </button>
                </div>
              </form>
            </section>

            <section className={styles.personalizationCard}>
              <div className={styles.personalizationCardHeader}>
                <div>
                  <h3>{t("Location & time")}</h3>
                </div>
              </div>
              <form className={styles.personalizationForm} onSubmit={handleLocaleSubmit}>
                <dl className={styles.personalizationAboutList}>
                  <div className={styles.personalizationAboutItem}>
                    <dt>
                      <label htmlFor="personalization-location">{t("Location")}</label>
                    </dt>
                    <dd>
                      <input
                        id="personalization-location"
                        className={styles.personalizationAboutInput}
                        value={location}
                        onChange={handleLocationChange}
                        type="text"
                        placeholder={t("City, region, and/or country")}
                      />
                    </dd>
                  </div>
                  <div className={styles.personalizationAboutItem}>
                    <dt>
                      <label htmlFor="personalization-timezone">{t("Time zone")}</label>
                    </dt>
                    <dd>
                      <input
                        id="personalization-timezone"
                        className={styles.personalizationAboutInput}
                        value={timeZone}
                        onChange={handleTimeZoneChange}
                        type="text"
                        placeholder={resolvedDeviceTimeZone}
                      />
                    </dd>
                  </div>
                </dl>
                <div className={styles.personalizationFormActions}>
                  {localeSaveMessage ? (
                    <span
                      className={styles.personalizationFormStatus}
                      data-status={localeSaveState}
                      aria-live="polite"
                    >
                      {localeSaveMessage}
                    </span>
                  ) : null}
                  <button type="submit" className={styles.personalizationFormButton}>
                    {localeSaveState === "saving" ? t("Saving...") : t("Save")}
                  </button>
                </div>
              </form>
            </section>

            <section className={styles.personalizationCard}>
              <div className={styles.personalizationCardHeader}>
                <div>
                  <h3>{t("Context usage")}</h3>
                  <p>{t("Track how much of your conversation context you've used.")}</p>
                </div>
                <button
                  type="button"
                  className={styles.personalizationLink}
                  onClick={handleCompressConversation}
                  disabled={compressState === "loading" || !contextUsage?.conversationId}
                >
                  {compressState === "loading"
                    ? t("Compressing…")
                    : compressState === "success"
                      ? t("Done")
                      : t("Compress")}
                </button>
              </div>
              <div className={styles.personalizationContextUsage}>
                <div className={styles.personalizationContextPercentRow}>
                  <span className={styles.personalizationContextPercent}>{contextPercentLabel}</span>
                </div>
                <div className={styles.personalizationContextStats}>
                  {contextMessagesLabel ? <span>{contextMessagesLabel}</span> : null}
                  <span>{contextTokensLabel}</span>
                </div>
                <div
                  className={styles.personalizationContextMeter}
                  role="meter"
                  aria-valuemin={0}
                  aria-valuemax={effectiveContextLimit}
                  aria-valuenow={Math.min(contextTokensUsed, effectiveContextLimit)}
                  aria-valuetext={contextMeterValueText}
                >
                  <div
                    className={styles.personalizationContextMeterFill}
                    style={{ width: `${contextPercent}%` }}
                  />
                </div>
                <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  {compressMessage ? (
                    <span
                      className={styles.personalizationFormStatus}
                      data-status={compressState}
                      style={{ textAlign: "center" }}
                    >
                      {compressMessage}
                    </span>
                  ) : null}
                </div>
              </div>
            </section>

            {/* Memory card temporarily disabled per request */}
          </div>
        </div>
      </div>
    </div>
  );
}
