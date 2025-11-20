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
              <ul className="space-y-4 text-zinc-400">
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
            <div className="p-8 bg-zinc-100 rounded-3xl border border-white/10 text-black relative overflow-hidden">
              <div className="absolute top-0 right-0 p-32 bg-gradient-to-br from-blue-500/20 to-purple-500/20 blur-3xl -z-10" />
              <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <Check className="w-5 h-5 text-green-600" />
                The Solution
              </h3>
              <p className="text-lg font-medium leading-relaxed">
                Gray gives you that system. An always-on mentor that notices when you slip, helps you get back on track, and pushes you to be your best self.
              </p>
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

      {/* Comparison Section */}
      <section className="py-24 bg-zinc-950 border-y border-zinc-900">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Not another productivity app.</h2>
            <p className="text-zinc-400">Gray is a coach, not a tool. It helps you BECOME better, not just DO more.</p>
          </div>

          <div className="overflow-x-auto max-w-5xl mx-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="py-4 px-6 text-zinc-500 font-medium">Feature</th>
                  <th className="py-4 px-6 text-white font-bold text-lg bg-zinc-900/50 rounded-t-xl">Gray</th>
                  <th className="py-4 px-6 text-zinc-500 font-medium">ChatGPT</th>
                  <th className="py-4 px-6 text-zinc-500 font-medium">Notion/Todoist</th>
                  <th className="py-4 px-6 text-zinc-500 font-medium">Therapy</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {[
                  ["Reaches out first", "✓", "✗", "✗", "Only weekly"],
                  ["Remembers your life", "Deep memory", "Basic", "Your responsibility", "Takes notes"],
                  ["Challenges you", "Yes", "Only if you ask", "Never", "Sometimes"],
                  ["Always available", "24/7", "24/7", "24/7", "1hr/week"],
                  ["Integrates with life", "Calendar, Gmail, Notion", "Limited", "Separate tools", "Separate"],
                  ["Price", "$17/mo", "$20/mo", "$8-15/mo", "$200+/session"]
                ].map(([feature, gray, gpt, tools, therapy], i) => (
                  <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-900/20 transition-colors">
                    <td className="py-4 px-6 text-zinc-300 font-medium">{feature}</td>
                    <td className="py-4 px-6 text-white font-semibold bg-zinc-900/30">{gray}</td>
                    <td className="py-4 px-6 text-zinc-500">{gpt}</td>
                    <td className="py-4 px-6 text-zinc-500">{tools}</td>
                    <td className="py-4 px-6 text-zinc-500">{therapy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>



      {/* FAQ Section */}
      <section id="faq" className="py-24 px-4 md:px-6">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold mb-12 text-center">Frequently Asked Questions</h2>

          <div className="space-y-6">
            {[
              { q: "Is this therapy?", a: "No. Gray is a mentor/coach, not a therapist. If you need therapy, get therapy. Gray is for breaking paralysis and building momentum." },
              { q: "How is this different from ChatGPT?", a: "ChatGPT waits for you. Gray reaches out. ChatGPT has basic memory. Gray remembers everything. ChatGPT is a tool. Gray is a coach." },
              { q: "Will this work for ADHD/gifted burnout?", a: "Gray is built FOR the \"gifted and burnt out.\" It understands paralysis, pattern interrupts, and the emotional side of getting unstuck. Many users with ADHD find it helpful, but it's not a replacement for treatment." },
              { q: "What if I can't afford $17/month?", a: "The free tier (10 check-ins/day) is genuinely useful. If you're a student or facing financial hardship, email us for sliding scale pricing." },
              { q: "Do you sell my data?", a: "Never. Your conversations are private. We don't train models on your data. We don't sell to advertisers. Your potential is not a product." },
              { q: "Can I cancel anytime?", a: "Yes. No tricks, no dark patterns. Cancel in one click." }
            ].map((faq, i) => (
              <FAQItem key={i} question={faq.q} answer={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 px-4 md:px-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-zinc-900/50 pointer-events-none" />
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

function FAQItem({ question, answer }: { question: string, answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-zinc-800 rounded-xl bg-zinc-900/30 overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-6 text-left hover:bg-zinc-900/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="font-medium pr-4">{question}</span>
        {isOpen ? <ChevronUp className="w-5 h-5 text-zinc-400" /> : <ChevronDown className="w-5 h-5 text-zinc-400" />}
      </button>
      {isOpen && (
        <div className="px-6 pb-6 text-zinc-400 leading-relaxed">
          {answer}
        </div>
      )}
    </div>
  );
}
