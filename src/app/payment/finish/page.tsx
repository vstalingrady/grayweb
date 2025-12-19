"use client";

import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle, AlertCircle, ArrowRight } from "lucide-react";
import styles from "../payment.module.css";
// We reuse the same module for consistent "Star Field" and card look.

function FinishContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const orderId = searchParams.get("order_id");
    const status = searchParams.get("status");
    const isSuccess = !status || status === "success" || status === "active";
    const statusTitle = isSuccess ? "Payment Finished" : "Payment Failed";
    const statusSubtitle = isSuccess
        ? (orderId ? `Order ID: ${orderId}` : "Thank you for your purchase.")
        : (orderId ? `Order ID: ${orderId}` : "We couldn't complete your payment.");

    return (
        <div className={styles.page}>
            <div className={styles.particleBackground}>
                <div className={styles.starLayer} />
            </div>

            <div className={styles.container} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "400px", height: "auto", textAlign: "center", gap: "1.5rem" }}>
                <div style={{ padding: "1.5rem", background: isSuccess ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.12)", borderRadius: "50%" }}>
                    {isSuccess ? <CheckCircle size={64} color="#4ade80" /> : <AlertCircle size={64} color="#f87171" />}
                </div>

                <div>
                    <h1 className={styles.title} style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>{statusTitle}</h1>
                    <p className={styles.subtitle}>
                        {statusSubtitle}
                    </p>
                </div>

                <div className={styles.summaryBox} style={{ width: "100%", maxWidth: "400px", marginTop: "1rem" }}>
                    <p style={{ color: "rgba(255,255,255,0.8)", margin: 0 }}>
                        {isSuccess
                            ? "Your transaction is being processed. You will receive a confirmation email shortly."
                            : "Please try again or contact support if the issue continues."}
                    </p>
                </div>

                <button
                    onClick={() => router.push("/")}
                    className={styles.payButton}
                    style={{ width: "auto", paddingLeft: "2rem", paddingRight: "2rem", marginTop: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}
                >
                    Return to Dashboard <ArrowRight size={20} />
                </button>
            </div>
        </div>
    );
}

export default function PaymentFinishPage() {
    return (
        <Suspense fallback={<div style={{ color: "white" }}>Loading...</div>}>
            <FinishContent />
        </Suspense>
    );
}
