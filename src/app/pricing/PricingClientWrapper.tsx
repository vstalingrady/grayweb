"use client";

import dynamic from "next/dynamic";
import React from "react";

const PricingClient = dynamic(() => import("./PricingClient"), {
  ssr: false,
  // lightweight loader to avoid blank flashes while the R3F bundle hydrates
  loading: () => <div style={{ minHeight: "60vh" }} />,
});

export default function PricingClientWrapper() {
  return <PricingClient />;
}
