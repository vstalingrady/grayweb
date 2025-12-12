import Image from "next/image";
import Link from "next/link";
import { ChevronsRight, ChevronsUp, UserRound } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import Skeleton from "react-loading-skeleton";
import { useUser } from "@/contexts/UserContext";
import { useI18n } from "@/contexts/I18nContext";
import styles from "@/app/gray/GrayPageClient.module.css";
import {
  type SidebarHistorySection,
  type SidebarNavItem,
  type SidebarNavKey,
} from "./types";

type GraySidebarProps = {
  isExpanded: boolean;
  viewerName: string;
  viewerInitials: string;
  viewerAvatarUrl?: string | null;
  activeNav: SidebarNavKey;
  railItems: SidebarNavItem[];
  navItems: SidebarNavItem[];
  historySections: SidebarHistorySection[];
  onExpand: () => void;
  onCollapse: () => void;
  onToggle: () => void;
  onNavigate: (nav: SidebarNavKey) => void;
  activeChatId?: string | null;
};

export function GraySidebar({
  isExpanded,
  viewerName,
  viewerInitials,
  viewerAvatarUrl = null,
  activeNav,
  railItems,
  navItems,
  historySections,
  onExpand,
  onCollapse,
  onToggle,
  onNavigate,
  activeChatId = null,
}: GraySidebarProps) {
  const { t } = useI18n();
  const { user } = useUser();
  const baseAvatarUrl = viewerAvatarUrl ?? user?.profile_picture_url ?? null;
  const [resolvedAvatarUrl, setResolvedAvatarUrl] = useState<string | null>(baseAvatarUrl);

  useEffect(() => {
    setResolvedAvatarUrl(baseAvatarUrl);
  }, [baseAvatarUrl]);

  const handleAvatarError = useCallback(() => {
    if (!resolvedAvatarUrl) {
      return;
    }
    // If the avatar fails to load, fall back to the default
    // inline avatar (initials) instead of a placeholder image.
    setResolvedAvatarUrl(null);
  }, [resolvedAvatarUrl]);

  const hasImage = Boolean(resolvedAvatarUrl);

  return (
    <aside className={styles.sidebar} data-expanded={isExpanded ? "true" : "false"}>
      <div className={styles.sidebarRail}>
        <button
          type="button"
          className={styles.sidebarRailLogo}
          aria-label={t("Open Gray Alignment sidebar")}
          onClick={onExpand}
        >
          <Image
            src="/grayaiwhitenotspinning.svg"
            alt={t("Gray Alignment emblem")}
            width={24}
            height={24}
            priority
          />
        </button>
        <nav aria-label={t("Sidebar quick actions")} className={styles.railNav}>
          <ul>
            {railItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  aria-label={t(item.label)}
                  data-active={item.id === activeNav ? "true" : "false"}
                  onClick={() => onNavigate(item.id)}
                >
                  <item.icon size={18} />
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.sidebarRailFooter}>
          <button
            type="button"
            className={styles.sidebarRailAvatar}
            aria-label={isExpanded ? t("Collapse sidebar") : t("Expand sidebar")}
            data-expanded={isExpanded ? "true" : "false"}
            onClick={onToggle}
          >
            <span
              className={styles.sidebarRailAvatarImage}
              data-has-image={hasImage ? "true" : "false"}
            >
              {hasImage ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={resolvedAvatarUrl!}
                    alt={viewerName}
                    referrerPolicy="no-referrer"
                    onError={handleAvatarError}
                  />
                </>
              ) : (
                viewerInitials
              )}
            </span>
            <span className={styles.sidebarRailAvatarIcon} aria-hidden="true">
              {isExpanded ? <ChevronsRight size={18} /> : <ChevronsUp size={18} />}
            </span>
          </button>
        </div>
      </div>

      <div className={styles.sidebarPanel} data-expanded={isExpanded ? "true" : "false"}>
        <div className={styles.sidebarPanelContent}>
          <div className={styles.sidebarTop}>
            <button
              type="button"
              className={styles.sidebarLogo}
              aria-label={t("Collapse Gray Alignment sidebar")}
              onClick={onCollapse}
            >
              <Image
                src="/grayaiwhitenotspinning.svg"
                alt={t("Gray Alignment emblem")}
                width={28}
                height={28}
                priority
                className={styles.sidebarLogoImage}
              />
            </button>
            <div className={styles.sidebarScroll}>
              <nav aria-label={t("Primary")}>
                <ul className={styles.sidebarNav}>
                  {navItems.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        data-active={item.id === activeNav ? "true" : "false"}
                        aria-label={t(item.label)}
                        onClick={() => onNavigate(item.id)}
                      >
                        <span className={styles.navIcon}>
                          <item.icon size={18} />
                        </span>
                        <span className={styles.navLabel}>{t(item.label)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>
              <div className={styles.sidebarHistory}>
                {historySections.map((section) => (
                  <div key={section.id} className={styles.historySection}>
                    <h3>{t(section.label)}</h3>
                    <ul>
                      {section.entries.map((entry) => (
                        <li key={entry.id}>
                          {entry.isGeneratingTitle || !entry.title?.trim() ? (
                            <div style={{ padding: "4px 12px" }}>
                              <Skeleton
                                height={14}
                                width={120}
                                baseColor="rgba(255, 255, 255, 0.05)"
                                highlightColor="rgba(255, 255, 255, 0.1)"
                                borderRadius={4}
                              />
                            </div>
                          ) : (
                            <Link
                              href={entry.href}
                              className={styles.historyLink}
                              data-active={entry.id === activeChatId ? "true" : "false"}
                            >
                              {entry.title}
                            </Link>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <div className={styles.sidebarScrollFade} aria-hidden="true" />
            </div>
          </div>
          <div className={styles.sidebarBottom}>
            <div className={styles.sidebarProfile} role="group" aria-label={t("Profile controls")}>
              <button type="button" className={styles.profileMenuButton} aria-label={t("View profile")}>
                <span className={styles.profileInfo}>
                  <span
                    className={styles.profileAvatar}
                    aria-hidden="true"
                    data-has-image={hasImage ? "true" : "false"}
                  >
                    {hasImage ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={resolvedAvatarUrl!}
                          alt={viewerName}
                          referrerPolicy="no-referrer"
                          onError={handleAvatarError}
                        />
                      </>
                    ) : (
                      <UserRound size={22} />
                    )}
                  </span>
                  <span className={styles.profileDetails}>
                    <span>{viewerName}</span>
                    <span>{user?.role || t("Operator")}</span>
                  </span>
                </span>
              </button>
              <button
                type="button"
                className={styles.profileToggleButton}
                aria-label={isExpanded ? t("Collapse sidebar") : t("Expand sidebar")}
                data-expanded={isExpanded ? "true" : "false"}
                onClick={onCollapse}
              >
                {isExpanded ? <ChevronsRight size={18} /> : <ChevronsUp size={18} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
