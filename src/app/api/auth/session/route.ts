import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { buildSessionCookie, clearSessionCookie } from "@/lib/auth/server";

type SupabaseUserResponse = {
  email?: string | null;
  user?: {
    email?: string | null;
  } | null;
};

type JwtPayload = {
  email?: string | null;
  exp?: number;
  user_metadata?: {
    email?: string | null;
  } | null;
};

const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET ?? null;
const CSRF_COOKIE_NAME = "gray-csrf";
const CSRF_HEADER_NAME = "x-gray-csrf";
const ALLOWED_FETCH_SITES = new Set(["same-origin", "same-site"]);
const ALLOWED_FETCH_MODES = new Set(["cors", "same-origin"]);

const resolveExpectedOrigin = (request: NextRequest): string | null => {
  try {
    return request.nextUrl.origin || new URL(request.url).origin;
  } catch {
    return null;
  }
};

const isSameOrigin = (candidate: string | null, expectedOrigin: string | null): boolean => {
  if (!candidate || !expectedOrigin) {
    return false;
  }
  if (candidate === "null") {
    return false;
  }
  try {
    return new URL(candidate).origin === expectedOrigin;
  } catch {
    return false;
  }
};

const isSameOriginRequest = (request: NextRequest): boolean => {
  const expectedOrigin = resolveExpectedOrigin(request);
  const origin = request.headers.get("origin");
  if (isSameOrigin(origin, expectedOrigin)) {
    return true;
  }

  const referer = request.headers.get("referer");
  if (isSameOrigin(referer, expectedOrigin)) {
    return true;
  }

  return false;
};

const isAllowedFetchMetadata = (request: NextRequest): boolean => {
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite && !ALLOWED_FETCH_SITES.has(fetchSite)) {
    return false;
  }
  const fetchMode = request.headers.get("sec-fetch-mode")?.toLowerCase();
  if (fetchMode && !ALLOWED_FETCH_MODES.has(fetchMode)) {
    return false;
  }
  return true;
};

const isValidCsrf = (request: NextRequest): boolean => {
  const cookieValue = request.cookies.get(CSRF_COOKIE_NAME)?.value ?? "";
  const headerValue = request.headers.get(CSRF_HEADER_NAME) ?? "";

  if (!cookieValue || !headerValue) {
    return false;
  }

  const cookieBuffer = Buffer.from(cookieValue);
  const headerBuffer = Buffer.from(headerValue);
  if (cookieBuffer.length !== headerBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(cookieBuffer, headerBuffer);
};

const normalizeUrl = (value: string | null | undefined): string | null => {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed.replace(/\/+$/, "") : null;
};

const parseJwtPayload = (accessToken: string): Record<string, unknown> | null => {
  const segments = accessToken.split(".");
  if (segments.length !== 3) {
    return null;
  }

  try {
    const payloadBuffer = decodeBase64Url(segments[1]);
    const parsed = JSON.parse(payloadBuffer.toString("utf8")) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

const issuerMatchesSupabaseUrl = (issuer: string, supabaseUrl: string): boolean => {
  const normalizedUrl = normalizeUrl(supabaseUrl);
  const normalizedIssuer = normalizeUrl(issuer);
  if (!normalizedUrl || !normalizedIssuer) {
    return false;
  }
  const expectedPrefix = `${normalizedUrl}/auth/v1`;
  return normalizedIssuer === expectedPrefix || normalizedIssuer.startsWith(`${expectedPrefix}/`);
};

const resolveSupabaseConfig = (accessToken: string) => {
  const serverUrl = normalizeUrl(process.env.SUPABASE_URL ?? null);
  const serverAnonKey = (process.env.SUPABASE_ANON_KEY ?? "").trim() || null;
  const publicUrl = normalizeUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? null);
  const publicAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim() || null;

  const serverConfig = serverUrl && serverAnonKey ? { url: serverUrl, anonKey: serverAnonKey } : null;
  const publicConfig = publicUrl && publicAnonKey ? { url: publicUrl, anonKey: publicAnonKey } : null;

  const payload = parseJwtPayload(accessToken);
  const issuer = typeof payload?.iss === "string" ? payload.iss : null;

  if (issuer) {
    if (serverConfig && issuerMatchesSupabaseUrl(issuer, serverConfig.url)) {
      return serverConfig;
    }
    if (publicConfig && issuerMatchesSupabaseUrl(issuer, publicConfig.url)) {
      return publicConfig;
    }
  }

  // Prefer the public config (client + server aligned) when available.
  // This avoids a common dev pitfall where SUPABASE_URL points at prod while
  // NEXT_PUBLIC_SUPABASE_URL points at the dev project (cookie sync would fail).
  return publicConfig ?? serverConfig;
};

const decodeBase64Url = (value: string): Buffer => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, "base64");
};

