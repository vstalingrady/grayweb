"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IntroSequence } from "@/components/gray/IntroSequence";

type IntroSplashProps = {
  redirectTo?: string;
  autoDelayMs?: number;
};

/**
 * Fullscreen intro that reuses the glowing Gray sequence and then routes into the app.
 * A short auto-delay ensures we never leave users stuck if they don't click.
 */
export function IntroSplash({ redirectTo = "/login?redirect=/g", autoDelayMs = 8000 }: IntroSplashProps) {
  const router = useRouter();
  const [completed, setCompleted] = useState(false);

  const handleComplete = useCallback(() => {
    if (completed) {
      return;
    }
    setCompleted(true);
    const maxAge = 60 * 60 * 24 * 30; // 30 days
    const persistFlags = async () => {
      try {
        window.sessionStorage.setItem("grayIntroCompleted", "1");
        document.cookie = `gray_intro_done=1; path=/; max-age=${maxAge}`;
        await fetch("/api/intro/complete", { method: "POST" });
      } catch {
        // Best-effort; ignore if storage/API unavailable
      }
    };
    void persistFlags().finally(() => router.replace(redirectTo));
  }, [completed, redirectTo, router]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      handleComplete();
    }, autoDelayMs);
    return () => window.clearTimeout(timer);
  }, [autoDelayMs, handleComplete]);

  return <IntroSequence onComplete={handleComplete} />;
}

export default IntroSplash;
