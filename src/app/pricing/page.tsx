import React from "react";
import PricingClient from "./PricingClient";

export default function PricingPage() {
  const storeId = process.env.LEMONSQUEEZY_STORE_ID;
  const voyagerVariantId = process.env.LEMONSQUEEZY_VOYAGER;
  const pioneerVariantId = process.env.LEMONSQUEEZY_PIONEER;

  return (
    <PricingClient 
      storeId={storeId} 
      voyagerVariantId={voyagerVariantId} 
      pioneerVariantId={pioneerVariantId} 
    />
  );
}