"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Pencil, Pin, Trash2 } from "lucide-react";
import { createPortal } from "react-dom";
import styles from "@/app/gray/GrayPageClient.module.css";
import type { SidebarHistoryEntry } from "../types";

type HistoryItemMenuProps = {
  entry: SidebarHistoryEntry;
  onRename?: (id: string) => void;
  onDelete?: (id: string) => void;
  onPin?: (id: string, pinned: boolean) => void;
};

export const HistoryItemMenu = ({ entry, onRename, onDelete, onPin }: HistoryItemMenuProps) => {
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

  const toggle = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    // Position menu: to the right of the button, or slightly below.
    setCoords({ top: rect.bottom + 2, left: rect.right - 150 });
    setIsOpen(!isOpen);
  };

  return (
    <>
      <div className={styles.sidebarHistoryActions} style={{ opacity: isOpen ? 1 : undefined }}>
        <button ref={triggerRef} onClick={toggle} className={styles.sidebarActionButton} type="button">
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
                type="button"
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
                type="button"
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
                type="button"
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