const emailFromPayload = (payload: JwtPayload): string | null => {
  const directEmail = payload.email ?? payload.user_metadata?.email ?? null;
  if (!directEmail || typeof directEmail !== "string") {
    return null;
  }
  const trimmed = directEmail.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const resolveEmailFromJwt = (accessToken: string): string | null => {
  if (!SUPABASE_JWT_SECRET) {
    return null;
  }

  const segments = accessToken.split(".");
  if (segments.length !== 3) {
    return null;
  }

  const [header, payload, signature] = segments;
  try {
    const expected = crypto.createHmac("sha256", SUPABASE_JWT_SECRET).update(`${header}.${payload}`).digest();
    const provided = decodeBase64Url(signature);

    if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
      return null;
    }

    const payloadBuffer = decodeBase64Url(payload);
    const parsed = JSON.parse(payloadBuffer.toString("utf8")) as JwtPayload;
    const exp = typeof parsed.exp === "number" ? parsed.exp : null;
    if (exp && exp * 1000 < Date.now()) {
      return null;
    }

    return emailFromPayload(parsed);
  } catch {
    return null;
  }
};

const fetchSupabaseEmail = async (accessToken: string): Promise<string | null> => {
  const config = resolveSupabaseConfig(accessToken);
  if (!config?.url || !config.anonKey) {
    console.error("Supabase configuration is missing. Cannot validate access token.");
    return null;
  }

  try {
    const response = await fetch(`${config.url}/auth/v1/user`, {
      headers: {
        authorization: `Bearer ${accessToken}`,
        apikey: config.anonKey,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json().catch(() => null)) as SupabaseUserResponse | null;
    const email = payload?.email ?? payload?.user?.email ?? null;
    if (email && typeof email === "string" && email.trim().length > 0) {
      return email;
    }
  } catch (error) {
    console.error("Failed to validate Supabase access token:", error);
  }

  return null;
};

const resolveEmailFromToken = async (accessToken: string): Promise<string | null> => {
  const jwtEmail = resolveEmailFromJwt(accessToken);
  if (jwtEmail) {
    return jwtEmail;
  }

  return fetchSupabaseEmail(accessToken);
};

const noStoreHeaders = { "cache-control": "no-store" };

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const resolveCookieDomain = (request: NextRequest): string | undefined => {
  const configured = (process.env.AUTH_COOKIE_DOMAIN ?? process.env.COOKIE_DOMAIN ?? "").trim();
  if (configured) {
    return configured;
  }

  const forwardedHost = request.headers.get("x-forwarded-host") ?? null;
  const hostHeader = request.headers.get("host") ?? null;
  const rawHost = (forwardedHost ?? hostHeader ?? request.nextUrl.host ?? "").split(",")[0]?.trim();
  const hostname = rawHost.split(":")[0]?.toLowerCase() ?? "";
  if (!hostname) {
    return undefined;
  }

  if (hostname === "alignment.id" || hostname.endsWith(".alignment.id")) {
    return ".alignment.id";
  }

  return undefined;
};

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return NextResponse.json({ detail: "Unsupported content type" }, { status: 415, headers: noStoreHeaders });
  }
  if (!isAllowedFetchMetadata(request)) {
    return NextResponse.json({ detail: "Forbidden" }, { status: 403, headers: noStoreHeaders });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ detail: "Forbidden" }, { status: 403, headers: noStoreHeaders });
  }
  if (!isValidCsrf(request)) {
    return NextResponse.json({ detail: "Forbidden" }, { status: 403, headers: noStoreHeaders });
  }

  const body = (await request.json().catch(() => null)) as { accessToken?: string } | null;
  const accessToken = typeof body?.accessToken === "string" ? body.accessToken.trim() : "";

  if (!accessToken) {
    return NextResponse.json({ detail: "Access token required" }, { status: 400, headers: noStoreHeaders });
  }

  const email = await resolveEmailFromToken(accessToken);
  if (!email) {
    return NextResponse.json({ detail: "Invalid access token" }, { status: 401, headers: noStoreHeaders });
  }

  const response = NextResponse.json({ ok: true }, { status: 200, headers: noStoreHeaders });
  response.cookies.set(buildSessionCookie(email, { domain: resolveCookieDomain(request) }));
  return response;
}

export async function DELETE(request: NextRequest) {
  if (!isAllowedFetchMetadata(request)) {
    return NextResponse.json({ detail: "Forbidden" }, { status: 403, headers: noStoreHeaders });
  }
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ detail: "Forbidden" }, { status: 403, headers: noStoreHeaders });
  }
  if (!isValidCsrf(request)) {
    return NextResponse.json({ detail: "Forbidden" }, { status: 403, headers: noStoreHeaders });
  }
  const response = NextResponse.json({ ok: true }, { headers: noStoreHeaders });
  response.cookies.set(clearSessionCookie({ domain: resolveCookieDomain(request) }));
  return response;
}
