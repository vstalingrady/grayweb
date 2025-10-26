import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronsRight,
  ChevronsUp,
  ChevronsDown,
  Search as SearchIcon,
  UserRound,
  Sparkles,
  Settings as SettingsIcon,
  LifeBuoy,
  LogOut,
} from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import styles from "@/app/gray/GrayPageClient.module.css";
import { type SidebarHistorySection, type SidebarNavItem, type SidebarNavKey, type SidebarHistoryEntry } from "./types";

type GrayEnhancedSidebarProps = {
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
  onOpenPersonalization?: () => void;
  onOpenSettings?: () => void;
  onOpenHelp?: () => void;
  onLogOut?: () => void;
};

export function GrayEnhancedSidebar({
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
  onOpenPersonalization,
  onOpenSettings,
  onOpenHelp,
  onLogOut,
}: GrayEnhancedSidebarProps) {
  const { user } = useUser();
  const sidebarAvatarUrl = viewerAvatarUrl ?? user?.profile_picture_url ?? null;
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileControlsRef = useRef<HTMLDivElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  const historyGroups = useMemo(() => {
    const allEntries = historySections
      .flatMap((section) => section.entries)
      .filter((entry) => entry.href && entry.href !== "#");

    if (!allEntries.length) {
      return [];
    }

    const sortedEntries = [...allEntries].sort((a, b) => b.createdAt - a.createdAt);
    const now = new Date();
    const startOfDay = (date: Date) => {
      const copy = new Date(date);
      copy.setHours(0, 0, 0, 0);
      return copy;
    };

    const startToday = startOfDay(now);
    const startYesterday = new Date(startToday);
    startYesterday.setDate(startYesterday.getDate() - 1);
    const startWeek = new Date(startToday);
    startWeek.setDate(startWeek.getDate() - startWeek.getDay());
    const startMonth = new Date(startToday);
    startMonth.setDate(1);

    type HistoryGroupInternal = {
      id: string;
      label: string;
      order: number;
      items: SidebarHistoryEntry[];
    };

    const baseOrder: Record<string, number> = {
      today: 0,
      yesterday: 1,
      "this-week": 2,
      "this-month": 3,
    };

    const groups = new Map<string, HistoryGroupInternal>();

    sortedEntries.forEach((entry) => {
      const entryDate = new Date(entry.createdAt);
      const entryStart = startOfDay(entryDate);
      let groupId: string;
      let label: string;
      let order: number;

      if (entryStart >= startToday) {
        groupId = "today";
        label = "Today";
        order = baseOrder[groupId];
      } else if (entryStart >= startYesterday) {
        groupId = "yesterday";
        label = "Yesterday";
        order = baseOrder[groupId];
      } else if (entryStart >= startWeek) {
        groupId = "this-week";
        label = "This Week";
        order = baseOrder[groupId];
      } else if (entryStart >= startMonth) {
        groupId = "this-month";
        label = "This Month";
        order = baseOrder[groupId];
      } else {
        const monthKey = `${entryDate.getFullYear()}-${entryDate.getMonth()}`;
        groupId = `month-${monthKey}`;
        const monthsSince =
          (now.getFullYear() - entryDate.getFullYear()) * 12 + (now.getMonth() - entryDate.getMonth());
        order = 4 + Math.max(monthsSince, 0);
        label =
          entryDate.getFullYear() === now.getFullYear()
            ? entryDate.toLocaleDateString([], { month: "long" })
            : entryDate.toLocaleDateString([], { month: "long", year: "numeric" });
      }

      const bucket = groups.get(groupId) ?? { id: groupId, label, order, items: [] };
      bucket.items.push(entry);
      groups.set(groupId, bucket);
    });

    return Array.from(groups.values())
      .sort((a, b) => a.order - b.order)
      .map(({ id, label, items }) => ({
        id,
        label,
        items,
      }));
  }, [historySections]);

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

  const handleProfileClick = () => {
    setIsProfileMenuOpen((previous) => !previous);
  };

  const handleSidebarToggle = () => {
    setIsProfileMenuOpen(false);
    onToggle();
  };

  const handleOpenPersonalization = () => {
    onOpenPersonalization?.();
    setIsProfileMenuOpen(false);
  };

  const handleOpenSettings = () => {
    onOpenSettings?.();
    setIsProfileMenuOpen(false);
  };

  const handleOpenHelp = () => {
    onOpenHelp?.();
    setIsProfileMenuOpen(false);
  };

  const handleLogOut = () => {
    onLogOut?.();
    setIsProfileMenuOpen(false);
  };

  return (
    <aside className={styles.sidebar} data-expanded={isExpanded ? "true" : "false"}>
      <div className={styles.sidebarRail}>
        <button
          type="button"
          className={styles.sidebarRailLogo}
          aria-label="Open Gray Alignment sidebar"
          onClick={onExpand}
        >
          <Image
            src="/grayaiwhitenotspinning.svg"
            alt="Gray Alignment emblem"
            width={24}
            height={24}
            priority
            className={styles.sidebarRailLogoImage}
          />
        </button>
        <nav aria-label="Sidebar quick actions" className={styles.railNav}>
          <ul>
            {railItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  aria-label={item.label}
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
            aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
            data-expanded={isExpanded ? "true" : "false"}
            onClick={() => {
              setIsProfileMenuOpen(false);
              onToggle();
            }}
          >
            <span
              className={styles.sidebarRailAvatarImage}
              data-has-image={sidebarAvatarUrl ? "true" : "false"}
            >
              {sidebarAvatarUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sidebarAvatarUrl} alt={viewerName} />
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
              aria-label="Collapse Gray Alignment sidebar"
              onClick={() => {
                setIsProfileMenuOpen(false);
                onCollapse();
              }}
            >
              <Image
                src="/grayaiwhitenotspinning.svg"
                alt="Gray Alignment emblem"
                width={28}
                height={28}
                priority
                className={styles.sidebarLogoImage}
              />
            </button>
            <div className={styles.sidebarScroll}>
              <div className={styles.searchRow}>
                <span className={styles.searchIcon}>
                  <SearchIcon size={16} />
                </span>
                <span className={styles.searchLabel}>Search</span>
                <span className={styles.searchShortcut}>CTRL+K</span>
              </div>
                  <nav aria-label="Primary">
                    <ul className={styles.sidebarNav}>
                      {navItems.map((item) => (
                        <li key={item.id} className={styles.sidebarNavItem} data-nav={item.id}>
                          <button
                            type="button"
                            data-active={item.id === activeNav ? "true" : "false"}
                            aria-label={item.label}
                            onClick={() => onNavigate(item.id)}
                          >
                            <span className={styles.navIcon}>
                              <item.icon size={18} />
                            </span>
                            <span className={styles.navLabel}>{item.label}</span>
                          </button>

                          {item.id === "history" && isExpanded && (
                            <>
                              <span className={styles.sidebarHistoryConnector} aria-hidden="true" />
                              <div className={styles.sidebarHistory}>
                                {historyGroups.length > 0 ? (
                                  historyGroups.map((group) => (
                                    <div key={group.id} className={styles.sidebarHistoryGroup}>
                                      <span className={styles.sidebarHistoryLabel}>{group.label}</span>
                                      <ul className={styles.sidebarHistoryList}>
                                        {group.items.map((entry) => {
                                          const isActive = entry.id === activeChatId;
                                          return (
                                            <li key={entry.id}>
                                              <Link
                                                href={entry.href}
                                                className={
                                                  isActive
                                                    ? `${styles.sidebarHistoryLink} ${styles.sidebarHistoryLinkActive}`
                                                    : styles.sidebarHistoryLink
                                                }
                                              >
                                                {entry.title}
                                              </Link>
                                            </li>
                                          );
                                        })}
                                      </ul>
                                    </div>
                                  ))
                                ) : (
                                  <span className={styles.sidebarHistoryEmpty}>No conversations yet.</span>
                                )}
                              </div>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  </nav>
                </div>
              </div>
              <div className={styles.sidebarBottom}>
                <div className={styles.sidebarProfile}>
                  <div
                    className={styles.profileMenuWrapper}
                    data-expanded={isProfileMenuOpen ? "true" : "false"}
                    role="group"
                    aria-label="Profile actions"
                    ref={profileControlsRef}
                  >
                    <button
                      type="button"
                      className={styles.profileMenuButton}
                      aria-label={isProfileMenuOpen ? "Collapse profile menu" : "Expand profile menu"}
                      aria-haspopup="menu"
                      aria-expanded={isProfileMenuOpen ? "true" : "false"}
                      onClick={handleProfileClick}
                    >
                      <span className={styles.profileInfo}>
                        <span
                          className={styles.profileAvatar}
                          aria-hidden="true"
                          data-has-image={sidebarAvatarUrl ? "true" : "false"}
                        >
                          {sidebarAvatarUrl ? (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={sidebarAvatarUrl} alt={viewerName} />
                            </>
                          ) : (
                            <UserRound size={22} />
                          )}
                        </span>
                        <span className={styles.profileDetails}>
                          <span>{viewerName}</span>
                          <span>{user?.role || "Operator"}</span>
                        </span>
                      </span>
                    </button>
                    {isProfileMenuOpen && (
                      <div className={styles.profileMenu} role="menu" ref={profileMenuRef}>
                        <button
                          type="button"
                          className={styles.profileMenuItem}
                          onClick={handleOpenPersonalization}
                          role="menuitem"
                        >
                          <span className={styles.profileMenuIcon}>
                            <Sparkles size={16} />
                          </span>
                          <span className={styles.profileMenuLabel}>Personalization</span>
                        </button>
                        <button
                          type="button"
                          className={styles.profileMenuItem}
                          onClick={handleOpenSettings}
                          role="menuitem"
                        >
                          <span className={styles.profileMenuIcon}>
                            <SettingsIcon size={16} />
                          </span>
                          <span className={styles.profileMenuLabel}>Settings</span>
                        </button>
                        <button
                          type="button"
                          className={styles.profileMenuItem}
                          onClick={handleOpenHelp}
                          role="menuitem"
                        >
                          <span className={styles.profileMenuIcon}>
                            <LifeBuoy size={16} />
                          </span>
                          <span className={styles.profileMenuLabel}>Help</span>
                        </button>
                        <span className={styles.profileMenuDivider} aria-hidden="true" />
                        <button
                          type="button"
                          className={`${styles.profileMenuItem} ${styles.profileMenuLogout}`}
                          onClick={handleLogOut}
                          role="menuitem"
                        >
                          <span className={styles.profileMenuIcon}>
                            <LogOut size={16} />
                          </span>
                          <span className={styles.profileMenuLabel}>Log out</span>
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className={styles.profileToggleButton}
                    aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
                    data-expanded={isExpanded ? "true" : "false"}
                    onClick={handleSidebarToggle}
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
