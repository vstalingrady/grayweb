"use client";

import { forwardRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import { useI18n } from "@/contexts/I18nContext";
import { isLocalHostname } from "@/lib/grayRouting";
import { normalizePlanTier, PLAN_TIER_LEVELS } from "@/components/gray/utils/helperFunctions";
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
import type { LucideIcon, LucideProps } from "lucide-react";
import styles from "./page.module.css";

type FeatureItem = {
    id: string;
    label: string;
    icon: LucideIcon;
    variant?: "inherit";
    subtext?: string;
    subtextParens?: boolean;
};

const ChatGptIcon = forwardRef<SVGSVGElement, LucideProps>(
    ({ color = "currentColor", size = 16, className, ...props }, ref) => (
        <svg
            ref={ref}
            width={size}
            height={size}
            viewBox="0 0 21.999468 22.000338"
            fill={color}
            className={className}
            aria-hidden="true"
            {...props}
        >
            <path d="m 20.548781,9.0041619 a 5.416,5.416 0 0 0 -0.478,-4.501 c -1.217,-2.09 -3.662,-3.166 -6.05,-2.66 A 5.59,5.59 0 0 0 9.8297815,1.6190136e-4 C 7.3887815,-0.0048381 5.2227815,1.5461619 4.4717815,3.8381619 a 5.553,5.553 0 0 0 -3.71299999,2.658 5.487,5.487 0 0 0 0.69099999,6.5000001 5.416,5.416 0 0 0 0.477,4.502 c 1.217,2.09 3.662,3.165 6.05,2.66 a 5.586,5.586 0 0 0 4.1900005,1.842 c 2.442999,0.006 4.609999,-1.546 5.360999,-3.84 a 5.553,5.553 0 0 0 3.715,-2.66 5.488,5.488 0 0 0 -0.693,-6.4970001 v 10e-4 z M 12.167782,20.562162 a 4.199,4.199 0 0 1 -2.6750005,-0.954 c 0.034,-0.018 0.093,-0.05 0.132,-0.074 l 4.4399995,-2.53 a 0.71,0.71 0 0 0 0.364,-0.623 v -6.176 l 1.877,1.069 c 0.02,0.01 0.033,0.029 0.036,0.05 v 5.115 c -0.003,2.274 -1.87,4.118 -4.173999,4.123 z m -8.9770005,-3.782 a 4.059,4.059 0 0 1 -0.498,-2.763 c 0.032,0.02 0.09,0.055 0.131,0.078 l 4.44,2.53 c 0.225,0.13 0.504,0.13 0.73,0 l 5.4199995,-3.088 v 2.138 a 0.068,0.068 0 0 1 -0.027,0.057 l -4.4879995,2.556 c -1.999,1.136 -4.552,0.46 -5.707,-1.51 h -10e-4 z m -1.169,-9.5640001 a 4.15,4.15 0 0 1 2.175,-1.806 l -0.002,0.151 v 5.0600001 a 0.711,0.711 0 0 0 0.364,0.624 l 5.42,3.087 -1.876,1.07 a 0.067,0.067 0 0 1 -0.063,0.005 l -4.489,-2.559 c -1.995,-1.14 -2.67899999,-3.6580001 -1.53,-5.6300001 h 10e-4 z m 15.4169995,3.5400001 -5.419999,-3.0880001 1.875999,-1.068 a 0.067,0.067 0 0 1 0.063,-0.006 l 4.489,2.557 c 1.998,1.1400001 2.683,3.6620001 1.529,5.6330001 a 4.163,4.163 0 0 1 -2.174,1.807 v -5.211 a 0.71,0.71 0 0 0 -0.363,-0.623 z m 1.867,-2.7730001 a 6.04,6.04 0 0 0 -0.132,-0.078 l -4.44,-2.53 a 0.731,0.731 0 0 0 -0.729,0 l -5.4199995,3.088 v -2.138 a 0.068,0.068 0 0 1 0.027,-0.057 l 4.4869995,-2.555 c 2,-1.137 4.555,-0.46 5.707,1.513 0.487,0.833 0.664,1.809 0.499,2.757 z m -11.7409995,3.8100001 -1.877,-1.068 a 0.065,0.065 0 0 1 -0.036,-0.051 V 5.5591619 c 10e-4,-2.277 1.873,-4.122 4.181,-4.12 0.9760005,0 1.9200005,0.338 2.6710005,0.954 -0.034,0.018 -0.092,0.05 -0.131,0.073 l -4.4400005,2.53 a 0.71,0.71 0 0 0 -0.365,0.623 l -0.003,6.1730001 v 0.002 z m 1.02,-2.1680001 2.4140005,-1.375 2.413999,1.375 v 2.7500001 l -2.413999,1.375 -2.4150005,-1.375 V 9.6251619 Z" />
        </svg>
    )
);

ChatGptIcon.displayName = "ChatGptIcon";

const FREE_FEATURES: FeatureItem[] = [
    {
        id: "fast_model",
        label: "Fast model",
        icon: Zap,
        subtext: "MiMo V2 Flash",
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
        subtext: "Claude Haiku 4.5, Gemini 3 Flash, DeepSeek V3.2, Kimi K2.5, MiniMax M2.1, GLM 4.7, Grok 4.1 Fast",
    },
    {
        id: "more_messages",
        label: "6x more messages",
        icon: MessageSquare,
    },
    {
        id: "longer_memory",
        label: "Long-term memory",
        icon: Pin,
        subtext: "256,000 token context",
    },
    { id: "reasoning_mode", label: "Reasoning mode", icon: Brain },
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
        label: "15x more messages",
        icon: MessageSquare,
    },
    {
        id: "longer_memory",
        label: "Near-infinite memory",
        icon: Pin,
        subtext: "2M token context",
    },
    {
        id: "calendar_access",
        label: "Calendar access",
        icon: Clock,
    },
    {
        id: "chatgpt_export_compression",
        label: "Import ChatGPT Data",
        icon: ChatGptIcon,
    },
    {
        id: "integrations",
        label: "Google Calendar, Gmail, Notion integrations",
        icon: CalendarClock,
        subtext: "Coming soon",
        subtextParens: true,
    },
    {
        id: "autorouter",
        label: "Auto",
        icon: Shuffle,
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
        label: "36x more messages",
        icon: MessageSquare,
        subtext: "Built for heavy daily use",
    },
    {
        id: "near_infinite_memory",
        label: "Near-infinite memory",
        icon: Pin,
        subtext: "2M token context",
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

type CurrencyKey = "idr" | "usd";

function parseIdrDisplay(value: string): number {
    const digits = value.replace(/[^\d]/g, "");
    const amount = Number.parseInt(digits || "0", 10);
    return Number.isFinite(amount) ? amount : 0;
}

function parseUsdDisplay(value: string): number {
    const normalized = value.replace(/[^0-9.]/g, "");
    const amount = Number.parseFloat(normalized || "0");
    return Number.isFinite(amount) ? amount : 0;
}

function formatIdrDisplay(value: number): string {
    const rounded = Math.max(0, Math.round(value));
    const formatted = new Intl.NumberFormat("id-ID").format(rounded);
    return `Rp ${formatted},-`;
}

function formatUsdDisplay(value: number): string {
    const rounded = Math.max(0, Math.round(value * 100) / 100);
    const formatter = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: rounded % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
    });
    return `$${formatter.format(rounded)}`;
}

