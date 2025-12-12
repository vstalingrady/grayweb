"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { Search, Plus, ExternalLink, Pencil, Trash2, X, ArrowRight, CornerDownLeft } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import styles from "./HistoryOverlay.module.css";
import { type SidebarHistorySection, type SidebarHistoryEntry } from "./types";
import { formatDistanceToNow } from "date-fns";
import { useI18n } from "@/contexts/I18nContext";

type HistoryOverlayProps = {
    isOpen: boolean;
    onClose: () => void;
    sections: SidebarHistorySection[];
    onOpenEntry: (entry: SidebarHistoryEntry) => void;
    onOpenEntryExternal?: (entry: SidebarHistoryEntry) => void;
    onRenameEntry?: (entry: SidebarHistoryEntry) => void;
    onDeleteEntry?: (entry: SidebarHistoryEntry) => void;
    onCreateNewChat: () => void;
};

type FlatEntry = {
    type: "action" | "entry";
    id: string;
    label: string;
    entry?: SidebarHistoryEntry;
    sectionLabel?: string;
    meta?: string;
};

export function HistoryOverlay({
    isOpen,
    onClose,
    sections,
    onOpenEntry,
    onOpenEntryExternal,
    onRenameEntry,
	onDeleteEntry,
	onCreateNewChat,
}: HistoryOverlayProps) {
    const { t } = useI18n();
    const [query, setQuery] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    const [activeIndex, setActiveIndex] = useState(0);

    // Reset query when opening
    useEffect(() => {
        if (isOpen) {
            setQuery("");
            setActiveIndex(0);
            // Small timeout to ensure DOM is ready for focus
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    // Close on Escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key === "Escape") {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    const flatItems = useMemo<FlatEntry[]>(() => {
        const items: FlatEntry[] = [];

        // Always show "Create New Chat" at top if no query or if it matches "new", "create"
        if (!query || "create new chat".includes(query.toLowerCase())) {
            items.push({
                type: "action",
                id: "create-new-chat",
                label: t("Create New Chat"),
            });
        }

        const pattern = query.trim().toLowerCase();

        sections.forEach((section) => {
            const relevantEntries = section.entries.filter((entry) => {
                if (!pattern) return true;
                return (
                    entry.title.toLowerCase().includes(pattern) ||
                    section.label.toLowerCase().includes(pattern)
                );
            });

            if (relevantEntries.length > 0) {
                // We render section headers visually, but for flat navigation logic
                // we just push entries. We can store sectionLabel on the first entry of a section
                // to render the header conditionally in the list.
                relevantEntries.forEach((entry, index) => {
                    // Calculate relative time for meta
                    let meta = "";
                    try {
                        // If the entry was created today/recently, show relative time
                        if (Date.now() - entry.createdAt < 24 * 60 * 60 * 1000) {
                            meta = formatDistanceToNow(entry.createdAt, { addSuffix: true });
                        } else {
                            meta = new Date(entry.createdAt).toLocaleDateString();
                        }
                    } catch (e) {
                        // ignore invalid dates
                    }

                    items.push({
                        type: "entry",
                        id: entry.id,
                        label: entry.title,
                        entry,
                        sectionLabel: index === 0 ? section.label : undefined,
                        meta
                    });
                });
            }
        });

        return items;
    }, [sections, query, t]);

    // Keyboard Navigation
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((prev) => (prev + 1) % flatItems.length);
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((prev) => (prev - 1 + flatItems.length) % flatItems.length);
            } else if (e.key === "Enter") {
                e.preventDefault();
                const item = flatItems[activeIndex];
                if (item) {
                    if (item.type === "action" && item.id === "create-new-chat") {
                        onCreateNewChat();
                        onClose();
                    } else if (item.type === "entry" && item.entry) {
                        onOpenEntry(item.entry);
                        onClose();
                    }
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, flatItems, activeIndex, onCreateNewChat, onOpenEntry, onClose]);


    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className={styles.overlayBackdrop}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) onClose();
                    }}
                >
                    <motion.div
                        className={styles.overlayContainer}
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                    >
                        <div className={styles.searchHeader}>
                            <Search className={styles.searchIcon} size={20} />
                            <input
                                ref={inputRef}
                                className={styles.searchInput}
                                type="text"
                                placeholder={t("Search...")}
                                value={query}
                                onChange={(e) => {
                                    setQuery(e.target.value);
                                    setActiveIndex(0);
                                }}
                            />
                            <div className={styles.keyHint}>
                                <span className={styles.key}>Esc</span>
                            </div>
                        </div>

                        <div className={styles.scrollArea}>
                            {flatItems.length === 0 ? (
                                <div style={{ padding: "20px", textAlign: "center", color: "rgba(255,255,255,0.4)" }}>
                                    {t("No results found.")}
                                </div>
                            ) : (
                                <>
                                    {/* Actions Section */}
                                    {flatItems.some(i => i.type === "action") && (
                                            <div className={styles.section}>
                                                <div className={styles.sectionHeader}>
                                                    <span className={styles.sectionTitle}>{t("Actions")}</span>
                                                </div>
                                            {flatItems.filter(i => i.type === "action").map((item, idx) => {
                                                // Find actual index in flatItems for active state
                                                const realIndex = flatItems.indexOf(item);
                                                return (
                                                    <button
                                                        key={item.id}
                                                        className={styles.item}
                                                        data-active={realIndex === activeIndex}
                                                        onClick={() => {
                                                            onCreateNewChat();
                                                            onClose();
                                                        }}
                                                        onMouseEnter={() => setActiveIndex(realIndex)}
                                                    >
                                                        <div className={styles.itemContent}>
                                                            <Plus size={16} className={styles.itemIcon} />
                                                            <span className={styles.itemText}>{item.label}</span>
                                                        </div>
                                                        <div className={styles.keyHint}>
                                                            <CornerDownLeft size={14} />
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Entries Section */}
                                    {flatItems.filter(i => i.type === "entry").map((item, idx) => {
                                        const realIndex = flatItems.indexOf(item);
                                        const showSectionHeader = !!item.sectionLabel;

                                        return (
                                            <div key={item.id} style={{ display: "contents" }}>
                                                {showSectionHeader && (
                                                    <div className={styles.sectionHeader} style={{ marginTop: idx === 0 ? 0 : "20px" }}>
                                                        <span className={styles.sectionTitle}>{item.sectionLabel}</span>
                                                    </div>
                                                )}
                                                <button
                                                    className={styles.item}
                                                    data-active={realIndex === activeIndex}
                                                    onClick={() => {
                                                        if (item.entry) {
                                                            onOpenEntry(item.entry);
                                                            onClose();
                                                        }
                                                    }}
                                                    onMouseEnter={() => setActiveIndex(realIndex)}
                                                >
                                                    <div className={styles.itemContent}>
                                                        <span className={styles.itemText}>{item.label}</span>
                                                    </div>
                                                    <span className={styles.itemMeta}>{item.meta}</span>

                                                    <div className={styles.itemActions}>
                                                        {onOpenEntryExternal && item.entry?.href && (
                                                            <div
                                                                className={styles.actionButton}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                onOpenEntryExternal(item.entry!);
                                                            }}
                                                            title={t("Open in new tab")}
                                                        >
                                                            <ExternalLink size={14} />
                                                        </div>
                                                        )}
                                                        {onRenameEntry && (
                                                            <div
                                                                className={styles.actionButton}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                onRenameEntry(item.entry!);
                                                            }}
                                                            title={t("Rename")}
                                                        >
                                                            <Pencil size={14} />
                                                        </div>
                                                        )}
                                                        {onDeleteEntry && (
                                                            <div
                                                                className={styles.actionButton}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                onDeleteEntry(item.entry!);
                                                            }}
                                                            title={t("Delete")}
                                                        >
                                                            <Trash2 size={14} />
                                                        </div>
                                                        )}
                                                    </div>
                                                </button>
                                            </div>
                                        );
                                    })}
                                </>
                            )}
                        </div>

                        <div className={styles.footer}>
                            <div className={styles.keyHint}>
                                <span className={styles.key}>↑</span>
                                <span className={styles.key}>↓</span>
                                {t("to navigate")}
                            </div>
                            <div className={styles.keyHint}>
                                <span className={styles.key}>↵</span>
                                {t("to select")}
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
