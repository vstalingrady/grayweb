import { GRAY_BRAND, PIONEER_GROUPS } from "./modelCatalog";

const AI_LOGO_CACHE_NAME = "gray-ai-company-logos-v1";
const AI_LOGO_WARMED_AT_KEY = "gray-ai-company-logos-warmed-at";

const EXTRA_LOGO_PATHS = ["/logos/chatgpt.svg"] as const;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

type LogoWarmState = {
  warmedAt: number;
  fingerprint: string;
};

const buildLogoPathList = (): string[] => {
  const all = [
    GRAY_BRAND.iconPath,
    ...PIONEER_GROUPS.map((group) => group.iconPath),
    ...EXTRA_LOGO_PATHS,
  ];
  return Array.from(
    new Set(
      all
        .map((path) => path.trim())
        .filter((path) => path.length > 0)
        .map((path) => (path.startsWith("/") ? path : `/${path}`))
    )
  );
};

const buildLogoFingerprint = (logoPaths: string[]): string => logoPaths.join("|");

const shouldWarmLogosNow = (logoPaths: string[]): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    const warmedAtRaw = window.localStorage.getItem(AI_LOGO_WARMED_AT_KEY);
    const fingerprint = buildLogoFingerprint(logoPaths);
    if (!warmedAtRaw) {
      return true;
    }
    const parsed = JSON.parse(warmedAtRaw) as Partial<LogoWarmState>;
    if (parsed.fingerprint !== fingerprint) {
      return true;
    }
    const warmedAt = typeof parsed.warmedAt === "number" ? parsed.warmedAt : 0;
    return !Number.isFinite(warmedAt) || warmedAt <= 0 || Date.now() - warmedAt >= ONE_DAY_MS;
  } catch {
    return true;
  }
};

const markLogoWarmComplete = (logoPaths: string[]) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const payload: LogoWarmState = {
      warmedAt: Date.now(),
      fingerprint: buildLogoFingerprint(logoPaths),
    };
    window.localStorage.setItem(AI_LOGO_WARMED_AT_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
};

const warmLogosWithImageCache = async (logoPaths: string[]): Promise<void> => {
  await Promise.allSettled(
    logoPaths.map(
      (path) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = path;
        })
    )
  );
};

const warmLogosWithCacheStorage = async (logoPaths: string[]): Promise<void> => {
  if (typeof window === "undefined" || !("caches" in window)) {
    await warmLogosWithImageCache(logoPaths);
    return;
  }
  try {
    const cache = await window.caches.open(AI_LOGO_CACHE_NAME);
    await Promise.allSettled(
      logoPaths.map(async (path) => {
        const cached = await cache.match(path, { ignoreSearch: true });
        if (cached) {
          return;
        }
        const response = await fetch(path, {
          method: "GET",
          credentials: "same-origin",
          cache: "force-cache",
        });
        if (!response.ok) {
          return;
        }
        await cache.put(path, response.clone());
      })
    );
  } catch {
    await warmLogosWithImageCache(logoPaths);
  }
};

export const primeAiCompanyLogoCache = async (): Promise<void> => {
  if (typeof window === "undefined") {
    return;
  }
  const logoPaths = buildLogoPathList();
  if (logoPaths.length === 0 || !shouldWarmLogosNow(logoPaths)) {
    return;
  }
  await warmLogosWithCacheStorage(logoPaths);
  markLogoWarmComplete(logoPaths);
};
