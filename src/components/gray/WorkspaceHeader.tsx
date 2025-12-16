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
          {null}
        </div>
      ) : null}
    </header>
  );
}

export { GrayWorkspaceHeader };
export default memo(GrayWorkspaceHeader);
