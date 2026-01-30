"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Script from "next/script";
import dynamic from "next/dynamic";
import { CheckCircle, AlertCircle, Loader2, ArrowLeft, Search } from "lucide-react";
import styles from "./payment.module.css";
import pricingStyles from "../pricing/page.module.css";
import { PATHFINDER_FEATURES, VOYAGER_FEATURES, PIONEER_FEATURES } from "../pricing/PricingPlansSection";

import { getSupabaseAccessToken } from "@/lib/auth/supabaseAccessToken";
import { useI18n } from "@/contexts/I18nContext";

// Dynamically import the 3D background with SSR disabled
const ParticleSphere = dynamic(
    () => import("@/components/backgrounds/ParticleSphere").then(mod => mod.ParticleSphere),
    { ssr: false }
);

type PaymentStatus = "idle" | "loading" | "success" | "pending" | "error";
type PaymentProvider = "midtrans" | "dodo";
type PaymentMethod = {
    id: string;
    label: string;
    provider: PaymentProvider;
    logo?: string;
    type?: string;
    bank?: string;
    isQris?: boolean;
    isDeepLink?: boolean;
};

interface ChargeResponse {
    order_id: string;
    status: string;
    actions?: Array<{ name: string; method: string; url: string }>;
    qr_code_url?: string;
    deeplink_url?: string;
    va_numbers?: Array<{ bank: string; va_number: string }>;
    redirect_url?: string;
    bill_key?: string;
    biller_code?: string;
    checkout_url?: string;
    session_id?: string;
}

declare global {
    interface Window {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        MidtransNew3ds: any;
    }
}

const PATHFINDER_PRICING = {
    monthly: { price: "Rp 77.000,-", fullPrice: "Rp 77.000" },
    annual: { price: "Rp 64.750,-", fullPrice: "Rp 777.000" },
} as const;

const VOYAGER_PRICING = {
    monthly: { price: "Rp 177.000,-", fullPrice: "Rp 177.000" },
    annual: { price: "Rp 148.083,-", fullPrice: "Rp 1.777.000" }, // 1.777m / 12 ≈ 148.083k
} as const;

const PIONEER_PRICING = {
    monthly: { price: "Rp 377.000,-", fullPrice: "Rp 377.000" },
    annual: { price: "Rp 314.750,-", fullPrice: "Rp 3.777.000" },
} as const;

// USD pricing for international users
const PATHFINDER_PRICING_USD = {
    monthly: { price: "$7", fullPrice: "$7" },
    annual: { price: "$6.42", fullPrice: "$77" },
} as const;

const VOYAGER_PRICING_USD = {
    monthly: { price: "$17", fullPrice: "$17" },
    annual: { price: "$14.75", fullPrice: "$177" },
} as const;

const PIONEER_PRICING_USD = {
    monthly: { price: "$37", fullPrice: "$37" },
    annual: { price: "$31.42", fullPrice: "$377" },
} as const;

const PAYMENT_METHODS: PaymentMethod[] = [
    {
        id: "dodo_card",
        label: "Card & Global Methods",
        provider: "dodo",
    },
    {
        id: "danamon",
        label: "Danamon",
        logo: "/logos/payment/danamon.png",
        provider: "midtrans",
        type: "bank_transfer",
        bank: "danamon"
    },
    {
        id: "cimb",
        label: "CIMB Niaga",
        logo: "/logos/payment/cimb.svg",
        provider: "midtrans",
        type: "bank_transfer",
        bank: "cimb"
    },
    {
        id: "qris",
        label: "GoPay Dynamic QRIS",
        logo: "/logos/payment/qris.png",
        provider: "midtrans",
        type: "gopay",
        isQris: true
    },
    {
        id: "bni",
        label: "BNI",
        logo: "/logos/payment/bni.svg",
        provider: "midtrans",
        type: "bank_transfer",
        bank: "bni"
    },
    {
        id: "bri",
        label: "BRI",
        logo: "/logos/payment/bri.svg",
        provider: "midtrans",
        type: "bank_transfer",
        bank: "bri"
    },
    {
        id: "gopay",
        label: "GoPay",
        logo: "/logos/payment/gopay.svg",
        provider: "midtrans",
        type: "gopay",
        isDeepLink: true
    },
    {
        id: "mandiri",
        label: "Bank Mandiri",
        logo: "/logos/payment/mandiri.png",
        provider: "midtrans",
        type: "echannel"
    },
    {
        id: "permata",
        label: "PermataBank",
        logo: "/logos/payment/permata.svg",
        provider: "midtrans",
        type: "bank_transfer",
        bank: "permata"
    }
];

function PaymentContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const planParam = searchParams.get("plan");
    const cycleParam = searchParams.get("cycle");
    const { t } = useI18n();

    // State
    const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">((cycleParam as "monthly" | "annual") || "monthly");
    const [selectedMethodId, setSelectedMethodId] = useState<string>("gopay");
    const [methodGroup, setMethodGroup] = useState<"global" | "wallet" | "va">("wallet");
    const [bankSearch, setBankSearch] = useState<string>("");
    const [isIndonesia, setIsIndonesia] = useState<boolean | null>(null);

    const [status, setStatus] = useState<PaymentStatus>("idle");
    const [chargeData, setChargeData] = useState<ChargeResponse | null>(null);
    const [errorMessage, setErrorMessage] = useState("");

    const globalMethods = PAYMENT_METHODS.filter((m) => m.provider === "dodo");
    const walletMethods = PAYMENT_METHODS.filter(
        (m) => m.provider === "midtrans" && ["gopay", "qris"].includes(m.id),
    );
    const virtualAccountMethods = PAYMENT_METHODS.filter(
        (m) => m.provider === "midtrans" && !["gopay", "qris"].includes(m.id),
    );
    const defaultWalletId = walletMethods[0]?.id ?? "gopay";
    const defaultVaId = virtualAccountMethods[0]?.id ?? "bni";
    const defaultGlobalId = globalMethods[0]?.id ?? "dodo_card";
    const activeMethods =
        methodGroup === "global"
            ? globalMethods
            : methodGroup === "wallet"
                ? walletMethods
                : virtualAccountMethods;
    const filteredActiveMethods =
        methodGroup === "va" && bankSearch.trim().length
            ? activeMethods.filter((method) =>
                method.label.toLowerCase().includes(bankSearch.trim().toLowerCase()),
            )
            : activeMethods;

    // Check geo on mount
    useEffect(() => {
        fetch("/api/geo")
            .then(res => res.json())
            .then(data => {
                setIsIndonesia(data.isIndonesia ?? true);
            })
            .catch(() => setIsIndonesia(true)); // Default to Indonesia on error
    }, []);

    // Show Dodo for international, Midtrans for Indonesia
    const showGlobalMethods = isIndonesia === false;
    const showLocalMethods = isIndonesia === true;

    useEffect(() => {
        if (selectedMethodId === "dodo_card") {
            setMethodGroup("global");
        } else if (["gopay", "qris"].includes(selectedMethodId)) {
            setMethodGroup("wallet");
        } else {
            setMethodGroup("va");
        }
    }, [selectedMethodId]);


    // Set the right default method based on geo
    useEffect(() => {
        if (isIndonesia === false) {
            // International: use Dodo
            setMethodGroup("global");
            setSelectedMethodId(defaultGlobalId);
        } else if (isIndonesia === true) {
            // Indonesia: use Midtrans wallet by default
            setMethodGroup("wallet");
            setSelectedMethodId(defaultWalletId);
        }
    }, [isIndonesia, defaultGlobalId, defaultWalletId]);


    // Derived Data
    const shortPlanName = planParam === "pioneer" ? "Pioneer" : planParam === "voyager" ? "Voyager" : "Pathfinder";
    const planCardVariant = planParam === "pioneer" ? "primary" : planParam === "voyager" ? "highlighted" : "neutral";

    // Fallback if pricing data is missing/invalid param
    const getPricingData = () => {
        if (isIndonesia === false) {
            if (planParam === "pioneer") return PIONEER_PRICING_USD;
            if (planParam === "voyager") return VOYAGER_PRICING_USD;
            return PATHFINDER_PRICING_USD;
        }
        if (planParam === "pioneer") return PIONEER_PRICING;
        if (planParam === "voyager") return VOYAGER_PRICING;
        return PATHFINDER_PRICING;
    };
    const pricingData = getPricingData();
    const basePriceDisplay = pricingData[billingCycle].price;
    const baseChargeDisplay = pricingData[billingCycle].fullPrice;
    const monthlyBaseChargeDisplay = pricingData.monthly.fullPrice;
    const discountedPriceDisplay = basePriceDisplay;
    const discountedChargeDisplay = baseChargeDisplay;
    const monthlyDiscountedChargeDisplay = monthlyBaseChargeDisplay;

    // Choose features
    const features = planParam === "pioneer" ? PIONEER_FEATURES : planParam === "voyager" ? VOYAGER_FEATURES : PATHFINDER_FEATURES;
    const selectedMethodConfig = PAYMENT_METHODS.find(m => m.id === selectedMethodId);
    const poweredByLabel = selectedMethodConfig?.provider === "dodo" ? "Dodo Payments" : "Midtrans";
    const selectionHint = methodGroup === "global" ? "" : "You can change this later in checkout.";

    const getPaymentErrorDetail = async (res: Response) => {
        const contentType = res.headers.get("content-type") || "";
        const fallback = `Payment initialization failed (HTTP ${res.status})`;

        try {
            if (contentType.includes("application/json")) {
                const errData = await res.json();
                return errData?.detail || errData?.message || fallback;
            }
            const text = await res.text();
            const trimmed = text.trim();
            if (!trimmed) {
                return fallback;
            }
            if (contentType.includes("text/html") || trimmed.startsWith("<!DOCTYPE html")) {
                return fallback;
            }
            return trimmed;
        } catch {
            return fallback;
        }
    };

    const handlePayment = async () => {
        setStatus("loading");
        setErrorMessage("");

        try {
            const accessToken = await getSupabaseAccessToken();

            if (!accessToken) {
                const returnTo =
                    typeof window !== "undefined"
                        ? `${window.location.pathname}${window.location.search}`
                        : "/payment";
                setStatus("error");
                setErrorMessage("Please log in to continue.");
                router.push(`/login?redirect=${encodeURIComponent(returnTo)}`);
                return;
            }

            const selectedMethod = PAYMENT_METHODS.find(m => m.id === selectedMethodId);
            if (!selectedMethod) throw new Error("Invalid payment method");

            if (selectedMethod.provider === "dodo") {
                const payload: Record<string, string> = {
                    plan_tier: planParam ?? "pathfinder",
                    billing_cycle: billingCycle
                };
                payload.provider = "dodo";

                const res = await fetch("/api/p/api/payment/charge", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${accessToken}`
                    },
                    body: JSON.stringify(payload)
                });

                if (!res.ok) {
                    if (res.status === 401 || res.status === 403) {
                        const returnTo =
                            typeof window !== "undefined"
                                ? `${window.location.pathname}${window.location.search}`
                                : "/payment";
                        setStatus("error");
                        setErrorMessage("Your session expired. Please log in again.");
                        router.push(`/login?redirect=${encodeURIComponent(returnTo)}`);
                        return;
                    }
                    const detail = await getPaymentErrorDetail(res);
                    setStatus("error");
                    setErrorMessage(detail);
                    return;
                }

                const data: ChargeResponse = await res.json();
                const checkoutUrl = data.checkout_url;
                if (!checkoutUrl) {
                    throw new Error("Checkout URL missing from payment gateway.");
                }
                window.location.href = checkoutUrl;
                return;
            }

            const payload = {
                plan_tier: planParam,
                payment_type: selectedMethod.type ?? "gopay",
                bank: selectedMethod.bank,
                billing_cycle: billingCycle,
                provider: "midtrans"
            };

            const res = await fetch("/api/p/api/payment/charge", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${accessToken}`
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                if (res.status === 401 || res.status === 403) {
                    const returnTo =
                        typeof window !== "undefined"
                            ? `${window.location.pathname}${window.location.search}`
                            : "/payment";
                    setStatus("error");
                    setErrorMessage("Your session expired. Please log in again.");
                    router.push(`/login?redirect=${encodeURIComponent(returnTo)}`);
                    return;
                }
                const detail = await getPaymentErrorDetail(res);
                setStatus("error");
                setErrorMessage(detail);
                return;
            }

            const data = await res.json();
            setChargeData(data);
            setStatus("success");

            // Handle Redirects (3DS or other)
            if (data.redirect_url) {
                window.location.href = data.redirect_url;
            }

        } catch (err: unknown) {
            console.error(err);
            setStatus("error");
            let msg = "An unexpected error occurred.";
            if (err instanceof Error) {
                msg = err.message;
            } else if (typeof err === "string") {
                msg = err;
            }
            setErrorMessage(msg);
        }
    };

    if (!planParam) {
        return (
            <div className={styles.page}>
                <ParticleSphere />
                <div
                    className={styles.container}
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "auto",
                        minHeight: "400px",
                        maxWidth: "500px",
                        textAlign: "center",
                        padding: "3rem"
                    }}
                >
                    <AlertCircle size={48} color="#ef4444" style={{ marginBottom: "1rem" }} />
                    <h2 className={styles.title}>Invalid Request</h2>
                    <p className={styles.subtitle}>No plan selected.</p>
                    <button
                        onClick={() => router.back()}
                        className={styles.payButton}
                        style={{ marginTop: "2rem", width: "min(360px, 100%)" }}
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    const planCard = (
        <article className={`${pricingStyles.planCard} ${styles.planCard}`} data-variant={planCardVariant}>
            <div className={pricingStyles.cardBody}>
                <div className={pricingStyles.cardIntro}>
                    <header className={pricingStyles.cardHeader}>
                        <h2>{shortPlanName}</h2>
                        <p>
                            {planParam === "pioneer"
                                ? "For heavy users: top limits, top models, and early access to new features."
                                : planParam === "voyager"
                                    ? "For real daily use: more messages, longer memory, and calendar routines."
                                    : "First step into paid: model choice and longer memory."}
                        </p>
                    </header>
                    <div className={`${pricingStyles.priceBlock} ${pricingStyles.priceBlockStacked}`}>
                        <span className={pricingStyles.priceValue}>{discountedPriceDisplay}</span>
                        <span className={pricingStyles.priceMeta}>/ {billingCycle === "annual" ? "month" : "month"}</span>
                    </div>
                </div>

                <ul className={pricingStyles.featureList}>
                    {features.map(({ label, icon: Icon, variant, subtext }) => (
                        <li key={label} data-variant={variant}>
                            <Icon size={16} />
                            <span className={variant === "inherit" ? pricingStyles.featureLabelInherit : pricingStyles.featureLabel}>
                                {label}
                                {subtext && <span className={pricingStyles.featureSubtext}>{subtext}</span>}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
        </article>
    );

    const successSteps = (() => {
        if (!chargeData) return [];
        const bankLabel = (() => {
            const bankCode = selectedMethodConfig?.bank;
            if (!bankCode) return selectedMethodConfig?.label || "your bank";
            const bankNames: Record<string, string> = {
                bni: "BNI",
                bri: "BRI",
                cimb: "CIMB Niaga",
                danamon: "Danamon",
                mandiri: "Mandiri",
                permata: "PermataBank",
            };
            return bankNames[bankCode] || selectedMethodConfig?.label || "your bank";
        })();
        const bankCode = selectedMethodConfig?.bank || "";

        if (selectedMethodId === "qris") {
            return [
                t("Open any QRIS-capable app and scan the QR code."),
                t("Confirm payment to activate your plan."),
            ];
        }
        if (selectedMethodId === "gopay") {
            return [
                t("Open GoPay and proceed with the payment."),
                t("Confirm payment to activate your plan."),
            ];
        }
        if (selectedMethodId === "mandiri") {
            return [
                t("Open Mandiri ATM, internet banking, or mobile banking and choose Multipayment."),
                t("Enter the Biller Code and Bill Key shown below."),
                t("Confirm payment to activate your plan."),
            ];
        }
        if (methodGroup === "va") {
            const bankSpecificFirstStep: Record<string, string> = {
                bni: t("Open BNI Mobile Banking or ATM and choose Transfer > Virtual Account Billing."),
                bri: t("Open BRImo or ATM and choose BRIVA / Virtual Account."),
                cimb: t("Open CIMB Octo Mobile or ATM and choose Transfer > Virtual Account."),
                danamon: t("Open D-Bank PRO or ATM and choose Transfer > Virtual Account."),
                permata: t("Open PermataMobile X or ATM and choose Transfer > Virtual Account."),
            };
            return [
                bankSpecificFirstStep[bankCode] ||
                t("Open {bank} app or ATM and choose Virtual Account transfer.", { bank: bankLabel }),
                t("Enter the virtual account number shown below."),
                t("Complete the transfer to activate your plan."),
            ];
        }
        return [t("Complete the payment to activate your plan.")];
    })();

    if (status === "success" && chargeData) {
        return (
            <div className={styles.page}>
                <ParticleSphere />
                <div className={styles.topRow}>
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className={styles.dismiss}
                        aria-label="Back"
                    >
                        <ArrowLeft size={20} />
                    </button>
                </div>

                <div className={styles.mainGrid}>
                    <div className={styles.summaryColumn}>{planCard}</div>
                    <div className={styles.inputColumn}>
                        <div className={styles.successPanel}>
                            <div className={styles.successHeader}>
                                <span className={styles.successIcon} aria-hidden="true">
                                    <CheckCircle size={22} />
                                </span>
                                <div>
                                    <h2 className={styles.successTitle}>Order Created</h2>
                                    <p className={styles.subtitle}>Complete payment to activate.</p>
                                </div>
                            </div>

                            <div className={styles.successBody}>
                                <div className={styles.successDetails}>
                                    <div className={styles.successSteps}>
                                        {successSteps.map((step, index) => (
                                            <div key={`${index}-${step}`} className={styles.successStep}>
                                                <span className={styles.successStepNumber}>{index + 1}</span>
                                                <span>{step}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {chargeData.va_numbers ? (
                                        <div className={styles.successMetaBox}>
                                            <div className={styles.successMetaLabel}>VIRTUAL ACCOUNT NUMBER</div>
                                            <div className={styles.successMetaValue}>{chargeData.va_numbers[0].va_number}</div>
                                            <div className={styles.successMetaLabel}>BANK</div>
                                            <div className={styles.successMetaValue}>{chargeData.va_numbers[0].bank.toUpperCase()}</div>
                                        </div>
                                    ) : null}

                                    {chargeData.bill_key && chargeData.biller_code ? (
                                        <div className={styles.successMetaBox}>
                                            <div className={styles.successMetaLabel}>BILLER CODE</div>
                                            <div className={styles.successMetaValue}>{chargeData.biller_code}</div>
                                            <div className={styles.successMetaLabel}>BILL KEY</div>
                                            <div className={styles.successMetaValue}>{chargeData.bill_key}</div>
                                        </div>
                                    ) : null}
                                </div>

                                {chargeData.qr_code_url ? (
                                    <div className={styles.successQrWrap}>
                                        <div className={styles.qrCard}>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={chargeData.qr_code_url} alt="QRIS" className={styles.qrImage} />
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        <div className={`${styles.payButtonContainer} ${styles.successCtaContainer}`} aria-hidden="true">
                            <button type="button" className={styles.payButton} disabled>
                                Subscribe for {discountedChargeDisplay}
                            </button>
                            <div
                                style={{
                                    marginTop: "1rem",
                                    display: "flex",
                                    justifyContent: "center",
                                    gap: "0.5rem",
                                    color: "rgba(255,255,255,0.3)",
                                    fontSize: "0.8rem",
                                }}
                            >
                                Powered by {poweredByLabel} • Secure 256-bit SSL Header
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <ParticleSphere />
            {selectedMethodConfig?.provider === "midtrans" && (
                <Script
                    id="midtrans-script"
                    src="https://api.midtrans.com/v2/assets/js/midtrans-new-3ds.min.js"
                    data-environment={process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === 'true' ? 'production' : 'sandbox'}
                    data-client-key={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY}
                />
            )}

            <div className={styles.topRow}>
                <button
                    type="button"
                    onClick={() => router.back()}
                    className={styles.dismiss}
                    aria-label="Back"
                >
                    <ArrowLeft size={20} />
                </button>
            </div>
            <div className={styles.mainGrid}>
                {/* LEFT COLUMN: Summary & Features - using exact pricing page styles */}
                <div className={styles.summaryColumn}>
                    {planCard}
                </div>

                <div className={styles.inputColumn}>
                    <article className={`${pricingStyles.planCard} ${styles.paymentFormCard}`} data-variant="muted">
                        <div className={pricingStyles.cardBody}>
                            <div>
                                <h3 className={styles.sectionTitle}>Billing Cycle</h3>
                                <div
                                    className={styles.billingToggle}
                                    role="group"
                                    aria-label="Billing cadence"
                                    data-cycle={billingCycle}
                                >
                                    <div className={styles.billingThumb} aria-hidden="true" />
                                    <button
                                        type="button"
                                        data-active={billingCycle === "monthly"}
                                        aria-pressed={billingCycle === "monthly"}
                                        onClick={() => setBillingCycle("monthly")}
                                    >
                                        <div className={styles.cycleHeader}>
                                            <span>Pay monthly</span>
                                        </div>
                                        <div className={styles.cycleMeta}>
                                            <span className={styles.cyclePriceCurrent}>{monthlyDiscountedChargeDisplay}</span>
                                            <span className={styles.cycleCadence}>per month</span>
                                        </div>
                                    </button>
                                    <button
                                        type="button"
                                        data-active={billingCycle === "annual"}
                                        aria-pressed={billingCycle === "annual"}
                                        onClick={() => setBillingCycle("annual")}
                                    >
                                        <div className={styles.cycleHeader}>
                                            <span className={styles.cycleHeaderWithBadge}>
                                                Pay yearly
                                                <span className={styles.saveBadge}>Save 17%</span>
                                            </span>
                                        </div>
                                        <div className={styles.cycleMeta}>
                                            <span className={styles.cyclePriceCurrent}>{pricingData.annual.fullPrice}</span>
                                            <span className={styles.cycleCadence}>per year</span>
                                        </div>
                                    </button>
                                </div>
                            </div>


                            <div className={styles.activePaymentMethodsCard}>
                                <h3 className={styles.activePaymentMethodsTitle}>Active payment methods</h3>
                                <div
                                    className={styles.methodGroupTabs}
                                    role="tablist"
                                    aria-label="Payment method type"
                                    data-has-global={showGlobalMethods ? "true" : "false"}
                                >
                                    {showGlobalMethods && (
                                        <button
                                            type="button"
                                            role="tab"
                                            data-active={methodGroup === "global"}
                                            aria-selected={methodGroup === "global"}
                                            onClick={() => {
                                                setMethodGroup("global");
                                                setSelectedMethodId(defaultGlobalId);
                                                setBankSearch("");
                                            }}
                                        >
                                            Card & Global (Dodo)
                                        </button>
                                    )}
                                    {showLocalMethods && (
                                        <>
                                            <button
                                                type="button"
                                                role="tab"
                                                data-active={methodGroup === "wallet"}
                                                aria-selected={methodGroup === "wallet"}
                                                onClick={() => {
                                                    setMethodGroup("wallet");
                                                    setSelectedMethodId(defaultWalletId);
                                                    setBankSearch("");
                                                }}
                                            >
                                                E‑Wallet & QRIS
                                            </button>
                                            <button
                                                type="button"
                                                role="tab"
                                                data-active={methodGroup === "va"}
                                                aria-selected={methodGroup === "va"}
                                                onClick={() => {
                                                    setMethodGroup("va");
                                                    setSelectedMethodId(defaultVaId);
                                                }}
                                            >
                                                Virtual Accounts
                                            </button>
                                        </>
                                    )}
                                </div>


                                {methodGroup === "va" && showLocalMethods && (
                                    <div className={styles.methodSearch}>
                                        <Search size={16} aria-hidden="true" />
                                        <input
                                            type="text"
                                            value={bankSearch}
                                            onChange={(e) => setBankSearch(e.target.value)}
                                            placeholder="Search for your bank"
                                            className={styles.methodSearchInput}
                                            aria-label="Search for your bank"
                                        />
                                    </div>
                                )}

                                {methodGroup !== "global" && (
                                    <div className={styles.methodGrid} role="tabpanel">
                                        {filteredActiveMethods.map((method) => (
                                            <button
                                                key={method.id}
                                                type="button"
                                                className={styles.methodOption}
                                                data-selected={selectedMethodId === method.id}
                                                onClick={() => setSelectedMethodId(method.id)}
                                            >
                                                {method.logo ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                        src={method.logo}
                                                        alt=""
                                                        className={styles.methodLogo}
                                                        loading="lazy"
                                                    />
                                                ) : null}
                                                <span className={styles.methodLabel}>{method.label}</span>
                                            </button>
                                        ))}
                                        {filteredActiveMethods.length === 0 && (
                                            <div className={styles.methodEmpty}>No banks match that search.</div>
                                        )}
                                    </div>
                                )}
                                {selectionHint ? (
                                    <div className={styles.paymentSelectHint}>{selectionHint}</div>
                                ) : null}
                            </div>

                            <div className={styles.payButtonContainer}>
                                {status === "error" && (
                                    <div style={{ marginBottom: "1rem", padding: "0.75rem", background: "rgba(239, 68, 68, 0.1)", color: "#fca5a5", borderRadius: "8px", display: "flex", gap: "0.5rem", alignItems: "center", fontSize: "0.9rem" }}>
                                        <AlertCircle size={16} />
                                        <span>{errorMessage}</span>
                                    </div>
                                )}
                                <button
                                    className={styles.payButton}
                                    onClick={handlePayment}
                                    disabled={status === "loading"}
                                >
                                    {status === "loading" ? (
                                        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                                            <Loader2 size={20} className="animate-spin" /> Processing
                                        </span>
                                    ) : (
                                        `Subscribe for ${discountedChargeDisplay}`
                                    )}
                                </button>
                                <div style={{ marginTop: "1rem", display: "flex", justifyContent: "center", gap: "0.5rem", color: "rgba(255,255,255,0.3)", fontSize: "0.8rem" }}>
                                    Powered by {poweredByLabel} • Secure 256-bit SSL Header
                                </div>
                            </div>
                        </div>
                    </article>
                </div>

            </div>
        </div >
    );
}

export default function PaymentPage() {
    return (
        <Suspense fallback={<div className={styles.page}><Loader2 className="animate-spin" /></div>}>
            <PaymentContent />
        </Suspense>
    );
}
