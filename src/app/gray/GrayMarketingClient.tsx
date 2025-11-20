"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  X,
  Brain,
  MessageSquare,
  Zap,
  Layout,
  Calendar,
  Mail,
  Clock,
  Shield,
  Menu,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { motion } from "framer-motion";
import Navigation from "@/app/components/Navigation";
import FooterBackground from "@/app/components/FooterBackground";
import PerformanceChart from "./components/PerformanceChart";
import MockChatInterface from "@/app/components/MockChatInterface";

type GrayMarketingClientProps = {
  tryGrayUrl: string;
};

export default function GrayMarketingClient({
  tryGrayUrl,
}: GrayMarketingClientProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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

      {/* Problem Section */}
      <section className="py-24 bg-zinc-950 border-y border-zinc-900">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">You're stuck between knowing and doing.</h2>
            <p className="text-lg text-zinc-400">
              You know what you should do. You just can't seem to do it.
              Most people fail not because they're lazy, but because they lack the support system that makes success inevitable.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="p-8 bg-zinc-900/50 rounded-3xl border border-zinc-800/50">
              <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <X className="w-5 h-5 text-red-500" />
                The Problem
              </h3>
              <ul className="space-y-4 text-zinc-400 text-sm">
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-700 mt-2.5" />
                  No external accountability
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-700 mt-2.5" />
                  No one to call out your patterns
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-700 mt-2.5" />
                  No structure to keep you on track
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-700 mt-2.5" />
                  No mentor who deeply understands your context
                </li>
              </ul>
            </div>
            <div className="p-0 bg-zinc-900 rounded-3xl border border-zinc-800 text-white relative overflow-hidden flex flex-col min-h-[300px]">
              <div className="absolute top-0 right-0 p-32 bg-gradient-to-br from-blue-500/10 to-purple-500/10 blur-3xl -z-10" />
              <div className="p-8 pb-0">
                <h3 className="text-xl font-semibold mb-2 flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-500" />
                  The Solution
                </h3>
              </div>
              <div className="flex-1 relative">
                <MockChatInterface />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section id="how-it-works" className="py-24 px-4 md:px-6">
        <div className="container mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Gray doesn't wait for you to ask for help.</h2>
            <p className="text-lg text-zinc-400">
              A fundamentally different approach to productivity. Proactive, context-aware, and relentless.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              {
                icon: <MessageSquare className="w-6 h-6 text-blue-400" />,
                title: "Proactive Check-Ins",
                description: "Gray reaches out throughout your day—not to nag, but to connect.",
                examples: [
                  "Morning: \"What's the one thing that would make today a win?\"",
                  "Midday: \"You've been on YouTube for 45m. What are you avoiding?\"",
                  "Evening: \"Did you do what you said you would? Let's plan tomorrow.\""
                ]
              },
              {
                icon: <Brain className="w-6 h-6 text-purple-400" />,
                title: "Deep Memory",
                description: "Gray remembers everything. Your goals, your patterns, your excuses.",
                quote: "Remember last Tuesday when you thought you couldn't finish the assignment, but you did it in an hour? This is just like that."
              },
              {
                icon: <Zap className="w-6 h-6 text-yellow-400" />,
                title: "Strategic Guidance",
                description: "Gray doesn't just listen—it challenges you to think bigger.",
                examples: [
                  "\"You've been 'planning' for 3 weeks. What can you ship today?\"",
                  "\"What would you do if you couldn't fail?\"",
                  "\"How does scrolling Twitter serve your priority of Family?\""
                ]
              }
            ].map((feature, i) => (
              <div key={i} className="p-8 rounded-3xl bg-zinc-900/30 border border-zinc-800 hover:border-zinc-700 transition-colors">
                <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center mb-6 border border-zinc-800">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold mb-4">{feature.title}</h3>
                <p className="text-zinc-400 mb-6 leading-relaxed">{feature.description}</p>
                {feature.examples && (
                  <ul className="space-y-3">
                    {feature.examples.map((ex, j) => (
                      <li key={j} className="text-sm text-zinc-500 pl-3 border-l-2 border-zinc-800 italic">
                        {ex}
                      </li>
                    ))}
                  </ul>
                )}
                {feature.quote && (
                  <blockquote className="text-sm text-zinc-500 pl-3 border-l-2 border-zinc-800 italic">
                    "{feature.quote}"
                  </blockquote>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

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


