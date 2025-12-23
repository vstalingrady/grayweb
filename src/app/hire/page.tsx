import type { Metadata } from "next";
import { headers } from "next/headers";
import MarketingFooter from "@/app/components/MarketingFooter";
import MarketingStyles from "@/app/components/MarketingStyles";
import Navigation from "@/app/components/Navigation";
import { resolveTryGrayUrl } from "@/lib/grayCta";
import HireHero from "./HireHero";

export const metadata: Metadata = {
  title: { absolute: "Hire" },
  description: "Alignment is hiring CTO and CMO co-founders to build Gray.",
  openGraph: {
    title: "Hire",
    description: "Alignment is hiring CTO and CMO co-founders to build Gray.",
    url: "/hire",
    type: "website",
    images: [
      {
        url: "/thumbnail.png",
        alt: "Hire at Gray",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Hire",
    description: "Alignment is hiring CTO and CMO co-founders to build Gray.",
    images: ["/thumbnail.png"],
  },
  alternates: {
    canonical: "/hire",
  },
};

export default async function HirePage() {
  const host = (await headers()).get("host") ?? "";
  const tryGrayUrl = resolveTryGrayUrl(host);

  return (
    <>
      <MarketingStyles />
      <div className="page-root">
        <Navigation defaultHidden />
        <main>
          <HireHero />
        </main>
        <MarketingFooter tryGrayUrl={tryGrayUrl} />
      </div>
    </>
  );
}
