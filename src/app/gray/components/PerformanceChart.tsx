"use client";

import { useEffect, useRef, useState, useMemo } from "react";

// Number of data points to show on screen
const POINTS_COUNT = 150;

export default function PerformanceChart() {
  const [data, setData] = useState<number[]>([]);
  const requestRef = useRef<number | null>(null);

  // Initialize data with smoother growth
  useEffect(() => {
    const initialData = [];
    let value = 100;
    for (let i = 0; i < POINTS_COUNT; i++) {
      // Much smaller variation for stable initial chart
      value += Math.random() * 0.5 - 0.2;
      initialData.push(value);
    }
    setData(initialData);
  }, []);

  const updateData = () => {
    setData((prevData) => {
      if (prevData.length === 0) return prevData;

      const lastValue = prevData[prevData.length - 1];
      // Slower, smoother growth:
      // Reduced range: -0.3 to +0.3
      // Net positive trend: ~+0.15 per frame (slower)
      // Adding smoothing to reduce jaggedness
      const rawChange = Math.random() * 0.6 - 0.3;

      // Apply exponential moving average for smoothing
      const smoothingFactor = 0.3;
      const previousChange = prevData.length > 1 ? prevData[prevData.length - 1] - prevData[prevData.length - 2] : 0;
      const smoothedChange = smoothingFactor * rawChange + (1 - smoothingFactor) * previousChange;

      const newValue = lastValue + smoothedChange;

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

  // Calculate path and viewbox
  const { pathD, fillD } = useMemo(() => {
    if (data.length === 0) return { pathD: "", fillD: "" };

    const currentMin = Math.min(...data);
    const currentMax = Math.max(...data);

    const padding = (currentMax - currentMin) * 0.15;
    const yMin = currentMin - padding;
    const yMax = currentMax + padding;
    const yRange = yMax - yMin || 1;

    const points = data.map((val, i) => {
      const x = (i / (POINTS_COUNT - 1)) * 100;
      const normalizedY = (val - yMin) / yRange;
      const y = 100 - (normalizedY * 100);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });

    const linePath = `M ${points.join(" L ")}`;
    const areaPath = `${linePath} L 100,200 L 0,200 Z`;

    return { pathD: linePath, fillD: areaPath };
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="bg-black/30 rounded-[28px] border border-white/5 shadow-[0_25px_80px_rgba(0,0,0,0.65)] backdrop-blur p-6 h-[320px] w-full pointer-events-none" />
    );
  }

  return (
    <div className="bg-black/30 rounded-[28px] border border-white/5 shadow-[0_25px_80px_rgba(0,0,0,0.65)] backdrop-blur p-6 h-[320px] w-full pointer-events-none flex items-center justify-center overflow-hidden relative">
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
