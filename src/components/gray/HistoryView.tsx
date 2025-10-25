"use client";

import { useMemo, useState } from "react";
import { Search, ExternalLink, Pencil, Trash2 } from "lucide-react";
import styles from "@/app/gray/GrayPageClient.module.css";
import {
  type SidebarHistoryEntry,
  type SidebarHistorySection,
} from "./types";

type GrayHistoryViewProps = {
  sections: SidebarHistorySection[];
  onOpenEntry?: (entry: SidebarHistoryEntry) => void;
  activeEntryId?: string | null;
  onOpenEntryExternal?: (entry: SidebarHistoryEntry) => void;
  onRenameEntry?: (entry: SidebarHistoryEntry) => void;
  onDeleteEntry?: (entry: SidebarHistoryEntry) => void;
};

type HistoryListEntry = SidebarHistoryEntry & {
  sectionLabel: string;
  dateLabel: string;
};

const formatHistoryDate = (timestamp: number) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
};

export function GrayHistoryView({
  sections,
  onOpenEntry,
  activeEntryId,
  onOpenEntryExternal,
  onRenameEntry,
  onDeleteEntry,
}: GrayHistoryViewProps) {
  const [query, setQuery] = useState("");

  const entries = useMemo<HistoryListEntry[]>(() => {
    return sections.flatMap((section) =>
      section.entries.map((entry) => ({
        ...entry,
        sectionLabel: section.label,
        dateLabel: formatHistoryDate(entry.createdAt),
      }))
    ).sort((a, b) => b.createdAt - a.createdAt);
  }, [sections]);

  const filteredEntries = useMemo(() => {
    if (!query.trim()) {
      return entries;
    }
    const pattern = query.trim().toLowerCase();
    return entries.filter((entry) =>
      entry.title.toLowerCase().includes(pattern) ||
      entry.sectionLabel.toLowerCase().includes(pattern)
    );
  }, [entries, query]);

  return (
    <section className={styles.historyView} aria-label="Conversation history">
      <header className={styles.historyViewHeader}>
        <h1>History</h1>
        <div className={styles.historyViewSearch}>
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            placeholder="Search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search history"
          />
        </div>
      </header>

      <div className={styles.historyListShell} role="list">
        {filteredEntries.length ? (
          <ul>
            {filteredEntries.map((entry) => {
              const hasLink = Boolean(entry.href && entry.href !== "#");
              const isActive = entry.id === activeEntryId;

              const content = (
                <>
                  <div className={styles.historyRowTitle}>
                    <span>{entry.title}</span>
                    {entry.sectionLabel ? (
                      <span className={styles.historyRowSection}>{entry.sectionLabel}</span>
                    ) : null}
                  </div>
                  <span className={styles.historyRowDate}>{entry.dateLabel}</span>
                </>
              );

              return (
                <li key={entry.id} data-active={isActive ? "true" : "false"}>
                  {hasLink ? (
                    <button
                      type="button"
                      onClick={() => onOpenEntry?.(entry)}
                      className={styles.historyListButton}
                      data-active={isActive ? "true" : "false"}
                    >
                      {content}
                    </button>
                  ) : (
                    <div className={`${styles.historyListButton} ${styles.historyListButtonStatic}`}>
                      {content}
                    </div>
                  )}
                  <div className={styles.historyRowActions}>
                    {hasLink && onOpenEntryExternal && (
                      <button
                        type="button"
                        aria-label="Open in new tab"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenEntryExternal(entry);
                        }}
                      >
                        <ExternalLink size={14} />
                      </button>
                    )}
                    {onRenameEntry && (
                      <button
                        type="button"
                        aria-label="Rename conversation"
                        onClick={(event) => {
                          event.stopPropagation();
                          onRenameEntry(entry);
                        }}
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                    {onDeleteEntry && (
                      <button
                        type="button"
                        aria-label="Delete conversation"
                        className={styles.historyRowDelete}
                        onClick={(event) => {
                          event.stopPropagation();
                          onDeleteEntry(entry);
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className={styles.historyEmptyState}>
            No history entries match “{query}”.
          </div>
        )}
      </div>
    </section>
  );
}
