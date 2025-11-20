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
        subtext: "Gemini 2.5 Flash Lite"
    },
    { label: "Limited daily messages", icon: MessageSquare },
    { label: "14-day chat memory", icon: Pin },
    { label: "Premade proactivity routines only", icon: Clock },
    { label: "Community support forum", icon: Users },
];

const VOYAGER_FEATURES: FeatureItem[] = [
    {
        label: "Gray Base + limited Gray Pro",
        icon: Zap,
        subtext: "Gemini 2.5 Flash + Gemini 3 Pro",
    },
    { label: "Expanded message limit (unlimited Gray Lite)", icon: MessageSquare },
    {
        label: "4x permanent context memory",
        icon: Pin,
    },
    { label: "Reasoning mode toggle", icon: Brain },
    { label: "Calendar, Gmail, Notion integrations", icon: CalendarClock },
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
        subtext: "Claude 4.5, Grok 4.1, GPT 5.1, DeepSeek V3.2, Kimi K2",
    },
    { label: "Expanded reasoning budget", icon: InfinityIcon },
    {
        label: "4x Voyager context",
        icon: Pin,
    },
    { label: "Priority response time (during high load)", icon: Headphones },
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
}

export function PricingPlansSection({ storeId, voyagerVariantId, pioneerVariantId }: PricingPlansSectionProps) {
    const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
    const { price: voyagerPrice, cadence: voyagerCadence } = VOYAGER_PRICING[billingCycle];
    const { price: pioneerPrice, cadence: pioneerCadence } = PIONEER_PRICING[billingCycle];
    const voyagerSavingsLabel = billingCycle === "annual" ? "Save $27" : undefined;
    const pioneerSavingsLabel = billingCycle === "annual" ? "Save $67" : undefined;

    const voyagerCheckoutHref = (storeId && voyagerVariantId)
        ? `https://${storeId}/buy/${voyagerVariantId}?embed=1&media=0&checkout[custom][billing_cycle]=${billingCycle}`
        : undefined;

    const pioneerCheckoutHref = (storeId && pioneerVariantId)
        ? `https://${storeId}/buy/${pioneerVariantId}?embed=1&media=0&checkout[custom][billing_cycle]=${billingCycle}`
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
                <article className={styles.planCard}>
                    <div className={styles.cardBody}>
                        <div className={styles.cardIntro}>
                            <header className={styles.cardHeader}>
                                <h2>Scout</h2>
                                <p>Test Gray Pulse Lite with a constrained reasoning budget, context, and preset automations.</p>
                            </header>
                            <div className={styles.priceBlock}>
                                <span className={styles.priceValue}>$0</span>
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

                <article className={styles.planCard}>
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
                        {voyagerCheckoutHref ? (
                            <a href={voyagerCheckoutHref} className={`${styles.planButton} ${styles.planButtonOutline} lemonsqueezy-button`}>
                                Upgrade to Voyager
                            </a>
                        ) : (
                            <div className={`${styles.planButton} ${styles.planButtonOutline}`} aria-disabled="true">
                                Coming soon
                            </div>
                        )}
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
                        {pioneerCheckoutHref ? (
                            <a href={pioneerCheckoutHref} className={`${styles.planButton} ${styles.planButtonPrimary} lemonsqueezy-button`}>
                                Upgrade to Pioneer
                            </a>
                        ) : (
                            <div className={`${styles.planButton} ${styles.planButtonPrimary}`} aria-disabled="true">
                                Coming soon
                            </div>
                        )}
                    </div>
                </article>
            </section>
            <p className={styles.disclaimer}>
                *Usage limits apply. Prices shown don't include applicable tax.
            </p>
        </>
    );
}
