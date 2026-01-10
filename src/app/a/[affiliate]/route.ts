import { NextRequest, NextResponse } from "next/server";
import {
  hostFromHeaders,
  isGrayWorkspaceHost,
  isLocalHostname,
  resolveWorkspaceOrigin,
} from "@/lib/grayRouting";

const AFFILIATE_COOKIE_NAME = "gray-affiliate";
const AFFILIATE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const AFFILIATE_CODE_PATTERN = /^[a-z0-9][a-z0-9_-]{1,63}$/;

const normalizeAffiliateCode = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || !AFFILIATE_CODE_PATTERN.test(trimmed)) {
    return null;
  }
  return trimmed;
};

const resolveAffiliateCookieDomain = (host?: string | null): string | undefined => {
  if (!host) {
    return undefined;
  }
  const hostname = host.split(":")[0]?.toLowerCase() ?? "";
  if (!hostname || isLocalHostname(hostname)) {
    return undefined;
  }
  if (hostname === "alignment.id" || hostname.endsWith(".alignment.id")) {
    return ".alignment.id";
  }
  return undefined;
};

const extractAffiliateFromPath = (pathname: string): string | null => {
  if (!pathname) {
    return null;
  }
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 2 || segments[0] !== "a") {
    return null;
  }
  return segments[1] ?? null;
};

const buildAffiliateCookie = (value: string, options: { domain?: string; secure: boolean }): string => {
  const parts = [
    `${AFFILIATE_COOKIE_NAME}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${AFFILIATE_COOKIE_MAX_AGE_SECONDS}`,
    "SameSite=Lax",
  ];
  if (options.domain) {
    parts.push(`Domain=${options.domain}`);
  }
  if (options.secure) {
    parts.push("Secure");
  }
  return parts.join("; ");
};

export async function GET(
  request: NextRequest,
  { params }: { params: { affiliate: string } }
) {
  const requestHost = hostFromHeaders(request.headers);
  const isLocal = isLocalHostname(requestHost);
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? undefined;
  const forwardedPort = request.headers.get("x-forwarded-port") ?? undefined;
  const workspaceOrigin = resolveWorkspaceOrigin(requestHost, forwardedProto, forwardedPort);
  const isWorkspaceHost = isGrayWorkspaceHost(requestHost);
  const localOrigin = request.nextUrl.host ? `http://${request.nextUrl.host}` : request.nextUrl.origin;

  const paramCode = normalizeAffiliateCode(params?.affiliate);
  const pathCode = normalizeAffiliateCode(extractAffiliateFromPath(request.nextUrl.pathname));
  const code = paramCode ?? pathCode;
  const redirectBaseOrigin = isLocal ? localOrigin : (workspaceOrigin ?? request.nextUrl.origin);
  const redirectTarget = new URL("/signup", redirectBaseOrigin);

  const response = NextResponse.redirect(redirectTarget);
  response.headers.set("Cache-Control", "no-store");

  if (code) {
    try {
      const trackOrigin = isLocal ? localOrigin : (workspaceOrigin ?? request.nextUrl.origin);
      const trackUrl = new URL("/api/p/affiliate/track", trackOrigin);
      trackUrl.searchParams.set("code", code);
      await fetch(trackUrl.toString(), { method: "POST", cache: "no-store" });
    } catch {
      // Swallow tracking errors; never block the redirect.
    }
    response.headers.append(
      "Set-Cookie",
      buildAffiliateCookie(code, {
        domain: resolveAffiliateCookieDomain(requestHost),
        secure: !isLocal,
      })
    );
  }

  return response;
}
