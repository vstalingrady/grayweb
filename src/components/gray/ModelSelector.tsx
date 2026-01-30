"use client";

import { memo, useCallback, useMemo, useState, useRef, useEffect } from "react";
import { Zap, Lock, ChevronUp, Grid, ChevronRight, Check, Brain, Settings, Box, Calendar } from "lucide-react";
import Image from "next/image";
import { useChatStore } from "@/components/gray/ChatProvider";
import { useUser } from "@/contexts/UserContext";
import { useI18n } from "@/contexts/I18nContext";
import styles from "./ModelSelector.module.css";
import { ALL_PIONEER_MODEL_IDS, PIONEER_GROUPS } from "./modelCatalog";
import { normalizePlanTier, PLAN_TIER_LEVELS } from "@/components/gray/utils/helperFunctions";

type ModelOption = {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  tierRequired: "scout" | "pathfinder" | "voyager" | "pioneer";
};

const AUTO_MODEL_ID = "openrouter/auto";

// Base model option - Lite is available to all tiers
const OPTIONS: ModelOption[] = [
  { id: "lite", label: "Lite", description: "Quick responses", icon: Zap, tierRequired: "scout" },
  { id: "auto", label: "Auto", description: "Auto-select best model", icon: Grid, tierRequired: "voyager" },
];

type ModelSelectorProps = {
  className?: string;
};

const stripBrandPrefix = (label: string) => label.replace(/^Gray\s+/, "");

