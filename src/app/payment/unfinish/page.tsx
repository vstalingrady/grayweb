"use client";

import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Clock } from "lucide-react";
import styles from "../payment.module.css";

function UnfinishContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const orderId = searchParams.get("order_id");

    return (
        <div className={styles.page}>
            <div className={styles.particleBackground}>
                <div className={styles.starLayer} />
            </div>

            <div className={styles.container} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "400px", height: "auto", textAlign: "center", gap: "1.5rem" }}>
                <div style={{ padding: "1.5rem", background: "rgba(251, 191, 36, 0.1)", borderRadius: "50%" }}>
                    <Clock size={64} color="#fbbf24" />
                </div>

                <div>
                    <h1 className={styles.title} style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>Payment Incomplete</h1>
                    <p className={styles.subtitle}>
                        {orderId ? `Order ID: ${orderId}` : "Your payment was not completed."}
                    </p>
                </div>

                <div className={styles.summaryBox} style={{ width: "100%", maxWidth: "400px", marginTop: "1rem" }}>
                    <p style={{ color: "rgba(255,255,255,0.8)", margin: 0 }}>
                        You left before completing the payment. No charges were made. You can try again whenever you&apos;re ready.
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

export default function PaymentUnfinishPage() {
    return (
        <Suspense fallback={<div style={{ color: "white" }}>Loading...</div>}>
            <UnfinishContent />
        </Suspense>
    );
}
