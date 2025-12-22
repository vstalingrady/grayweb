 "use client";

import React from "react";
import Navigation from "./Navigation";
import HeroSection from "./HeroSection";
import MarketingFooter from "./MarketingFooter";

type MarketingLandingProps = {
    tryGrayUrl: string;
};

export default function MarketingLanding({ tryGrayUrl }: MarketingLandingProps) {
    return (
        <>
            <div className="page-root">
                <Navigation />
                <HeroSection />
                <MarketingFooter tryGrayUrl={tryGrayUrl} />
            </div>
        </>
    );
}
