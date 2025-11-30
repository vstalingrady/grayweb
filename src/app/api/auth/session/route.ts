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

const resolveSupabaseConfig = () => {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? null;
  return { url, anonKey };
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
  const { url, anonKey } = resolveSupabaseConfig();
  if (!url || !anonKey) {
    console.error("Supabase configuration is missing. Cannot validate access token.");
    return null;
  }

  try {
    const response = await fetch(`${url}/auth/v1/user`, {
      headers: {
        authorization: `Bearer ${accessToken}`,
        apikey: anonKey,
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

export async function POST(request: NextRequest) {
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
  response.cookies.set(buildSessionCookie(email));
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true }, { headers: noStoreHeaders });
  response.cookies.set(clearSessionCookie());
  return response;
}
