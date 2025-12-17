import { memo, type ReactNode } from "react";
import styles from "@/app/gray/GrayPageClient.module.css";
import { useI18n } from "@/contexts/I18nContext";

type GrayWorkspaceHeaderProps = {
  planLabel: string;
  onUpgradeClick?: () => void;
  children?: ReactNode;
  showUpgradeButton?: boolean;
  hideDesktopMeta?: boolean;
};

function GrayWorkspaceHeader({
  planLabel,
  onUpgradeClick,
  children,
  showUpgradeButton = true,
  hideDesktopMeta = false,
}: GrayWorkspaceHeaderProps) {
  const { t } = useI18n();
  const normalizedPlanLabel = planLabel.trim().length ? planLabel.trim() : t("Pioneer");
  const normalizedPlanLower = normalizedPlanLabel.toLowerCase();
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
          <button
            type="button"
            className={styles.planBadge}
            onClick={handlePlanBadgeClick}
            data-state={!isUpgradeVisible ? "active" : undefined}
            disabled={!isUpgradeVisible || !onUpgradeClick}
            aria-label={
              isUpgradeVisible
                ? t("Upgrade plan from {plan}", { plan: normalizedPlanLabel })
                : t("Current plan: {plan}", { plan: normalizedPlanLabel })
            }
          >
            <span className={styles.planBadgeLabel}>{normalizedPlanLabel}</span>
            {isUpgradeVisible ? <span className={styles.planBadgeHint}>{t("Upgrade")}</span> : null}
          </button>
        </div>
      ) : null}
    </header>
  );
}

export { GrayWorkspaceHeader };
export default memo(GrayWorkspaceHeader);
