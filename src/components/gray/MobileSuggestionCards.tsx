import { memo } from "react";
import { Video, Camera, Mic, Sparkles } from "lucide-react";
import styles from "@/app/gray/GrayPageClient.module.css";
import { useI18n } from "@/contexts/I18nContext";

const MobileSuggestionCardsComponent = () => {
    const { t } = useI18n();
    return (
        <div className={styles.mobileSuggestionGrid}>
            <button className={styles.mobileSuggestionCard}>
                <span className={styles.mobileSuggestionIcon}>
                    <Video size={20} />
                </span>
                <span className={styles.mobileSuggestionLabel}>{t("Create Videos")}</span>
            </button>
            <button className={styles.mobileSuggestionCard}>
                <span className={styles.mobileSuggestionIcon}>
                    <Camera size={20} />
                </span>
                <span className={styles.mobileSuggestionLabel}>{t("Open Camera")}</span>
            </button>
            <button className={styles.mobileSuggestionCard}>
                <span className={styles.mobileSuggestionIcon}>
                    <Mic size={20} />
                </span>
                <span className={styles.mobileSuggestionLabel}>{t("Voice Mode")}</span>
            </button>
            <button className={styles.mobileSuggestionCard}>
                <span className={styles.mobileSuggestionIcon}>
                    <Sparkles size={20} />
                </span>
                <span className={styles.mobileSuggestionLabel}>{t("Analyze")}</span>
            </button>
        </div>
    );
};

MobileSuggestionCardsComponent.displayName = "MobileSuggestionCards";

export const MobileSuggestionCards = memo(MobileSuggestionCardsComponent);
