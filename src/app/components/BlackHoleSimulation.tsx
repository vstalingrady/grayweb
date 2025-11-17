"use client";

import { useEffect, useRef } from "react";

type State = [number, number, number, number];

type TrailPoint = {
  x: number;
  y: number;
};

const SPEED_OF_LIGHT = 1.0;
const SCHWARZSCHILD_RADIUS = 1.0;
const LAMBDA_STEP = 0.02;
const SUB_STEPS = 3;
const TRAIL_LIMIT = 90;
const VIEW_RADIUS = 7.0; // measured in units of r_s
const NUM_RAYS = 140;
const SPAWN_X = -6.5; // units of r_s
const BEAM_SPREAD = 5.0; // total vertical spread in units of r_s

class Ray {
  x = 0;
  y = 0;
  r = 0;
  phi = 0;
  dr = 0;
  dphi = 0;
  E = 0;
  L = 0;
  active = false;
  trail: TrailPoint[] = [];
  readonly baseOffset: number;

  constructor(baseOffset: number) {
    this.baseOffset = baseOffset;
    this.reset();
  }

  reset(jitter = 0) {
    const y0 = this.baseOffset + jitter;
    this.x = SPAWN_X;
    this.y = y0;
    this.r = Math.hypot(this.x, this.y);
    this.phi = Math.atan2(this.y, this.x);

    // Launch rays mostly along +X with a slight tilt derived from the original C++ sample.
    const dirX = SPEED_OF_LIGHT;
    const dirY = y0 * 0.015;
    const safeR = Math.max(this.r, 1e-4);
    this.dr = dirX * Math.cos(this.phi) + dirY * Math.sin(this.phi);
    this.dphi = (-dirX * Math.sin(this.phi) + dirY * Math.cos(this.phi)) / safeR;
    this.L = this.r * this.r * this.dphi;

    const f = 1.0 - SCHWARZSCHILD_RADIUS / safeR;
    const denom = Math.max(f, 1e-4);
    const dt_dLambda = Math.sqrt(
      Math.max((this.dr * this.dr) / (denom * denom) + (this.r * this.r * this.dphi * this.dphi) / denom, 1e-8),
    );
    this.E = f * dt_dLambda;

    this.trail = [{ x: this.x, y: this.y }];
    this.active = Number.isFinite(this.r) && Number.isFinite(this.phi);
  }

  step(dLambda: number) {
    if (!this.active) {
      return;
    }

    if (this.r <= SCHWARZSCHILD_RADIUS * 1.02) {
      this.active = false;
      return;
    }

    const state: State = [this.r, this.phi, this.dr, this.dphi];

    const k1 = geodesicRHS(state, this);
    const k2 = geodesicRHS(addState(state, k1, dLambda / 2), this);
    const k3 = geodesicRHS(addState(state, k2, dLambda / 2), this);
    const k4 = geodesicRHS(addState(state, k3, dLambda), this);

    const next = state.map((value, index) => {
      const delta = (dLambda / 6) * (k1[index] + 2 * k2[index] + 2 * k3[index] + k4[index]);
      return value + delta;
    }) as State;

    const [rNext, phiNext, drNext, dphiNext] = next;
    if (!Number.isFinite(rNext) || rNext <= SCHWARZSCHILD_RADIUS * 1.001 || !Number.isFinite(phiNext)) {
      this.active = false;
      return;
    }

    this.r = rNext;
    this.phi = phiNext;
    this.dr = drNext;
    this.dphi = dphiNext;
    this.x = this.r * Math.cos(this.phi);
    this.y = this.r * Math.sin(this.phi);

    if (!Number.isFinite(this.x) || !Number.isFinite(this.y)) {
      this.active = false;
      return;
    }

    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > TRAIL_LIMIT) {
      this.trail.shift();
    }
  }
}

function geodesicRHS([r, , dr, dphi]: State, ray: Ray): State {
    if (r <= SCHWARZSCHILD_RADIUS) {
      return [0, 0, 0, 0];
    }

    const f = 1.0 - SCHWARZSCHILD_RADIUS / r;
    const safeF = Math.max(f, 1e-5);
    const dt_dLambda = ray.E / safeF;

    const rhs0 = dr;
    const rhs1 = dphi;
    const rhs2 =
      -((SCHWARZSCHILD_RADIUS / (2 * r * r)) * safeF * (dt_dLambda * dt_dLambda)) +
      (SCHWARZSCHILD_RADIUS / (2 * r * r * safeF)) * (dr * dr) +
      (r - SCHWARZSCHILD_RADIUS) * (dphi * dphi);
    const rhs3 = -2.0 * dr * dphi / Math.max(r, 1e-4);

    return [rhs0, rhs1, rhs2, rhs3];
}

function addState(base: State, delta: State, factor: number): State {
  return [
    base[0] + delta[0] * factor,
    base[1] + delta[1] * factor,
    base[2] + delta[2] * factor,
    base[3] + delta[3] * factor,
  ];
}

