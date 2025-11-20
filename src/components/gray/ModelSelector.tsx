"use client";

import { memo, useCallback, useMemo, useState, useRef, useEffect } from "react";
import { Zap, Box, Sparkles, Lock, ChevronUp, Rocket, Grid } from "lucide-react";
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

const OPTIONS: ModelOption[] = [
  { id: "lite", label: "Lite", description: "Quick responses", icon: Zap, tierRequired: "scout" },
  { id: "base", label: "Base", description: "Balanced intelligence", icon: Box, tierRequired: "voyager" },
  { id: "pro", label: "Pro", description: "Complex tasks", icon: Sparkles, tierRequired: "voyager" },
];

const TIER_LEVELS: Record<string, number> = {
  scout: 0,
  voyager: 1,
  pioneer: 2,
};

export const ModelSelector = memo(() => {
  const { modelTier, setModelTier } = useChatStore();
  const { user } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentTier = (user?.plan_tier || "scout").toLowerCase();
  const currentLevel = TIER_LEVELS[currentTier] ?? 0;

  const activeOption = useMemo(() => {
    if (modelTier === "pro") return OPTIONS[2];
    if (modelTier === "base") return OPTIONS[1];
    return OPTIONS[0];
  }, [modelTier]);

  const handleSelect = useCallback(
    (index: number) => {
      const option = OPTIONS[index];
      const requiredLevel = TIER_LEVELS[option.tierRequired];

      if (currentLevel < requiredLevel) {
        return;
      }

      if (index === 2) setModelTier("pro");
      else if (index === 1) setModelTier("base");
      else setModelTier("lite");

      setIsOpen(false);
    },
    [currentLevel, setModelTier]
  );

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
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
  const nextTierLabel = nextTier ? nextTier.charAt(0).toUpperCase() + nextTier.slice(1) : "";

  return (
    <div className={styles.container} ref={containerRef}>
      {/* Trigger Button */}
      <button
        className={styles.trigger}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Select model"
        type="button"
      >
        <ChevronUp className={styles.chevron} size={16} />
        <span className={styles.triggerLabel}>{activeOption.label}</span>
      </button>

      {/* Dropup Menu */}
      <div className={`${styles.menu} ${isOpen ? styles.menuOpen : ""}`}>
        <div className={styles.menuContent}>
          {OPTIONS.map((option, index) => {
            const requiredLevel = TIER_LEVELS[option.tierRequired];
            const isLocked = currentLevel < requiredLevel;
            const isActive = activeOption.id === option.id;
            const Icon = option.icon;

            return (
              <button
                key={option.id}
                className={`${styles.menuItem} ${isActive ? styles.menuItemActive : ""} ${isLocked ? styles.menuItemLocked : ""}`}
                onClick={() => handleSelect(index)}
                disabled={isLocked}
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
                {isActive && <div className={styles.activeIndicator} />}
              </button>
            );
          })}

          <div className={styles.divider} />

          {/* All Models - Locked */}
          <button className={styles.actionItem} type="button" disabled>
            <Grid size={16} />
            <span>All Models</span>
            <Lock size={14} className={styles.actionLock} />
          </button>

          {/* Upgrade Section */}
          {nextTier && (
            <div className={styles.upgradeSection}>
              <div className={styles.upgradeContent}>
                <div className={styles.upgradeIconWrapper}>
                  <Rocket size={18} />
                </div>
                <div className={styles.upgradeInfo}>
                  <div className={styles.upgradeLabel}>Upgrade</div>
                  <div className={styles.upgradeDescription}>Unlock more capabilities</div>
                </div>
                <a href="/pricing" className={styles.upgradeButton}>Upgrade</a>
              </div>
            </div>
          )}


        </div>
      </div>
    </div>
  );
});

ModelSelector.displayName = "ModelSelector";
