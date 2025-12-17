"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import styles from "./DashboardOverlay.module.css";
import { GrayDashboardView } from "./DashboardView";
import type { ComponentProps } from "react";

// Extract props type from GrayDashboardView
type DashboardViewProps = ComponentProps<typeof GrayDashboardView>;

type DashboardOverlayProps = DashboardViewProps & {
    isOpen: boolean;
    onClose: () => void;
};

export function DashboardOverlay({
    isOpen,
    onClose,
    ...dashboardProps
}: DashboardOverlayProps) {
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
                        initial={{ opacity: 0, scale: 0.96, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 10 }}
                        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    >


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
