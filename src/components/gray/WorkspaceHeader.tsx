import { memo, type ReactNode } from "react";
import { Zap } from "lucide-react";
import styles from "@/app/gray/GrayPageClient.module.css";

type GrayWorkspaceHeaderProps = {
  streakCount: number;
  planLabel: string;
  onUpgradeClick?: () => void;
  children?: ReactNode;
};

function GrayWorkspaceHeader({
  streakCount,
  planLabel,
  onUpgradeClick,
  children,
}: GrayWorkspaceHeaderProps) {
  const normalizedPlanLabel = planLabel.trim().length ? planLabel.trim() : "Scout";
  const normalizedPlanLower = normalizedPlanLabel.toLowerCase();
  const normalizedStreak = Number.isFinite(streakCount)
    ? Math.max(0, Math.trunc(streakCount))
    : 0;
  const isDepthMember = normalizedPlanLower === "depth";
  const isUpgradeVisible = !isDepthMember
    && normalizedPlanLower !== "voyager"
    && normalizedPlanLower !== "pioneer";

  const handlePlanBadgeClick = () => {
    if (isDepthMember || !isUpgradeVisible) {
      return;
    }
    onUpgradeClick?.();
  };
  return (
    <header className={styles.header}>
      {children ? <div className={styles.headerLeft}>{children}</div> : null}
      <div className={`${styles.headerRight} hidden md:flex`}>
        {isUpgradeVisible ? (
          <div className={styles.upgradeFloat}>
            <button
              type="button"
              className={styles.planBadge}
              data-state={isDepthMember ? "active" : "cta"}
              aria-label={isDepthMember ? `${normalizedPlanLabel} plan` : "Upgrade"}
              aria-disabled={isDepthMember ? "true" : "false"}
              onClick={handlePlanBadgeClick}
            >
              <span className={styles.planBadgeLabel}>Upgrade</span>
            </button>
          </div>
        ) : null}
        {normalizedStreak > 0 ? (
          <div className={styles.streakBadge} aria-label={`${normalizedStreak} day streak`}>
            <Zap size={12} />
            <span>{normalizedStreak}</span>
          </div>
        ) : null}
      </div>
    </header>
  );
}

export { GrayWorkspaceHeader };
export default memo(GrayWorkspaceHeader);
