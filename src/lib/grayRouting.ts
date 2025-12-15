const GENERAL_PREFIX = "/g";
const PROD_DOMAIN = "gray.alignment.id";

const normalizeHostname = (value?: string | null): string => {
  if (!value) {
    return "";
  }

  const host = value.split(":")[0];
  return host ? host.toLowerCase() : "";
};

export const isProductionHost = (host?: string | null): boolean => {
  const normalized = normalizeHostname(host);
  return (
    normalized === PROD_DOMAIN || normalized.endsWith(`.${PROD_DOMAIN}`)
  );
};

export const isLocalHostname = (host?: string | null): boolean => {
  const normalized = normalizeHostname(host);
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "0.0.0.0" ||
    normalized === "::1" ||
    normalized.endsWith(".localhost")
  );
};

export const isGrayWorkspaceHost = (host?: string | null): boolean => {
  const normalized = normalizeHostname(host);
  if (!normalized) {
    return false;
  }

  if (normalized === PROD_DOMAIN) {
    return true;
  }

  // Allow localhost for development
  if (isLocalHostname(normalized)) {
    return true;
  }

  return normalized.startsWith("gray.") || normalized === "gray";
};

export const isPayHost = (host?: string | null): boolean => {
  const normalized = normalizeHostname(host);
  if (!normalized) {
    return false;
  }
  return normalized.startsWith("pay.") || normalized === "pay";
};

export const resolveDefaultWorkspacePath = (
  host?: string | null
): string => {
  void host;
  return GENERAL_PREFIX;
};

export const normalizeWorkspaceRedirect = (
  path: string,
  host?: string | null
): string => {
  if (!path) {
    return resolveDefaultWorkspacePath(host);
  }

  if (path === "/") {
    return "/";
  }

  if (!path.startsWith("/")) {
    return resolveDefaultWorkspacePath(host);
  }

  if (path === "/gray") {
    return "/";
  }

  if (
    path.startsWith("/gray/") ||
    path.startsWith("/gray?") ||
    path.startsWith("/gray#")
  ) {
    const remainder = path.slice("/gray".length);
    if (!remainder) {
      return "/";
    }
    if (remainder.startsWith("/")) {
      return remainder;
    }
    return `/${remainder}`;
  }

  return path;
};

export const hostFromUrl = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }

  try {
    const candidate = value.startsWith("http") ? value : `https://${value}`;
    return new URL(candidate).hostname;
  } catch {
    return null;
  }
};

const coerceHeaderValue = (value: unknown): string | null => {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === "string" ? first : null;
  }

  if (typeof value === "string") {
    return value;
  }

  return null;
};

const parseHostHeader = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const primary = value.split(",")[0]?.trim();
  return primary && primary.length > 0 ? primary : null;
};

const resolvePreferredHost = (
  forwardedHost: string | null,
  hostHeader: string | null
): string | null => {
  if (forwardedHost && !isLocalHostname(forwardedHost)) {
    return forwardedHost;
  }

  if (hostHeader) {
    return hostHeader;
  }

  return forwardedHost;
};

type HeadersLike =
  | Headers
  | {
    get?: (name: string) => string | null | undefined;
    [key: string]: unknown;
  }
  | Record<string, unknown>
  | null
  | undefined;

export const hostFromHeaders = (headersLike: HeadersLike): string | null => {
  if (!headersLike) {
    return null;
  }

  if (typeof (headersLike as Headers).get === "function") {
    const headerGetter = headersLike as Headers;
    const forwarded = parseHostHeader(
      headerGetter.get?.("x-forwarded-host") ?? null
    );
    const hostHeader = parseHostHeader(headerGetter.get?.("host") ?? null);
    return resolvePreferredHost(forwarded, hostHeader);
  }

  if (typeof headersLike === "object") {
    const record = headersLike as Record<string, unknown>;
    const lowered = new Map<string, unknown>();
    for (const [key, value] of Object.entries(record)) {
      lowered.set(key.toLowerCase(), value);
    }

    const forwarded = parseHostHeader(
      coerceHeaderValue(lowered.get("x-forwarded-host"))
    );
    const hostHeader = parseHostHeader(coerceHeaderValue(lowered.get("host")));
    return resolvePreferredHost(forwarded, hostHeader);
  }

  return null;
};

export const resolveWorkspaceHost = (
  currentHost?: string | null
): string | null => {
  const hostValue = currentHost ?? "";
  const [hostOnly] = hostValue.split(":");
  const normalized = normalizeHostname(hostOnly);
  if (!normalized) {
    return null;
  }

  if (isGrayWorkspaceHost(hostOnly)) {
    return hostOnly;
  }

  if (isLocalHostname(hostOnly)) {
    return normalized;
  }

  if (normalized === "alignment.id" || normalized.endsWith(".alignment.id")) {
    return PROD_DOMAIN;
  }

  return null;
};

export const resolveWorkspaceOrigin = (
  currentHost?: string | null,
  protocol?: string,
  port?: string
): string | null => {
  const workspaceHost = resolveWorkspaceHost(currentHost);
  if (!workspaceHost) {
    return null;
  }

  // Normalize protocol to always include colon suffix
  const normalizeProtocol = (proto?: string): string => {
    if (!proto) return "http:";
    const trimmed = proto.trim();
    return trimmed.endsWith(":") ? trimmed : `${trimmed}:`;
  };

  const normalized = normalizeHostname(workspaceHost);

  if (isLocalHostname(workspaceHost)) {
    const scheme = normalizeProtocol(protocol ?? "http");
    const portSuffix = port ? `:${port}` : "";
    return `${scheme}//${workspaceHost}${portSuffix}`;
  }

  if (
    normalized === PROD_DOMAIN ||
    normalized.endsWith(`.${PROD_DOMAIN}`)
  ) {
    return `https://${workspaceHost}`;
  }

  const scheme = normalizeProtocol(protocol ?? "https");
  const portSuffix = port ? `:${port}` : "";
  return `${scheme}//${workspaceHost}${portSuffix}`;
};