function applyAffiliateDiscount(value: string, currency: CurrencyKey, rate: number): string {
    if (rate <= 0) {
        return value;
    }
    const base = currency === "idr" ? parseIdrDisplay(value) : parseUsdDisplay(value);
    if (base <= 0) {
        return value;
    }
    const discounted = base * (1 - rate);
    return currency === "idr" ? formatIdrDisplay(discounted) : formatUsdDisplay(discounted);
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
    const [affiliateDiscountRate, setAffiliateDiscountRate] = useState(0);

    // Fetch geo data on mount
    useEffect(() => {
        fetch("/api/geo")
            .then(res => res.json())
            .then(data => setIsIndonesia(data.isIndonesia ?? true))
            .catch(() => setIsIndonesia(true)); // Default to Indonesia on error
    }, []);

    // Determine currency based on region (default to IDR during loading)
    const currency: CurrencyKey = isIndonesia === false ? "usd" : "idr";
    const currentPlan = normalizePlanTier(user);
    const currentPlanLevel = PLAN_TIER_LEVELS[currentPlan] ?? 0;
    const paidCardBodyClassName = styles.cardBody;
    const getPlanAction = (tier: keyof typeof PLAN_TIER_LEVELS) => {
        const tierLevel = PLAN_TIER_LEVELS[tier] ?? 0;
        if (currentPlan === tier) {
            return { label: t("Current Plan"), disabled: true, status: "current" as const };
        }
        if (currentPlanLevel > tierLevel) {
            return { label: t("Lower tier"), disabled: true, status: "lower" as const };
        }
        return { label: t("Upgrade"), disabled: false, status: "upgrade" as const };
    };
    const scoutAction = getPlanAction("scout");
    const pathfinderAction = getPlanAction("pathfinder");
    const voyagerAction = getPlanAction("voyager");
    const pioneerAction = getPlanAction("pioneer");

    const { price: pathfinderPrice, cadence: pathfinderCadence } = PATHFINDER_PRICING[billingCycle][currency];
    const { price: voyagerPrice, cadence: voyagerCadence } = VOYAGER_PRICING[billingCycle][currency];
    const { price: pioneerPrice, cadence: pioneerCadence } = PIONEER_PRICING[billingCycle][currency];
    const isAffiliateDiscountActive = affiliateDiscountRate > 0 && billingCycle === "monthly";
    const affiliateDiscountPercent = Math.round(affiliateDiscountRate * 100);
    const showAffiliateNotice = affiliateDiscountPercent > 0;
    const affiliateNoticeDetail = isAffiliateDiscountActive
        ? t("{percent}% off your first month", { percent: affiliateDiscountPercent })
        : t("{percent}% off monthly plans", { percent: affiliateDiscountPercent });
    const pathfinderDiscountedPrice = isAffiliateDiscountActive
        ? applyAffiliateDiscount(pathfinderPrice, currency, affiliateDiscountRate)
        : pathfinderPrice;
    const voyagerDiscountedPrice = isAffiliateDiscountActive
        ? applyAffiliateDiscount(voyagerPrice, currency, affiliateDiscountRate)
        : voyagerPrice;
    const pioneerDiscountedPrice = isAffiliateDiscountActive
        ? applyAffiliateDiscount(pioneerPrice, currency, affiliateDiscountRate)
        : pioneerPrice;
    const showPathfinderDiscount = isAffiliateDiscountActive && pathfinderDiscountedPrice !== pathfinderPrice;
    const showVoyagerDiscount = isAffiliateDiscountActive && voyagerDiscountedPrice !== voyagerPrice;
    const showPioneerDiscount = isAffiliateDiscountActive && pioneerDiscountedPrice !== pioneerPrice;
    const annualSavingsPercent = Math.max(
        computeAnnualSavingsPercent(PATHFINDER_PRICING.monthly.idr.price, PATHFINDER_PRICING.annual.idr.price) ?? 0,
        computeAnnualSavingsPercent(VOYAGER_PRICING.monthly.idr.price, VOYAGER_PRICING.annual.idr.price) ?? 0,
        computeAnnualSavingsPercent(PIONEER_PRICING.monthly.idr.price, PIONEER_PRICING.annual.idr.price) ?? 0,
    );
    const annualSavingsLabel =
        annualSavingsPercent > 0 ? t("Save ~{percent}%", { percent: annualSavingsPercent }) : undefined;

    const handleUpgrade = (plan: "pathfinder" | "voyager" | "pioneer") => {
        const paymentPath = `/payment?plan=${plan}&cycle=${billingCycle}`;
        const isLocal =
            typeof window !== "undefined" && isLocalHostname(window.location.hostname);
        const paymentBase = isLocal ? undefined : process.env.NEXT_PUBLIC_PAYMENT_SITE_URL;
        const paymentUrl = paymentBase
            ? `${paymentBase.replace(/\/+$/, "")}${paymentPath}`
            : paymentPath;

        if (!user) {
            // Redirect to login with return URL to complete purchase
            router.push(`/login?redirect=${encodeURIComponent(paymentPath)}`);
        } else {
            if (paymentUrl.startsWith("http")) {
                window.location.href = paymentUrl;
            } else {
                router.push(paymentUrl);
            }
        }
    };

    useEffect(() => {
        let isActive = true;
        const controller = new AbortController();

        const fetchAffiliateOffer = async () => {
            try {
                const params = new URLSearchParams();
                params.set("billing_cycle", billingCycle);
                const response = await fetch(`/api/p/affiliate/offer?${params.toString()}`, {
                    signal: controller.signal,
                    cache: "no-store",
                });
                if (!response.ok) {
                    if (isActive) {
                        setAffiliateDiscountRate(0);
                    }
                    return;
                }
                const payload = await response.json();
                const rate = typeof payload?.discount_rate === "number" ? payload.discount_rate : 0;
                if (isActive) {
                    setAffiliateDiscountRate(rate > 0 ? rate : 0);
                }
            } catch {
                if (isActive) {
                    setAffiliateDiscountRate(0);
                }
            }
        };

        void fetchAffiliateOffer();
        return () => {
            isActive = false;
            controller.abort();
        };
    }, [billingCycle, user?.id]);


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
            {showAffiliateNotice ? (
                <div className={styles.affiliateNotice} data-active={isAffiliateDiscountActive ? "true" : "false"}>
                    <span className={styles.affiliateNoticeBadge}>{t("Affiliate")}</span>
                    <span className={styles.affiliateNoticeValue}>{affiliateNoticeDetail}</span>
                </div>
            ) : null}

            <section className={styles.planGrid}>
                <article className={styles.planCard} data-variant="muted">
                    <div className={styles.cardBody}>
                        <div className={styles.cardIntro}>
                            <header className={styles.cardHeader}>
                                <h2>{t("Scout")}</h2>
                                <p>{t("Try Gray for free. Great for getting the feel without committing.")}</p>
                            </header>
                            <div className={`${styles.priceBlock} ${styles.priceBlockStacked}`}>
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
                            {scoutAction.label}
                        </button>
                    </div>
                </article>

                <article className={styles.planCard} data-variant="neutral">
                    <div className={paidCardBodyClassName}>
                        <div className={styles.cardIntro}>
                            <header className={styles.cardHeader}>
                                <h2>{t("Pathfinder")}</h2>
                                <p>{t("First step into paid: model choice and longer memory.")}</p>
                            </header>
                            <div className={styles.priceHeader}>
                                <div className={`${styles.priceBlock} ${styles.priceBlockStacked}`}>
                                    {showPathfinderDiscount ? (
                                        <span className={`${styles.priceValue} ${styles.priceValueMuted}`}>
                                            {pathfinderPrice}
                                        </span>
                                    ) : null}
                                    <span className={styles.priceValue}>{pathfinderDiscountedPrice}</span>
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
                            className={`${styles.planButton} ${pathfinderAction.status === "upgrade" ? styles.planButtonOutline : ""}`}
                            onClick={() => handleUpgrade("pathfinder")}
                            disabled={pathfinderAction.disabled}
                        >
                            {pathfinderAction.label}
                        </button>
                    </div>
                </article>

                <article className={styles.planCard} data-variant="highlighted">
                    <div className={paidCardBodyClassName}>
                        <div className={styles.cardIntro}>
                            <header className={styles.cardHeader}>
                                <h2>{t("Voyager")}</h2>
                                <p>{t("For real daily use: more messages, longer memory, and calendar routines.")}</p>
                            </header>
                            <div className={styles.priceHeader}>
                                <div className={`${styles.priceBlock} ${styles.priceBlockStacked}`}>
                                    {showVoyagerDiscount ? (
                                        <span className={`${styles.priceValue} ${styles.priceValueMuted}`}>
                                            {voyagerPrice}
                                        </span>
                                    ) : null}
                                    <span className={styles.priceValue}>{voyagerDiscountedPrice}</span>
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
                            className={`${styles.planButton} ${voyagerAction.status === "upgrade" ? styles.planButtonOutline : ""}`}
                            onClick={() => handleUpgrade("voyager")}
                            disabled={voyagerAction.disabled}
                        >
                            {voyagerAction.label}
                        </button>
                    </div>
                </article>

                <article className={styles.planCard} data-variant="primary">
                    <div className={paidCardBodyClassName}>
                        <div className={styles.cardIntro}>
                            <header className={styles.cardHeader}>
                                <h2>{t("Pioneer")}</h2>
                                <p>{t("For heavy users: top limits, top models, and early access to new features.")}</p>
                            </header>
                            <div className={styles.priceHeader}>
                                <div className={`${styles.priceBlock} ${styles.priceBlockStacked}`}>
                                    {showPioneerDiscount ? (
                                        <span className={`${styles.priceValue} ${styles.priceValueMuted}`}>
                                            {pioneerPrice}
                                        </span>
                                    ) : null}
                                    <span className={styles.priceValue}>{pioneerDiscountedPrice}</span>
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
                            className={`${styles.planButton} ${pioneerAction.status === "upgrade" ? styles.planButtonPrimary : ""}`}
                            onClick={() => handleUpgrade("pioneer")}
                            disabled={pioneerAction.disabled}
                        >
                            {pioneerAction.label}
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
