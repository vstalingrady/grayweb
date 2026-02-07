import { memo, type ReactNode } from "react";
import { Flame } from "lucide-react";
import styles from "@/app/gray/GrayPageClient.module.css";
import { useI18n } from "@/contexts/I18nContext";

type GrayWorkspaceHeaderProps = {
  planLabel: string;
  onUpgradeClick?: () => void;
  children?: ReactNode;
  showUpgradeButton?: boolean;
  hideDesktopMeta?: boolean;
  streakCount?: number | null;
};

function GrayWorkspaceHeader({
  planLabel,
  onUpgradeClick,
  children,
  showUpgradeButton = true,
  hideDesktopMeta = false,
  streakCount = null,
}: GrayWorkspaceHeaderProps) {
  const { t } = useI18n();
  const normalizedPlanLower = (planLabel || "").trim().toLowerCase();

  // Only show Upgrade button if user is "scout" (free tier)
  const isScout = normalizedPlanLower === "scout" || normalizedPlanLower === "";
  const shouldShowUpgrade = showUpgradeButton && isScout;
  const showStreak = typeof streakCount === "number" && streakCount > 0;
  const shouldShowMeta = !hideDesktopMeta && (shouldShowUpgrade || showStreak);
  const streakLabel = showStreak ? t("{count} day streak", { count: streakCount }) : "";

  const handleUpgradeClick = () => {
    onUpgradeClick?.();
  };

  return (
    <header className={styles.header}>
      {children ? <div className={styles.headerLeft}>{children}</div> : null}
      {shouldShowMeta ? (
        <div className={`${styles.headerRight} hidden md:flex`}>
          {showStreak ? (
            <div className={styles.streakBadge} aria-label={streakLabel} title={streakLabel}>
              <Flame size={14} className={styles.streakBadgeIcon} aria-hidden="true" />
              <span className={styles.streakBadgeCount}>{streakCount}</span>
            </div>
          ) : null}
          {shouldShowUpgrade ? (
            <button
              type="button"
              className={styles.planBadge}
              onClick={handleUpgradeClick}
              aria-label={t("Upgrade plan")}
            >
              <span className={styles.planBadgeLabel}>{t("Upgrade")}</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}

export { GrayWorkspaceHeader };
export default memo(GrayWorkspaceHeader);
