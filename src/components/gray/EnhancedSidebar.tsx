import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronsRight,
  ChevronsUp,
  Settings as SettingsIcon,
  LifeBuoy,
  LogOut,
  Pin,
} from "lucide-react";
import Skeleton from "react-loading-skeleton";
import { SiDiscord } from "react-icons/si";
import { useUser } from "@/contexts/UserContext";
import { useI18n } from "@/contexts/I18nContext";
import styles from "@/app/gray/GrayPageClient.module.css";
import railNavStyles from "./sidebar/RailNav.module.css";
import { type SidebarHistorySection, type SidebarNavItem, type SidebarNavKey } from "./types";
import { StarfieldCanvas } from "./StarfieldCanvas";
import { HistoryItemMenu } from "./enhancedSidebar/HistoryItemMenu";
import { SidebarHistorySkeleton } from "./enhancedSidebar/SidebarHistorySkeleton";
import { useDismissableLayer } from "./hooks/useDismissableLayer";

type GrayEnhancedSidebarProps = {
  isExpanded: boolean;
  viewerName: string;
  viewerInitials: string;
  viewerAvatarUrl?: string | null;
  viewerAvatarColor?: string;
  viewerPlanLabel: string;
  activeNav: SidebarNavKey;
  railItems: SidebarNavItem[];
  navItems: SidebarNavItem[];
  historySections: SidebarHistorySection[];
  onExpand: () => void;
  onCollapse: () => void;
  onToggle: () => void;
  onNavigate: (nav: SidebarNavKey) => void;
  activeChatId?: string | null;
  onOpenSettings?: () => void;
  onOpenHelp?: () => void;
  onUpgradePlan?: () => void;
  onLogOut?: () => void;
  onRenameHistoryEntry?: (id: string) => void;
  onDeleteHistoryEntry?: (id: string) => void;
  onPinHistoryEntry?: (id: string, pinned: boolean) => void;
  isLoadingHistory?: boolean;
};

const normalizeNavLabel = (item: SidebarNavItem): string => {
  return item.label;
};

