"use client";

import React, { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import styles from "./DepthParticleBackground.module.css";

const PARTICLE_COUNT = 2500;
const SPHERE_RADIUS = 30;
const PARTICLE_RANDOMNESS = 2.8;
const ROTATION_SPEED = 0.00045;

function createSeededRandom(seed: number) {
  let value = seed;
  return () => {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function DepthParticles() {
  const pointsRef = useRef<THREE.Points>(null);

  const { positions, colors } = useMemo(() => {
    const random = createSeededRandom(1337);
    const positionBuffer = new Float32Array(PARTICLE_COUNT * 3);
    const colorBuffer = new Float32Array(PARTICLE_COUNT * 3);

    for (let index = 0; index < PARTICLE_COUNT; index++) {
      const phi = Math.acos(2 * random() - 1);
      const theta = random() * Math.PI * 2;
      const radius = SPHERE_RADIUS + (random() - 0.5) * PARTICLE_RANDOMNESS;

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      positionBuffer.set([x, y, z], index * 3);

      const gray = 0.4 + random() * 0.35;
      colorBuffer.set([gray, gray, gray], index * 3);
    }

    return { positions: positionBuffer, colors: colorBuffer };
  }, []);

  useFrame(() => {
    const points = pointsRef.current;
    if (!points) return;

    points.rotation.y += ROTATION_SPEED;
    points.rotation.x += ROTATION_SPEED * 0.4;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes.position"
          array={positions}
          count={PARTICLE_COUNT}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes.color"
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

export function DepthParticleBackground() {
  return (
    <div className={styles.particleBackground} aria-hidden="true">
      <Canvas
        className={styles.particleCanvas}
        camera={{ position: [0, 0, 45], fov: 46 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={["#030205"]} />
        <fog attach="fog" args={["#020205", 8, 55]} />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 15]} intensity={1.4} />
        <DepthParticles />
      </Canvas>
    </div>
  );
}
