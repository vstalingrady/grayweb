import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isSupportedLocale, translate, type Locale } from "@/lib/i18n";

const COOKIE_KEY = "gray_locale";

export const getServerLocale = async (): Promise<Locale> => {
  try {
    const cookieStore = await cookies();
    const stored = cookieStore.get(COOKIE_KEY)?.value;
    return isSupportedLocale(stored) ? stored : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
};

export const tServer = async (
  message: string,
  vars?: Record<string, string | number>
): Promise<string> => translate(message, await getServerLocale(), vars);
