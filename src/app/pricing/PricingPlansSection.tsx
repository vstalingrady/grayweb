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
        label: "Gray Lite only",
        icon: Zap,
        subtext: "Grok 4.1 Fast",
    },
    { label: "Limited daily messages", icon: MessageSquare },
    { label: "14-day chat memory", icon: Pin },
    { label: "Premade proactivity routines", icon: Clock },
    { label: "Pulse only", icon: CalendarClock },
    { label: "Discord community support", icon: Users },
];

export const VOYAGER_FEATURES: FeatureItem[] = [
    {
        label: "Model switcher",
        icon: Shuffle,
        subtext: "Claude Haiku/Sonnet, Gemini 3 Pro, GPT 5.2, DeepSeek, Kimi K2",
    },
    {
        label: "5x more message credits",
        icon: MessageSquare,
    },
    {
        label: "Full context memory",
        icon: Pin,
    },
    {
        label: "Calendar-powered focus routines",
        icon: Clock,
    },
    { label: "Reasoning mode toggle", icon: Brain },
    {
        label: "Google Calendar, Gmail, Notion integrations",
        icon: CalendarClock,
        subtext: "(coming soon)",
    },
    { label: "Everything in Scout", icon: Plus, variant: "inherit" },
];

export const PIONEER_FEATURES: FeatureItem[] = [
    {
        label: "Claude Opus 4.5 + GPT 5.2 Pro access",
        icon: Zap,
        subtext: "Most capable Claude + next-gen reasoning model",
    },
    {
        label: "25x more message credits",
        icon: MessageSquare,
        subtext: "Heavy usage across all models",
    },
    { label: "Expanded reasoning budget", icon: InfinityIcon },
    { label: "Priority response during peaks", icon: Headphones },
    { label: "Early access to experimental features", icon: FlaskConical },
    { label: "Reference library (docs/files RAG)", icon: Database },
    { label: "Everything in Voyager", icon: Plus, variant: "inherit" },
];

const BILLING_CYCLES = [
    { id: "monthly", label: "Monthly" },
    { id: "annual", label: "Annual" },
];

const VOYAGER_PRICING = {
    monthly: { price: "Rp 77.000,-", cadence: "month" },
    annual: { price: "Rp 777.000,-", cadence: "year" },
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
                <h1 className={styles.heroTitle}>Maximize your potential</h1>
                <p className={styles.heroSubhead}>
                    Choose the plan that matches how often you rely on Gray. Pay monthly or save when you
                    commit annually.
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
                                <p>Try Gray Pulse Lite with limited context and preset routines.</p>
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
                                <p>Unlock model switching, integrations, and customizable automations.</p>
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
                                <p>Uncapped context, models, and proactive workflows for daily reliance.</p>
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
