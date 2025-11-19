"use client";

import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";
import Script from "next/script";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRouter } from "next/navigation";
import {
  Brain,
  CalendarClock,
  Clock,
  Database,
  Headphones,
  Infinity as InfinityIcon,
  MessageSquare,
  Pin,
  Plus,
  Users,
  X,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import styles from "./page.module.css";

type FeatureItem = {
  label: string;
  icon: LucideIcon;
  variant?: "inherit";
  subtext?: string;
};

const FREE_FEATURES: FeatureItem[] = [
  { label: "Gray Lite only", icon: Zap },
  { label: "Limited daily messages", icon: MessageSquare },
  { label: "Short context memory per thread", icon: Pin },
  { label: "Premade proactivity routines only", icon: Clock },
  { label: "Community support forum", icon: Users },
];

const VOYAGER_FEATURES: FeatureItem[] = [
  {
    label: "Gray Base + model switcher",
    icon: Zap,
    subtext: "Gemini 3, Claude 4.5, Grok 4.1, GPT 5.1, DeepSeek V3.2, Kimi K2",
  },
  { label: "Expanded message limit (unlimited Gray Lite)", icon: MessageSquare },
  {
    label: "5× context memory per thread",
    icon: Pin,
    subtext: "Roughly five times Scout’s recall window",
  },
  { label: "Thinking mode toggle for longer reasoning", icon: Brain },
  { label: "Calendar, Gmail, Notion integrations", icon: CalendarClock },
  { label: "Discord ticket support + early feature flights", icon: Headphones },
  { label: "Everything in Scout", icon: Plus, variant: "inherit" },
];

const PIONEER_FEATURES: FeatureItem[] = [
  { label: "Gray Pro + expanded model catalog", icon: Zap },
  { label: "Expanded reasoning budget", icon: InfinityIcon },
  {
    label: "5× Voyager context + long-term pinning",
    icon: Pin,
    subtext: "Effectively uncapped context memory for daily reliance",
  },
  { label: "Calendar, Gmail, Notion integrations", icon: CalendarClock },
  { label: "Reference library (docs/files RAG)", icon: Database },
  { label: "Everything in Voyager", icon: Plus, variant: "inherit" },
];

const BILLING_CYCLES = [
  { id: "monthly", label: "Monthly" },
  { id: "annual", label: "Annual" },
];

const VOYAGER_PRICING = {
  monthly: { price: "$7", cadence: "month" },
  annual: { price: "$77", cadence: "year" },
} as const;

const PIONEER_PRICING = {
  monthly: { price: "$27", cadence: "month" },
  annual: { price: "$277", cadence: "year" },
} as const;

const PARTICLE_COUNT = 1300;
const SPHERE_RADIUS = 14.5;
const PARTICLE_RANDOMNESS = 2.8;
const ROTATION_SPEED = 0.00045;

function DepthParticles() {
  const pointsRef = useRef<any>(null);
  const { positions, colors } = useMemo(() => {
    const positionBuffer = new Float32Array(PARTICLE_COUNT * 3);
    const colorBuffer = new Float32Array(PARTICLE_COUNT * 3);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      const radius = SPHERE_RADIUS + (Math.random() - 0.5) * PARTICLE_RANDOMNESS;

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      positionBuffer.set([x, y, z], i * 3);
      const gray = 0.4 + Math.random() * 0.35;
      colorBuffer[i * 3] = gray;
      colorBuffer[i * 3 + 1] = gray;
      colorBuffer[i * 3 + 2] = gray;
    }

    return { positions: positionBuffer, colors: colorBuffer };
  }, []);

  useFrame(() => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += ROTATION_SPEED;
      pointsRef.current.rotation.x += ROTATION_SPEED * 0.4;
    }
  });

  return (
    <points ref={pointsRef as any}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={PARTICLE_COUNT}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          array={colors}
          count={PARTICLE_COUNT}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        vertexColors
        size={0.08}
        sizeAttenuation
        transparent
        opacity={0.85}
        depthWrite={false}
      />
    </points>
  );
}

function DepthParticleCanvas() {
  return (
    <Canvas
      className={styles.particleCanvas}
      camera={{ position: [0, 0, 26], fov: 46 }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={["#030205"]} />
      <fog attach="fog" args={["#020205", 8, 35]} />
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 15]} intensity={1.4} />
      <DepthParticles />
    </Canvas>
  );
}

interface PricingClientProps {
  storeId?: string;
  voyagerVariantId?: string;
  pioneerVariantId?: string;
}

