import React from "react";
import Image from "next/image";
import Navigation from "./Navigation";
import HeroSection from "./HeroSection";
import ComparisonDiagram from "./ComparisonDiagram";
import FooterBackground from "./FooterBackground";
import MarketingStyles from "./MarketingStyles";

type MarketingLandingProps = {
    tryGrayUrl: string;
};

const socialLinks = [
    { label: "X", href: "https://x.com/alignmentlab", logo: "/logos/xwhite.svg" },
    { label: "YouTube", href: "https://youtube.com/@alignmentlab", logo: "/logos/youtubewhite.svg" },
    { label: "Instagram", href: "https://instagram.com/alignmentlab", logo: "/logos/instagramwhite.svg" },
    { label: "Discord", href: "https://discord.gg/alignment", logo: "/logos/discordwhite.svg" },
];

export default function MarketingLanding({ tryGrayUrl }: MarketingLandingProps) {
    return (
        <>
            <MarketingStyles />
            <div className="page-root">
                <Navigation />
                <HeroSection />
                <ComparisonDiagram />
                <footer id="contact" className="site-footer">
                    <FooterBackground />
                    <div className="site-footer__overlay">
                        <div className="site-footer__grid">
                            <div className="site-footer__column">
                                <p className="site-footer__column-title">Products</p>
                                <a href={tryGrayUrl} className="site-footer__column-link" target="_blank" rel="noreferrer">
                                    Gray
                                </a>
                            </div>
                            <div className="site-footer__column">
                                <p className="site-footer__column-title">Research</p>
                                <span className="site-footer__column-note">Coming soon</span>
                            </div>
                            <div className="site-footer__column">
                                <p className="site-footer__column-title">Contact</p>
                                <a href="mailto:hi@alignment.id" className="site-footer__column-link">
                                    hi@alignment.id
                                </a>
                            </div>
                        </div>
                        <div className="site-footer__grid site-footer__grid--secondary">
                            <div className="site-footer__column site-footer__column-stack">
                                <p className="site-footer__column-title">Policies</p>
                                <a href="/policies/tos" className="site-footer__column-link">
                                    Terms of Service
                                </a>
                                <a href="/policies/privacy" className="site-footer__column-link">
                                    Privacy Policy
                                </a>
                                <a href="/policies/refund" className="site-footer__column-link">
                                    Refund Policy
                                </a>
                            </div>
                            <div className="site-footer__column">
                                <p className="site-footer__column-title">Blog</p>
                                <span className="site-footer__column-note">Coming soon</span>
                            </div>
                        </div>
                        <div className="site-footer__social-row">
                            <div className="site-footer__social-links">
                                {socialLinks.map(({ label, href, logo }) => (
                                    <a
                                        key={label}
                                        href={href}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="site-footer__social-link"
                                    >
                                        <Image src={logo} alt="" width={18} height={18} className="site-footer__social-icon" />
                                        <span className="sr-only">{label}</span>
                                    </a>
                                ))}
                            </div>
                            <p className="site-footer__meta">© {new Date().getFullYear()} Alignment. All rights reserved.</p>
                            <button type="button" className="site-footer__language">
                                <span>English</span>
                                <span className="site-footer__language-region">United States</span>
                            </button>
                        </div>
                    </div>
                </footer>
            </div>
        </>
    );
}
