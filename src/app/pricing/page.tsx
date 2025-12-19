import type { Metadata } from "next";
import PricingClientWrapper from "./PricingClientWrapper";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Compare Gray plans and pick the AI mentor tier that fits your daily alignment and accountability.",
  alternates: {
    canonical: "/pricing",
  },
};

export default function PricingPage() {
  return <PricingClientWrapper />;
}
