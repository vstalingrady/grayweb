"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Script from "next/script";
import dynamic from "next/dynamic";
import { CheckCircle, AlertCircle, Loader2, ArrowLeft, Search } from "lucide-react";
import styles from "./payment.module.css";
import pricingStyles from "../pricing/page.module.css";
import { VOYAGER_FEATURES, PIONEER_FEATURES } from "../pricing/PricingPlansSection";

import { getSupabaseClient } from "@/lib/supabaseClient";

// Dynamically import the 3D background with SSR disabled
const DepthParticleBackground = dynamic(
    () => import("@/components/backgrounds/DepthParticleBackground").then(mod => mod.DepthParticleBackground),
    { ssr: false }
);

type PaymentStatus = "idle" | "loading" | "success" | "pending" | "error";

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
}

declare global {
    interface Window {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        MidtransNew3ds: any;
    }
}

const VOYAGER_PRICING = {
    monthly: { price: "Rp 177.000,-", fullPrice: "Rp 177.000" },
    annual: { price: "Rp 148.083,-", fullPrice: "Rp 1.777.000" }, // 1.777m / 12 ≈ 148.083k
} as const;

const PIONEER_PRICING = {
    monthly: { price: "Rp 377.000,-", fullPrice: "Rp 377.000" },
    annual: { price: "Rp 314.750,-", fullPrice: "Rp 3.777.000" }, // 3.777m / 12 ~ 314.75k
} as const;


const PAYMENT_METHODS = [
    {
        id: "danamon",
        label: "Danamon",
        logo: "/logos/payment/danamon.png",
        type: "bank_transfer",
        bank: "danamon"
    },
    {
        id: "cimb",
        label: "CIMB Niaga",
        logo: "/logos/payment/cimb.svg",
        type: "bank_transfer",
        bank: "cimb"
    },
    {
        id: "qris",
        label: "GoPay Dynamic QRIS",
        logo: "/logos/payment/qris.png",
        type: "gopay",
        isQris: true
    },
    {
        id: "bni",
        label: "BNI",
        logo: "/logos/payment/bni.svg",
        type: "bank_transfer",
        bank: "bni"
    },
    {
        id: "bri",
        label: "BRI",
        logo: "/logos/payment/bri.svg",
        type: "bank_transfer",
        bank: "bri"
    },
    {
        id: "gopay",
        label: "GoPay",
        logo: "/logos/payment/gopay.svg",
        type: "gopay",
        isDeepLink: true
    },
    {
        id: "mandiri",
        label: "Bank Mandiri",
        logo: "/logos/payment/mandiri.png",
        type: "echannel"
    },
    {
        id: "permata",
        label: "PermataBank",
        logo: "/logos/payment/permata.svg",
        type: "bank_transfer",
        bank: "permata"
    }
];

function PaymentContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const planParam = searchParams.get("plan");
    const cycleParam = searchParams.get("cycle");

    // State
    const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">((cycleParam as "monthly" | "annual") || "monthly");
    const [selectedMethodId, setSelectedMethodId] = useState<string>("gopay");
    const [methodGroup, setMethodGroup] = useState<"wallet" | "va">("wallet");
    const [bankSearch, setBankSearch] = useState<string>("");

    const [status, setStatus] = useState<PaymentStatus>("idle");
    const [chargeData, setChargeData] = useState<ChargeResponse | null>(null);
    const [errorMessage, setErrorMessage] = useState("");

    const walletMethods = PAYMENT_METHODS.filter((m) => ["gopay", "qris"].includes(m.id));
    const virtualAccountMethods = PAYMENT_METHODS.filter((m) => !["gopay", "qris"].includes(m.id));
    const activeMethods = methodGroup === "wallet" ? walletMethods : virtualAccountMethods;
    const filteredActiveMethods =
        methodGroup === "va" && bankSearch.trim().length
            ? activeMethods.filter((method) =>
                method.label.toLowerCase().includes(bankSearch.trim().toLowerCase()),
            )
            : activeMethods;

    useEffect(() => {
        // Keep group in sync with selected method (e.g., deep links)
        if (["gopay", "qris"].includes(selectedMethodId)) {
            setMethodGroup("wallet");
        } else {
            setMethodGroup("va");
        }
    }, [selectedMethodId]);


    // Derived Data
    const planName = planParam === "pioneer" ? "Gray Pioneer" : "Gray Voyager"; // eslint-disable-line @typescript-eslint/no-unused-vars
    const shortPlanName = planParam === "pioneer" ? "Pioneer" : "Voyager";
    const planCardVariant = planParam === "pioneer" ? "primary" : "highlighted";

    // Fallback if pricing data is missing/invalid param
    const pricingData = (planParam === "pioneer" ? PIONEER_PRICING : VOYAGER_PRICING);
    const currentPriceDisplay = pricingData[billingCycle].price;
    const fullPriceDisplay = pricingData[billingCycle].fullPrice;

    // Choose features
    const features = planParam === "pioneer" ? PIONEER_FEATURES : VOYAGER_FEATURES;

    // Calculate precise amount for API
    const amountForApi = planParam === "pioneer" // eslint-disable-line @typescript-eslint/no-unused-vars
        ? (billingCycle === "annual" ? 3777000 : 377000)
        : (billingCycle === "annual" ? 777000 : 77000);

    const handlePayment = async () => {
        setStatus("loading");
        setErrorMessage("");

        try {



            const supabase = getSupabaseClient();
            if (!supabase) {
                throw new Error("Authentication is not configured. Please refresh and try again.");
            }

            const { data: sessionData } = await supabase.auth.getSession();
            const accessToken = sessionData.session?.access_token ?? null;
            if (!accessToken) {
                const returnTo =
                    typeof window !== "undefined"
                        ? `${window.location.pathname}${window.location.search}`
                        : "/payment";
                setStatus("error");
                setErrorMessage("Please log in to continue.");
                router.push(`/login?returnTo=${encodeURIComponent(returnTo)}`);
                return;
            }

            const selectedMethod = PAYMENT_METHODS.find(m => m.id === selectedMethodId);
            if (!selectedMethod) throw new Error("Invalid payment method");

            const payload = {
                plan_tier: planParam,
                payment_type: selectedMethod.type,
                bank: selectedMethod.bank, // undefined for non-bank_transfer
                billing_cycle: billingCycle
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
                    router.push(`/login?returnTo=${encodeURIComponent(returnTo)}`);
                    return;
                }
                const contentType = res.headers.get("content-type") || "";
                let detail = `Payment initialization failed (HTTP ${res.status})`;
                try {
                    if (contentType.includes("application/json")) {
                        const errData = await res.json();
                        detail = errData?.detail || errData?.message || detail;
                    } else {
                        const text = await res.text();
                        const trimmed = text.trim();
                        if (trimmed) {
                            // Avoid dumping full HTML error documents into the UI/console.
                            if (contentType.includes("text/html") || trimmed.startsWith("<!DOCTYPE html")) {
                                detail = `Payment initialization failed (HTTP ${res.status})`;
                            } else {
                                detail = trimmed;
                            }
                        }
                    }
                } catch {
                    // ignore parse errors; use default detail
                }
                throw new Error(detail);
            }

            const data = await res.json();
            setChargeData(data);
            setStatus("success");

            // Handle 3DS Redirect for Credit Card
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
                <DepthParticleBackground />
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
                                ? "Uncapped context, models, and proactive workflows for daily reliance."
                                : "Unlock model switching, integrations, and customizable automations."}
                        </p>
                    </header>
                    <div className={pricingStyles.priceBlock}>
                        <span className={pricingStyles.priceValue}>{currentPriceDisplay}</span>
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

    if (status === "success" && chargeData) {
        return (
            <div className={styles.page}>
                <DepthParticleBackground />
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
                                        <div className={styles.successStep}>
                                            <span className={styles.successStepNumber}>1</span>
                                            <span>Scan the QR code in Gojek/GoPay.</span>
                                        </div>
                                        <div className={styles.successStep}>
                                            <span className={styles.successStepNumber}>2</span>
                                            <span>Confirm payment to activate your plan.</span>
                                        </div>
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
                                Subscribe for {fullPriceDisplay}
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
                                Powered by Midtrans • Secure 256-bit SSL Header
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <DepthParticleBackground />
            <Script
                id="midtrans-script"
                src="https://api.midtrans.com/v2/assets/js/midtrans-new-3ds.min.js"
                data-environment={process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === 'true' ? 'production' : 'sandbox'}
                data-client-key={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY}
            />

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
                                <div className={styles.cycleMeta}>{pricingData.monthly.fullPrice} per month</div>
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
                                <div className={styles.cycleMeta}>{pricingData.annual.fullPrice} per year</div>
                            </button>
                        </div>
                    </div>


                    <div className={styles.activePaymentMethodsCard}>
                        <h3 className={styles.activePaymentMethodsTitle}>Active payment methods</h3>
                        <div className={styles.methodGroupTabs} role="tablist" aria-label="Payment method type">
                            <button
                                type="button"
                                role="tab"
                                data-active={methodGroup === "wallet"}
                                aria-selected={methodGroup === "wallet"}
                                onClick={() => {
                                    setMethodGroup("wallet");
                                    setSelectedMethodId(walletMethods[0]?.id ?? "gopay");
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
                                    setSelectedMethodId(virtualAccountMethods[0]?.id ?? "bni");
                                }}
                            >
                                Virtual Accounts
                            </button>
                        </div>

                        {methodGroup === "va" && (
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
                        <div className={styles.paymentSelectHint}>You can change this later in checkout.</div>
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
                                `Subscribe for ${fullPriceDisplay}`
                            )}
                        </button>
                        <div style={{ marginTop: "1rem", display: "flex", justifyContent: "center", gap: "0.5rem", color: "rgba(255,255,255,0.3)", fontSize: "0.8rem" }}>
                            Powered by Midtrans • Secure 256-bit SSL Header
                        </div>
                    </div>
                </div >

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
