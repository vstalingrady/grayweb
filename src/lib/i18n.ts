import translations from "@/locales/translations.json";

export type Locale = "en" | "id";

export const DEFAULT_LOCALE: Locale = "en";
export const SUPPORTED_LOCALES: readonly Locale[] = ["en", "id"] as const;

const TRANSLATIONS = translations as Record<Locale, Record<string, string>>;

const interpolate = (
  template: string,
  vars: Record<string, string | number>
): string =>
  template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = vars[key];
    return value === undefined || value === null ? match : String(value);
  });

export const translate = (
  message: string,
  locale: Locale,
  vars?: Record<string, string | number>
): string => {
  const localeTable = TRANSLATIONS[locale] ?? {};
  const base = localeTable[message] ?? message;
  return vars ? interpolate(base, vars) : base;
};

export const isSupportedLocale = (value: string | null | undefined): value is Locale =>
  value === "en" || value === "id";
