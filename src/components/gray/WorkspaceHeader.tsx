import { memo, type ReactNode } from "react";
import { Zap } from "lucide-react";
import styles from "@/app/gray/GrayPageClient.module.css";

type GrayWorkspaceHeaderProps = {
  streakCount: number;
  planLabel: string;
  onUpgradeClick?: () => void;
  children?: ReactNode;
  showUpgradeButton?: boolean;
  hideDesktopMeta?: boolean;
};

function GrayWorkspaceHeader({
  streakCount,
  planLabel,
  onUpgradeClick,
  children,
  showUpgradeButton = true,
  hideDesktopMeta = false,
}: GrayWorkspaceHeaderProps) {
  const normalizedPlanLabel = planLabel.trim().length ? planLabel.trim() : "Pioneer";
  const normalizedPlanLower = normalizedPlanLabel.toLowerCase();
  const normalizedStreak = Number.isFinite(streakCount)
    ? Math.max(0, Math.trunc(streakCount))
    : 0;
  const isDepthMember = normalizedPlanLower === "depth";
  const isUpgradeVisible = showUpgradeButton
    && !isDepthMember
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
      {!hideDesktopMeta ? (
        <div className={`${styles.headerRight} hidden md:flex`}>
          {normalizedStreak > 0 ? (
            <div className={styles.streakBadge} aria-label={`${normalizedStreak} day streak`}>
              <Zap size={12} />
              <span>{normalizedStreak}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}

export { GrayWorkspaceHeader };
export default memo(GrayWorkspaceHeader);
