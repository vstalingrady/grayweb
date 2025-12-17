import { useCallback, useEffect, useRef, useState } from "react";

const MOBILE_BREAKPOINT_PX = 768;
const COMPACT_BREAKPOINT_PX = 1024;

type UseGrayLayoutStateOptions = {
  pathname: string;
  sidebarPreferenceKey: string;
  defaultSidebarExpandedDesktop: boolean;
};

const readSidebarExpandedPreference = (
  sidebarPreferenceKey: string,
  defaultSidebarExpandedDesktop: boolean
) => {
  if (typeof window === "undefined") {
    return defaultSidebarExpandedDesktop;
  }
  try {
    const stored = window.localStorage.getItem(sidebarPreferenceKey);
    if (stored === "true") return true;
    if (stored === "false") return false;
  } catch {
    // Ignore storage errors (e.g. disabled cookies).
  }
  return defaultSidebarExpandedDesktop;
};

const isCompactViewport = (width: number, height: number) => {
  const aspectRatio = height > 0 ? height / Math.max(width, 1) : 0;
  return width <= COMPACT_BREAKPOINT_PX || aspectRatio >= 1.1;
};

export const useGrayLayoutState = ({
  pathname,
  sidebarPreferenceKey,
  defaultSidebarExpandedDesktop,
}: UseGrayLayoutStateOptions) => {
  const isCalendarPage = pathname === "/pulse" || pathname.startsWith("/cal");

  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === "undefined") return false;
    return (window.innerWidth || 0) <= MOBILE_BREAKPOINT_PX;
  });

  const [isCompactLayout, setIsCompactLayout] = useState(() => {
    if (typeof window === "undefined") return false;
    return isCompactViewport(window.innerWidth || 0, window.innerHeight || 0);
  });

  const [isSidebarExpanded, setIsSidebarExpanded] = useState<boolean>(() => {
    if (typeof window === "undefined") {
      return defaultSidebarExpandedDesktop;
    }
    if ((window.innerWidth || 0) <= MOBILE_BREAKPOINT_PX) {
      return false;
    }
    return readSidebarExpandedPreference(sidebarPreferenceKey, defaultSidebarExpandedDesktop);
  });

  const [isCalendarSidebarExpanded, setIsCalendarSidebarExpanded] = useState(false);
  const wasMobileViewportRef = useRef(isMobileViewport);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const evaluateViewport = () => {
      const width = window.innerWidth || 0;
      const height = window.innerHeight || 0;
      const shouldCollapseSidebar = width <= MOBILE_BREAKPOINT_PX;
      const shouldUseCompactLayout = isCompactViewport(width, height);

      setIsMobileViewport(shouldCollapseSidebar);
      setIsCompactLayout((previous) =>
        previous === shouldUseCompactLayout ? previous : shouldUseCompactLayout
      );

      setIsSidebarExpanded((previous) => {
        if (shouldCollapseSidebar) {
          wasMobileViewportRef.current = true;
          return false;
        }
        if (wasMobileViewportRef.current) {
          wasMobileViewportRef.current = false;
          return readSidebarExpandedPreference(sidebarPreferenceKey, defaultSidebarExpandedDesktop);
        }
        return previous;
      });
    };

    evaluateViewport();
    window.addEventListener("resize", evaluateViewport);
    window.addEventListener("orientationchange", evaluateViewport);
    return () => {
      window.removeEventListener("resize", evaluateViewport);
      window.removeEventListener("orientationchange", evaluateViewport);
    };
  }, [defaultSidebarExpandedDesktop, sidebarPreferenceKey]);

  useEffect(() => {
    if (typeof window === "undefined" || isMobileViewport) {
      return;
    }
    try {
      window.localStorage.setItem(sidebarPreferenceKey, isSidebarExpanded ? "true" : "false");
    } catch {
      // Ignore storage errors.
    }
  }, [isMobileViewport, isSidebarExpanded, sidebarPreferenceKey]);

  useEffect(() => {
    if (isCalendarPage) {
      setIsCalendarSidebarExpanded(false);
    }
  }, [isCalendarPage]);

  const toggleSidebarExpandedForLayout = useCallback(() => {
    if (isCalendarPage) {
      setIsCalendarSidebarExpanded((previous) => !previous);
      return;
    }
    setIsSidebarExpanded((previous) => !previous);
  }, [isCalendarPage]);

  const expandSidebarForLayout = useCallback(() => {
    if (isCalendarPage) {
      setIsCalendarSidebarExpanded(true);
      return;
    }
    setIsSidebarExpanded(true);
  }, [isCalendarPage]);

  const collapseSidebarForLayout = useCallback(() => {
    if (isCalendarPage) {
      setIsCalendarSidebarExpanded(false);
      return;
    }
    setIsSidebarExpanded(false);
  }, [isCalendarPage]);

  const collapseAllSidebars = useCallback(() => {
    setIsSidebarExpanded(false);
    setIsCalendarSidebarExpanded(false);
  }, []);

  const sidebarExpandedForLayout = isCalendarPage ? isCalendarSidebarExpanded : isSidebarExpanded;

  return {
    isCalendarPage,
    isMobileViewport,
    isCompactLayout,
    sidebarExpandedForLayout,
    toggleSidebarExpandedForLayout,
    expandSidebarForLayout,
    collapseSidebarForLayout,
    collapseAllSidebars,
  };
};

