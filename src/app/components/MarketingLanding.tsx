 "use client";

import React from "react";
import Image from "next/image";
import Navigation from "./Navigation";
import HeroSection from "./HeroSection";
import FooterBackground from "./FooterBackground";
import { useI18n } from "@/contexts/I18nContext";

type MarketingLandingProps = {
    tryGrayUrl: string;
};

const socialLinks = [
    { label: "X", href: "https://x.com/alignmentid", logo: "/logos/xwhite.svg" },
    { label: "YouTube", href: "https://youtube.com/@alignmentid", logo: "/logos/youtubewhite.svg" },
    { label: "Instagram", href: "https://instagram.com/alignmentid", logo: "/logos/instagramwhite.svg" },
    { label: "Discord", href: "https://discord.gg/sE4CSm4wWQ", logo: "/logos/discordwhite.svg" },
];

export default function MarketingLanding({ tryGrayUrl }: MarketingLandingProps) {
    const { t, locale, setLocale } = useI18n();
    const languageLabel = locale === "id" ? t("Indonesian") : t("English");
    const regionLabel = locale === "id" ? "Indonesia" : t("United States");
    const toggleLanguage = () => setLocale(locale === "en" ? "id" : "en");
    return (
        <>
            <div className="page-root">
                <Navigation />
                <HeroSection />
                <footer id="contact" className="site-footer">
                    <FooterBackground />
                    <div className="site-footer__overlay">
                        <div className="site-footer__grid">
                            <div className="site-footer__column">
                                <p className="site-footer__column-title">{t("Products")}</p>
                                <a href={tryGrayUrl} className="site-footer__column-link" target="_blank" rel="noreferrer">
                                    Gray
                                </a>
                            </div>
                            <div className="site-footer__column">
                                <p className="site-footer__column-title">{t("Research")}</p>
                                <span className="site-footer__column-note">{t("Coming soon")}</span>
                            </div>
                            <div className="site-footer__column">
                                <p className="site-footer__column-title">{t("Contact")}</p>
                                <a href="mailto:hi@alignment.id" className="site-footer__column-link">
                                    hi@alignment.id
                                </a>
                            </div>
                        </div>
                        <div className="site-footer__grid site-footer__grid--secondary">
                            <div className="site-footer__column site-footer__column-stack">
                                <p className="site-footer__column-title">{t("Policies")}</p>
                                <a href="/policies/tos" className="site-footer__column-link">
                                    {t("Terms of Service")}
                                </a>
                                <a href="/policies/privacy" className="site-footer__column-link">
                                    {t("Privacy Policy")}
                                </a>
                                <a href="/policies/refund" className="site-footer__column-link">
                                    {t("Refund Policy")}
                                </a>
                            </div>
                            <div className="site-footer__column">
                                <p className="site-footer__column-title">{t("Blog")}</p>
                                <span className="site-footer__column-note">{t("Coming soon")}</span>
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
                            <p className="site-footer__meta">
                                {t("© {year} Alignment. All rights reserved.", { year: new Date().getFullYear() })}
                            </p>
                            <button type="button" className="site-footer__language" onClick={toggleLanguage}>
                                <span>{languageLabel}</span>
                                <span className="site-footer__language-region">{regionLabel}</span>
                            </button>
                        </div>
                    </div>
                </footer>
            </div>
        </>
    );
}
