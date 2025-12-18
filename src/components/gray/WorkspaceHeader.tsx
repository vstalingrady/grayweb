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
  const normalizedPlanLower = (planLabel || "").trim().toLowerCase();

  // Only show Upgrade button if user is "scout" (free tier)
  const isScout = normalizedPlanLower === "scout" || normalizedPlanLower === "";
  const shouldShowUpgrade = showUpgradeButton && isScout;

  const handleUpgradeClick = () => {
    onUpgradeClick?.();
  };

  return (
    <header className={styles.header}>
      {children ? <div className={styles.headerLeft}>{children}</div> : null}
      {!hideDesktopMeta && shouldShowUpgrade ? (
        <div className={`${styles.headerRight} hidden md:flex`}>
          <button
            type="button"
            className={styles.planBadge}
            onClick={handleUpgradeClick}
            aria-label={t("Upgrade plan")}
          >
            <span className={styles.planBadgeLabel}>{t("Upgrade")}</span>
          </button>
        </div>
      ) : null}
    </header>
  );
}

export { GrayWorkspaceHeader };
export default memo(GrayWorkspaceHeader);
