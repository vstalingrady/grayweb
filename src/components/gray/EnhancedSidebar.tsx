import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronsRight,
  ChevronsUp,
  ChevronsDown,
  Settings as SettingsIcon,
  LifeBuoy,
  LogOut,
  MoreHorizontal,
  Pencil,
  Pin,
  Trash2,
} from "lucide-react";
import { createPortal } from "react-dom";
import Skeleton from "react-loading-skeleton";
import { SiDiscord } from "react-icons/si";
import { useUser } from "@/contexts/UserContext";
import { useI18n } from "@/contexts/I18nContext";
import styles from "@/app/gray/GrayPageClient.module.css";
import { type SidebarHistorySection, type SidebarNavItem, type SidebarNavKey, type SidebarHistoryEntry } from "./types";
import { StarfieldCanvas } from "./StarfieldCanvas";

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

const SidebarHistorySkeleton = () => (
  <div
    className="gray-history-skeleton"
    style={{
      padding: "6px 16px",
      display: "flex",
      flexDirection: "column",
      gap: 10,
    }}
    aria-label="Loading"
  >
    <Skeleton
      height={14}
      width="78%"
      baseColor="rgba(255, 255, 255, 0.08)"
      highlightColor="rgba(255, 255, 255, 0.18)"
      borderRadius={6}
      duration={1.2}
      enableAnimation
    />
    <Skeleton
      height={14}
      width="64%"
      baseColor="rgba(255, 255, 255, 0.08)"
      highlightColor="rgba(255, 255, 255, 0.18)"
      borderRadius={6}
      duration={1.2}
      enableAnimation
    />
    <Skeleton
      height={14}
      width="70%"
      baseColor="rgba(255, 255, 255, 0.08)"
      highlightColor="rgba(255, 255, 255, 0.18)"
      borderRadius={6}
      duration={1.2}
      enableAnimation
    />
    <Skeleton
      height={14}
      width="52%"
      baseColor="rgba(255, 255, 255, 0.08)"
      highlightColor="rgba(255, 255, 255, 0.18)"
      borderRadius={6}
      duration={1.2}
      enableAnimation
    />
    <Skeleton
      height={14}
      width="68%"
      baseColor="rgba(255, 255, 255, 0.08)"
      highlightColor="rgba(255, 255, 255, 0.18)"
      borderRadius={6}
      duration={1.2}
      enableAnimation
    />
  </div>
);

const HistoryItemMenu = ({
  entry,
  onRename,
  onDelete,
  onPin,
}: {
  entry: SidebarHistoryEntry;
  onRename?: (id: string) => void;
  onDelete?: (id: string) => void;
  onPin?: (id: string, pinned: boolean) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!isOpen) return;
    const close = () => setIsOpen(false);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, { capture: true });
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, { capture: true });
    };
  }, [isOpen]);

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    // Position menu: to the right of the button, or slightly below.
    setCoords({ top: rect.bottom + 2, left: rect.right - 150 });
    setIsOpen(!isOpen);
  };

  return (
    <>
      <div
        className={styles.sidebarHistoryActions}
        style={{ opacity: isOpen ? 1 : undefined }}
      >
        <button ref={triggerRef} onClick={toggle} className={styles.sidebarActionButton}>
          <MoreHorizontal size={14} />
        </button>
      </div>
      {isOpen &&
        createPortal(
          <div
            className={styles.sidebarMenuPopover}
            style={{ top: coords.top, left: coords.left }}
            onClick={(e) => e.stopPropagation()}
          >
            {onRename && (
              <button
                onClick={() => {
                  onRename(entry.id);
                  setIsOpen(false);
                }}
                className={styles.sidebarMenuItem}
              >
                <Pencil size={13} /> Rename
              </button>
            )}
            {onPin && (
              <button
                onClick={() => {
                  onPin(entry.id, !entry.isPinned);
                  setIsOpen(false);
                }}
                className={styles.sidebarMenuItem}
              >
                <Pin size={13} fill={entry.isPinned ? "currentColor" : "none"} />{" "}
                {entry.isPinned ? "Unpin" : "Pin"}
              </button>
            )}
            <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "2px 0" }} />
            {onDelete && (
              <button
                onClick={() => {
                  onDelete(entry.id);
                  setIsOpen(false);
                }}
                className={`${styles.sidebarMenuItem} ${styles.delete}`}
              >
                <Trash2 size={13} /> Delete
              </button>
            )}
          </div>,
          document.body
        )}
    </>
  );
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

  const handleAvatarError = useCallback(() => {
    if (!resolvedAvatarUrl) {
      return;
    }
    // If the avatar fails to load, fall back to the default
    // inline avatar (initials / icon) instead of a placeholder image.
    setResolvedAvatarUrl(null);
  }, [resolvedAvatarUrl]);

  useEffect(() => {
    if (!isProfileMenuOpen) {
      return;
    }
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(target) &&
        profileControlsRef.current &&
        !profileControlsRef.current.contains(target)
      ) {
        setIsProfileMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isProfileMenuOpen]);

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
            className={styles.sidebarRailLogoImage}
          />
        </button>
        <nav aria-label={t("Sidebar quick actions")} className={styles.railNav}>
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
                null
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
                className={styles.sidebarLogoImage}
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
                        null
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
                            <StarfieldCanvas className={styles.starfieldCanvas} density={0.008} minStars={12} maxStars={40} speed={16} orbitMode />
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
