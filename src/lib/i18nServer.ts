import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isSupportedLocale, translate, type Locale } from "@/lib/i18n";

const COOKIE_KEY = "gray_locale";

export const getServerLocale = (): Locale => {
  try {
    const cookieStore = cookies();
    const stored = cookieStore.get(COOKIE_KEY)?.value;
    return isSupportedLocale(stored) ? stored : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
};

export const tServer = (
  message: string,
  vars?: Record<string, string | number>
): string => translate(message, getServerLocale(), vars);

