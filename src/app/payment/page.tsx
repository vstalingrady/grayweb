"use client";

import dynamic from "next/dynamic";
import React from "react";

const PaymentContent = dynamic(() => import("./PaymentContent"), {
    ssr: false,
    // lightweight loader to avoid blank flashes while the R3F bundle hydrates
    loading: () => <div style={{ minHeight: "60vh", background: "#030205" }} />,
});

export default function PaymentPage() {
    return <PaymentContent />;
}
