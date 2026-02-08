"use client";

import Skeleton from "react-loading-skeleton";
import styles from "../EnhancedSidebar.module.css";

export const SidebarHistorySkeleton = () => (
  <div
    className={`gray-history-skeleton ${styles.sidebarHistorySkeletonBlock}`}
    aria-label="Loading"
  >
    <Skeleton
      height={14}
      width="84%"
      baseColor="var(--gray-skeleton-base)"
      highlightColor="var(--gray-skeleton-highlight)"
      borderRadius={6}
      duration={1.2}
      enableAnimation
    />
    <Skeleton
      height={14}
      width="68%"
      baseColor="var(--gray-skeleton-base)"
      highlightColor="var(--gray-skeleton-highlight)"
      borderRadius={6}
      duration={1.2}
      enableAnimation
    />
    <Skeleton
      height={14}
      width="76%"
      baseColor="var(--gray-skeleton-base)"
      highlightColor="var(--gray-skeleton-highlight)"
      borderRadius={6}
      duration={1.2}
      enableAnimation
    />
    <Skeleton
      height={14}
      width="58%"
      baseColor="var(--gray-skeleton-base)"
      highlightColor="var(--gray-skeleton-highlight)"
      borderRadius={6}
      duration={1.2}
      enableAnimation
    />
    <Skeleton
      height={14}
      width="74%"
      baseColor="var(--gray-skeleton-base)"
      highlightColor="var(--gray-skeleton-highlight)"
      borderRadius={6}
      duration={1.2}
      enableAnimation
    />
  </div>
);
