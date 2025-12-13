/* eslint-disable react/no-unescaped-entities */
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import {
    Brain,
    CalendarClock,
    Clock,
    Database,
    FlaskConical,
    Headphones,
    Infinity as InfinityIcon,
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
    label: string;
    icon: LucideIcon;
    variant?: "inherit";
    subtext?: string;
};

const FREE_FEATURES: FeatureItem[] = [
    {
        label: "Fast model",
        icon: Zap,
        subtext: "Grok Fast",
    },
    { label: "Limited daily messages", icon: MessageSquare },
    { label: "14-day chat memory", icon: Pin },
    { label: "Simple daily routines", icon: Clock },
    { label: "Daily pulse", icon: CalendarClock },
    { label: "Community support (Discord)", icon: Users },
];

export const VOYAGER_FEATURES: FeatureItem[] = [
    {
        label: "Choose your model",
        icon: Shuffle,
        subtext: "Claude, GPT, Gemini, DeepSeek, Kimi",
    },
    {
        label: "More messages",
        icon: MessageSquare,
    },
    {
        label: "Longer memory",
        icon: Pin,
    },
    {
        label: "Calendar + focus routines",
        icon: Clock,
    },
    { label: "Deep thinking mode", icon: Brain },
    {
        label: "Integrations (Google Calendar, Gmail, Notion)",
        icon: CalendarClock,
        subtext: "(coming soon)",
    },
    { label: "Everything in Scout", icon: Plus, variant: "inherit" },
];

export const PIONEER_FEATURES: FeatureItem[] = [
    {
        label: "Top-tier models",
        icon: Zap,
        subtext: "Claude Opus + GPT Pro",
    },
    {
        label: "Highest message limits",
        icon: MessageSquare,
        subtext: "Built for heavy daily use",
    },
    { label: "More deep thinking", icon: InfinityIcon },
    { label: "Priority during busy times", icon: Headphones },
    { label: "Early access", icon: FlaskConical },
    { label: "Upload docs and ask questions", icon: Database },
    { label: "Everything in Voyager", icon: Plus, variant: "inherit" },
];

const BILLING_CYCLES = [
    { id: "monthly", label: "Monthly" },
    { id: "annual", label: "Annual" },
];

const VOYAGER_PRICING = {
    monthly: { price: "Rp 177.000,-", cadence: "month" },
    annual: { price: "Rp 1.777.000,-", cadence: "year" },
} as const;

const PIONEER_PRICING = {
    monthly: { price: "Rp 377.000,-", cadence: "month" },
    annual: { price: "Rp 3.777.000,-", cadence: "year" },
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
    const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
    const { price: voyagerPrice, cadence: voyagerCadence } = VOYAGER_PRICING[billingCycle];
    const { price: pioneerPrice, cadence: pioneerCadence } = PIONEER_PRICING[billingCycle];
    const annualSavingsPercent = Math.max(
        computeAnnualSavingsPercent(VOYAGER_PRICING.monthly.price, VOYAGER_PRICING.annual.price) ?? 0,
        computeAnnualSavingsPercent(PIONEER_PRICING.monthly.price, PIONEER_PRICING.annual.price) ?? 0,
    );
    const annualSavingsLabel = annualSavingsPercent > 0 ? `Save ~${annualSavingsPercent}%` : undefined;

    const handleUpgrade = (plan: "voyager" | "pioneer") => {
        const paymentUrl = `/payment?plan=${plan}&cycle=${billingCycle}`;
        if (!user) {
            // Redirect to login with return URL to complete purchase
            router.push(`/login?returnTo=${encodeURIComponent(paymentUrl)}`);
        } else {
            router.push(paymentUrl);
        }
    };

    return (
        <>
            <header className={styles.hero}>
                <h1 className={styles.heroTitle}>A proactive support system for your goals</h1>
                <p className={styles.heroSubhead}>
                    Start free. Upgrade when you want more messages, longer memory, and integrations.
                </p>
            </header>

            <div className={styles.billingControls}>
                <div
                    className={styles.billingToggle}
                    role="group"
                    aria-label="Billing cadence"
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
                                <span className={styles.billingLabel}>{label}</span>
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
                                <h2>Scout</h2>
                                <p>Try Gray for free. Great for getting the feel without committing.</p>
                            </header>
                            <div className={styles.priceBlock}>
                                <span className={styles.priceValue}>Free</span>
                                <span className={styles.priceMeta}>/ forever</span>
                            </div>
                        </div>
                        <ul className={styles.featureList}>
                            {FREE_FEATURES.map(({ label, icon: Icon, subtext }) => (
                                <li key={label}>
                                    <Icon size={16} aria-hidden="true" />
                                    <span className={styles.featureLabel}>
                                        {label}
                                        {subtext ? <span className={styles.featureSubtext}>{subtext}</span> : null}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className={styles.cardFooter}>
                        <button type="button" className={styles.planButton} disabled>
                            Current Plan
                        </button>
                    </div>
                </article>

                <article className={styles.planCard} data-variant="highlighted">
                    <div className={styles.cardBody}>
                        <div className={styles.cardIntro}>
                            <header className={styles.cardHeader}>
                                <h2>Voyager</h2>
                                <p>For real daily use: more messages, longer memory, and calendar routines.</p>
                            </header>
                            <div className={styles.priceHeader}>
                                <div className={styles.priceBlock}>
                                    <span className={styles.priceValue}>{voyagerPrice}</span>
                                    <span className={styles.priceMeta}>/ {voyagerCadence}</span>
                                </div>
                            </div>
                        </div>
                        <ul className={styles.featureList}>
                            {VOYAGER_FEATURES.map(({ label, icon: Icon, variant, subtext }) => (
                                <li key={label} data-variant={variant ?? undefined}>
                                    <Icon size={16} aria-hidden="true" />
                                    <span
                                        className={
                                            variant === "inherit" ? `${styles.featureLabel} ${styles.featureLabelInherit}` : styles.featureLabel
                                        }
                                    >
                                        {label}
                                        {subtext ? <span className={styles.featureSubtext}>{subtext}</span> : null}
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
                            Upgrade
                        </button>
                    </div>
                </article>

                <article className={styles.planCard} data-variant="primary">
                    <div className={styles.cardBody}>
                        <div className={styles.cardIntro}>
                            <header className={styles.cardHeader}>
                                <h2>Pioneer</h2>
                                <p>For heavy users: top limits, top models, and early access to new features.</p>
                            </header>
                            <div className={styles.priceHeader}>
                                <div className={styles.priceBlock}>
                                    <span className={styles.priceValue}>{pioneerPrice}</span>
                                    <span className={styles.priceMeta}>/ {pioneerCadence}</span>
                                </div>
                            </div>
                        </div>
                        <ul className={styles.featureList}>
                            {PIONEER_FEATURES.map(({ label, icon: Icon, variant, subtext }) => (
                                <li key={label} data-variant={variant ?? undefined}>
                                    <Icon size={16} aria-hidden="true" />
                                    <span
                                        className={
                                            variant === "inherit" ? `${styles.featureLabel} ${styles.featureLabelInherit}` : styles.featureLabel
                                        }
                                    >
                                        {label}
                                        {subtext ? <span className={styles.featureSubtext}>{subtext}</span> : null}
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
                            Upgrade
                        </button>
                    </div>
                </article>
            </section>
            <p className={styles.disclaimer}>
                *Usage limits apply. Prices shown don't include applicable tax.
            </p>
        </>
    );
}
