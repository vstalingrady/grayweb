"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  isSupportedLocale,
  translate,
  type Locale,
} from "@/lib/i18n";

type I18nContextValue = {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (message: string, vars?: Record<string, string | number>) => string;
  supportedLocales: readonly Locale[];
};

const STORAGE_KEY = "gray_locale";
const COOKIE_KEY = "gray_locale";

const I18nContext = createContext<I18nContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => undefined,
  t: (message) => message,
  supportedLocales: SUPPORTED_LOCALES,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const scheduleLocaleUpdate = (next: Locale) => {
      void Promise.resolve().then(() => setLocaleState(next));
    };

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (isSupportedLocale(stored)) {
        scheduleLocaleUpdate(stored);
        return;
      }
    } catch {
      // ignore storage errors
    }
    const browserLocale = window.navigator.language?.toLowerCase() ?? "";
    if (browserLocale.startsWith("id")) {
      scheduleLocaleUpdate("id");
    }
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore storage errors
    }
    try {
      const maxAge = 60 * 60 * 24 * 365; // 1 year
      document.cookie = `${COOKIE_KEY}=${next}; path=/; max-age=${maxAge}`;
    } catch {
      // ignore cookie errors
    }
    try {
      document.documentElement.lang = next;
    } catch {
      // ignore
    }
  }, []);

  const t = useCallback(
    (message: string, vars?: Record<string, string | number>) =>
      translate(message, locale, vars),
    [locale]
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t,
      supportedLocales: SUPPORTED_LOCALES,
    }),
    [locale, setLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
