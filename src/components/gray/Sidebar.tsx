import Image from "next/image";
import Link from "next/link";
import { ChevronsRight, ChevronsUp, ChevronsDown, Search as SearchIcon, UserRound } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
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
  const { user } = useUser();
  const sidebarAvatarUrl = viewerAvatarUrl ?? user?.profile_picture_url ?? null;
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
                  {navItems.map((item) => (
                    <li key={item.id}>
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
                    </li>
                  ))}
                </ul>
              </nav>
              <div className={styles.sidebarHistory}>
                {historySections.map((section) => (
                  <div key={section.id} className={styles.historySection}>
                    <h3>{section.label}</h3>
                    <ul>
                      {section.entries.map((entry) => (
                        <li key={entry.id}>
                          <Link
                            href={entry.href}
                            className={styles.historyLink}
                            data-active={entry.id === activeChatId ? "true" : "false"}
                          >
                            {entry.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className={styles.sidebarBottom}>
            <button
              type="button"
              className={styles.sidebarProfile}
              aria-label="Collapse Gray Alignment sidebar"
              onClick={onCollapse}
            >
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
              <ChevronsDown size={18} className={styles.profileChevron} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
