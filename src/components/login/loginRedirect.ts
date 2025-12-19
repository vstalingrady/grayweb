import {
  hostFromUrl,
  isGrayWorkspaceHost,
  isLocalHostname,
  isProductionHost,
  normalizeWorkspaceRedirect,
  resolveWorkspaceHost,
  resolveWorkspaceOrigin,
} from "@/lib/grayRouting";

const envRedirect = process.env.NEXT_PUBLIC_AUTH_REDIRECT?.trim();
const envSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
const CALLBACK_PATH = "/callback";

const resolveSiteOrigin = (): string => {
  if (typeof window !== "undefined" && window.location?.origin) {
    const { origin, hostname } = window.location;

    if (isLocalHostname(hostname)) {
      return origin;
    }

    if (isProductionHost(hostname) || isGrayWorkspaceHost(hostname)) {
      return origin;
    }

    return origin;
  }

  if (envSiteUrl) {
    try {
      const normalized = envSiteUrl.startsWith("http") ? envSiteUrl : `https://${envSiteUrl}`;
      return new URL(normalized).origin;
    } catch {
      // Ignore invalid SITE_URL values
    }
  }

  if (process.env.NODE_ENV === "development") {
    if (envSiteUrl) {
      return envSiteUrl;
    }
    return "http://localhost:3000";
  }

  return `https://gray.alignment.id`;
};

const resolveHostContext = (): string | null => {
  if (typeof window !== "undefined" && window.location) {
    return window.location.hostname;
  }

  return hostFromUrl(envSiteUrl);
};

export const ensureAbsoluteUrl = (target: string): string => {
  if (target.startsWith("http://") || target.startsWith("https://")) {
    return target;
  }

  if (typeof window !== "undefined") {
    const origin = window.location.origin;
    return new URL(target, origin).toString();
  }

  const origin = resolveSiteOrigin();
  return new URL(target, origin).toString();
};

const sanitizeRedirect = (target: string | null | undefined): string | null => {
  if (!target) {
    return null;
  }

  try {
    const trimmed = target.trim();
    if (!trimmed) {
      return null;
    }

    const url = new URL(trimmed, "http://localhost");
    if (url.origin !== "http://localhost") {
      return null;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
};

export const resolvePostAuthDestination = (): string => {
  const host = resolveHostContext();
  const workspaceHost = resolveWorkspaceHost(host) ?? host;

  if (envRedirect) {
    try {
      const u = new URL(envRedirect, "https://placeholder");
      if (!u.host) {
        return normalizeWorkspaceRedirect(envRedirect, workspaceHost);
      }

      if (
        isProductionHost(u.host) ||
        (workspaceHost && u.hostname === workspaceHost) ||
        (host && u.hostname === host)
      ) {
        return envRedirect;
      }
    } catch {
      // Ignore invalid auth redirect configuration
    }
  }

  if (typeof window !== "undefined") {
    const url = new URL(window.location.href);
    const sanitized =
      sanitizeRedirect(url.searchParams.get("redirect")) ??
      sanitizeRedirect(url.searchParams.get("returnTo"));
    if (sanitized) {
      return normalizeWorkspaceRedirect(sanitized, workspaceHost);
    }
  }

  return "/g";
};

const buildLoopbackOrigin = (protocol?: string, port?: string | null | undefined): string => {
  const normalizedProtocol = protocol && protocol.endsWith(":") ? protocol : `${protocol ?? "http"}:`;
  const portSuffix = port ? `:${port}` : "";
  return `${normalizedProtocol}//localhost${portSuffix}`;
};

const isLoopbackHost = (host: string | null | undefined): boolean =>
  host === "localhost" || host === "127.0.0.1";

const resolveCallbackOrigin = (): string => {
  if (typeof window !== "undefined" && window.location) {
    const { hostname, protocol, port } = window.location;

    if (isLoopbackHost(hostname)) {
      return window.location.origin;
    }

    const workspaceOrigin = resolveWorkspaceOrigin(hostname, protocol, port);

    if (workspaceOrigin) {
      try {
        const parsed = new URL(workspaceOrigin);
        if (isLoopbackHost(parsed.hostname)) {
          return buildLoopbackOrigin(parsed.protocol, parsed.port);
        }
        return parsed.origin;
      } catch {
        return workspaceOrigin;
      }
    }

    return window.location.origin;
  }

  const origin = resolveSiteOrigin();
  try {
    const parsed = new URL(origin);
    if (isLoopbackHost(parsed.hostname)) {
      return buildLoopbackOrigin(parsed.protocol, parsed.port);
    }
    return parsed.origin;
  } catch {
    return origin;
  }
};

export const buildCallbackDestination = (customRedirect?: string): string => {
  if (customRedirect) {
    const absoluteTarget = ensureAbsoluteUrl(customRedirect);
    const encoded = encodeURIComponent(absoluteTarget);
    const origin = resolveCallbackOrigin();
    return `${origin}${CALLBACK_PATH}?redirect=${encoded}`;
  }
  const target = resolvePostAuthDestination();
  const absoluteTarget = ensureAbsoluteUrl(target);
  const encoded = encodeURIComponent(absoluteTarget);
  const origin = resolveCallbackOrigin();
  return `${origin}${CALLBACK_PATH}?redirect=${encoded}`;
};
