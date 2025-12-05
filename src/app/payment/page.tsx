"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Script from "next/script";
import { CheckCircle, AlertCircle, Loader2, ArrowLeft, CreditCard, Landmark, Smartphone } from "lucide-react";
import styles from "../pricing/page.module.css"; // Reuse pricing styles for consistency
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

function PaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan");
  const cycle = searchParams.get("cycle");

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

  const planName = plan === "pioneer" ? "Gray Pioneer" : "Gray Voyager";
  const amount = plan === "pioneer" ? "Rp 377.000,-" : "Rp 77.000,-"; // Simplified logic
  const features = plan === "pioneer" ? PIONEER_FEATURES : VOYAGER_FEATURES;
  
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
                 onSuccess: function(response: any){
                     resolve(response.token_id);
                 },
                 onFailure: function(response: any){
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
        plan_tier: plan,
        payment_type: paymentMethod,
        bank: paymentMethod === "bank_transfer" ? selectedBank : undefined,
        token_id: tokenId
      };

      const res = await fetch("/api/payment/charge", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("token") || ""}` // Assuming token is here
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

    if (!plan) {
      return (
          <div className={styles.shell} style={{ alignItems: "center", justifyContent: "center" }}>
              <div className={styles.inner} style={{ maxWidth: "600px", background: "rgba(12,12,12,0.8)", borderRadius: "24px", padding: "2rem", textAlign: "center" }}>
                   <AlertCircle size={48} color="#ef4444" />
                   <h2>Invalid Request</h2>
                   <p>No plan selected.</p>
                   <button onClick={() => router.back()} className={styles.planButtonOutline} style={{ width: "auto", marginTop: "1rem" }}>Go Back</button>
              </div>
          </div>
      );
    }
  
    return (
      <div className={styles.shell} style={{ overflowY: "auto", alignItems: "flex-start" }}>
          <Script
              id="midtrans-script"
              src="https://api.midtrans.com/v2/assets/js/midtrans-new-3ds.min.js"
              data-environment={process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === 'true' ? 'production' : 'sandbox'}
              data-client-key={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY}
          />
  
          <button
              onClick={() => router.back()}
              className={styles.dismiss}
              style={{ position: "fixed", top: "1.5rem", left: "1.5rem", zIndex: 10 }}
          >
              <ArrowLeft />
          </button>
  
          <div className={styles.inner} style={{ maxWidth: "800px", width: "100%", background: "rgba(12,12,12,0.8)", borderRadius: "24px", padding: "clamp(1.5rem, 4vw, 3rem)" }}>
              <header className={styles.hero} style={{ textAlign: "left", marginBottom: "2rem" }}>                <h1 className={styles.heroTitle} style={{ fontSize: "2rem" }}>Secure Checkout</h1>
                <p className={styles.heroSubhead} style={{ margin: "0.5rem 0 0" }}>
                    Upgrade to <strong>{planName}</strong>
                </p>
            </header>

            {status === "idle" || status === "error" ? (
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "2rem" }}>
                                        {/* Order Summary */}
                                        <div style={{ padding: "1.5rem", background: "rgba(255,255,255,0.03)", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.05)" }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                                                <span style={{ color: "rgba(255,255,255,0.6)" }}>Plan</span>
                                                <span style={{ fontWeight: 600 }}>{planName}</span>
                                            </div>
                                             <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                                                <span style={{ color: "rgba(255,255,255,0.6)" }}>Billing Cycle</span>
                                                <span style={{ textTransform: "capitalize" }}>{cycle || "Monthly"}</span>
                                            </div>
                                            <hr style={{ borderColor: "rgba(255,255,255,0.1)", margin: "1rem 0" }} />
                                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1.25rem" }}>
                                                <span>Total</span>
                                                <span style={{ fontWeight: 600 }}>{amount}</span>
                                            </div>
                                        </div>
                
                                    {/* Features List */}
                                    <div style={{ padding: "1.5rem", background: "rgba(255,255,255,0.03)", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.05)" }}>
                                        <h3 style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>What you'll get:</h3>
                                        <ul className={styles.featureList} style={{ gap: "0.75rem" }}>
                                            {features.map(({ label, icon: Icon, subtext, variant }) => (
                                                <li key={label} data-variant={variant ?? undefined} style={{ fontSize: "0.9rem" }}>
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
                    {/* Payment Method Selection */}
                    <div>
                        <h3 style={{ fontSize: "1.1rem", marginBottom: "1rem" }}>Payment Method</h3>
                        <div style={{ display: "grid", gap: "0.75rem" }}>
                            <button 
                                onClick={() => setPaymentMethod("gopay")}
                                style={{
                                    display: "flex", alignItems: "center", gap: "1rem", padding: "1rem",
                                    background: paymentMethod === "gopay" ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.03)",
                                    border: `1px solid ${paymentMethod === "gopay" ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.05)"}`,
                                    borderRadius: "12px", color: "white", cursor: "pointer", textAlign: "left"
                                }}
                            >
                                <Smartphone size={24} />
                                <div>
                                    <div style={{ fontWeight: 600 }}>GoPay / QRIS</div>
                                    <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.5)" }}>Scan QR code directly</div>
                                </div>
                            </button>

                            <button 
                                onClick={() => setPaymentMethod("bank_transfer")}
                                style={{
                                    display: "flex", alignItems: "center", gap: "1rem", padding: "1rem",
                                    background: paymentMethod === "bank_transfer" ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.03)",
                                    border: `1px solid ${paymentMethod === "bank_transfer" ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.05)"}`,
                                    borderRadius: "12px", color: "white", cursor: "pointer", textAlign: "left"
                                }}
                            >
                                <Landmark size={24} />
                                <div>
                                    <div style={{ fontWeight: 600 }}>Bank Transfer</div>
                                    <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.5)" }}>Virtual Account (BCA, BNI, BRI)</div>
                                </div>
                            </button>

                            <button 
                                onClick={() => setPaymentMethod("credit_card")}
                                style={{
                                    display: "flex", alignItems: "center", gap: "1rem", padding: "1rem",
                                    background: paymentMethod === "credit_card" ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.03)",
                                    border: `1px solid ${paymentMethod === "credit_card" ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.05)"}`,
                                    borderRadius: "12px", color: "white", cursor: "pointer", textAlign: "left"
                                }}
                            >
                                <CreditCard size={24} />
                                <div>
                                    <div style={{ fontWeight: 600 }}>Credit Card</div>
                                    <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.5)" }}>Visa, Mastercard, JCB</div>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Bank Selection (Conditional) */}
                    {paymentMethod === "bank_transfer" && (
                         <div style={{ paddingLeft: "1rem", borderLeft: "2px solid rgba(255,255,255,0.1)" }}>
                            <h4 style={{ fontSize: "0.95rem", marginBottom: "0.75rem", color: "rgba(255,255,255,0.7)" }}>Select Bank</h4>
                            <div style={{ display: "flex", gap: "0.5rem" }}>
                                {(["bca", "bni", "bri"] as const).map(bank => (
                                    <button
                                        key={bank}
                                        onClick={() => setSelectedBank(bank)}
                                        style={{
                                            padding: "0.5rem 1rem", borderRadius: "8px", textTransform: "uppercase",
                                            background: selectedBank === bank ? "white" : "rgba(255,255,255,0.1)",
                                            color: selectedBank === bank ? "black" : "white",
                                            border: "none", cursor: "pointer", fontWeight: 600
                                        }}
                                    >
                                        {bank}
                                    </button>
                                ))}
                            </div>
                         </div>
                    )}

                    {/* Credit Card Input (Conditional) */}
                    {paymentMethod === "credit_card" && (
                         <div style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "1rem", background: "rgba(255,255,255,0.03)", borderRadius: "12px" }}>
                            <input 
                                type="text" 
                                placeholder="Card Number" 
                                value={cardNumber}
                                onChange={e => setCardNumber(e.target.value)}
                                style={{ width: "100%", padding: "0.75rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "white" }}
                            />
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                                <input 
                                    type="text" 
                                    placeholder="MM" 
                                    value={cardExpMonth}
                                    onChange={e => setCardExpMonth(e.target.value)}
                                    maxLength={2}
                                    style={{ padding: "0.75rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "white" }}
                                />
                                <input 
                                    type="text" 
                                    placeholder="YYYY" 
                                    value={cardExpYear}
                                    onChange={e => setCardExpYear(e.target.value)}
                                    maxLength={4}
                                    style={{ padding: "0.75rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "white" }}
                                />
                                <input 
                                    type="text" 
                                    placeholder="CVV" 
                                    value={cardCVV}
                                    onChange={e => setCardCVV(e.target.value)}
                                    maxLength={4}
                                    style={{ padding: "0.75rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "white" }}
                                />
                            </div>
                         </div>
                    )}

                    {status === "error" && (
                        <div style={{ padding: "1rem", background: "rgba(239, 68, 68, 0.1)", color: "#fca5a5", borderRadius: "8px", display: "flex", gap: "0.5rem", alignItems: "center" }}>
                            <AlertCircle size={20} />
                            <span>{errorMessage}</span>
                        </div>
                    )}

                    <button 
                        onClick={handlePayment} 
                        disabled={isProcessingCard}
                        className={styles.planButtonPrimary} 
                        style={{ marginTop: "1rem", width: "100%", padding: "1rem", fontSize: "1.1rem", opacity: isProcessingCard ? 0.7 : 1 }}
                    >
                        {isProcessingCard ? <Loader2 className="animate-spin" /> : `Pay ${amount}`}
                    </button>
                </div>
            ) : status === "loading" ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "300px", gap: "1rem" }}>
                    <Loader2 size={48} className="animate-spin" />
                    <p style={{ color: "rgba(255,255,255,0.6)" }}>Processing request...</p>
                </div>
            ) : status === "success" && chargeData ? (
                 <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                    <div style={{ textAlign: "center", marginBottom: "1rem" }}>
                        <div style={{ display: "inline-flex", padding: "1rem", background: "rgba(34, 197, 94, 0.1)", borderRadius: "50%", marginBottom: "1rem" }}>
                            <CheckCircle size={32} color="#4ade80" />
                        </div>
                        <h2 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Order Created</h2>
                        <p style={{ color: "rgba(255,255,255,0.6)" }}>Complete payment to upgrade.</p>
                    </div>

                    {paymentMethod === "gopay" && chargeData.qr_code_url && (
                        <div style={{ textAlign: "center", background: "white", padding: "1.5rem", borderRadius: "16px" }}>
                            <img src={chargeData.qr_code_url} alt="QRIS Code" style={{ maxWidth: "100%", height: "auto", display: "block", margin: "0 auto" }} />
                            <p style={{ color: "black", marginTop: "1rem", fontSize: "0.9rem" }}>Scan with Gojek or any QRIS app</p>
                        </div>
                    )}

                    {paymentMethod === "gopay" && chargeData.deeplink_url && (
                        <a 
                            href={chargeData.deeplink_url} 
                            target="_blank" 
                            rel="noreferrer"
                            className={styles.planButtonPrimary}
                            style={{ textAlign: "center", display: "block", textDecoration: "none" }}
                        >
                            Open Gojek App
                        </a>
                    )}

                    {paymentMethod === "bank_transfer" && chargeData.va_numbers && (
                         <div style={{ padding: "1.5rem", background: "rgba(255,255,255,0.1)", borderRadius: "16px" }}>
                            <p style={{ color: "rgba(255,255,255,0.6)", marginBottom: "0.5rem", textTransform: "uppercase", fontSize: "0.85rem" }}>
                                {chargeData.va_numbers[0].bank} Virtual Account
                            </p>
                            <div style={{ fontSize: "1.75rem", fontFamily: "monospace", fontWeight: 600, letterSpacing: "1px" }}>
                                {chargeData.va_numbers[0].va_number}
                            </div>
                            <p style={{ marginTop: "1rem", fontSize: "0.9rem", opacity: 0.8 }}>
                                Transfer the exact amount to this number.
                            </p>
                         </div>
                    )}
                    
                    {/* For credit card, we usually redirect immediately. If we are here, something might have paused or it's a non-3DS flow (rare) */}
                    {paymentMethod === "credit_card" && (
                         <div style={{ textAlign: "center" }}>
                            <p>Redirecting to 3DS Authentication...</p>
                            {chargeData.redirect_url && (
                                 <a href={chargeData.redirect_url} className={styles.planButtonPrimary} style={{ marginTop: "1rem", display: "inline-block" }}>
                                     Click here if not redirected
                                 </a>
                            )}
                         </div>
                    )}

                    <div style={{ marginTop: "2rem", textAlign: "center" }}>
                        <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.5)" }}>
                            We will email you once the payment is confirmed.
                        </p>
                        <button onClick={() => router.push("/dashboard")} className={styles.planButtonOutline} style={{ marginTop: "1rem", width: "100%" }}>
                            Return to Dashboard
                        </button>
                    </div>
                 </div>
            ) : null}
        </div>
    </div>
  );
}

export default function PaymentPage() {
    return (
        <div className={styles.page} style={{ overflowY: "hidden" }}>
            <div className={styles.particleBackground}>
                <div className={`${styles.starLayer} ${styles.starField}`} />
                <div className={`${styles.starLayer} ${styles.starField}`} data-variant="dense" />
            </div>
            <Suspense fallback={<div className={styles.shell}><Loader2 className="animate-spin" /></div>}>
                <PaymentContent />
            </Suspense>
        </div>
    );
}
