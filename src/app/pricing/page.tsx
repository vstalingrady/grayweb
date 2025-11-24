import PricingClientWrapper from "./PricingClientWrapper.tsx";

export default function PricingPage() {
  const storeId = process.env.LEMONSQUEEZY_STORE_ID;
  const voyagerVariantId = process.env.LEMONSQUEEZY_VOYAGER;
  const pioneerVariantId = process.env.LEMONSQUEEZY_PIONEER;

  return (
    <PricingClientWrapper
      storeId={storeId}
      voyagerVariantId={voyagerVariantId}
      pioneerVariantId={pioneerVariantId}
    />
  );
}
