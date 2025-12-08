"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState, type MouseEvent, type ChangeEvent, type FormEvent } from "react";
import { X } from "lucide-react";
import styles from "@/app/gray/GrayPageClient.module.css";
import type { ContextUsageSummary } from "@/components/gray/types";
import { useUser } from "@/contexts/UserContext";
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

const DEFAULT_CONTEXT_LIMIT = 1_048_576;

const TRAIT_PRESETS = [
  { id: "openness", label: "Openness", value: 5 },
  { id: "conscientiousness", label: "Conscientiousness", value: 2.5 },
  { id: "extraversion", label: "Extraversion", value: 3 },
  { id: "agreeableness", label: "Agreeableness", value: 3 },
  { id: "neuroticism", label: "Neuroticism", value: 3 },
] as const;

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
  backgroundOptions,
  selectedBackgroundId,
  onSelectBackground,
  onCreateBackground,
  backgroundsLoading = false,
  backgroundError = null,
}: PersonalizationPanelProps) {
  const { webSearchEnabled, setWebSearchEnabled } = useChatStore();
  const [primaryQuest] = useState("Ship the legendary operator cockpit.");
  const [blockages] = useState("Unclear swimlanes between motion + ops.");

  // Derived context usage display metadata from backend payload only.
  const contextProviderLabel = formatContextLabel(contextUsage);

  const hasContextUsage = Boolean(contextUsage);
  const contextLimit = typeof contextUsage?.limit === "number" ? contextUsage.limit : 0;
  const contextTokensUsed =
    typeof contextUsage?.conversationTokens === "number"
      ? Math.max(0, contextUsage.conversationTokens)
      : 0;

  const hasFiniteLimit = contextLimit > 0;
  const contextTokensRemaining = hasFiniteLimit
    ? Math.max(0, contextLimit - contextTokensUsed)
    : 0;
  const effectiveContextLimit = hasFiniteLimit ? contextLimit : DEFAULT_CONTEXT_LIMIT;
  const contextPercent =
    effectiveContextLimit > 0
      ? Math.max(0, Math.min(100, (contextTokensUsed / effectiveContextLimit) * 100))
      : 0;
  const contextPercentLabel = `${Math.round(contextPercent)}%`;
  const contextLimitLabel = hasContextUsage
    ? hasFiniteLimit
      ? `${formatNumber(contextLimit)} total tokens`
      : `Unlimited context (visualized against ${formatNumber(DEFAULT_CONTEXT_LIMIT)} tokens)`
    : "";
  const contextFooterLabel = hasFiniteLimit
    ? `${formatNumber(contextTokensRemaining)} tokens left`
    : "No cap active";
  const contextMeterValueText = hasFiniteLimit
    ? `${formatNumber(contextTokensUsed)} of ${formatNumber(contextLimit)} tokens used`
    : `${formatNumber(contextTokensUsed)} tokens used while limit is unlimited`;
  const contextMeterDescription = hasContextUsage ? contextMeterValueText : "";
  const contextFooterDescription = hasContextUsage ? contextFooterLabel : "";
  const contextMessagesLabel = hasContextUsage && contextUsage ? `${contextUsage.messageCount.toLocaleString()} messages` : "";
  const contextTokensLabel = contextUsage
    ? `${contextTokensUsed.toLocaleString()}`
    : "0";

  const { user, updateUser: updateUserProfile } = useUser();
  const mapsEnabled = user?.maps_enabled ?? false;
  const showCalendar = user?.personalization_show_calendar ?? true;

  const normalizedViewerPlan = (viewerPlan || "pioneer").toLowerCase();
  const effectiveViewerPlan = normalizedViewerPlan === "scout" ? "pioneer" : normalizedViewerPlan;
  const isScout = effectiveViewerPlan === "scout";

  const handleCalendarToggle = async () => {
    if (!user?.id) return;
    try {
      await updateUserProfile({ personalization_show_calendar: !showCalendar });
    } catch (e) {
      console.error("Failed to toggle calendar", e);
    }
  };

  const handleMapsToggle = async () => {
    if (!user?.id) return;
    try {
      await updateUserProfile({ maps_enabled: !mapsEnabled });
    } catch (e) {
      console.error("Failed to toggle maps", e);
    }
  };

  const interests = useMemo(() => ["Systems", "Wellness"], []);
  const traits = useMemo(() => TRAIT_PRESETS, []);
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
  const [overrideSaveState, setOverrideSaveState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [overrideSaveMessage, setOverrideSaveMessage] = useState<string | null>(null);
  const [newBackgroundFile, setNewBackgroundFile] = useState<File | null>(null);
  const [newBackgroundFileName, setNewBackgroundFileName] = useState<string | null>(null);
  const [newBackgroundFileError, setNewBackgroundFileError] = useState<string | null>(null);
  const [backgroundSaveState, setBackgroundSaveState] = useState<ApiStatus>({ tone: "idle" });
  const [compressState, setCompressState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [compressMessage, setCompressMessage] = useState<string | null>(null);
  const showAlignmentProfile = false; // Temporarily hide alignment profile card until updated.

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
      setCustomInstructionsFileError("Files must be smaller than 512 KB.");
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
      setCustomInstructionsFileError("Unable to read this file.");
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
      setNewBackgroundFileError("Only PNG, JPG, WebP, or AVIF images are supported.");
      return;
    }

    if (file.size > WORKSPACE_BACKGROUND_UPLOAD_BYTES) {
      setNewBackgroundFileError(`Files must be smaller than ${WORKSPACE_BACKGROUND_UPLOAD_MB} MB.`);
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
    setAboutSaveMessage("Saving...");
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
      setAboutSaveMessage("Saved");
    } catch (error) {
      setAboutSaveState("error");
      setAboutSaveMessage(error instanceof Error ? error.message : "Failed to save");
    }
  };

  const handleCustomInstructionsSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!userId) {
      return;
    }
    setCustomSaveState("saving");
    setCustomSaveMessage("Saving...");
    try {
      await updateUserProfile({
        personalization_custom_instructions: normalizedCustomInstructions || null,
      });
      setCustomSaveState("success");
      setCustomSaveMessage("Saved");
    } catch (error) {
      setCustomSaveState("error");
      setCustomSaveMessage(error instanceof Error ? error.message : "Failed to save");
    }
  };

  const handleSystemPromptOverrideSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!userId) {
      return;
    }
    setOverrideSaveState("saving");
    setOverrideSaveMessage("Saving...");
    try {
      await updateUserProfile({
        personalization_system_prompt_override: normalizedSystemPromptOverride || null,
      });
      setOverrideSaveState("success");
      setOverrideSaveMessage("Saved");
    } catch (error) {
      setOverrideSaveState("error");
      setOverrideSaveMessage(error instanceof Error ? error.message : "Failed to save");
    }
  };

  const handleBackgroundSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!onCreateBackground || !canSubmitNewBackground) {
      return;
    }
    setBackgroundSaveState({ tone: "loading", message: "Saving..." });
    try {
      if (!newBackgroundFile) {
        throw new Error("Please choose an image to upload.");
      }
      await onCreateBackground({
        assetFile: newBackgroundFile ?? undefined,
      });
      setBackgroundSaveState({ tone: "success", message: "Background added" });
      resetBackgroundFileState();
    } catch (error) {
      setBackgroundSaveState({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to add background",
      });
    }
  };

  const handleCompressConversation = async () => {
    const conversationId = contextUsage?.conversationId;
    if (!conversationId) {
      setCompressState("error");
      setCompressMessage("No active conversation to compress");
      return;
    }

    setCompressState("loading");
    setCompressMessage("Compressing...");

    try {
      const result = await apiService.compressConversation(conversationId);
      setCompressState("success");
      setCompressMessage(result.message || "Conversation compressed successfully");

      // Auto-clear success message after 3 seconds
      setTimeout(() => {
        setCompressState("idle");
        setCompressMessage(null);
      }, 3000);
    } catch (error) {
      setCompressState("error");
      setCompressMessage(error instanceof Error ? error.message : "Failed to compress conversation");
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
            <p className={styles.personalizationEyebrow}>Personalization</p>
            <h2 id="personalization-title">{viewerName}</h2>
          </div>
          <button
            type="button"
            className={styles.personalizationClose}
            onClick={onClose}
            aria-label="Close personalization"
          >
            <X size={18} />
          </button>
        </header>

        <div className={styles.personalizationGrid}>
          <div className={styles.personalizationColumn}>
            {showAlignmentProfile ? (
              <section className={styles.personalizationCard}>
                <div className={styles.personalizationCardHeader}>
                  <div>
                    <h3>Your Alignment Profile</h3>
                    <p>Understand how Gray currently mirrors your orbit.</p>
                  </div>
                  <button type="button" className={styles.personalizationLink}>
                    Manage
                  </button>
                </div>

                <div>
                  <p className={styles.personalizationSectionLabel}>Interests</p>
                </div>
                <div className={styles.personalizationChipRow}>
                  {interests.map((interest) => (
                    <span key={interest} className={styles.personalizationChip}>
                      {interest}
                    </span>
                  ))}
                </div>

                <div className={styles.personalizationTraitHeader}>
                  <p className={styles.personalizationSectionLabel}>Trait spectrum</p>
                  <p className={styles.personalizationHint}>Higher bar = stronger expression.</p>
                </div>
                <div className={styles.personalizationTraitList}>
                  {traits.map((trait) => (
                    <div key={trait.id} className={styles.personalizationTraitRow}>
                      <div className={styles.personalizationTraitMeta}>
                        <span>{trait.label}</span>
                        <span>{trait.value.toFixed(1)}</span>
                      </div>
                      <div className={styles.personalizationTraitBar}>
                        <div
                          className={styles.personalizationTraitValue}
                          style={{ width: `${Math.min(100, Math.max(0, (trait.value / 5) * 100))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className={styles.personalizationFieldGroup}>
                  <label htmlFor="primaryQuest">Primary Quest</label>
                  <div id="primaryQuest" className={styles.personalizationField}>
                    {primaryQuest}
                  </div>
                </div>

                <div className={styles.personalizationFieldGroup}>
                  <label htmlFor="blockages">Blockages</label>
                  <div id="blockages" className={styles.personalizationField}>
                    {blockages}
                  </div>
                </div>
              </section>
            ) : null}

            <section className={styles.personalizationCard}>
              <div className={styles.personalizationCardHeader}>
                <div>
                  <h3>Advanced</h3>
                  <p>Quick toggles for Gray&apos;s automations.</p>
                </div>
              </div>
              <div className={styles.personalizationToggleList}>
                <button
                  type="button"
                  className={styles.personalizationToggle}
                  data-active={webSearchEnabled ? "true" : "false"}
                  aria-pressed={webSearchEnabled}
                  onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                >
                  <span>
                    <span>Web search</span>
                    <span className={styles.personalizationToggleHint}>Let Gray search for answers automatically.</span>
                  </span>
                  <span className={styles.personalizationSwitch} data-active={webSearchEnabled ? "true" : "false"}>
                    <span className={styles.personalizationSlider} />
                  </span>
                </button>

                {/* Maps toggle temporarily hidden; feature remains wired but dormant in the UI. */}

                {!isScout && (
                  <button
                    type="button"
                    className={styles.personalizationToggle}
                    data-active={showCalendar ? "true" : "false"}
                    aria-pressed={showCalendar}
                    onClick={handleCalendarToggle}
                  >
                    <span>
                      <span>Show Calendar</span>
                      <span className={styles.personalizationToggleHint}>Display the daily schedule view.</span>
                    </span>
                    <span className={styles.personalizationSwitch} data-active={showCalendar ? "true" : "false"}>
                      <span className={styles.personalizationSlider} />
                    </span>
                  </button>
                )}
              </div>
            </section>

            <section className={styles.personalizationCard}>
              <div className={styles.personalizationCardHeader}>
                <div>
                  <h3>Custom instructions</h3>
                </div>
              </div>
              <form className={styles.personalizationForm} onSubmit={handleCustomInstructionsSubmit}>
                <textarea
                  className={styles.personalizationTextarea}
                  value={customInstructions}
                  onChange={handleCustomInstructionsChange}
                  placeholder="Paste instructions here if you prefer to edit them manually."
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
                    {customSaveState === "saving" ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
            </section>


            <section className={`${styles.personalizationCard} ${styles.personalizationAboutCard}`}>
              <div className={styles.personalizationCardHeader}>
                <div>
                  <h3>About you</h3>
                </div>
              </div>
              <form className={styles.personalizationForm} onSubmit={handleAboutSubmit}>
                <dl className={styles.personalizationAboutList}>
                  <div className={styles.personalizationAboutItem}>
                    <dt>
                      <label htmlFor="personalization-nickname">Nickname</label>
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
                      <label htmlFor="personalization-occupation">Occupation</label>
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
                      <label htmlFor="personalization-about">More about you</label>
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
                    {aboutSaveState === "saving" ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
            </section>

            <section className={styles.personalizationCard}>
              <div className={styles.personalizationCardHeader}>
                <div>
                  <h3>Context usage</h3>
                  <p>Track how much of your conversation context you&apos;ve used.</p>
                </div>
                <button
                  type="button"
                  className={styles.personalizationLink}
                  onClick={handleCompressConversation}
                  disabled={compressState === "loading" || !contextUsage?.conversationId}
                >
                  {compressState === "loading" ? "Compressing…" : compressState === "success" ? "Done" : "Compress"}
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
