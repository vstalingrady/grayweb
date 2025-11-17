/* @ts-nocheck */
"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Clock,
  Gift,
  Headphones,
  Infinity as InfinityIcon,
  MessageSquare,
  Pin,
  Users,
  Zap,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

import styles from "./page.module.css";

type FeatureItem = {
  label: string;
  icon: LucideIcon;
};

const FREE_FEATURES: FeatureItem[] = [
  { label: "2 depth chats per week", icon: MessageSquare },
  { label: "Standard reasoning window", icon: Clock },
  { label: "Community support", icon: Users },
];

const VOYAGER_FEATURES: FeatureItem[] = [
  { label: "5 depth chats per week", icon: MessageSquare },
  { label: "Extended reasoning window", icon: Clock },
  { label: "Priority inference queue", icon: Zap },
  { label: "Community support with early access", icon: Users },
];

const PIONEER_FEATURES: FeatureItem[] = [
  { label: "Unlimited depth conversations", icon: InfinityIcon },
  { label: "Priority inference window", icon: Zap },
  { label: "Long-term memory pinning", icon: Pin },
  { label: "1:1 support with the Gray team", icon: Headphones },
  { label: "Launch bonus: first sign-ups get two extra months free.", icon: Gift },
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
  monthly: { price: "$17", cadence: "month" },
  annual: { price: "$177", cadence: "year" },
} as const;

const PARTICLE_COUNT = 1300;
const SPHERE_RADIUS = 14.5;
const PARTICLE_RANDOMNESS = 2.8;
const ROTATION_SPEED = 0.00045;

// Disabled: DepthParticles - Three.js rendering has type issues
/*
function DepthParticles() {
  const pointsRef = useRef<any>(null);
  const { positions, colors } = useMemo(() => {
    const positionBuffer = new Float32Array(PARTICLE_COUNT * 3);
    const colorBuffer = new Float32Array(PARTICLE_COUNT * 3);
    const tmpColor = new THREE.Color();

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

  return React.createElement(
    "points" as any,
    { ref: pointsRef },
    React.createElement(
      "bufferGeometry",
      {},
      React.createElement("bufferAttribute", {
        attach: "attributes-position",
        array: positions,
        count: PARTICLE_COUNT,
        itemSize: 3,
      }),
      React.createElement("bufferAttribute", {
        attach: "attributes-color",
        array: colors,
        count: PARTICLE_COUNT,
        itemSize: 3,
      })
    ),
    React.createElement("pointsMaterial", {
      vertexColors: true,
      size: 0.08,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    })
  );
}
*/

// Disabled: DepthParticleCanvas - Three.js rendering has type issues
// function DepthParticleCanvas() {
//   return (
//     <Canvas
//       className={styles.particleCanvas}
//       camera={{ position: [0, 0, 26], fov: 46 }}
//       gl={{ antialias: true }}
//     >
//       <color attach="background" args={["#030205"]} />
//       <fog attach="fog" args={["#020205", 8, 35]} />
//       <ambientLight intensity={0.5} />
//       <pointLight position={[10, 10, 15]} intensity={1.4} />
//       <DepthParticles />
//     </Canvas>
//   );
// }

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const router = useRouter();

  const { price: voyagerPrice, cadence: voyagerCadence } = VOYAGER_PRICING[billingCycle];
  const { price: pioneerPrice, cadence: pioneerCadence } = PIONEER_PRICING[billingCycle];
  const voyagerSavingsLabel = billingCycle === "annual" ? "Save $7" : undefined;
  const pioneerSavingsLabel = billingCycle === "annual" ? "Save $27" : undefined;
  const voyagerCheckoutHref = `/checkout?plan=gray-voyager&cycle=${billingCycle}`;
  const pioneerCheckoutHref = `/checkout?plan=gray-depth&cycle=${billingCycle}`;
  const handleDismiss = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/#pricing");
  }, [router]);

  return (
    <main className={styles.page}>
      <div className={styles.particleBackground} aria-hidden="true">
        {/* Disabled: <DepthParticleCanvas /> - Three.js rendering has type issues */}
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
                    <p>Explore Gray at your own pace with a lightweight entry plan.</p>
                  </header>
                  <div className={styles.priceBlock}>
                    <span className={styles.priceValue}>$0</span>
                    <span className={styles.priceMeta}>/ forever</span>
                  </div>
                </div>
                <ul className={styles.featureList}>
                  {FREE_FEATURES.map(({ label, icon: Icon }) => (
                    <li key={label}>
                      <Icon size={16} aria-hidden="true" />
                      <span>{label}</span>
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
                    <p>Get extra chats and faster inference with a flexible mid-tier.</p>
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
                  {VOYAGER_FEATURES.map(({ label, icon: Icon }) => (
                    <li key={label}>
                      <Icon size={16} aria-hidden="true" />
                      <span>{label}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className={styles.cardFooter}>
                <Link href={voyagerCheckoutHref} className={`${styles.planButton} ${styles.planButtonOutline}`}>
                  Upgrade to Voyager
                </Link>
              </div>
            </article>

            <article className={styles.planCard} data-variant="primary">
              <div className={styles.cardBody}>
                <div className={styles.cardIntro}>
                  <header className={styles.cardHeader}>
                    <h2>Pioneer</h2>
                    <p>All the depth you need, whenever you need it.</p>
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
                  {PIONEER_FEATURES.map(({ label, icon: Icon }) => (
                    <li key={label}>
                      <Icon size={16} aria-hidden="true" />
                      <span>{label}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className={styles.cardFooter}>
                <Link href={pioneerCheckoutHref} className={`${styles.planButton} ${styles.planButtonPrimary}`}>
                  Upgrade to Pioneer
                </Link>
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
