"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import { useI18n } from "@/contexts/I18nContext";
import {
    Brain,
    CalendarClock,
    Clock,
    Crown,
    FlaskConical,
    Headphones,
    MessageSquare,
    Pin,
    Plus,
    Shuffle,
    Users,
    Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import styles from "./page.module.css";

type FeatureItem = {
    id: string;
    label: string;
    icon: LucideIcon;
    variant?: "inherit";
    subtext?: string;
    subtextParens?: boolean;
};

const FREE_FEATURES: FeatureItem[] = [
    {
        id: "fast_model",
        label: "Fast model",
        icon: Zap,
        subtext: "Grok 4.1 Fast",
    },
    { id: "limited_messages", label: "Limited daily messages", icon: MessageSquare },
    { id: "token_memory", label: "65,536 token memory", icon: Pin },
    { id: "plans_habits_reminders", label: "Plans, habits, and reminders", icon: Clock },
    { id: "daily_pulse", label: "Daily pulse", icon: CalendarClock },
    { id: "discord_support", label: "Discord community support", icon: Users },
];

export const PATHFINDER_FEATURES: FeatureItem[] = [
    {
        id: "choose_model",
        label: "Choose your model",
        icon: Shuffle,
        subtext: "Claude Haiku 4.5, Gemini 3 Flash, DeepSeek V3.2, Kimi K2",
    },
    {
        id: "more_messages",
        label: "3x more messages",
        icon: MessageSquare,
    },
    {
        id: "longer_memory",
        label: "256,000 token memory",
        icon: Pin,
    },
    { id: "everything_in_scout", label: "Everything in Scout", icon: Plus, variant: "inherit" },
];

export const VOYAGER_FEATURES: FeatureItem[] = [
    {
        id: "choose_model",
        label: "Premium models",
        icon: Shuffle,
        subtext: "Claude Sonnet 4.5, GPT 5.2, Gemini 3 Pro",
    },
    {
        id: "more_messages",
        label: "6x more messages",
        icon: MessageSquare,
    },
    {
        id: "longer_memory",
        label: "2M token memory",
        icon: Pin,
    },
    {
        id: "calendar_access",
        label: "Calendar access",
        icon: Clock,
    },
    { id: "reasoning_mode", label: "Reasoning mode", icon: Brain },
    {
        id: "integrations",
        label: "Google Calendar, Gmail, Notion integrations",
        icon: CalendarClock,
        subtext: "Coming soon",
        subtextParens: true,
    },
    { id: "everything_in_pathfinder", label: "Everything in Pathfinder", icon: Plus, variant: "inherit" },
];

export const PIONEER_FEATURES: FeatureItem[] = [
    {
        id: "top_tier_models",
        label: "Top-tier models",
        icon: Crown,
        subtext: "Claude Opus 4.5, GPT 5.2 Pro",
    },
    {
        id: "more_messages",
        label: "15x more messages",
        icon: MessageSquare,
        subtext: "Built for heavy daily use",
    },
    { id: "priority", label: "Priority during busy times", icon: Headphones },
    { id: "early_access", label: "Early access", icon: FlaskConical },
    { id: "everything_in_voyager", label: "Everything in Voyager", icon: Plus, variant: "inherit" },
];

const BILLING_CYCLES = [
    { id: "monthly", label: "Monthly" },
    { id: "annual", label: "Annual" },
];

// Dual pricing: Indonesia (IDR) and International (USD)
const PATHFINDER_PRICING = {
    monthly: {
        idr: { price: "Rp 77.000,-", cadence: "month" },
        usd: { price: "$7", cadence: "month" }
    },
    annual: {
        idr: { price: "Rp 777.000,-", cadence: "year" },
        usd: { price: "$77", cadence: "year" }
    },
} as const;

const VOYAGER_PRICING = {
    monthly: {
        idr: { price: "Rp 177.000,-", cadence: "month" },
        usd: { price: "$17", cadence: "month" }
    },
    annual: {
        idr: { price: "Rp 1.777.000,-", cadence: "year" },
        usd: { price: "$177", cadence: "year" }
    },
} as const;

const PIONEER_PRICING = {
    monthly: {
        idr: { price: "Rp 377.000,-", cadence: "month" },
        usd: { price: "$37", cadence: "month" }
    },
    annual: {
        idr: { price: "Rp 3.777.000,-", cadence: "year" },
        usd: { price: "$377", cadence: "year" }
    },
} as const;

function parseIdrDisplay(value: string): number {
    const digits = value.replace(/[^\d]/g, "");
    const amount = Number.parseInt(digits || "0", 10);
    return Number.isFinite(amount) ? amount : 0;
}

function computeAnnualSavingsPercent(monthlyDisplay: string, annualDisplay: string): number | undefined {
    const monthly = parseIdrDisplay(monthlyDisplay);
    const annual = parseIdrDisplay(annualDisplay);
    if (monthly <= 0 || annual <= 0) {
        return undefined;
    }
    const annualFromMonthly = monthly * 12;
    if (annualFromMonthly <= 0 || annualFromMonthly <= annual) {
        return undefined;
    }
    const percent = Math.round(((annualFromMonthly - annual) / annualFromMonthly) * 100);
    if (!Number.isFinite(percent) || percent <= 0) {
        return undefined;
    }
    return percent;
}

export function PricingPlansSection() {
    const router = useRouter();
    const { user } = useUser();
    const { t } = useI18n();
    const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
    const [isIndonesia, setIsIndonesia] = useState<boolean | null>(null);

    // Fetch geo data on mount
    useEffect(() => {
        fetch("/api/geo")
            .then(res => res.json())
            .then(data => setIsIndonesia(data.isIndonesia ?? true))
            .catch(() => setIsIndonesia(true)); // Default to Indonesia on error
    }, []);

    // Determine currency based on region (default to IDR during loading)
    const currency = isIndonesia === false ? "usd" : "idr";

    const { price: pathfinderPrice, cadence: pathfinderCadence } = PATHFINDER_PRICING[billingCycle][currency];
    const { price: voyagerPrice, cadence: voyagerCadence } = VOYAGER_PRICING[billingCycle][currency];
    const { price: pioneerPrice, cadence: pioneerCadence } = PIONEER_PRICING[billingCycle][currency];
    const annualSavingsPercent = Math.max(
        computeAnnualSavingsPercent(PATHFINDER_PRICING.monthly.idr.price, PATHFINDER_PRICING.annual.idr.price) ?? 0,
        computeAnnualSavingsPercent(VOYAGER_PRICING.monthly.idr.price, VOYAGER_PRICING.annual.idr.price) ?? 0,
        computeAnnualSavingsPercent(PIONEER_PRICING.monthly.idr.price, PIONEER_PRICING.annual.idr.price) ?? 0,
    );
    const annualSavingsLabel =
        annualSavingsPercent > 0 ? t("Save ~{percent}%", { percent: annualSavingsPercent }) : undefined;

    const handleUpgrade = (plan: "pathfinder" | "voyager" | "pioneer") => {
        const paymentPath = `/payment?plan=${plan}&cycle=${billingCycle}`;
        const paymentBase = process.env.NEXT_PUBLIC_PAYMENT_SITE_URL;
        const paymentUrl = paymentBase
            ? `${paymentBase.replace(/\/+$/, "")}${paymentPath}`
            : paymentPath;

        if (!user) {
            // Redirect to login with return URL to complete purchase
            router.push(`/login?returnTo=${encodeURIComponent(paymentUrl)}`);
        } else {
            if (paymentUrl.startsWith("http")) {
                window.location.href = paymentUrl;
            } else {
                router.push(paymentUrl);
            }
        }
    };


    return (
        <>
            <header className={styles.hero}>
                <h1 className={styles.heroTitle}>{t("A proactive support system for your goals")}</h1>
                <p className={styles.heroSubhead}>
                    {t("Start free. Upgrade when you want more messages, longer memory, and integrations.")}
                </p>
            </header>

            <div className={styles.billingControls}>
                <div
                    className={styles.billingToggle}
                    role="group"
                    aria-label={t("Billing cadence")}
                    data-cycle={billingCycle}
                >
                    <div className={styles.billingThumb} aria-hidden="true" />
                    {BILLING_CYCLES.map(({ id, label }) => (
                        <button
                            key={id}
                            type="button"
                            onClick={() => setBillingCycle(id as "monthly" | "annual")}
                            data-active={billingCycle === id}
                            aria-pressed={billingCycle === id}
                        >
                            <span className={styles.billingOption}>
                                <span className={styles.billingLabel}>{t(label)}</span>
                                {id === "annual" && annualSavingsLabel ? (
                                    <span className={styles.billingSavings}>{annualSavingsLabel}</span>
                                ) : null}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            <section className={styles.planGrid}>
                <article className={styles.planCard} data-variant="muted">
                    <div className={styles.cardBody}>
                        <div className={styles.cardIntro}>
                            <header className={styles.cardHeader}>
                                <h2>{t("Scout")}</h2>
                                <p>{t("Try Gray for free. Great for getting the feel without committing.")}</p>
                            </header>
                            <div className={styles.priceBlock}>
                                <span className={styles.priceValue}>{t("Free")}</span>
                                <span className={styles.priceMeta}>{t("/ forever")}</span>
                            </div>
                        </div>
                        <ul className={styles.featureList}>
                            {FREE_FEATURES.map(({ id, label, icon: Icon, subtext }) => (
                                <li key={id}>
                                    <Icon size={16} aria-hidden="true" />
                                    <span className={styles.featureLabel}>
                                        {t(label)}
                                        {subtext ? <span className={styles.featureSubtext}>{t(subtext)}</span> : null}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className={styles.cardFooter}>
                        <button type="button" className={styles.planButton} disabled>
                            {t("Current Plan")}
                        </button>
                    </div>
                </article>

                <article className={styles.planCard} data-variant="neutral">
                    <div className={styles.cardBody}>
                        <div className={styles.cardIntro}>
                            <header className={styles.cardHeader}>
                                <h2>{t("Pathfinder")}</h2>
                                <p>{t("First step into paid: model choice and longer memory.")}</p>
                            </header>
                            <div className={styles.priceHeader}>
                                <div className={styles.priceBlock}>
                                    <span className={styles.priceValue}>{pathfinderPrice}</span>
                                    <span className={styles.priceMeta}>/ {t(pathfinderCadence)}</span>
                                </div>
                            </div>
                        </div>
                        <ul className={styles.featureList}>
                            {PATHFINDER_FEATURES.map(({ id, label, icon: Icon, variant, subtext }) => (
                                <li key={id} data-variant={variant ?? undefined}>
                                    <Icon size={16} aria-hidden="true" />
                                    <span
                                        className={
                                            variant === "inherit" ? `${styles.featureLabel} ${styles.featureLabelInherit}` : styles.featureLabel
                                        }
                                    >
                                        {t(label)}
                                        {subtext ? <span className={styles.featureSubtext}>{t(subtext)}</span> : null}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className={styles.cardFooter}>
                        <button
                            type="button"
                            className={`${styles.planButton} ${styles.planButtonOutline}`}
                            onClick={() => handleUpgrade("pathfinder")}
                        >
                            {t("Upgrade")}
                        </button>
                    </div>
                </article>

                <article className={styles.planCard} data-variant="highlighted">
                    <div className={styles.cardBody}>
                        <div className={styles.cardIntro}>
                            <header className={styles.cardHeader}>
                                <h2>{t("Voyager")}</h2>
                                <p>{t("For real daily use: more messages, longer memory, and calendar routines.")}</p>
                            </header>
                            <div className={styles.priceHeader}>
                                <div className={styles.priceBlock}>
                                    <span className={styles.priceValue}>{voyagerPrice}</span>
                                    <span className={styles.priceMeta}>/ {t(voyagerCadence)}</span>
                                </div>
                            </div>
                        </div>
                        <ul className={styles.featureList}>
                            {VOYAGER_FEATURES.map(({ id, label, icon: Icon, variant, subtext, subtextParens }) => (
                                <li key={id} data-variant={variant ?? undefined}>
                                    <Icon size={16} aria-hidden="true" />
                                    <span
                                        className={
                                            variant === "inherit" ? `${styles.featureLabel} ${styles.featureLabelInherit}` : styles.featureLabel
                                        }
                                    >
                                        {t(label)}
                                        {subtext ? (
                                            <span className={styles.featureSubtext}>
                                                {subtextParens ? `(${t(subtext)})` : t(subtext)}
                                            </span>
                                        ) : null}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className={styles.cardFooter}>
                        <button
                            type="button"
                            className={`${styles.planButton} ${styles.planButtonOutline}`}
                            onClick={() => handleUpgrade("voyager")}
                        >
                            {t("Upgrade")}
                        </button>
                    </div>
                </article>

                <article className={styles.planCard} data-variant="primary">
                    <div className={styles.cardBody}>
                        <div className={styles.cardIntro}>
                            <header className={styles.cardHeader}>
                                <h2>{t("Pioneer")}</h2>
                                <p>{t("For heavy users: top limits, top models, and early access to new features.")}</p>
                            </header>
                            <div className={styles.priceHeader}>
                                <div className={styles.priceBlock}>
                                    <span className={styles.priceValue}>{pioneerPrice}</span>
                                    <span className={styles.priceMeta}>/ {t(pioneerCadence)}</span>
                                </div>
                            </div>
                        </div>
                        <ul className={styles.featureList}>
                            {PIONEER_FEATURES.map(({ id, label, icon: Icon, variant, subtext }) => (
                                <li key={id} data-variant={variant ?? undefined}>
                                    <Icon size={16} aria-hidden="true" />
                                    <span
                                        className={
                                            variant === "inherit" ? `${styles.featureLabel} ${styles.featureLabelInherit}` : styles.featureLabel
                                        }
                                    >
                                        {t(label)}
                                        {subtext ? <span className={styles.featureSubtext}>{t(subtext)}</span> : null}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className={styles.cardFooter}>
                        <button
                            type="button"
                            className={`${styles.planButton} ${styles.planButtonPrimary}`}
                            onClick={() => handleUpgrade("pioneer")}
                        >
                            {t("Upgrade")}
                        </button>
                    </div>
                </article>
            </section>
            <p className={styles.disclaimer}>
                {t("*Usage limits apply. Prices shown don't include applicable tax.")}
            </p>
        </>
    );
}
