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
      <header className="mb-6 px-4">
        <h1 className="text-2xl font-medium tracking-tight text-white mb-4">History</h1>
        <div className="flex items-center gap-3 px-4 py-3 rounded-full bg-[#0A0A0A] border border-white/10 focus-within:border-white/20 transition-colors">
          <Search size={18} className="text-zinc-500" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search your history..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search history"
            className="flex-1 bg-transparent border-none outline-none text-zinc-200 placeholder:text-zinc-600 text-sm"
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
                <div className={styles.historyRowTitle}>
                  <span>{entry.title}</span>
                  {entry.sectionLabel ? (
                    <span className={styles.historyRowSection}>{entry.sectionLabel}</span>
                  ) : null}
                </div>
              );

              const renderActions = (
                <>
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
                </>
              );

              const hasActions =
                (hasLink && Boolean(onOpenEntryExternal)) ||
                Boolean(onRenameEntry) ||
                Boolean(onDeleteEntry);

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
                  <div className={styles.historyRowMeta}>
                    {hasActions ? (
                      <div className={styles.historyRowActions}>{renderActions}</div>
                    ) : null}
                    <span className={styles.historyRowDate}>{entry.dateLabel}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className={styles.historyEmptyState}>
            {query.trim() ? (
              <>No history entries match "{query}".</>
            ) : (
              <>No history yet. Start a new conversation to see it here.</>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
