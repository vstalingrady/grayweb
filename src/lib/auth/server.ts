import { cookies } from "next/headers";
import crypto from "node:crypto";

export type ServerSession = {
  email?: string;
};

type SignedSession = {
  email: string;
  exp: number;
};

type SessionCookieOptions = {
  domain?: string;
};

const SESSION_COOKIE_NAME = "gray-auth-session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

const resolveSecret = () => {
  const secret =
    process.env.AUTH_COOKIE_SECRET ??
    process.env.COOKIE_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    "";
  const isProd = process.env.NODE_ENV === "production";

  if (!secret) {
    if (isProd) {
      throw new Error(
        "Missing AUTH_COOKIE_SECRET/COOKIE_SECRET/NEXTAUTH_SECRET in production (refusing to use an insecure default)."
      );
    }
    return "development-gray-session-secret";
  }

  return secret;
};

const signPayload = (payload: SignedSession) => {
  const secret = resolveSecret();
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
};

const verifyPayload = (raw: string | undefined | null): SignedSession | null => {
  if (!raw) {
    return null;
  }

  const [body, signature] = raw.split(".");
  if (!body || !signature) {
    return null;
  }

  const secret = resolveSecret();
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");

  try {
    const safeSignature = Buffer.from(signature, "base64url");
    const safeExpected = Buffer.from(expected, "base64url");
    if (safeSignature.length !== safeExpected.length) {
      return null;
    }
    if (!crypto.timingSafeEqual(safeSignature, safeExpected)) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<SignedSession>;
    if (!parsed || typeof parsed.email !== "string" || parsed.email.trim().length === 0) {
      return null;
    }
    if (typeof parsed.exp !== "number" || !Number.isFinite(parsed.exp)) {
      return null;
    }
    if (parsed.exp * 1000 < Date.now()) {
      return null;
    }
    return { email: parsed.email, exp: parsed.exp };
  } catch {
    return null;
  }
};

export const buildSessionCookie = (email: string, options?: SessionCookieOptions) => {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const value = signPayload({ email, exp });
  const isProd = process.env.NODE_ENV === "production";

  const base = {
    name: SESSION_COOKIE_NAME,
    value,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProd,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
  if (options?.domain) {
    return { ...base, domain: options.domain };
  }
  return base;
};

export const clearSessionCookie = (options?: SessionCookieOptions) => {
  const isProd = process.env.NODE_ENV === "production";
  const base = {
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProd,
    path: "/",
    maxAge: 0,
  };
  if (options?.domain) {
    return { ...base, domain: options.domain };
  }
  return base;
};

export const readServerSession = async (): Promise<ServerSession | null> => {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  const payload = verifyPayload(sessionCookie?.value ?? null);

  if (!payload) {
    return null;
  }

  return { email: payload.email };
};
