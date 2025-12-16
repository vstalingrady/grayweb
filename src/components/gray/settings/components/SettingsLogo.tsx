"use client";

import Image from "next/image";

export type SettingsLogoProps = {
  src: string;
  alt: string;
};

export function SettingsLogo({ src, alt }: SettingsLogoProps) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 22,
        height: 22,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 6,
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <Image
        src={src}
        alt={alt}
        width={18}
        height={18}
        style={{
          filter: "brightness(0.85) saturate(0.95)",
          opacity: 0.9,
        }}
      />
    </span>
  );
}
