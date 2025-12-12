"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Script from "next/script";
import { CheckCircle, AlertCircle, Loader2, ArrowLeft, CreditCard, Landmark, Smartphone, ShieldCheck, Zap, Globe, Radio, Brain, Clock, Pin, Plus, CalendarClock, MessageSquare, Shuffle, Infinity as InfinityIcon, Headphones, FlaskConical, Database } from "lucide-react";
import styles from "./payment.module.css";
import pricingStyles from "../pricing/page.module.css";
import { VOYAGER_FEATURES, PIONEER_FEATURES } from "../pricing/PricingPlansSection";

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
        MidtransNew3ds: any;
    }
}

const VOYAGER_PRICING = {
    monthly: { price: "Rp 77.000,-", fullPrice: "Rp 77.000" },
    annual: { price: "Rp 64.750,-", fullPrice: "Rp 777.000" }, // 777k / 12 ~ 64.75k
} as const;

const PIONEER_PRICING = {
    monthly: { price: "Rp 377.000,-", fullPrice: "Rp 377.000" },
    annual: { price: "Rp 314.750,-", fullPrice: "Rp 3.777.000" }, // 3.777m / 12 ~ 314.75k
} as const;


const PAYMENT_METHODS = [
    {
        id: "qris",
        label: "GoPay Dynamic QRIS",
        logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Logo_QRIS.svg/1200px-Logo_QRIS.svg.png",
        type: "gopay",
        isQris: true
    },
    {
        id: "gopay",
        label: "GoPay",
        logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Gopay_logo.svg/2560px-Gopay_logo.svg.png",
        type: "gopay",
        isDeepLink: true
    },
    {
        id: "bca",
        label: "BCA",
        logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Bank_Central_Asia.svg/2560px-Bank_Central_Asia.svg.png",
        type: "bank_transfer",
        bank: "bca"
    },
    {
        id: "bni",
        label: "BNI",
        logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Bank_Negara_Indonesia_logo.svg/2560px-Bank_Negara_Indonesia_logo.svg.png",
        type: "bank_transfer",
        bank: "bni"
    },
    {
        id: "bri",
        label: "BRI",
        logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/BANK_BRI_logo.svg/2560px-BANK_BRI_logo.svg.png",
        type: "bank_transfer",
        bank: "bri"
    },
    {
        id: "mandiri",
        label: "Bank Mandiri",
        logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/Bank_Mandiri_logo_2016.svg/2560px-Bank_Mandiri_logo_2016.svg.png",
        type: "echannel"
    },
    {
        id: "permata",
        label: "PermataBank",
        logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Bank_Permata_Logo.svg/1200px-Bank_Permata_Logo.svg.png",
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

    const [status, setStatus] = useState<PaymentStatus>("idle");
    const [chargeData, setChargeData] = useState<ChargeResponse | null>(null);
    const [errorMessage, setErrorMessage] = useState("");

    const walletMethods = PAYMENT_METHODS.filter((m) => ["gopay", "qris"].includes(m.id));
    const virtualAccountMethods = PAYMENT_METHODS.filter((m) => !["gopay", "qris"].includes(m.id));


    // Derived Data
    const planName = planParam === "pioneer" ? "Gray Pioneer" : "Gray Voyager";
    const shortPlanName = planParam === "pioneer" ? "Pioneer" : "Voyager";

    // Fallback if pricing data is missing/invalid param
    const pricingData = (planParam === "pioneer" ? PIONEER_PRICING : VOYAGER_PRICING);
    const currentPriceDisplay = pricingData[billingCycle].price;
    const fullPriceDisplay = pricingData[billingCycle].fullPrice;

    // Choose features
    const features = planParam === "pioneer" ? PIONEER_FEATURES : VOYAGER_FEATURES;

    // Calculate precise amount for API
    const amountForApi = planParam === "pioneer"
        ? (billingCycle === "annual" ? 3777000 : 377000)
        : (billingCycle === "annual" ? 777000 : 77000);

    const handlePayment = async () => {
        setStatus("loading");
        setErrorMessage("");

        try {
            let tokenId = null;


            const selectedMethod = PAYMENT_METHODS.find(m => m.id === selectedMethodId);
            if (!selectedMethod) throw new Error("Invalid payment method");

            const payload = {
                plan_tier: planParam,
                payment_type: selectedMethod.type,
                bank: selectedMethod.bank, // undefined for non-bank_transfer
                billing_cycle: billingCycle
            };


            const res = await fetch("/api/payment/charge", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("token") || ""}`
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || "Payment initialization failed");
            }

            const data = await res.json();
            setChargeData(data);
            setStatus("success");

            // Handle 3DS Redirect for Credit Card
            // Handle Redirects (3DS or other)
            if (data.redirect_url) {
                window.location.href = data.redirect_url;
            }

        } catch (err: any) {
            console.error(err);
            setStatus("error");
            setErrorMessage(err.message || "An unexpected error occurred.");
        }
    };

    if (!planParam) {
        return (
            <div className={styles.page}>
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
                    <button onClick={() => router.back()} className={styles.payButton} style={{ marginTop: "2rem" }}>
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    if (status === "success" && chargeData) {
        return (
            <div className={styles.page}>
                <div className={pricingStyles.starField} aria-hidden="true">
                    <div className={pricingStyles.starLayer} />
                    <div className={pricingStyles.starLayer} data-variant="dense" />
                </div>
                <div className={styles.container}>
                    <div className={styles.successContainer}>
                        <div style={{ padding: "1.5rem", background: "rgba(255, 255, 255, 0.1)", borderRadius: "50%" }}>
                            <CheckCircle size={48} color="white" />
                        </div>
                        <div>
                            <h2 style={{ fontSize: "1.75rem", fontWeight: 700, color: "white" }}>Order Created</h2>
                            <p className={styles.subtitle}>Complete payment to activate.</p>
                        </div>

                        {chargeData.qr_code_url && (
                            <div style={{ background: "white", padding: "1rem", borderRadius: "16px" }}>
                                <img src={chargeData.qr_code_url} alt="QRIS" style={{ width: "200px", height: "200px" }} />
                            </div>
                        )}

                        {chargeData.va_numbers && (
                            <div className={styles.summaryBox} style={{ width: "100%", maxWidth: "300px" }}>
                                <div style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.6)" }}>VIRTUAL ACCOUNT NUMBER</div>
                                <div style={{ fontSize: "2rem", fontFamily: "monospace", margin: "0.5rem 0", color: "white" }}>{chargeData.va_numbers[0].va_number}</div>
                                <div style={{ fontSize: "0.9rem", color: "#ffff" }}>Bank {chargeData.va_numbers[0].bank.toUpperCase()}</div>
                            </div>
                        )}

                        {chargeData.bill_key && chargeData.biller_code && (
                            <div className={styles.summaryBox} style={{ width: "100%", maxWidth: "300px" }}>
                                <div style={{ marginBottom: "1rem" }}>
                                    <div style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.6)" }}>BILLER CODE</div>
                                    <div style={{ fontSize: "1.5rem", fontFamily: "monospace", color: "white" }}>{chargeData.biller_code}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.6)" }}>BILL KEY</div>
                                    <div style={{ fontSize: "1.5rem", fontFamily: "monospace", color: "white" }}>{chargeData.bill_key}</div>
                                </div>
                            </div>
                        )}

                        {chargeData.deeplink_url && (
                            <a href={chargeData.deeplink_url} target="_blank" rel="noreferrer" className={styles.payButton} style={{ textDecoration: "none", display: "inline-block", maxWidth: "300px" }}>
                                Open Gojek App
                            </a>
                        )}

                        <button onClick={() => router.push("/dashboard")} className={styles.methodButton} style={{ justifyContent: "center", width: "100%", maxWidth: "300px" }}>
                            Return to Dashboard
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <div className={pricingStyles.starField} aria-hidden="true">
                <div className={pricingStyles.starLayer} />
                <div className={pricingStyles.starLayer} data-variant="dense" />
            </div>
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
                    <article className={`${pricingStyles.planCard} ${styles.planCard}`} data-variant="highlighted">
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
                        <div className={styles.paymentSelectWrapper}>
                            <label htmlFor="payment-method" className={styles.paymentSelectLabel}>
                                Choose a method
                            </label>
                            <select
                                id="payment-method"
                                className={styles.paymentSelect}
                                value={selectedMethodId}
                                onChange={(e) => setSelectedMethodId(e.target.value)}
                            >
                                <optgroup label="E‑Wallet & QRIS">
                                    {walletMethods.map((method) => (
                                        <option key={method.id} value={method.id}>
                                            {method.label}
                                        </option>
                                    ))}
                                </optgroup>
                                <optgroup label="Virtual Accounts">
                                    {virtualAccountMethods.map((method) => (
                                        <option key={method.id} value={method.id}>
                                            {method.label}
                                        </option>
                                    ))}
                                </optgroup>
                            </select>
                            <div className={styles.paymentSelectHint}>
                                You can change this later in checkout.
                            </div>
                        </div>
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

            <div className={styles.particleBackground}>
                <div className={styles.starLayer} />
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
