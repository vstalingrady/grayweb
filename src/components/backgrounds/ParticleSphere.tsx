"use client"

import { useRef, useMemo } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import * as THREE from "three"
import styles from "./DepthParticleBackground.module.css"

const PARTICLE_COUNT = 1500
const PARTICLE_SIZE_MIN = 0.012
const PARTICLE_SIZE_MAX = 0.024
const SPHERE_RADIUS = 12
const POSITION_RANDOMNESS = 5.5
const ROTATION_SPEED_X = 0.0
const ROTATION_SPEED_Y = 0.0005
const PARTICLE_OPACITY = 1

// Seeded random function for deterministic particle generation
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

function Particles() {
    const groupRef = useRef<THREE.Group>(null)

    const particles = useMemo(() => {
        const random = createSeededRandom(42);
        const result = []

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            // Generate points on sphere surface with some random variation
            const phi = Math.acos(-1 + (2 * i) / PARTICLE_COUNT)
            const theta = Math.sqrt(PARTICLE_COUNT * Math.PI) * phi

            // Add random variation to make it more organic
            const radiusVariation = SPHERE_RADIUS + (random() - 0.5) * POSITION_RANDOMNESS

            const x = radiusVariation * Math.cos(theta) * Math.sin(phi)
            const y = radiusVariation * Math.cos(phi)
            const z = radiusVariation * Math.sin(theta) * Math.sin(phi)

            // Use grayscale colors for particles
            const gray = 0.4 + random() * 0.35;

            result.push({
                position: [x, y, z] as [number, number, number],
                scale: random() * (PARTICLE_SIZE_MAX - PARTICLE_SIZE_MIN) + PARTICLE_SIZE_MIN,
                color: new THREE.Color(gray, gray, gray),
            })
        }

        return result
    }, [])

    useFrame(() => {
        if (groupRef.current) {
            groupRef.current.rotation.y += ROTATION_SPEED_Y
            groupRef.current.rotation.x += ROTATION_SPEED_X
        }
    })

    return (
        <group ref={groupRef}>
            {particles.map((particle, index) => (
                <mesh key={index} position={particle.position} scale={particle.scale}>
                    <sphereGeometry args={[1, 8, 6]} />
                    <meshBasicMaterial color={particle.color} transparent opacity={PARTICLE_OPACITY} />
                </mesh>
            ))}
        </group>
    )
}

export function ParticleSphere() {
    return (
        <div
            className={styles.particleBackground}
            style={{ position: "fixed", inset: 0, zIndex: 0, opacity: 0.65, pointerEvents: "none" }}
            aria-hidden="true"
        >
            <Canvas
                className={styles.particleCanvas}
                style={{ width: "100vw", height: "100vh" }}
                camera={{ position: [0, 0, 20], fov: 50 }}
                gl={{ antialias: true }}
            >
                <color attach="background" args={["#030205"]} />
                <fog attach="fog" args={[0x020205, 8, 35]} />
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 15]} intensity={1.4} />
                <Particles />
            </Canvas>
        </div>
    )
}
