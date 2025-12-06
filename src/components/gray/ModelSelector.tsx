"use client";

import { memo, useCallback, useMemo, useState, useRef, useEffect } from "react";
import { Zap, Sparkles, Lock, ChevronUp, Rocket, Grid, ChevronRight, Check, Brain, Settings, ArrowRight, Box } from "lucide-react"; // Replaced Cube with Box
import Image from "next/image";
import { useChatStore } from "@/components/gray/ChatProvider";
import { useUser } from "@/contexts/UserContext";
import styles from "./ModelSelector.module.css";

type ModelOption = {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  tierRequired: "scout" | "voyager" | "pioneer";
};

// Renamed and updated strictly to match the "Fast" / "Expert" vibe of the inspo
const OPTIONS: ModelOption[] = [
  { id: "lite", label: "Gray Lite", description: "Quick responses", icon: Zap, tierRequired: "scout" },
  { id: "pro", label: "Gray Pro", description: "Complex tasks", icon: Sparkles, tierRequired: "voyager" },
];

type ModelGroup = {
  id: string;
  label: string;
  iconPath: string;
  models: { id: string; label: string }[];
};

const PIONEER_GROUPS: ModelGroup[] = [
  {
    id: "anthropic",
    label: "Anthropic",
    iconPath: "/logos/claude-color.svg",
    models: [
      { id: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet 4.5" },
      { id: "anthropic/claude-opus-4.5", label: "Claude Opus 4.5" },
    ],
  },
  {
    id: "google",
    label: "Google",
    iconPath: "/logos/gemini-color.svg",
    models: [
      { id: "google/gemini-3-pro-preview", label: "Gemini 3 Pro Preview" },
      { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    ],
  },
  {
    id: "openai",
    label: "OpenAI",
    iconPath: "/logos/whiteopenai.svg",
    models: [
      { id: "openai/gpt-5.1-chat", label: "GPT 5.1" },
    ],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    iconPath: "/logos/deepseek-color.svg",
    models: [
      { id: "deepseek/deepseek-v3.2", label: "Deepseek V3.2" },
      { id: "deepseek/deepseek-v3.2-speciale", label: "Deepseek V3.2 Speciale" },
    ],
  },
  {
    id: "x-ai",
    label: "xAI",
    iconPath: "/logos/whitegrok.svg",
    models: [
      { id: "x-ai/grok-4.1-fast", label: "Grok 4.1 Fast" },
    ],
  },
  {
    id: "moonshot",
    label: "Moonshot AI",
    iconPath: "/logos/whitekimi.svg",
    models: [
      { id: "moonshotai/kimi-k2-thinking", label: "Kimi K2 Thinking" },
    ],
  },
];

const TIER_LEVELS: Record<string, number> = {
  scout: 0,
  voyager: 1,
  pioneer: 2,
};

type ModelSelectorProps = {
  className?: string;
};

export const ModelSelector = memo(({ className }: ModelSelectorProps) => {
  const { modelTier, setModelTier, selectedModelId, setSelectedModelId, reasoningMode, setReasoningMode } = useChatStore();
  const { user } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [showAllModels, setShowAllModels] = useState(false);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const planTierRaw = (user?.plan_tier || "pioneer").toLowerCase();
  const currentTier = planTierRaw === "scout" ? "pioneer" : planTierRaw;
  const currentLevel = TIER_LEVELS[currentTier] ?? 0;

  const activeOption = useMemo(() => {
    if (modelTier === "pioneer" && selectedModelId) {
      // Find the group so we can use its icon
      const group = PIONEER_GROUPS.find(g => g.models.some(m => m.id === selectedModelId));
      const pioneerModel = group?.models.find((m) => m.id === selectedModelId);

      if (pioneerModel) {
        // Return a component that renders the Image for the group
        const IconComponent = () => (
          group?.iconPath ? <Image src={group.iconPath} alt={group.label} width={18} height={18} /> : <Grid size={18} />
        );
        return { ...pioneerModel, icon: IconComponent, description: "Pioneer Model", tierRequired: "pioneer" as const };
      }
    }
    if (modelTier === "pro") return OPTIONS[1];
    return OPTIONS[0];
  }, [modelTier, selectedModelId]);

  const handleSelect = useCallback(
    (index: number) => {
      const option = OPTIONS[index];
      const requiredLevel = TIER_LEVELS[option.tierRequired];

      if (currentLevel < requiredLevel) {
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
      if (currentLevel < TIER_LEVELS["pioneer"]) return;
      setModelTier("pioneer");
      setSelectedModelId(modelId);
      setIsOpen(false);
      setShowAllModels(false);
    },
    [currentLevel, setModelTier, setSelectedModelId]
  );

  const toggleAllModels = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentLevel >= TIER_LEVELS["pioneer"]) {
      setShowAllModels((prev) => !prev);
    }
  }, [currentLevel]);

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

  const nextTier = currentLevel === 0 ? "voyager" : currentLevel === 1 ? "pioneer" : null;

  return (
    <div className={styles.container} ref={containerRef}>
      {/* Trigger Button - Reverted to simple style */}
      <button
        className={`${styles.trigger} ${className || ""}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Select model"
        type="button"
      >
        <span className={styles.triggerLabel}>
          {activeOption.label.replace("Gray ", "")}
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
              Back
            </button>
            <div className={styles.pioneerList}>
              {PIONEER_GROUPS.map((group) => {
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
                        {group.models.map((model) => (
                          <button
                            key={model.id}
                            className={`${styles.menuItem} ${selectedModelId === model.id ? styles.menuItemActive : ""} ${styles.subMenuItem}`}
                            onClick={() => handlePioneerSelect(model.id)}
                            type="button"
                          >
                            <div className={styles.itemInfo}>
                              <div className={styles.itemLabel}>{model.label}</div>
                            </div>
                            {selectedModelId === model.id && <Check size={14} className={styles.checkIcon} />}
                          </button>
                        ))}
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


              {/* Reasoning Toggle - Prominent at top */}
              <button
                className={`${styles.menuItem} ${reasoningMode ? styles.menuItemActive : ""}`}
                onClick={() => setReasoningMode(!reasoningMode)}
                type="button"
              >
                <div className={styles.itemIconWrapper}>
                  <Brain size={18} className={reasoningMode ? styles.glowIcon : ""} />
                </div>
                <div className={styles.itemInfo}>
                  <div className={styles.itemLabel}>Reasoning</div>
                  <div className={styles.itemDescription}>Deep thinking mode</div>
                </div>
                <div className={`${styles.toggle} ${reasoningMode ? styles.toggleOn : ""}`}>
                  <div className={styles.toggleKnob} />
                </div>
              </button>

              <div className={styles.divider} />

              {/* Standard Options */}
              {OPTIONS.map((option, index) => {
                const requiredLevel = TIER_LEVELS[option.tierRequired];
                const isLocked = currentLevel < requiredLevel;
                const isActive = activeOption.id === option.id && !selectedModelId; // Only active if no specific model selected
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
                        {option.label}
                      </div>
                      <div className={styles.itemDescription}>{option.description}</div>
                    </div>
                    {isActive && <Check size={14} className={styles.checkIcon} />}
                  </button>
                );
              })}

              {/* Display Active Pioneer Model if selected */}
              {selectedModelId && activeOption.tierRequired === 'pioneer' && (
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
                    <div className={styles.itemDescription}>Selected Pioneer Model</div>
                  </div>
                  <Check size={14} className={styles.checkIcon} />
                </button>
              )}


              {/* Divider moved inside conditional or strict check to avoid doubling */}
              {nextTier && (
                <>
                  <div className={styles.comfyUpgradeCard}>
                    <div className={styles.upgradeHeader}>
                      <div className={styles.upgradeTitle}>
                        <Rocket size={16} className={styles.upgradeIcon} />
                        <span>Upgrade</span>
                      </div>
                      <a href="/pricing" className={styles.upgradePill}>
                        View Plans
                      </a>
                    </div>
                    <div className={styles.upgradeBody}>
                      Unlock extended capabilities and faster thoughts.
                    </div>
                  </div>
                </>
              )}

              <div className={styles.divider} />

              {/* All Models */}
              <button
                className={`${styles.actionItem} ${currentLevel < TIER_LEVELS["pioneer"] ? styles.menuItemLocked : ''}`}
                type="button"
                onClick={toggleAllModels}
                disabled={currentLevel < TIER_LEVELS["pioneer"]}
              >
                <Box size={16} />
                <span>All Models</span>
                {currentLevel < TIER_LEVELS["pioneer"] ? (
                  <Lock size={14} className={styles.actionLock} />
                ) : (
                  <ChevronRight size={14} className={styles.actionArrow} />
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div >
  );

});

ModelSelector.displayName = "ModelSelector";
