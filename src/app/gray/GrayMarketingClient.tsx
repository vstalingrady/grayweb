"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowRight,
  Brain,
  MessageSquare,
  Zap,
  Layout,
  Calendar,
  Mail,
  Clock,
  Shield,
  Menu,
  Check
} from "lucide-react";
import { motion } from "framer-motion";
import Navigation from "@/app/components/Navigation";
import FooterBackground from "@/app/components/FooterBackground";
import PerformanceChart from "./components/PerformanceChart";
import { DiagnosticModule } from "@/components/gray/DiagnosticModule";

const FeaturesGrid = dynamic(
  () => import("@/components/gray/FeaturesGrid").then((mod) => mod.FeaturesGrid),
  { ssr: false }
);

type GrayMarketingClientProps = {
  tryGrayUrl: string;
  storeId?: string;
  voyagerVariantId?: string;
  pioneerVariantId?: string;
};

export default function GrayMarketingClient({
  tryGrayUrl,
}: GrayMarketingClientProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showFinalCta, setShowFinalCta] = useState(false);

  useEffect(() => {
    // Defer the final CTA so the hero is the first thing rendered on mount.
    const timer = setTimeout(() => setShowFinalCta(true), 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 overflow-y-auto bg-black text-white selection:bg-zinc-800 selection:text-zinc-200 font-sans">
      <Navigation />

      {/* Hero Section */}
      <section className="pt-32 pb-20 md:pt-48 md:pb-32 px-4 md:px-6 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-zinc-900/50 blur-[120px] rounded-full -z-10" />

        <div className="container mx-auto max-w-7xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left">
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.1]"
              >
                Maximize human potential.
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="text-xl md:text-2xl text-zinc-400 mb-10 max-w-xl mx-auto lg:mx-0 leading-relaxed"
              >
                Gray checks in throughout your day, remembers your patterns, and calls you out when you're avoiding the hard thing. For ambitious builders who need structure, not another to-do app.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4"
              >
                <Link
                  href={tryGrayUrl}
                  className="w-full sm:w-auto px-8 py-4 bg-white text-black font-medium rounded-full hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 group"
                >
                  Start Free
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="w-full max-w-xl mx-auto lg:ml-auto relative z-10"
            >
              <PerformanceChart />
            </motion.div>
          </div>
        </div>
      </section>

      <DiagnosticModule />

      {/* Final CTA */}
      {showFinalCta && (
        <section className="py-32 px-4 md:px-6 text-center relative overflow-hidden bg-black">
          <div className="container mx-auto relative z-10">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">Stop planning. Start building.</h2>
            <p className="text-xl text-zinc-400 mb-10 max-w-2xl mx-auto">
              The best time to start was 2 years ago. The second best time is today.
            </p>
            <Link
              href={tryGrayUrl}
              className="inline-flex items-center justify-center px-10 py-5 bg-white text-black text-lg font-bold rounded-full hover:bg-zinc-200 transition-colors"
            >
              Start Free—No Credit Card Required
            </Link>

            <div className="mt-12 flex flex-wrap justify-center gap-8 text-sm text-zinc-500">
              <span className="flex items-center gap-2"><Check className="w-4 h-4" /> Free tier forever</span>
              <span className="flex items-center gap-2"><Check className="w-4 h-4" /> Cancel anytime</span>
              <span className="flex items-center gap-2"><Check className="w-4 h-4" /> Your data stays private</span>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
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
              <a
                href="https://x.com/alignmentlab"
                target="_blank"
                rel="noreferrer"
                className="site-footer__social-link"
              >
                <img src="/logos/xwhite.svg" alt="" className="site-footer__social-icon" />
                <span className="sr-only">X</span>
              </a>
              <a
                href="https://youtube.com/@alignmentlab"
                target="_blank"
                rel="noreferrer"
                className="site-footer__social-link"
              >
                <img src="/logos/youtubewhite.svg" alt="" className="site-footer__social-icon" />
                <span className="sr-only">YouTube</span>
              </a>
              <a
                href="https://instagram.com/alignmentlab"
                target="_blank"
                rel="noreferrer"
                className="site-footer__social-link"
              >
                <img src="/logos/instagramwhite.svg" alt="" className="site-footer__social-icon" />
                <span className="sr-only">Instagram</span>
              </a>
              <a
                href="https://discord.gg/alignment"
                target="_blank"
                rel="noreferrer"
                className="site-footer__social-link"
              >
                <img src="/logos/discordwhite.svg" alt="" className="site-footer__social-icon" />
                <span className="sr-only">Discord</span>
              </a>
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
  );
}