function GrayEnhancedSidebarComponent(props: GrayEnhancedSidebarProps) {
  const {
    isExpanded,
    viewerName,
    viewerInitials,
    viewerAvatarUrl = null,
    viewerAvatarColor,
    viewerPlanLabel,
    activeNav,
    railItems,
    navItems,
    historySections,
    onExpand,
    onCollapse,
    onToggle,
    onNavigate,
    activeChatId = null,
    onOpenSettings,
    onOpenHelp,
    onUpgradePlan,
    onLogOut,
    onRenameHistoryEntry,
    onDeleteHistoryEntry,
    onPinHistoryEntry,
    isLoadingHistory = false,
  } = props;
  const { t } = useI18n();
  const { user } = useUser();
  const sidebarAvatarUrl = viewerAvatarUrl ?? user?.profile_picture_url ?? null;
  const [resolvedAvatarUrl, setResolvedAvatarUrl] = useState<string | null>(sidebarAvatarUrl);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileControlsRef = useRef<HTMLDivElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const normalizedPlan = viewerPlanLabel?.trim().length ? viewerPlanLabel : "Scout";
  const planLower = normalizedPlan.trim().toLowerCase();
  const isVoyager = planLower === "voyager";
  const isPioneer = planLower === "pioneer";
  const isPaidUser = isVoyager || isPioneer;

  const historyNavItem = useMemo(() => navItems.find((item) => item.id === "history"), [navItems]);

  useEffect(() => {
    setResolvedAvatarUrl(sidebarAvatarUrl);
  }, [sidebarAvatarUrl]);

  const closeProfileMenu = useCallback(() => {
    setIsProfileMenuOpen(false);
  }, []);

  const profileMenuDismissRefs = useMemo(() => [profileMenuRef, profileControlsRef], []);

  useDismissableLayer({
    isOpen: isProfileMenuOpen,
    ignoreRefs: profileMenuDismissRefs,
    onDismiss: closeProfileMenu,
  });

  const handleAvatarError = useCallback(() => {
    if (!resolvedAvatarUrl) {
      return;
    }
    // If the avatar fails to load, fall back to the default
    // inline avatar (initials / icon) instead of a placeholder image.
    setResolvedAvatarUrl(null);
  }, [resolvedAvatarUrl]);

  const handleProfileClick = useCallback(() => {
    setIsProfileMenuOpen((previous) => !previous);
  }, []);

  const handleSidebarToggle = useCallback(() => {
    setIsProfileMenuOpen(false);
    onToggle();
  }, [onToggle]);

  const handleOpenSettings = useCallback(() => {
    onOpenSettings?.();
    setIsProfileMenuOpen(false);
  }, [onOpenSettings]);

  const handleOpenHelp = useCallback(() => {
    onOpenHelp?.();
    setIsProfileMenuOpen(false);
  }, [onOpenHelp]);

  const handleOpenCommunity = useCallback(() => {
    window.open("https://discord.gg/8xvsF5J5fc", "_blank", "noopener,noreferrer");
    setIsProfileMenuOpen(false);
  }, []);

  const handleUpgradePlan = useCallback(() => {
    onUpgradePlan?.();
    setIsProfileMenuOpen(false);
  }, [onUpgradePlan]);

  const handleLogOut = useCallback(() => {
    onLogOut?.();
    setIsProfileMenuOpen(false);
  }, [onLogOut]);

  const showImage = Boolean(resolvedAvatarUrl);

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
            className={`${styles.sidebarRailLogoImage} ${styles.uiIconImage}`}
          />
        </button>
        <nav aria-label={t("Sidebar quick actions")} className={railNavStyles.railNav}>
          <ul>
            {railItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  aria-label={t(normalizeNavLabel(item))}
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
            onClick={() => {
              setIsProfileMenuOpen(false);
              onToggle();
            }}
          >
            <span
              className={styles.sidebarRailAvatarImage}
              data-has-image={showImage ? "true" : "false"}
              style={!showImage && viewerAvatarColor ? { backgroundColor: viewerAvatarColor } : undefined}
            >
              {showImage ? (
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
          <div className={styles.sidebarTop} data-layout="anchored">
            <button
              type="button"
              className={styles.sidebarLogo}
              aria-label={t("Collapse Gray Alignment sidebar")}
              onClick={() => {
                setIsProfileMenuOpen(false);
                onCollapse();
              }}
            >
              <Image
                src="/grayaiwhitenotspinning.svg"
                alt={t("Gray Alignment emblem")}
                width={28}
                height={28}
                priority
                className={`${styles.sidebarLogoImage} ${styles.uiIconImage}`}
              />
            </button>
            <div className={styles.sidebarAnchored}>
              <nav aria-label={t("Primary")}>
                <ul className={styles.sidebarNav}>
                  {navItems.map((item) => (
                    <li key={item.id} className={styles.sidebarNavItem} data-nav={item.id}>
                      <button
                        type="button"
                        data-active={item.id === activeNav ? "true" : "false"}
                        aria-label={t(normalizeNavLabel(item))}
                        onClick={() => onNavigate(item.id)}
                      >
                        <span className={styles.navIcon}>
                          <item.icon size={18} />
                        </span>
                        <span className={styles.navLabel}>{t(normalizeNavLabel(item))}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </div>
          {historyNavItem && isExpanded ? (
            <div className={styles.sidebarScroll} aria-label={t("Recent conversations")}>
              <div className={styles.sidebarHistorySection}>
                <div className={styles.sidebarHistoryFixed}>
                  {historySections.length > 0 ? (
                    historySections.map((group) => (
                      <div key={group.id} className={styles.sidebarHistoryGroup}>
                        <span className={styles.sidebarHistoryLabel}>{t(group.label)}</span>
                        {group.entries.length > 0 ? (
                          <ul className={styles.sidebarHistoryList}>
                            {group.entries.map((entry) => {
                              const isActive = entry.id === activeChatId;
                              return (
                                <li key={entry.id}>
                                  {entry.isGeneratingTitle || !entry.title?.trim() ? (
                                    <div className="gray-history-skeleton" style={{ padding: "6px 16px" }}>
                                      <Skeleton
                                        height={14}
                                        width={140}
                                        baseColor="rgba(255, 255, 255, 0.08)"
                                        highlightColor="rgba(255, 255, 255, 0.18)"
                                        borderRadius={4}
                                        duration={1.2}
                                        enableAnimation
                                      />
                                    </div>
                                  ) : (
                                    <>
                                      <Link
                                        href={entry.href}
                                        className={
                                          isActive
                                            ? `${styles.sidebarHistoryLink} ${styles.sidebarHistoryLinkActive}`
                                            : styles.sidebarHistoryLink
                                        }
                                      >
                                        {entry.isPinned && (
                                          <Pin
                                            size={10}
                                            fill="currentColor"
                                            style={{ marginRight: 6, opacity: 0.7, flexShrink: 0 }}
                                          />
                                        )}
                                        {entry.title}
                                      </Link>
                                      <HistoryItemMenu
                                        entry={entry}
                                        onRename={onRenameHistoryEntry}
                                        onDelete={onDeleteHistoryEntry}
                                        onPin={onPinHistoryEntry}
                                      />
                                    </>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        ) : isLoadingHistory ? (
                          <SidebarHistorySkeleton />
                        ) : null}
                      </div>
                    ))
                  ) : isLoadingHistory ? (
                    <SidebarHistorySkeleton />
                  ) : null}
                </div>
              </div>
              <div className={styles.sidebarScrollFadeFixed} aria-hidden="true" />
            </div>
          ) : null}
          <div className={styles.sidebarBottom}>
            <div className={styles.sidebarProfile}>
              <div
                className={styles.profileMenuWrapper}
                data-expanded={isProfileMenuOpen ? "true" : "false"}
                role="group"
                aria-label={t("Profile actions")}
                ref={profileControlsRef}
              >
                <button
                  type="button"
                  className={styles.profileMenuButton}
                  aria-label={isProfileMenuOpen ? t("Collapse profile menu") : t("Expand profile menu")}
                  aria-haspopup="menu"
                  aria-expanded={isProfileMenuOpen ? "true" : "false"}
                  onClick={handleProfileClick}
                >
                  <span className={styles.profileInfo}>
                    <span
                      className={styles.profileAvatar}
                      aria-hidden="true"
                      data-has-image={showImage ? "true" : "false"}
                      style={!showImage && viewerAvatarColor ? { backgroundColor: viewerAvatarColor } : undefined}
                    >
                      {showImage ? (
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
                    <span className={styles.profileDetails}>
                      <span>{viewerName}</span>
                      <span>{normalizedPlan}</span>
                    </span>
                  </span>
                </button>
                {isProfileMenuOpen && (
                  <div className={styles.profileMenu} role="menu" ref={profileMenuRef}>
                    {!isPaidUser ? (
                      <>
                        <button
                          type="button"
                          className={`${styles.profileMenuItem} ${styles.profileMenuUpgrade}`}
                          onClick={handleUpgradePlan}
                          role="menuitem"
                        >
                          <span className={styles.profileMenuUpgradeCard}>
                            <span className={styles.profileMenuUpgradeSubtext}>{t("Unlock full access")}</span>
                            <span className={styles.profileMenuUpgradePill}>{t("View Plans")}</span>
                          </span>
                        </button>
                        <span className={styles.profileMenuDivider} aria-hidden="true" />
                      </>
                    ) : (isVoyager || isPioneer) ? (
                      <>
                        <div
                          className={`${styles.profileMenuItem} ${styles.profileMenuUpgrade}`}
                          role="menuitem"
                        >
                          <span className={styles.profileMenuUpgradeCard} data-variant={isPioneer ? "pioneer" : "voyager"}>
                            <span className={styles.profileMenuUpgradeSubtext}>{t("Current Plan")}</span>
                            <span className={styles.profileMenuUpgradeTitle}>{normalizedPlan}</span>
                            <StarfieldCanvas className={styles.starfieldCanvas} density={0.008} minStars={12} maxStars={40} speed={16} orbitMode trailLength={0.15} />
                          </span>
                        </div>
                        <span className={styles.profileMenuDivider} aria-hidden="true" />
                      </>
                    ) : null}
                    <button
                      type="button"
                      className={styles.profileMenuItem}
                      onClick={handleOpenSettings}
                      role="menuitem"
                    >
                      <span className={styles.profileMenuItemContent}>
                        <span className={styles.profileMenuIcon}>
                          <SettingsIcon size={16} />
                        </span>
                        <span className={styles.profileMenuLabel}>{t("Settings")}</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className={styles.profileMenuItem}
                      onClick={handleOpenHelp}
                      role="menuitem"
                    >
                      <span className={styles.profileMenuItemContent}>
                        <span className={styles.profileMenuIcon}>
                          <LifeBuoy size={16} />
                        </span>
                        <span className={styles.profileMenuLabel}>{t("Help")}</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className={styles.profileMenuItem}
                      onClick={handleOpenCommunity}
                      role="menuitem"
                    >
                      <span className={styles.profileMenuItemContent}>
                        <span className={styles.profileMenuIcon}>
                          <SiDiscord size={16} />
                        </span>
                        <span className={styles.profileMenuLabel}>{t("Community")}</span>
                      </span>
                    </button>
                    <span className={styles.profileMenuDivider} aria-hidden="true" />
                    <button
                      type="button"
                      className={`${styles.profileMenuItem} ${styles.profileMenuLogout}`}
                      onClick={handleLogOut}
                      role="menuitem"
                    >
                      <span className={styles.profileMenuItemContent}>
                        <span className={styles.profileMenuIcon}>
                          <LogOut size={16} />
                        </span>
                        <span className={styles.profileMenuLabel}>{t("Log out")}</span>
                      </span>
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                className={styles.profileToggleButton}
                aria-label={isExpanded ? t("Collapse sidebar") : t("Expand sidebar")}
                data-expanded={isExpanded ? "true" : "false"}
                onClick={handleSidebarToggle}
              >
                {isExpanded ? <ChevronsRight size={18} /> : <ChevronsUp size={18} />}
              </button>
            </div>
          </div>

        </div>
      </div>
    </aside >
  );
}

GrayEnhancedSidebarComponent.displayName = "GrayEnhancedSidebar";

export const GrayEnhancedSidebar = memo(GrayEnhancedSidebarComponent);
