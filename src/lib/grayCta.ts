const PROD_TRY_GRAY_URL = "https://gray.alignment.id";
const LOCAL_TRY_GRAY_URL = "http://gray.localhost:3000";

const normalizeHost = (host?: string | null): string => {
  if (!host) {
    return "";
  }

  const [hostname] = host.split(":");
  return hostname?.toLowerCase() ?? "";
};

const isLocalEnvironmentHost = (host?: string | null): boolean => {
  const normalized = normalizeHost(host);
  if (!normalized) {
    return false;
  }

  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized.endsWith(".localhost")
  );
};

const sanitizeUrl = (url: string): string => {
  const trimmed = url.trim();
  if (!trimmed) {
    return PROD_TRY_GRAY_URL;
  }

  try {
    const parsed = new URL(trimmed);
    parsed.hash = "";
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return trimmed.replace(/\/+$/, "");
  }
};

export const resolveTryGrayUrl = (host?: string | null): string => {
  const override = process.env.NEXT_PUBLIC_TRY_GRAY_URL;
  if (override?.trim()) {
    return sanitizeUrl(override);
  }

  if (isLocalEnvironmentHost(host)) {
    return LOCAL_TRY_GRAY_URL;
  }

  return PROD_TRY_GRAY_URL;
};
