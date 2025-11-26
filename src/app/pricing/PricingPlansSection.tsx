"use client";

import React, { useState } from "react";
import Script from "next/script";
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
        subtext: "x-ai/grok-4.1-fast:free",
    },
    { label: "Limited daily messages", icon: MessageSquare },
    { label: "14-day chat memory", icon: Pin },
    { label: "Premade proactivity routines", icon: Clock },
    { label: "Pulse only", icon: CalendarClock },
    { label: "Discord community support", icon: Users },
];

const VOYAGER_FEATURES: FeatureItem[] = [
    {
        label: "Gray Base + limited Gray Pro",
        icon: Zap,
        subtext: "Gemini 2.5 Flash + Gemini 3 Pro",
    },
    {
        label: "32x more message credits",
        icon: MessageSquare,
        subtext: "Plus unlimited Gray Lite",
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

const PIONEER_FEATURES: FeatureItem[] = [
    {
        label: "Expanded Gray Pro",
        icon: Zap,
    },
    {
        label: "Model switcher",
        icon: Shuffle,
        subtext: "OpenRouter: Claude 4.5, Grok 4.1, GPT 5.1, DeepSeek V3.2, Kimi K2 Thinking",
    },
    { label: "Expanded reasoning budget", icon: InfinityIcon },
    {
        label: "128x more message credits",
        icon: Pin,
        subtext: "Plus unlimited Gray Base",
    },
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
    monthly: { price: "$17", cadence: "month" },
    annual: { price: "$177", cadence: "year" },
} as const;

const PIONEER_PRICING = {
    monthly: { price: "$37", cadence: "month" },
    annual: { price: "$377", cadence: "year" },
} as const;

interface PricingPlansSectionProps {
    storeId?: string;
    voyagerVariantId?: string;
    pioneerVariantId?: string;
    userId?: number;
}

export function PricingPlansSection({ storeId, voyagerVariantId, pioneerVariantId, userId }: PricingPlansSectionProps) {
    const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
    const { price: voyagerPrice, cadence: voyagerCadence } = VOYAGER_PRICING[billingCycle];
    const { price: pioneerPrice, cadence: pioneerCadence } = PIONEER_PRICING[billingCycle];
    const voyagerSavingsLabel = billingCycle === "annual" ? "Save $27" : undefined;
    const pioneerSavingsLabel = billingCycle === "annual" ? "Save $67" : undefined;

    const voyagerCheckoutHref = (storeId && voyagerVariantId)
        ? `https://${storeId}/buy/${voyagerVariantId}?embed=1&media=0&checkout[custom][billing_cycle]=${billingCycle}${userId ? `&checkout[custom][user_id]=${userId}` : ''}`
        : undefined;

    const pioneerCheckoutHref = (storeId && pioneerVariantId)
        ? `https://${storeId}/buy/${pioneerVariantId}?embed=1&media=0&checkout[custom][billing_cycle]=${billingCycle}${userId ? `&checkout[custom][user_id]=${userId}` : ''}`
        : undefined;

    return (
        <>
            <Script
                src="https://assets.lemonsqueezy.com/lemon.js"
                strategy="afterInteractive"
                onLoad={() => {
                    if (typeof window !== "undefined" && (window as any).createLemonSqueezy) {
                        (window as any).createLemonSqueezy();
                    }
                }}
            />
            <header className={styles.hero}>
                <h1 className={styles.heroTitle}>Maximize your potential</h1>
                <p className={styles.heroSubhead}>
                    Choose the plan that matches how often you rely on Gray. Pay monthly or save when you
                    commit annually.
                </p>
            </header>

            <div className={styles.billingControls}>
                <div className={styles.billingToggle} role="group" aria-label="Billing cadence">
                    {BILLING_CYCLES.map(({ id, label }) => (
                        <button
                            key={id}
                            type="button"
                            onClick={() => setBillingCycle(id as "monthly" | "annual")}
                            data-active={billingCycle === id}
                        >
                            <span>{label}</span>
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
                                {voyagerSavingsLabel && (
                                    <span className={styles.savingsInline}>{voyagerSavingsLabel}</span>
                                )}
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
                        <div className={`${styles.planButton} ${styles.planButtonOutline}`} aria-disabled="true">
                            Coming Soon
                        </div>
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
                                {pioneerSavingsLabel && (
                                    <span className={styles.savingsInline}>{pioneerSavingsLabel}</span>
                                )}
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
                        <div className={`${styles.planButton} ${styles.planButtonPrimary}`} aria-disabled="true">
                            Coming Soon
                        </div>
                    </div>
                </article>
            </section>
            <p className={styles.disclaimer}>
                *Usage limits apply. Prices shown don't include applicable tax.
            </p>
        </>
    );
}
