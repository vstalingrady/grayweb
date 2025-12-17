"use client";

import { useEffect, useState } from "react";
import { UsageStatus } from "@/lib/api";
import { Clock, AlertTriangle } from "lucide-react";
import styles from "./UsageLimitBanner.module.css";
import { useI18n } from "@/contexts/I18nContext";

interface UsageLimitBannerProps {
    usageStatus: UsageStatus;
}

export function UsageLimitBanner({ usageStatus }: UsageLimitBannerProps) {
    const { t } = useI18n();
    const [timeLeft, setTimeLeft] = useState<string>("");

    const {
        is_monthly_limit_reached,
        next_monthly_reset,
        is_six_hour_limit_reached,
        next_six_hour_reset,
        tier,
    } = usageStatus;

    const isLimitReached = is_monthly_limit_reached || is_six_hour_limit_reached;
    const resetTimeStr = is_monthly_limit_reached ? next_monthly_reset : next_six_hour_reset;
    const limitType = is_monthly_limit_reached ? t("Monthly") : t("Burst");

    useEffect(() => {
        if (!isLimitReached || !resetTimeStr) return;

        const updateTimer = () => {
            const now = new Date();
            const resetTime = new Date(resetTimeStr);
            const diff = resetTime.getTime() - now.getTime();

            if (diff <= 0) {
                setTimeLeft("00:00:00");
                return;
            }

            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            setTimeLeft(
                `${hours.toString().padStart(2, "0")}:${minutes
                    .toString()
                    .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
            );
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);

        return () => clearInterval(interval);
    }, [isLimitReached, resetTimeStr]);

    if (!isLimitReached) return null;

    return (
        <div className={styles.usageLimitBanner}>
            <div className={styles.usageLimitContent}>
                <div className={styles.usageLimitHeader}>
                    <AlertTriangle size={16} className={styles.usageLimitIcon} />
                    <span className={styles.usageLimitTitle}>
                        {t("Limit Reached")}
                    </span>
                </div>
                <p className={styles.usageLimitMessage}>
                    {t("{limitType} cap hit on {tier}.", { limitType, tier })}
                </p>
                <div className={styles.usageLimitTimer}>
                    <Clock size={14} />
                    <span>{timeLeft}</span>
                </div>
            </div>
        </div>
    );
}
