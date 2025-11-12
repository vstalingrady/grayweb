"use client"

import type React from "react"

import { MeshGradient } from "@paper-design/shaders-react"

import styles from "./shader-background.module.css"

interface ShaderBackgroundProps {
  children: React.ReactNode
  className?: string
  fullHeight?: boolean
}

export default function ShaderBackground({ children, className, fullHeight = true }: ShaderBackgroundProps) {
  const containerClassName = [styles.container, fullHeight ? styles.fullHeight : "", className ?? ""]
    .filter((token) => token)
    .join(" ")

  const sharedShaderProps = {
    minPixelRatio: 1,
    maxPixelCount: 1_800_000,
  }

  return (
    <div className={containerClassName}>
      {/* SVG Filters */}
      <svg className={styles.hiddenSvg}>
        <defs>
          <filter id="glass-effect" x="-50%" y="-50%" width="200%" height="200%">
            <feTurbulence baseFrequency="0.005" numOctaves="1" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.3" />
            <feColorMatrix
              type="matrix"
              values="1 0 0 0 0.02
                      0 1 0 0 0.02
                      0 0 1 0 0.05
                      0 0 0 0.9 0"
              result="tint"
            />
          </filter>
          <filter id="gooey-filter" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"
              result="gooey"
            />
            <feComposite in="SourceGraphic" in2="gooey" operator="atop" />
          </filter>
        </defs>
      </svg>

      {/* Background Shaders */}
      <MeshGradient
        className={styles.layer}
        colors={["#020202", "#101010", "#242424", "#3a3a3a", "#5c5c5c"]}
        speed={0.18}
        backgroundColor="#010101"
        {...sharedShaderProps}
      />
      <MeshGradient
        className={styles.wireframeLayer}
        colors={["#000000", "#1a1a1a", "#2f2f2f", "#5a5a5a"]}
        speed={0.12}
        wireframe
        backgroundColor="transparent"
        {...sharedShaderProps}
      />

      {children}
    </div>
  )
}
