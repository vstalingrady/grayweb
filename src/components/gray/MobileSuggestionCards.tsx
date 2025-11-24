import React from "react";
import { Video, Camera, Mic, Sparkles } from "lucide-react";
import styles from "@/app/gray/GrayPageClient.module.css";

export const MobileSuggestionCards = () => {
    return (
        <div className={styles.mobileSuggestionGrid}>
            <button className={styles.mobileSuggestionCard}>
                <span className={styles.mobileSuggestionIcon}>
                    <Video size={20} />
                </span>
                <span className={styles.mobileSuggestionLabel}>Create Videos</span>
            </button>
            <button className={styles.mobileSuggestionCard}>
                <span className={styles.mobileSuggestionIcon}>
                    <Camera size={20} />
                </span>
                <span className={styles.mobileSuggestionLabel}>Open Camera</span>
            </button>
            <button className={styles.mobileSuggestionCard}>
                <span className={styles.mobileSuggestionIcon}>
                    <Mic size={20} />
                </span>
                <span className={styles.mobileSuggestionLabel}>Voice Mode</span>
            </button>
            <button className={styles.mobileSuggestionCard}>
                <span className={styles.mobileSuggestionIcon}>
                    <Sparkles size={20} />
                </span>
                <span className={styles.mobileSuggestionLabel}>Analyze</span>
            </button>
        </div>
    );
};
