"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Script from "next/script";
import { Check, CheckCircle, AlertCircle, Loader2, ArrowLeft, CreditCard, Landmark, Smartphone, ShieldCheck, Zap, Globe, Radio, Brain, Clock, Pin, Plus, CalendarClock, MessageSquare, Shuffle, Infinity as InfinityIcon, Headphones, FlaskConical, Database } from "lucide-react";
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

function PaymentContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const planParam = searchParams.get("plan");
    const cycleParam = searchParams.get("cycle");

    // State
    const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">((cycleParam as "monthly" | "annual") || "monthly");
    const [paymentMethod, setPaymentMethod] = useState<"gopay" | "bank_transfer" | "credit_card">("gopay");
    const [selectedBank, setSelectedBank] = useState<"bca" | "bni" | "bri">("bca");
    const [status, setStatus] = useState<PaymentStatus>("idle");
    const [chargeData, setChargeData] = useState<ChargeResponse | null>(null);
    const [errorMessage, setErrorMessage] = useState("");

    // Card Input State
    const [cardNumber, setCardNumber] = useState("");
    const [cardExpMonth, setCardExpMonth] = useState("");
    const [cardExpYear, setCardExpYear] = useState("");
    const [cardCVV, setCardCVV] = useState("");
    const [isProcessingCard, setIsProcessingCard] = useState(false);

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

            if (paymentMethod === "credit_card") {
                setIsProcessingCard(true);
                // Tokenize Card
                tokenId = await new Promise<string>((resolve, reject) => {
                    const cardData = {
                        "card_number": cardNumber.replace(/\s/g, ""),
                        "card_exp_month": cardExpMonth,
                        "card_exp_year": cardExpYear,
                        "card_cvv": cardCVV,
                    };
                    const options = {
                        onSuccess: function (response: any) {
                            resolve(response.token_id);
                        },
                        onFailure: function (response: any) {
                            reject(new Error("Card tokenization failed: " + response.status_message));
                        }
                    };

                    if (window.MidtransNew3ds) {
                        window.MidtransNew3ds.getCardToken(cardData, options);
                    } else {
                        reject(new Error("Midtrans library not loaded."));
                    }
                });
                setIsProcessingCard(false);
            }

            const payload = {
                plan_tier: planParam,
                payment_type: paymentMethod,
                bank: paymentMethod === "bank_transfer" ? selectedBank : undefined,
                token_id: tokenId,
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
            if (paymentMethod === "credit_card" && data.redirect_url) {
                window.location.href = data.redirect_url;
            }

        } catch (err: any) {
            console.error(err);
            setStatus("error");
            setErrorMessage(err.message || "An unexpected error occurred.");
            setIsProcessingCard(false);
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
                <div className={styles.container}>
                    <div className={styles.successContainer}>
                        <div style={{ padding: "1.5rem", background: "rgba(255, 255, 255, 0.1)", borderRadius: "50%" }}>
                            <CheckCircle size={48} color="white" />
                        </div>
                        <div>
                            <h2 style={{ fontSize: "1.75rem", fontWeight: 700, color: "white" }}>Order Created</h2>
                            <p className={styles.subtitle}>Complete payment to activate.</p>
                        </div>

                        {paymentMethod === "gopay" && chargeData.qr_code_url && (
                            <div style={{ background: "white", padding: "1rem", borderRadius: "16px" }}>
                                <img src={chargeData.qr_code_url} alt="QRIS" style={{ width: "200px", height: "200px" }} />
                            </div>
                        )}

                        {paymentMethod === "bank_transfer" && chargeData.va_numbers && (
                            <div className={styles.summaryBox} style={{ width: "100%", maxWidth: "300px" }}>
                                <div style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.6)" }}>VIRTUAL ACCOUNT NUMBER</div>
                                <div style={{ fontSize: "2rem", fontFamily: "monospace", margin: "0.5rem 0", color: "white" }}>{chargeData.va_numbers[0].va_number}</div>
                                <div style={{ fontSize: "0.9rem", color: "#ffff" }}>Bank {chargeData.va_numbers[0].bank.toUpperCase()}</div>
                            </div>
                        )}

                        {paymentMethod === "gopay" && chargeData.deeplink_url && (
                            <a href={chargeData.deeplink_url} target="_blank" rel="noreferrer" className={styles.payButton} style={{ textDecoration: "none", display: "inline-block", maxWidth: "300px" }}>
                                Open Gojek App
                            </a>
                        )}

                        <button onClick={() => router.push("/dashboard")} className={styles.methodButton} style={{ justifyContent: "center", width: "100%", maxWidth: "300px" }}>
                            Return to Dashboard
                        </button>
                    </div>
                </div>
                <div className={styles.particleBackground}>
                    <div className={styles.starLayer} />
                </div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <Script
                id="midtrans-script"
                src="https://api.midtrans.com/v2/assets/js/midtrans-new-3ds.min.js"
                data-environment={process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === 'true' ? 'production' : 'sandbox'}
                data-client-key={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY}
            />

            <button
                onClick={() => router.back()}
                className={styles.dismiss}
            >
                <ArrowLeft size={20} />
            </button>

            <div className={styles.mainGrid}>
                {/* LEFT COLUMN: Summary & Features - using exact pricing page styles */}
                <div className={styles.summaryColumn}>
                    <article className={pricingStyles.planCard} data-variant="highlighted">
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
                        <div className={pricingStyles.billingToggle} role="group" aria-label="Billing cadence" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', width: '100%' }}>
                            <button
                                type="button"
                                data-active={billingCycle === "monthly"}
                                onClick={() => setBillingCycle("monthly")}
                                style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}
                            >
                                <div style={{ fontWeight: 600 }}>Pay monthly</div>
                                <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>{pricingData.monthly.fullPrice} per month</div>
                            </button>
                            <button
                                type="button"
                                data-active={billingCycle === "annual"}
                                onClick={() => setBillingCycle("annual")}
                                style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                                    Pay yearly
                                    <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>Save 17%</span>
                                </div>
                                <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>{pricingData.annual.fullPrice} per year</div>
                            </button>
                        </div>
                    </div>

                    <div>
                        <h3 className={styles.sectionTitle}>Payment Method</h3>
                        <div className={styles.paymentMethods}>
                            <button
                                className={styles.methodButton}
                                data-selected={paymentMethod === "gopay"}
                                onClick={() => setPaymentMethod("gopay")}
                            >
                                <Smartphone size={24} />
                                <div>
                                    <div style={{ fontWeight: 600 }}>GoPay / QRIS</div>
                                    <div style={{ fontSize: "0.8rem", opacity: 0.6 }}>Scan with any app</div>
                                </div>
                                {paymentMethod === "gopay" && <div style={{ marginLeft: "auto", width: 4, height: 4, borderRadius: "50%", background: "white" }} />}
                            </button>

                            <button
                                className={styles.methodButton}
                                data-selected={paymentMethod === "bank_transfer"}
                                onClick={() => setPaymentMethod("bank_transfer")}
                            >
                                <Landmark size={24} />
                                <div>
                                    <div style={{ fontWeight: 600 }}>Bank Transfer</div>
                                    <div style={{ fontSize: "0.8rem", opacity: 0.6 }}>Virtual Account</div>
                                </div>
                                {paymentMethod === "bank_transfer" && <div style={{ marginLeft: "auto", width: 4, height: 4, borderRadius: "50%", background: "white" }} />}
                            </button>

                            <button
                                className={styles.methodButton}
                                data-selected={paymentMethod === "credit_card"}
                                onClick={() => setPaymentMethod("credit_card")}
                            >
                                <CreditCard size={24} />
                                <div>
                                    <div style={{ fontWeight: 600 }}>Credit Card</div>
                                    <div style={{ fontSize: "0.8rem", opacity: 0.6 }}>Visa, Mastercard</div>
                                </div>
                                {paymentMethod === "credit_card" && <div style={{ marginLeft: "auto", width: 4, height: 4, borderRadius: "50%", background: "white" }} />}
                            </button>
                        </div>
                    </div>

                    {
                        paymentMethod === "bank_transfer" && (
                            <div className={styles.bankList}>
                                {(["bca", "bni", "bri"] as const).map(bank => (
                                    <button
                                        key={bank}
                                        className={styles.bankButton}
                                        data-active={selectedBank === bank}
                                        onClick={() => setSelectedBank(bank)}
                                    >
                                        {bank}
                                    </button>
                                ))}
                            </div>
                        )
                    }

                    {
                        paymentMethod === "credit_card" && (
                            <div className={styles.cardForm}>
                                <input
                                    className={styles.input}
                                    type="text"
                                    placeholder="Card Number"
                                    value={cardNumber}
                                    onChange={e => setCardNumber(e.target.value)}
                                />
                                <div className={styles.expiryRow}>
                                    <input
                                        className={styles.input}
                                        type="text"
                                        placeholder="MM"
                                        value={cardExpMonth}
                                        onChange={e => setCardExpMonth(e.target.value)}
                                        maxLength={2}
                                    />
                                    <input
                                        className={styles.input}
                                        type="text"
                                        placeholder="YYYY"
                                        value={cardExpYear}
                                        onChange={e => setCardExpYear(e.target.value)}
                                        maxLength={4}
                                    />
                                    <input
                                        className={styles.input}
                                        type="text"
                                        placeholder="CVV"
                                        value={cardCVV}
                                        onChange={e => setCardCVV(e.target.value)}
                                        maxLength={4}
                                    />
                                </div>
                            </div>
                        )
                    }

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
                            disabled={isProcessingCard || status === "loading"}
                        >
                            {isProcessingCard || status === "loading" ? (
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