type Star = {
  x: number;
  y: number;
  brightness: number;
};

function createStarField(count: number): Star[] {
  return Array.from({ length: count }, () => ({
    x: Math.random(),
    y: Math.random(),
    brightness: 0.25 + Math.random() * 0.75,
  }));
}

function drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number, stars: Star[]) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#02040a");
  gradient.addColorStop(1, "#040916");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  for (const star of stars) {
    const px = star.x * width;
    const py = star.y * height;
    const intensity = star.brightness;
    ctx.globalAlpha = intensity;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(px, py, 0.7 + intensity * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawBlackHole(ctx: CanvasRenderingContext2D, scale: number, centerX: number, centerY: number) {
  const eventHorizon = SCHWARZSCHILD_RADIUS * scale;
  const photonSphere = (1.5 * SCHWARZSCHILD_RADIUS) * scale;
  const accretionOuter = photonSphere * 2.6;

  const diskGradient = ctx.createRadialGradient(centerX, centerY, eventHorizon, centerX, centerY, accretionOuter);
  diskGradient.addColorStop(0.0, "rgba(10, 5, 0, 0.0)");
  diskGradient.addColorStop(0.42, "rgba(255, 180, 40, 0.18)");
  diskGradient.addColorStop(0.75, "rgba(255, 110, 20, 0.05)");
  diskGradient.addColorStop(1.0, "rgba(0, 0, 0, 0.0)");

  ctx.fillStyle = diskGradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, accretionOuter, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 200, 120, 0.35)";
  ctx.lineWidth = Math.max(1, photonSphere * 0.05);
  ctx.beginPath();
  ctx.arc(centerX, centerY, photonSphere, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#050208";
  ctx.beginPath();
  ctx.arc(centerX, centerY, eventHorizon, 0, Math.PI * 2);
  ctx.fill();
}

function drawRays(
  ctx: CanvasRenderingContext2D,
  rays: Ray[],
  scale: number,
  centerX: number,
  centerY: number,
) {
  ctx.lineWidth = 1.2;
  ctx.lineCap = "round";

  for (const ray of rays) {
    if (!ray.active || ray.trail.length < 2) {
      continue;
    }

    const opacity = 0.2 + 0.6 * (ray.trail.length / TRAIL_LIMIT);
    const hue = 200 + Math.min(120, Math.abs(ray.baseOffset) * 25);
    ctx.strokeStyle = `hsla(${hue}, 80%, 70%, ${opacity.toFixed(3)})`;
    ctx.beginPath();

    const first = ray.trail[0];
    let point = worldToCanvas(first.x, first.y, scale, centerX, centerY);
    ctx.moveTo(point.x, point.y);

    for (let i = 1; i < ray.trail.length; i++) {
      const sample = ray.trail[i];
      point = worldToCanvas(sample.x, sample.y, scale, centerX, centerY);
      ctx.lineTo(point.x, point.y);
    }

    ctx.stroke();
  }
}

function worldToCanvas(x: number, y: number, scale: number, centerX: number, centerY: number) {
  return {
    x: centerX + x * scale,
    y: centerY - y * scale,
  };
}

const BlackHoleSimulation = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return undefined;
    }

    const stars = createStarField(160);
    const rays = Array.from({ length: NUM_RAYS }, (_, index) => {
      const t = NUM_RAYS > 1 ? index / (NUM_RAYS - 1) : 0.5;
      const offset = (t - 0.5) * BEAM_SPREAD;
      return new Ray(offset);
    });

    let animationFrame = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const { clientWidth, clientHeight } = canvas;
      canvas.width = Math.floor(clientWidth * dpr);
      canvas.height = Math.floor(clientHeight * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };

    const updateRay = (ray: Ray) => {
      for (let i = 0; i < SUB_STEPS; i++) {
        ray.step(LAMBDA_STEP);
        if (!ray.active) {
          break;
        }
      }

      const outOfBounds =
        !ray.active ||
        Math.abs(ray.x) > VIEW_RADIUS ||
        Math.abs(ray.y) > VIEW_RADIUS ||
        Math.hypot(ray.x, ray.y) > VIEW_RADIUS * 1.3;

      if (outOfBounds) {
        ray.reset((Math.random() - 0.5) * 0.15 * BEAM_SPREAD);
      }
    };

    resize();
    const frame = () => {
      rays.forEach(updateRay);

      const { clientWidth, clientHeight } = canvas;
      drawBackground(ctx, clientWidth, clientHeight, stars);

      const scale = Math.min(clientWidth, clientHeight) / (VIEW_RADIUS * 2.3);
      const centerX = clientWidth / 2;
      const centerY = clientHeight / 2;

      drawBlackHole(ctx, scale, centerX, centerY);
      drawRays(ctx, rays, scale, centerX, centerY);

      animationFrame = requestAnimationFrame(frame);
    };

    frame();
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="black-hole-canvas" role="img" aria-label="Simulated gravitational lensing around a black hole" />;
};

export default BlackHoleSimulation;
