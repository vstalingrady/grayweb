import { useEffect, useState } from "react";

const resolvePromptString = (value: unknown, activeLocale: string): string => {
  if (typeof value === "string") {
    return value;
  }
  if (!value || typeof value !== "object") {
    return "";
  }
  const record = value as Record<string, unknown>;
  const baseLocale = String(activeLocale || "en").split("-")[0];
  const direct = record[activeLocale];
  if (typeof direct === "string") {
    return direct;
  }
  const base = record[baseLocale];
  if (typeof base === "string") {
    return base;
  }
  const fallback = record["en"];
  if (typeof fallback === "string") {
    return fallback;
  }
  return "";
};

export const useDefaultSystemPrompt = (locale: string) => {
  const [defaultSystemPrompt, setDefaultSystemPrompt] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let controller = new AbortController();

    const loadSystemPrompt = async () => {
      try {
        controller.abort();
        controller = new AbortController();
        const response = await fetch("/system-prompts.json", {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as { chat?: unknown } | null;
        if (!isMounted) {
          return;
        }
        const raw = resolvePromptString(data?.chat, locale);
        const trimmed = raw.trim();
        setDefaultSystemPrompt(trimmed.length > 0 ? trimmed : null);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        console.error("Failed to load system prompt:", error);
      }
    };

    void loadSystemPrompt();

    if (typeof window !== "undefined" && typeof document !== "undefined") {
      const handleVisibilityChange = () => {
        if (document.visibilityState === "visible") {
          void loadSystemPrompt();
        }
      };
      window.addEventListener("visibilitychange", handleVisibilityChange);

      return () => {
        isMounted = false;
        controller.abort();
        window.removeEventListener("visibilitychange", handleVisibilityChange);
      };
    }

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [locale]);

  return defaultSystemPrompt;
};

