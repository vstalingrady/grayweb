"use client";

import Skeleton from "react-loading-skeleton";

export const SidebarHistorySkeleton = () => (
  <div
    className="gray-history-skeleton"
    style={{
      padding: "6px 16px",
      display: "flex",
      flexDirection: "column",
      gap: 10,
    }}
    aria-label="Loading"
  >
    <Skeleton
      height={14}
      width="78%"
      baseColor="rgba(255, 255, 255, 0.08)"
      highlightColor="rgba(255, 255, 255, 0.18)"
      borderRadius={6}
      duration={1.2}
      enableAnimation
    />
    <Skeleton
      height={14}
      width="64%"
      baseColor="rgba(255, 255, 255, 0.08)"
      highlightColor="rgba(255, 255, 255, 0.18)"
      borderRadius={6}
      duration={1.2}
      enableAnimation
    />
    <Skeleton
      height={14}
      width="70%"
      baseColor="rgba(255, 255, 255, 0.08)"
      highlightColor="rgba(255, 255, 255, 0.18)"
      borderRadius={6}
      duration={1.2}
      enableAnimation
    />
    <Skeleton
      height={14}
      width="52%"
      baseColor="rgba(255, 255, 255, 0.08)"
      highlightColor="rgba(255, 255, 255, 0.18)"
      borderRadius={6}
      duration={1.2}
      enableAnimation
    />
    <Skeleton
      height={14}
      width="68%"
      baseColor="rgba(255, 255, 255, 0.08)"
      highlightColor="rgba(255, 255, 255, 0.18)"
      borderRadius={6}
      duration={1.2}
      enableAnimation
    />
  </div>
);

