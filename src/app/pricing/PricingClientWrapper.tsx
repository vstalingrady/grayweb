"use client";

import dynamic from "next/dynamic";
import React from "react";

const PricingClient = dynamic(() => import("./PricingClient"), {
  ssr: false,
  // lightweight loader to avoid blank flashes while the R3F bundle hydrates
  loading: () => <div style={{ minHeight: "60vh" }} />,
});

interface PricingClientWrapperProps {
  storeId?: string;
  voyagerVariantId?: string;
  pioneerVariantId?: string;
}

export default function PricingClientWrapper(props: PricingClientWrapperProps) {
  return <PricingClient {...props} />;
}
