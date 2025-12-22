import type { Metadata } from "next";
import { headers } from "next/headers";
import MarketingFooter from "@/app/components/MarketingFooter";
import MarketingStyles from "@/app/components/MarketingStyles";
import Navigation from "@/app/components/Navigation";
import { resolveTryGrayUrl } from "@/lib/grayCta";
import HireHero from "./HireHero";

export const metadata: Metadata = {
  title: "Hire",
  description: "Gray is hiring for CTO and Marketing/Growth Co-Founder roles.",
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
        <Navigation />
        <main>
          <HireHero />
        </main>
        <MarketingFooter tryGrayUrl={tryGrayUrl} />
      </div>
    </>
  );
}
