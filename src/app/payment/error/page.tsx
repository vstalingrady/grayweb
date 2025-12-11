"use client";

import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, AlertCircle } from "lucide-react";
import styles from "../payment.module.css";

function ErrorContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const orderId = searchParams.get("order_id");
    const statusCode = searchParams.get("status_code");
    const statusMessage = searchParams.get("status_message");

    return (
        <div className={styles.page}>
            <div className={styles.particleBackground}>
                <div className={styles.starLayer} />
            </div>

            <div className={styles.container} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "400px", height: "auto", textAlign: "center", gap: "1.5rem" }}>
                <div style={{ padding: "1.5rem", background: "rgba(239, 68, 68, 0.1)", borderRadius: "50%" }}>
                    <AlertCircle size={64} color="#ef4444" />
                </div>

                <div>
                    <h1 className={styles.title} style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>Payment Failed</h1>
                    <p className={styles.subtitle}>
                        {statusMessage || "Something went wrong with your payment."}
                    </p>
                </div>

                <div className={styles.summaryBox} style={{ width: "100%", maxWidth: "400px", marginTop: "1rem" }}>
                    <p style={{ color: "rgba(255,255,255,0.8)", margin: 0 }}>
                        {orderId && <span style={{ display: "block", marginBottom: "0.5rem" }}>Order ID: {orderId}</span>}
                        {statusCode && <span style={{ display: "block", marginBottom: "0.5rem" }}>Error Code: {statusCode}</span>}
                        No charges were made. Please try again or contact support if the issue persists.
                    </p>
                </div>

                <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
                    <button
                        onClick={() => router.push("/pricing")}
                        className={styles.payButton}
                        style={{ width: "auto", paddingLeft: "2rem", paddingRight: "2rem", display: "flex", alignItems: "center", gap: "0.5rem" }}
                    >
                        <ArrowLeft size={20} /> Try Again
                    </button>
                    <button
                        onClick={() => router.push("/")}
                        className={styles.methodButton}
                        style={{ justifyContent: "center", paddingLeft: "2rem", paddingRight: "2rem" }}
                    >
                        Return Home
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function PaymentErrorPage() {
    return (
        <Suspense fallback={<div style={{ color: "white" }}>Loading...</div>}>
            <ErrorContent />
        </Suspense>
    );
}
