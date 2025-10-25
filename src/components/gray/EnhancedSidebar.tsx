import React, { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronsRight, ChevronsUp, ChevronsDown, Search as SearchIcon, UserRound, History as HistoryGlyph, Plus, LayoutDashboard } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import styles from "@/app/gray/GrayPageClient.module.css";
import {
  type SidebarHistorySection,
  type SidebarNavItem,
  type SidebarNavKey,
} from "./types";

// Icon components from Gemini code
const HistoryIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <HistoryGlyph className={className} />
);

const PlusIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <Plus className={className} />
);

const DashboardIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <LayoutDashboard className={className} />
);

type EnhancedHistoryGroup = {
  id: string;
  label: string;
  items: Array<{
    id: string;
    label: string;
    href?: string;
  }>;
};

type GrayEnhancedSidebarProps = {
  isExpanded: boolean;
  viewerName: string;
  viewerInitials: string;
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

export function GrayEnhancedSidebar({
  isExpanded,
  viewerName,
  viewerInitials,
  activeNav,
  railItems,
  navItems: _navItems,
  historySections,
  onExpand,
  onCollapse,
  onToggle,
  onNavigate,
  activeChatId = null,
}: GrayEnhancedSidebarProps) {
  const { user } = useUser();
  void _navItems;
  const [activeHistoryItem, setActiveHistoryItem] = useState<string | null>(
    historySections[0]?.entries.find((entry) => !entry.href)?.id ?? null
  );

  const historyData = useMemo<EnhancedHistoryGroup[]>(
    () =>
      historySections.map((section) => ({
        id: section.id,
        label: section.label,
        items: section.entries.map((entry) => ({
          id: entry.id,
          label: entry.title,
          href: entry.href,
        })),
      })),
    [historySections]
  );

  // Enhanced navigation items with history
  const enhancedNavItems = [
    { id: 'general' as SidebarNavKey, icon: null, label: 'General' },
    { id: 'new-thread' as SidebarNavKey, icon: <PlusIcon />, label: 'New Thread' },
    { id: 'dashboard' as SidebarNavKey, icon: <DashboardIcon />, label: 'Dashboard' },
    { id: 'history' as SidebarNavKey, icon: <HistoryIcon />, label: 'History' },
  ];

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
            onClick={onToggle}
          >
            <span className={styles.sidebarRailAvatarImage}>{viewerInitials}</span>
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
              onClick={onCollapse}
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
                  {enhancedNavItems.map((item) => (
                    <li key={item.id} className={styles.sidebarNavItem}>
                      <button
                        type="button"
                        data-active={item.id === activeNav ? "true" : "false"}
                        aria-label={item.label}
                        onClick={() => onNavigate(item.id)}
                      >
                        <span className={styles.navIcon}>{item.icon}</span>
                        <span className={styles.navLabel}>{item.label}</span>
                      </button>

                      {item.id === "history" && activeNav === "history" && isExpanded && historyData.length > 0 && (
                        <div className={styles.enhancedHistory}>
                          {historyData.map((group) => (
                            <div key={group.id} className={styles.enhancedHistoryGroup}>
                              <h4>{group.label.toUpperCase()}</h4>
                              <ul>
                                {group.items.map((entry) => {
                                  const isLink = Boolean(entry.href);
                                  const isActive = isLink
                                    ? entry.id === activeChatId
                                    : activeHistoryItem === entry.id;
                                  const linkClass = isActive
                                    ? `${styles.enhancedHistoryLink} ${styles.enhancedHistoryLinkActive}`
                                    : styles.enhancedHistoryLink;

                                  return (
                                    <li key={entry.id}>
                                      {isLink ? (
                                        <Link href={entry.href ?? "#"} className={linkClass}>
                                          {entry.label}
                                        </Link>
                                      ) : (
                                        <button
                                          type="button"
                                          className={linkClass}
                                          onClick={() => setActiveHistoryItem(entry.id)}
                                        >
                                          {entry.label}
                                        </button>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </div>
          <div className={styles.sidebarBottom}>
            <button
              type="button"
              className={styles.sidebarProfile}
              aria-label="Collapse Gray Alignment sidebar"
              onClick={onCollapse}
            >
              <span className={styles.profileAvatar} aria-hidden="true">
                {user?.profile_picture_url ? (
                  <img
                    src={user.profile_picture_url}
                    alt={viewerName}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <UserRound size={22} />
                )}
              </span>
              <span className={styles.profileDetails}>
                <span>{viewerName}</span>
                <span>{user?.role || "Operator"}</span>
              </span>
              <ChevronsDown size={18} className={styles.profileChevron} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
