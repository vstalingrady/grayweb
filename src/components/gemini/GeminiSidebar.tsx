"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  ChevronDown,
  Clock3,
  MessageSquare,
  Plus,
  Search,
  Square,
  UserRound,
} from "lucide-react";
import Image from "next/image";
import styles from "@/app/gemini/GeminiPageClient.module.css";
import {
  formatMonthYear,
  formatWeekRange,
  getCalendarMonth,
  getWeekDays,
  isSameDay,
  isSameMonth,
} from "@/lib/gemini/date";

type GeminiSidebarProps = {
  currentDate: Date;
  onChangeDate: (date: Date) => void;
  isCalendarView: boolean;
  viewerName: string;
  viewerRole?: string | null;
  viewerAvatarUrl?: string | null;
};

const CALENDAR_ENTRIES = [
  { id: "primary", label: "Vstalin Grady", color: "rgba(94, 122, 255, 0.92)" },
  { id: "birthdays", label: "Birthdays", color: "rgba(224, 91, 255, 0.88)" },
  { id: "family", label: "Family", color: "rgba(86, 212, 141, 0.9)" },
  { id: "tasks", label: "Tasks", color: "rgba(255, 139, 102, 0.92)" },
];

const RAIL_ACTIONS = [
  { id: "search", icon: Search, label: "Search" },
  { id: "messages", icon: MessageSquare, label: "Threads" },
  { id: "new", icon: Plus, label: "New entry" },
  { id: "grid", icon: Square, label: "Board" },
  { id: "clock", icon: Clock3, label: "Timeline" },
];

export function GeminiSidebar({
  currentDate,
  onChangeDate,
  isCalendarView,
  viewerName,
  viewerRole = "Operator",
  viewerAvatarUrl = null,
}: GeminiSidebarProps) {
  const week = getWeekDays(currentDate);
  const monthDays = getCalendarMonth(currentDate);
  const today = new Date();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);

  const viewerInitials = useMemo(() => {
    const letters = viewerName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
    return letters || "VS";
  }, [viewerName]);

  useEffect(() => {
    if (!isProfileMenuOpen) {
      return;
    }
    const handleClickAway = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickAway);
    return () => {
      document.removeEventListener("mousedown", handleClickAway);
    };
  }, [isProfileMenuOpen]);

  const handleProfileToggle = () => {
    setIsProfileMenuOpen((previous) => !previous);
  };

  const normalizedRole = (viewerRole ?? "Operator").toUpperCase();
  const sidebarAvatarUrl =
    typeof viewerAvatarUrl === "string" && viewerAvatarUrl.trim().length > 0
      ? viewerAvatarUrl
      : "/astronauttest.jpg";

  return (
    <aside className={styles.sidebar}>
      <div className={styles.rail}>
        <div aria-label="Gray Alignment emblem" className={styles.railButton}>
          <Image
            src="/grayaiwhitenotspinning.svg"
            alt="Gray Alignment logomark"
            width={20}
            height={20}
            priority
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", alignItems: "center" }}>
          {RAIL_ACTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`${styles.railButton} ${item.id === "messages" && isCalendarView ? styles.railButtonActive : ""}`}
              aria-label={item.label}
            >
              <item.icon size={18} />
            </button>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", alignItems: "center" }}>
          <span className={styles.railAvatar}>
            <UserRound size={18} />
          </span>
        </div>
      </div>

      <div
        className={styles.sidebarPanel}
        data-open={isCalendarView ? "true" : "false"}
      >
        <section className={styles.sidebarSection}>
          <h3>Calendar</h3>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{formatMonthYear(currentDate)}</span>
              <span>{formatWeekRange(week)}</span>
            </div>
          </div>
          <div className={styles.miniCalendarShell}>
            <div className={styles.miniCalendarHeader}>
              <span>{formatMonthYear(currentDate)}</span>
              <span style={{ fontSize: "0.72rem", color: "rgba(150,152,170,0.58)" }}>
                {formatWeekRange(week)}
              </span>
            </div>
            <div className={styles.miniCalendarGrid}>
              {["S", "M", "T", "W", "T", "F", "S"].map((day) => (
                <span key={day} className={styles.miniWeekday}>
                  {day}
                </span>
              ))}
              {monthDays.map((day) => {
                const isToday = isSameDay(day, today);
                const isSelected = isSameDay(day, currentDate);
                const inMonth = isSameMonth(day, currentDate);

                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    className={styles.miniDay}
                    data-selected={isSelected ? "true" : "false"}
                    data-today={isToday ? "true" : "false"}
                    onClick={() => onChangeDate(new Date(day))}
                    style={
                      inMonth
                        ? undefined
                        : { opacity: 0.32 }
                    }
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className={styles.sidebarSection}>
          <h3>My Calendars</h3>
          <div className={styles.sidebarList}>
            {CALENDAR_ENTRIES.map((entry) => (
              <div key={entry.id} className={styles.sidebarListItem}>
                <span
                  className={styles.sidebarDot}
                  style={{ background: entry.color }}
                />
                <span>{entry.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.sidebarSection}>
          <h3>Shortcuts</h3>
          <div className={styles.sidebarList}>
            <div className={styles.sidebarListItem}>
              <Plus size={14} />
              <span>New booking link</span>
            </div>
            <div className={styles.sidebarListItem}>
              <Calendar size={14} />
              <span>Browse resources</span>
            </div>
          </div>
        </section>

        <div className={styles.sidebarBottom}>
          <div
            className={styles.sidebarProfile}
            data-open={isProfileMenuOpen ? "true" : "false"}
            ref={profileRef}
          >
            <button
              type="button"
              className={styles.sidebarProfileButton}
              aria-haspopup="true"
              aria-expanded={isProfileMenuOpen ? "true" : "false"}
              onClick={handleProfileToggle}
            >
              <span
                className={styles.sidebarProfileAvatar}
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
              <span className={styles.sidebarProfileText}>
                <span>{viewerName}</span>
                <span>{normalizedRole}</span>
              </span>
              <span
                className={styles.sidebarProfileCaret}
                data-open={isProfileMenuOpen ? "true" : "false"}
                aria-hidden="true"
              >
                <ChevronDown size={16} />
              </span>
            </button>
            {isProfileMenuOpen && (
              <div className={styles.sidebarProfileMenu} role="menu">
                <button type="button" className={styles.sidebarProfileMenuItem} role="menuitem">
                  Personalize Gray
                </button>
                <button type="button" className={styles.sidebarProfileMenuItem} role="menuitem">
                  Preferences
                </button>
                <span className={styles.sidebarProfileDivider} aria-hidden="true" />
                <button
                  type="button"
                  className={`${styles.sidebarProfileMenuItem} ${styles.sidebarProfileLogout}`}
                  role="menuitem"
                >
                  Log out
                </button>
              </div>
            )}
          </div>
          <div className={styles.footnote}>
            <a href="#">Terms</a>
            <a href="#">Privacy</a>
          </div>
        </div>
      </div>
    </aside>
  );
}
