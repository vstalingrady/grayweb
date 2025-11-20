"use client";

import { memo, useCallback, useMemo } from "react";
import { Zap, Box, Sparkles, Brain, Lock } from "lucide-react";
import { useChatStore } from "@/components/gray/ChatProvider";
import { useUser } from "@/contexts/UserContext";
import styles from "./ModelSelector.module.css";

type ModelOption = {
  id: string;
  label: string;
  icon: React.ElementType;
  tierRequired: "scout" | "voyager" | "pioneer";
};

const OPTIONS: ModelOption[] = [
  { id: "lite", label: "Lite", icon: Zap, tierRequired: "scout" },
  { id: "base", label: "Base", icon: Box, tierRequired: "scout" },
  { id: "pro", label: "Pro", icon: Sparkles, tierRequired: "voyager" },
  { id: "reasoning", label: "Deep", icon: Brain, tierRequired: "pioneer" },
];

const TIER_LEVELS: Record<string, number> = {
  scout: 0,
  voyager: 1,
  pioneer: 2,
};

export const ModelSelector = memo(() => {
  const { modelTier, setModelTier, reasoningMode, setReasoningMode } = useChatStore();
  const { user } = useUser();

  const currentTier = (user?.plan_tier || "scout").toLowerCase();
  const currentLevel = TIER_LEVELS[currentTier] ?? 0;

  const activeIndex = useMemo(() => {
    if (reasoningMode) return 3;
    if (modelTier === "pro") return 2;
    if (modelTier === "base") return 1;
    return 0;
  }, [modelTier, reasoningMode]);

  const handleSelect = useCallback(
    (index: number) => {
      const option = OPTIONS[index];
      const requiredLevel = TIER_LEVELS[option.tierRequired];
      
      if (currentLevel < requiredLevel) {
        // Optionally trigger upsell modal here
        return;
      }

      if (index === 3) {
        setModelTier("pro");
        setReasoningMode(true);
      } else {
        setReasoningMode(false);
        if (index === 2) setModelTier("pro");
        else if (index === 1) setModelTier("base");
        else setModelTier("lite");
      }
    },
    [currentLevel, setModelTier, setReasoningMode]
  );

  return (
    <div className={styles.container}>
      <div 
        className={styles.track} 
        style={{ "--option-count": OPTIONS.length } as React.CSSProperties}
        data-active-index={activeIndex}
      >
        <div className={styles.indicator} />
        {OPTIONS.map((option, index) => {
          const requiredLevel = TIER_LEVELS[option.tierRequired];
          const isLocked = currentLevel < requiredLevel;
          const Icon = isLocked ? Lock : option.icon;
          const isActive = activeIndex === index;

          return (
            <button
              key={option.id}
              className={styles.option}
              onClick={() => handleSelect(index)}
              disabled={isLocked}
              data-active={isActive ? "true" : undefined}
              aria-label={`Select ${option.label} model`}
              title={isLocked ? `${option.label} (Requires ${option.tierRequired})` : option.label}
            >
              <Icon className={styles.icon} />
              <span className={styles.label}>{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
});

ModelSelector.displayName = "ModelSelector";