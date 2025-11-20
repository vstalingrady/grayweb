"use client";

import React, { useCallback, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import styles from "./page.module.css";
import { PricingPlansSection } from "./PricingPlansSection";
import { useUser } from "@/contexts/UserContext";

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
  const router = useRouter();
  const { user } = useUser();

  const handleDismiss = useCallback(() => {
    router.push("/gray");
  }, [router]);

  return (
    <div className={styles.pricingPage}>
      <DepthParticleCanvas />
      <div className={styles.pricingPageContent}>
        <div className={styles.pricingContentInner}>
          <button
            type="button"
            className={styles.dismissButton}
            onClick={handleDismiss}
            aria-label="Close pricing page"
          >
            <X size={20} />
          </button>
          <PricingPlansSection
            storeId={storeId}
            voyagerVariantId={voyagerVariantId}
            pioneerVariantId={pioneerVariantId}
            userId={user?.id}
          />
        </div>
      </div>
    </div>
  );
}
