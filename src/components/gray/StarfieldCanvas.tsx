import { useEffect, useMemo, useRef } from "react";

type StarfieldCanvasProps = {
  className?: string;
  density?: number;
  maxStars?: number;
  minStars?: number;
  speed?: number;
  color?: string;
  orbitMode?: boolean;
};

type Star = {
  angle: number;
  orbitRadius: number;
  angularSpeed: number;
  radius: number;
  baseAlpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
};

const DEFAULT_COLOR = "255, 255, 255";

const prefersReducedMotion = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

const randomBetween = (min: number, max: number): number => {
  return min + Math.random() * (max - min);
};

const parseRgbTriplet = (color?: string): string => {
  const trimmed = (color ?? "").trim();
  if (!trimmed) {
    return DEFAULT_COLOR;
  }
  const normalized = trimmed.replace(/^rgba?\(|\)$/g, "").trim();
  const parts = normalized.split(",").map((part) => Number.parseFloat(part.trim()));
  if (parts.length < 3 || parts.slice(0, 3).some((value) => Number.isNaN(value))) {
    return DEFAULT_COLOR;
  }
  const [red, green, blue] = parts as [number, number, number];
  return `${clamp(red, 0, 255)}, ${clamp(green, 0, 255)}, ${clamp(blue, 0, 255)}`;
};

export function StarfieldCanvas({
  className,
  density = 0.00012,
  maxStars = 160,
  minStars = 24,
  speed = 18,
  color,
  orbitMode = false,
}: StarfieldCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rgbTriplet = useMemo(() => parseRgbTriplet(color), [color]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const reducedMotion = prefersReducedMotion();
    const stars: Star[] = [];
    const state = {
      width: 0,
      height: 0,
      devicePixelRatio: 1,
      animationFrameId: 0 as number | 0,
      lastTimestamp: 0,
    };

    const resizeToParent = (width: number, height: number) => {
      const nextWidth = Math.max(1, Math.floor(width));
      const nextHeight = Math.max(1, Math.floor(height));
      const nextDpr = clamp(window.devicePixelRatio || 1, 1, 2);

      if (state.width === nextWidth && state.height === nextHeight && state.devicePixelRatio === nextDpr) {
        return;
      }

      state.width = nextWidth;
      state.height = nextHeight;
      state.devicePixelRatio = nextDpr;

      canvas.width = Math.floor(nextWidth * nextDpr);
      canvas.height = Math.floor(nextHeight * nextDpr);
      canvas.style.width = `${nextWidth}px`;
      canvas.style.height = `${nextHeight}px`;

      context.setTransform(nextDpr, 0, 0, nextDpr, 0, 0);
      stars.length = 0;

      const area = nextWidth * nextHeight;
      const targetStars = clamp(Math.round(area * density), minStars, maxStars);

      // Max orbit radius - use the distance from bottom-center to the farthest corner
      const maxOrbitRadius = Math.sqrt(Math.pow(nextWidth, 2) + Math.pow(nextHeight, 2));

      for (let index = 0; index < targetStars; index += 1) {
        const radius = randomBetween(0.6, 1.8);
        // Distribute stars at various orbit distances
        const orbitRadius = randomBetween(15, maxOrbitRadius * 0.9);
        // Angular speed varies inversely with orbit radius (like real planets)
        const angularSpeed = (speed * 0.015) / Math.sqrt(orbitRadius / 50);
        stars.push({
          angle: randomBetween(0, Math.PI * 2),
          orbitRadius,
          angularSpeed: randomBetween(angularSpeed * 0.6, angularSpeed * 1.4),
          radius,
          baseAlpha: randomBetween(0.35, 0.95),
          twinkleSpeed: randomBetween(0.8, 2.2),
          twinklePhase: randomBetween(0, Math.PI * 2),
        });
      }
    };

    const render = (timestamp: number) => {
      if (document.hidden) {
        state.lastTimestamp = timestamp;
        state.animationFrameId = window.requestAnimationFrame(render);
        return;
      }

      const dtSeconds = state.lastTimestamp ? clamp((timestamp - state.lastTimestamp) / 1000, 0, 0.05) : 0;
      state.lastTimestamp = timestamp;

      context.clearRect(0, 0, state.width, state.height);

      // Orbit center is at bottom-center of the canvas
      const centerX = state.width / 2;
      const centerY = state.height + 20; // Slightly below the canvas

      for (const star of stars) {
        if (orbitMode && !reducedMotion) {
          star.angle += star.angularSpeed * dtSeconds;
        }

        // Calculate position based on orbit
        const x = centerX + Math.cos(star.angle) * star.orbitRadius;
        const y = centerY + Math.sin(star.angle) * star.orbitRadius;

        // Only render if within canvas bounds (with some padding)
        if (x >= -5 && x <= state.width + 5 && y >= -5 && y <= state.height + 5) {
          const twinkle = 0.55 + 0.45 * Math.sin(timestamp / 1000 * star.twinkleSpeed + star.twinklePhase);
          const alpha = clamp(star.baseAlpha * twinkle, 0.1, 0.98);
          context.fillStyle = `rgba(${rgbTriplet}, ${alpha})`;
          context.beginPath();
          context.arc(x, y, star.radius, 0, Math.PI * 2);
          context.fill();
        }
      }

      state.animationFrameId = window.requestAnimationFrame(render);
    };

    const handleResize = () => {
      const parent = canvas.parentElement;
      if (!parent) {
        return;
      }
      const rect = parent.getBoundingClientRect();
      resizeToParent(rect.width, rect.height);
    };

    handleResize();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => handleResize());
      const parent = canvas.parentElement;
      if (parent) {
        resizeObserver.observe(parent);
      }
    } else {
      window.addEventListener("resize", handleResize);
    }

    state.animationFrameId = window.requestAnimationFrame(render);

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener("resize", handleResize);
      }
      if (state.animationFrameId) {
        window.cancelAnimationFrame(state.animationFrameId);
      }
    };
  }, [density, maxStars, minStars, speed, rgbTriplet, orbitMode]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