export default function PricingClient({ storeId, voyagerVariantId, pioneerVariantId }: PricingClientProps) {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const router = useRouter();
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).createLemonSqueezy) {
      (window as any).createLemonSqueezy();
    }
  }, []);

  const { price: voyagerPrice, cadence: voyagerCadence } = VOYAGER_PRICING[billingCycle];
  const { price: pioneerPrice, cadence: pioneerCadence } = PIONEER_PRICING[billingCycle];
  const voyagerSavingsLabel = billingCycle === "annual" ? "Save $7" : undefined;
  const pioneerSavingsLabel = billingCycle === "annual" ? "Save $27" : undefined;
  
  const voyagerCheckoutHref = (storeId && voyagerVariantId) 
    ? `https://alignment.lemonsqueezy.com/buy/${voyagerVariantId}?embed=1&media=0&checkout[custom][billing_cycle]=${billingCycle}`
    : undefined;

  const pioneerCheckoutHref = (storeId && pioneerVariantId)
    ? `https://alignment.lemonsqueezy.com/buy/${pioneerVariantId}?embed=1&media=0&checkout[custom][billing_cycle]=${billingCycle}`
    : undefined;

  const handleDismiss = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/#pricing");
  }, [router]);

  return (
    <main className={styles.page}>
      <Script src="https://assets.lemonsqueezy.com/lemon.js" strategy="lazyOnload" />
      <div className={styles.particleBackground} aria-hidden="true">
        <DepthParticleCanvas />
      </div>
      <div className={styles.starField} aria-hidden="true">
        <div className={styles.starLayer} />
        <div className={styles.starLayer} data-variant="dense" />
      </div>
      <button type="button" className={styles.dismiss} onClick={handleDismiss}>
        <X size={18} aria-hidden="true" />
        <span className="sr-only">Close Gray plans</span>
      </button>
      <div className={styles.shell}>
        <div className={styles.inner}>
          <header className={styles.hero}>
            <h1 className={styles.heroTitle}>Plans built for longer, deeper reasoning</h1>
            <p className={styles.heroSubhead}>
              Choose the plan that matches how often you rely on Gray. Pay monthly or save when you
              commit annually.
            </p>
          </header>

          <div className={styles.billingControls}>
            <div className={styles.billingToggle} role="group" aria-label="Billing cadence">
              {BILLING_CYCLES.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setBillingCycle(id as "monthly" | "annual")}
                  data-active={billingCycle === id}
                >
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          <section className={styles.planGrid}>
            <article className={styles.planCard}>
              <div className={styles.cardBody}>
                <div className={styles.cardIntro}>
                  <header className={styles.cardHeader}>
                    <h2>Scout</h2>
                    <p>Test Gray Pulse Lite with a constrained reasoning budget, context, and preset automations.</p>
                  </header>
                  <div className={styles.priceBlock}>
                    <span className={styles.priceValue}>$0</span>
                    <span className={styles.priceMeta}>/ forever</span>
                  </div>
                </div>
                <ul className={styles.featureList}>
                  {FREE_FEATURES.map(({ label, icon: Icon, subtext }) => (
                    <li key={label}>
                      <Icon size={16} aria-hidden="true" />
                      <span className={styles.featureLabel}>
                        {label}
                        {subtext ? <span className={styles.featureSubtext}>{subtext}</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className={styles.cardFooter}>
                <button type="button" className={styles.planButton} disabled>
                  Current Plan
                </button>
              </div>
            </article>

            <article className={styles.planCard} data-variant="highlighted">
              <div className={styles.cardBody}>
                <div className={styles.cardIntro}>
                  <header className={styles.cardHeader}>
                    <h2>Voyager</h2>
                    <p>Unlock model switching, integrations, and customizable automations.</p>
                  </header>
                  <div className={styles.priceHeader}>
                    <div className={styles.priceBlock}>
                      <span className={styles.priceValue}>{voyagerPrice}</span>
                      <span className={styles.priceMeta}>/ {voyagerCadence}</span>
                    </div>
                    {voyagerSavingsLabel && (
                      <span className={styles.savingsInline}>{voyagerSavingsLabel}</span>
                    )}
                  </div>
                </div>
                <ul className={styles.featureList}>
                  {VOYAGER_FEATURES.map(({ label, icon: Icon, variant, subtext }) => (
                    <li key={label} data-variant={variant ?? undefined}>
                      <Icon size={16} aria-hidden="true" />
                      <span
                        className={
                          variant === "inherit" ? `${styles.featureLabel} ${styles.featureLabelInherit}` : styles.featureLabel
                        }
                      >
                        {label}
                        {subtext ? <span className={styles.featureSubtext}>{subtext}</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className={styles.cardFooter}>
                {voyagerCheckoutHref ? (
                  <a href={voyagerCheckoutHref} className={`${styles.planButton} ${styles.planButtonOutline} lemonsqueezy-button`}>
                    Upgrade to Voyager
                  </a>
                ) : (
                  <div className={`${styles.planButton} ${styles.planButtonOutline}`} aria-disabled="true">
                    Coming soon
                  </div>
                )}
              </div>
            </article>

            <article className={styles.planCard} data-variant="primary">
              <div className={styles.cardBody}>
                <div className={styles.cardIntro}>
                  <header className={styles.cardHeader}>
                    <h2>Pioneer</h2>
                    <p>Uncapped context, models, and proactive workflows for daily reliance.</p>
                  </header>
                  <div className={styles.priceHeader}>
                    <div className={styles.priceBlock}>
                      <span className={styles.priceValue}>{pioneerPrice}</span>
                      <span className={styles.priceMeta}>/ {pioneerCadence}</span>
                    </div>
                    {pioneerSavingsLabel && (
                      <span className={styles.savingsInline}>{pioneerSavingsLabel}</span>
                    )}
                  </div>
                </div>
                <ul className={styles.featureList}>
                  {PIONEER_FEATURES.map(({ label, icon: Icon, variant, subtext }) => (
                    <li key={label} data-variant={variant ?? undefined}>
                      <Icon size={16} aria-hidden="true" />
                      <span
                        className={
                          variant === "inherit" ? `${styles.featureLabel} ${styles.featureLabelInherit}` : styles.featureLabel
                        }
                      >
                        {label}
                        {subtext ? <span className={styles.featureSubtext}>{subtext}</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className={styles.cardFooter}>
                {pioneerCheckoutHref ? (
                  <a href={pioneerCheckoutHref} className={`${styles.planButton} ${styles.planButtonPrimary} lemonsqueezy-button`}>
                    Upgrade to Pioneer
                  </a>
                ) : (
                   <div className={`${styles.planButton} ${styles.planButtonPrimary}`} aria-disabled="true">
                    Coming soon
                  </div>
                )}
              </div>
            </article>
          </section>
          <p className={styles.disclaimer}>
            *Usage limits apply. Prices shown don’t include applicable tax.
          </p>
        </div>
      </div>
    </main>
  );
}
