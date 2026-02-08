"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import styles from "./DashboardOverlay.module.css";
import { GrayDashboardView } from "./DashboardView";
import type { ComponentProps } from "react";

// Extract props type from GrayDashboardView
type DashboardViewProps = ComponentProps<typeof GrayDashboardView>;

type DashboardOverlayProps = DashboardViewProps & {
    isOpen: boolean;
    onClose: () => void;
};

const FOCUSABLE_SELECTOR = [
    "button:not([disabled])",
    "[href]",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
].join(",");

export function DashboardOverlay({
    isOpen,
    onClose,
    ...dashboardProps
}: DashboardOverlayProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

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

    useEffect(() => {
        if (!isOpen) {
            return;
        }
        previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
        return () => {
            window.cancelAnimationFrame(frame);
            previousFocusRef.current?.focus();
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }
        const handleFocusTrap = (event: KeyboardEvent) => {
            if (event.key !== "Tab") {
                return;
            }
            const container = containerRef.current;
            if (!container) {
                return;
            }
            const focusables = Array.from(
                container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
            ).filter((element) => element.offsetParent !== null);
            if (focusables.length === 0) {
                event.preventDefault();
                return;
            }
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            const active = document.activeElement as HTMLElement | null;
            const isInside = active ? container.contains(active) : false;

            if (event.shiftKey) {
                if (!isInside || active === first) {
                    event.preventDefault();
                    last.focus();
                }
                return;
            }

            if (!isInside || active === last) {
                event.preventDefault();
                first.focus();
            }
        };

        window.addEventListener("keydown", handleFocusTrap);
        return () => window.removeEventListener("keydown", handleFocusTrap);
    }, [isOpen]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className={styles.overlayBackdrop}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Dashboard"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) onClose();
                    }}
                >
                    <motion.div
                        ref={containerRef}
                        className={styles.overlayContainer}
                        tabIndex={-1}
                        initial={{ opacity: 0, scale: 0.96, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 10 }}
                        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <button
                            ref={closeButtonRef}
                            type="button"
                            className={styles.closeButton}
                            onClick={onClose}
                            aria-label="Close dashboard"
                        >
                            <X size={18} />
                        </button>

                        <div className={styles.overlayContent}>
                            <GrayDashboardView
                                {...dashboardProps}
                                // Force compact layout or specific overrides for modal if needed
                                isCompactLayout={false}
                                // Hide upgrade button in overlay if desired, or keep it
                                showUpgradeButton={dashboardProps.showUpgradeButton}
                                // Pass a null chatBar effectively since we don't want the chat input in the dashboard overlay
                                chatBar={null}
                                isOverlay={true}
                            />
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
