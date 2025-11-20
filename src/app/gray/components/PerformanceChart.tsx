"use client";

import { useEffect, useRef, useState, useMemo } from "react";

// Number of data points to show on screen
const POINTS_COUNT = 100;

export default function PerformanceChart() {
  const [data, setData] = useState<number[]>([]);
  const requestRef = useRef<number | null>(null);
  const frameRef = useRef(0);

  // Refs for "Trend" system - keeps the graph moving in one direction for longer
  const targetVelocityRef = useRef(0.1);
  const trendDurationRef = useRef(0);

  // Initialize data
  useEffect(() => {
    const initialData = [];
    let value = 100;
    let velocity = 0.1;

    // Pre-generate data with the same trend logic
    let currentTargetVel = 0.1;
    let currentTrendDur = 0;

    for (let i = 0; i < POINTS_COUNT; i++) {
      if (currentTrendDur <= 0) {
        // Pick a new trend every 20-50 points
        currentTrendDur = Math.floor(Math.random() * 30) + 20;
        // Mostly positive trends, but some dips
        currentTargetVel = 0.1 + (Math.random() * 0.6 - 0.2);
      }
      currentTrendDur--;

      // Smoothly interpolate to target
      velocity = velocity * 0.9 + currentTargetVel * 0.1;
      value += velocity;
      initialData.push(value);
    }
    setData(initialData);
  }, []);

  const updateData = () => {
    // Throttle: Only update every 2nd frame to slow it down
    frameRef.current++;
    if (frameRef.current % 2 !== 0) {
      requestRef.current = requestAnimationFrame(updateData);
      return;
    }

    setData((prevData) => {
      if (prevData.length === 0) return prevData;

      const lastValue = prevData[prevData.length - 1];
      const secondLastValue = prevData.length > 1 ? prevData[prevData.length - 2] : lastValue - 0.1;
      let currentVelocity = lastValue - secondLastValue;

      // Trend Logic:
      // Instead of changing direction every frame (too detailed),
      // we keep a target direction for a while (smooth curves).
      if (trendDurationRef.current <= 0) {
        // New trend duration: 30-60 frames (slow, sweeping moves)
        trendDurationRef.current = Math.floor(Math.random() * 30) + 30;

        // New target velocity:
        // Bias positive (+0.1 base), range [-0.1, +0.4]
        targetVelocityRef.current = 0.1 + (Math.random() * 0.5 - 0.2);
      }
      trendDurationRef.current--;

      // Apply inertia (very high smoothing)
      const newVelocity = currentVelocity * 0.92 + targetVelocityRef.current * 0.08;
      const newValue = lastValue + newVelocity;

      const newData = [...prevData.slice(1), newValue];
      return newData;
    });

    requestRef.current = requestAnimationFrame(updateData);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(updateData);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  // Calculate smooth path (Cubic Bezier)
  const { pathD, fillD } = useMemo(() => {
    if (data.length === 0) return { pathD: "", fillD: "" };

    const currentMin = Math.min(...data);
    const currentMax = Math.max(...data);

    const padding = (currentMax - currentMin) * 0.2; // More padding
    const yMin = currentMin - padding;
    const yMax = currentMax + padding;
    const yRange = yMax - yMin || 1;

    // Helper to get coordinate
    const getCoord = (index: number, value: number) => {
      const x = (index / (POINTS_COUNT - 1)) * 100;
      const normalizedY = (value - yMin) / yRange;
      const y = 100 - (normalizedY * 100);
      return [x, y];
    };

    // Generate Smooth Path (Catmull-Rom-like or simple cubic)
    let d = "";

    // Start point
    const [startX, startY] = getCoord(0, data[0]);
    d += `M ${startX.toFixed(2)},${startY.toFixed(2)}`;

    for (let i = 0; i < data.length - 1; i++) {
      const [p0x, p0y] = getCoord(Math.max(0, i - 1), data[Math.max(0, i - 1)]);
      const [p1x, p1y] = getCoord(i, data[i]);
      const [p2x, p2y] = getCoord(i + 1, data[i + 1]);
      const [p3x, p3y] = getCoord(Math.min(data.length - 1, i + 2), data[Math.min(data.length - 1, i + 2)]);

      // Cubic Bezier Control Points (Catmull-Rom to Bezier conversion)
      // cp1 = p1 + (p2 - p0) / 6
      // cp2 = p2 - (p3 - p1) / 6

      const cp1x = p1x + (p2x - p0x) / 6;
      const cp1y = p1y + (p2y - p0y) / 6;

      const cp2x = p2x - (p3x - p1x) / 6;
      const cp2y = p2y - (p3y - p1y) / 6;

      d += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2x.toFixed(2)},${p2y.toFixed(2)}`;
    }

    const fillPath = `${d} L 100,200 L 0,200 Z`;

    return { pathD: d, fillD: fillPath };
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="bg-black/30 rounded-[28px] border border-white/5 shadow-[0_25px_80px_rgba(0,0,0,0.65)] backdrop-blur p-6 h-[320px] w-full pointer-events-none" />
    );
  }

  return (
    <div
      className="bg-black/30 rounded-[28px] border border-white/40 backdrop-blur p-6 h-[320px] w-full pointer-events-none flex items-center justify-center overflow-hidden relative transition-all duration-700 ease-out"
      style={{
        transform: "perspective(1000px) rotateY(-12deg) rotateX(6deg) skewY(1deg)",
        // INTENSE neon glow: bright white border with aggressive multi-layer glow
        boxShadow: "25px 35px 60px -15px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(255,255,255,0.3), 0 0 4px rgba(255,255,255,0.6), 0 0 15px rgba(255,255,255,0.4), 0 0 35px rgba(255,255,255,0.3), 0 0 60px rgba(255,255,255,0.15)"
      }}
    >
      <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-white/5 to-transparent opacity-50" />
      <div className="absolute inset-0 w-full h-full">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="w-full h-full"
          style={{ overflow: 'visible' }}
        >
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="white" stopOpacity="0.15" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Area Fill */}
          <path
            d={fillD}
            fill="url(#chartGradient)"
            vectorEffect="non-scaling-stroke"
          />

          {/* Stroke Line */}
          <path
            d={pathD}
            fill="none"
            stroke="white"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            className="drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]"
          />
        </svg>
      </div>
    </div>
  );
}