export const ModelSelector = memo(({ className }: ModelSelectorProps) => {
  const { t } = useI18n();
  const {
    modelTier, setModelTier, selectedModelId, setSelectedModelId,
    reasoningMode, setReasoningMode,
    webSearchEnabled, toggleWebSearchEnabled,
    remindersEnabled, toggleRemindersEnabled,
    visibleModelIds,
  } = useChatStore();
  const { user } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [showAllModels, setShowAllModels] = useState(false);
  // Tools section expanded state
  const [isToolsExpanded, setIsToolsExpanded] = useState(false);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentTier = normalizePlanTier(user);
  const currentLevel = PLAN_TIER_LEVELS[currentTier] ?? 0;
  const isReasoningLocked = currentTier === "scout";
  const isReasoningLockedByModel =
    selectedModelId === "moonshotai/kimi-k2-0905" ||
    selectedModelId === "moonshotai/kimi-k2.5";
  const isReasoningForcedOn = selectedModelId === "moonshotai/kimi-k2.5";
  const shouldShowReasoningLevel =
    selectedModelId === "google/gemini-3-pro-preview" || modelTier === "pro";
  const isReasoningToggleDisabled = isReasoningLocked || isReasoningLockedByModel;
  const reasoningDescription = isReasoningForcedOn
    ? null
    : shouldShowReasoningLevel
      ? (reasoningMode ? t("High") : t("Low"))
      : null;

  const filteredPioneerGroups = useMemo(() => {
    const isVisible = (modelId: string) =>
      visibleModelIds === null || visibleModelIds.includes(modelId) || modelId === selectedModelId;

    return PIONEER_GROUPS.filter((group) => group.id !== "openrouter").map((group) => ({
      ...group,
      models: group.models.filter((model) => isVisible(model.id)),
    })).filter((group) => group.models.length > 0);
  }, [selectedModelId, visibleModelIds]);

  const hasPioneerSelection = selectedModelId ? ALL_PIONEER_MODEL_IDS.includes(selectedModelId) : false;

  const activeOption = useMemo(() => {
    if (selectedModelId === AUTO_MODEL_ID) {
      return OPTIONS.find((option) => option.id === "auto") ?? OPTIONS[0];
    }

    if (modelTier === "pioneer" && selectedModelId && hasPioneerSelection) {
      // Find the group so we can use its icon
      const group = PIONEER_GROUPS.find(g => g.models.some(m => m.id === selectedModelId));
      const pioneerModel = group?.models.find((m) => m.id === selectedModelId);

      if (pioneerModel) {
        // Return a component that renders the Image for the group
        const IconComponent = () => (
          group?.iconPath ? <Image src={group.iconPath} alt={group.label} width={18} height={18} /> : <Grid size={18} />
        );
        return {
          ...pioneerModel,
          icon: IconComponent,
          description: t("Selected Model"),
          tierRequired: "voyager" as const,
        };
      }
    }

    // Find option matching current tier, otherwise default to lite
    // Since "pro" is removed, this will naturally fallback to OPTIONS[0] (Lite) if state is arguably "pro"
    // (though ChatProvider should catch that).
    return OPTIONS.find(o => o.id === modelTier) ?? OPTIONS[0];
  }, [hasPioneerSelection, modelTier, selectedModelId, t]);

  const shouldShowSelectedModel =
    hasPioneerSelection && !OPTIONS.some((option) => option.id === activeOption.id);

  const handleSelect = useCallback(
    (index: number) => {
      const option = OPTIONS[index];
      const requiredLevel = PLAN_TIER_LEVELS[option.tierRequired];

      if (currentLevel < requiredLevel) {
        return;
      }

      if (option.id === "auto") {
        setModelTier("pioneer");
        setSelectedModelId(AUTO_MODEL_ID);
        setIsOpen(false);
        setShowAllModels(false);
        return;
      }

      if (option.id === "pro") {
        setModelTier("pro");
      } else {
        setModelTier("lite");
      }
      setSelectedModelId(null); // Clear specific model selection for base tiers

      setIsOpen(false);
      setShowAllModels(false);
    },
    [currentLevel, setModelTier, setSelectedModelId]
  );

  const handlePioneerSelect = useCallback(
    (modelId: string) => {
      if (currentLevel < PLAN_TIER_LEVELS["pathfinder"]) return;
      setModelTier("pioneer");
      setSelectedModelId(modelId);
      setIsOpen(false);
      setShowAllModels(false);
    },
    [currentLevel, setModelTier, setSelectedModelId]
  );

  const toggleAllModels = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    setShowAllModels((prev) => !prev);
  }, []);

  const handleGroupToggle = useCallback((groupId: string) => {
    setExpandedGroupId((prev) => (prev === groupId ? null : groupId));
  }, []);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowAllModels(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={styles.container} ref={containerRef}>
      {/* Trigger Button - Reverted to simple style */}
      <button
        className={`${styles.trigger} ${className || ""}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={t("Select model")}
        type="button"
      >
        <span className={styles.triggerLabel}>
          {stripBrandPrefix(activeOption.label)}
        </span>
        <ChevronUp
          className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`}
          size={16}
        />
      </button>

      {/* Dropup Menu */}
      <div className={`${styles.menu} ${isOpen ? styles.menuOpen : ""}`}>
        {showAllModels ? (
          <div className={styles.menuContent}>
            <button
              className={styles.backButton}
              onClick={() => setShowAllModels(false)}
            >
              <ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />
              {t("Back")}
	            </button>
	            <div className={styles.pioneerList}>
	              {filteredPioneerGroups.map((group) => {
	                const isExpanded = expandedGroupId === group.id;
	                return (
	                  <div key={group.id} className={styles.groupContainer}>
                    <button
                      className={`${styles.menuItem} ${isExpanded ? styles.menuItemExpanded : ""}`}
                      onClick={() => handleGroupToggle(group.id)}
                      type="button"
                    >
                      <div className={styles.itemIconWrapper}>
                        <Image src={group.iconPath} alt={group.label} width={18} height={18} />
                      </div>
                      <div className={styles.itemInfo}>
                        <div className={styles.itemLabel}>{group.label}</div>
                      </div>
                      <ChevronRight
                        size={14}
                        className={styles.actionArrow}
                        style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}
                      />
                    </button>

                    {isExpanded && (
                      <div className={styles.groupModels}>
                        {group.models.map((model) => {
                          const modelTierRequired = model.tierRequired || "voyager";
                          const modelTierLevel = PLAN_TIER_LEVELS[modelTierRequired] ?? 0;
                          const isModelLocked = currentLevel < modelTierLevel;

                          return (
                            <button
                              key={model.id}
                              className={`${styles.menuItem} ${selectedModelId === model.id ? styles.menuItemActive : ""} ${styles.subMenuItem} ${isModelLocked ? styles.menuItemLocked : ""}`}
                              onClick={() => !isModelLocked && handlePioneerSelect(model.id)}
                              disabled={isModelLocked}
                              type="button"
                            >
                              <div className={styles.itemInfo}>
                                <div className={styles.itemLabel}>{model.label}</div>
                              </div>
                              {model.cost && <span className={styles.costIndicator}>{model.cost}</span>}
                              {isModelLocked ? (
                                <Lock size={14} className={styles.actionLock} />
                              ) : selectedModelId === model.id ? (
                                <Check size={14} className={styles.checkIcon} />
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className={styles.menuScrollWrapper}>
            <div className={styles.menuContent}>


              {/* Tools Section */}
              <div className={styles.groupContainer}>
                <button
                  className={`${styles.menuItem} ${isToolsExpanded ? styles.menuItemExpanded : ""}`}
                  onClick={() => setIsToolsExpanded(!isToolsExpanded)}
                  type="button"
                >
                  <div className={styles.itemIconWrapper}>
                    <Settings size={18} />
                  </div>
                  <div className={styles.itemInfo}>
                    <div className={styles.itemLabel}>{t("Tools")}</div>
                    <div className={styles.itemDescription}>{t("Reasoning, Search & More")}</div>
                  </div>
                  <ChevronRight
                    size={14}
                    className={styles.actionArrow}
                    style={{ transform: isToolsExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}
                  />
                </button>

                {isToolsExpanded && (
                  <div className={styles.groupModels}>
                    {/* Reasoning Toggle */}
                    <button
                      className={`${styles.menuItem} ${styles.subMenuItem} ${isReasoningToggleDisabled ? styles.menuItemLocked : ""}`}
                      onClick={() => {
                        if (isReasoningToggleDisabled) return;
                        setReasoningMode(!reasoningMode);
                      }}
                      disabled={isReasoningToggleDisabled}
                      type="button"
                    >
                      <div className={styles.itemIconWrapper}>
                        <Brain size={16} className={reasoningMode ? styles.glowIcon : ""} />
                      </div>
                      <div className={styles.itemInfo}>
                        <div className={styles.itemLabel}>{t("Reasoning")}</div>
                        {reasoningDescription ? (
                          <div className={styles.itemDescription}>{reasoningDescription}</div>
                        ) : null}
                      </div>
                      {isReasoningToggleDisabled ? (
                        <Lock size={16} className={styles.actionLock} aria-hidden="true" />
                      ) : (
                        <div className={`${styles.toggle} ${reasoningMode ? styles.toggleOn : ""}`}>
                          <div className={styles.toggleKnob} />
                        </div>
                      )}
                    </button>

                    {/* Web Search Toggle */}
                    <button
                      className={`${styles.menuItem} ${styles.subMenuItem}`}
                      onClick={toggleWebSearchEnabled}
                      type="button"
                    >
                      <div className={styles.itemIconWrapper}>
                        {/* Using Grid as placeholder for Globe/Search icon in lucide set provided */}
                        <Grid size={16} />
                      </div>
                      <div className={styles.itemInfo}>
                        <div className={styles.itemLabel}>{t("Web search")}</div>
                      </div>
                      <div className={`${styles.toggle} ${webSearchEnabled ? styles.toggleOn : ""}`}>
                        <div className={styles.toggleKnob} />
                      </div>
                    </button>

                    {/* Reminders & Plans Toggle */}
                    <button
                      className={`${styles.menuItem} ${styles.subMenuItem}`}
                      onClick={toggleRemindersEnabled}
                      type="button"
                    >
                      <div className={styles.itemIconWrapper}>
                        <Calendar size={16} />
                      </div>
                      <div className={styles.itemInfo}>
                        <div className={styles.itemLabel}>{t("Reminders & Plans")}</div>
                      </div>
                      <div className={`${styles.toggle} ${remindersEnabled ? styles.toggleOn : ""}`}>
                        <div className={styles.toggleKnob} />
                      </div>
                    </button>
                  </div>
                )}
              </div>

              <div className={styles.divider} />

              {/* Standard Options */}
              {OPTIONS.map((option, index) => {
                const requiredLevel = PLAN_TIER_LEVELS[option.tierRequired];
                const isLocked = currentLevel < requiredLevel;
                const isActive = activeOption.id === option.id && !shouldShowSelectedModel; // Only active if no specific model selected
                const Icon = option.icon;

                return (
                  <button
                    key={option.id}
                    className={`${styles.menuItem} ${isActive ? styles.menuItemActive : ""} ${isLocked ? styles.menuItemLocked : ""}`}
                    onClick={() => handleSelect(index)}
                    disabled={isLocked}
                    type="button"
                  >
                    <div className={styles.itemIconWrapper}>
                      {isLocked ? <Lock size={16} /> : <Icon size={18} />}
                    </div>
                    <div className={styles.itemInfo}>
                      <div className={styles.itemLabel}>
                        {stripBrandPrefix(t(option.label))}
                      </div>
                      <div className={styles.itemDescription}>{t(option.description)}</div>
                    </div>
                    {isActive && <Check size={14} className={styles.checkIcon} />}
                  </button>
                );
              })}

              <div className={styles.divider} />

              {/* All Models */}
              <button
                className={styles.actionItem}
                type="button"
                onClick={toggleAllModels}
              >
                <Box size={16} />
                <span>{t("All Models")}</span>
                {currentLevel < PLAN_TIER_LEVELS["pathfinder"] ? (
                  <span className={styles.actionUpgradeRight}>
                    <a
                      href="/pricing"
                      className={styles.upgradePill}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <span>{t("Upgrade")}</span>
                      <Lock size={14} className={styles.upgradePillIcon} />
                    </a>
                    <ChevronRight size={14} className={styles.actionUpgradeArrow} />
                  </span>
                ) : (
                  <ChevronRight size={14} className={styles.actionArrow} />
                )}
              </button>

              {/* Display Active Model if selected */}
              {shouldShowSelectedModel && (
                <>
                  <div className={styles.divider} />
                  <button className={`${styles.menuItem} ${styles.menuItemActive}`} disabled>
                    {/* We use activeOption.icon here which I will update in useMemo to be the group icon */}
                    <div className={styles.itemIconWrapper}>
                      {/* Dynamically render icon component or image if strictly needed, 
                                but activeOption.icon is typically a component (Grid). 
                                We need to pass the real icon down. */}
                      <activeOption.icon size={18} />
                    </div>
                    <div className={styles.itemInfo}>
                      <div className={styles.itemLabel}>{activeOption.label}</div>
                      <div className={styles.itemDescription}>{t("Selected Model")}</div>
                    </div>
                    <Check size={14} className={styles.checkIcon} />
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div >
  );

});

ModelSelector.displayName = "ModelSelector";
