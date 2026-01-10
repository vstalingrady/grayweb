import { getSupabaseAccessToken } from "./supabaseAccessToken";

const CSRF_COOKIE_NAME = "gray-csrf";
const CSRF_HEADER_NAME = "x-gray-csrf";

const readCookie = (name: string): string | null => {
  if (typeof document === "undefined") {
    return null;
  }
  const pattern = new RegExp(`(?:^|;\\s*)${name}=([^;]*)`);
  const match = document.cookie.match(pattern);
  if (!match) {
    return null;
  }
  return decodeURIComponent(match[1]);
};

const generateCsrfToken = (): string => {
  if (typeof crypto !== "undefined") {
    if (typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    if (typeof crypto.getRandomValues === "function") {
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      return Array.from(bytes)
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
    }
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
};

export const getOrCreateCsrfToken = (): string | null => {
  if (typeof document === "undefined") {
    return null;
  }
  const existing = readCookie(CSRF_COOKIE_NAME);
  if (existing) {
    return existing;
  }
  const token = generateCsrfToken();
  const attributes = ["path=/", "SameSite=Strict"];
  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    attributes.push("Secure");
  }
  document.cookie = `${CSRF_COOKIE_NAME}=${encodeURIComponent(token)}; ${attributes.join("; ")}`;
  return token;
};

export const getCsrfHeaders = (): Record<string, string> => {
  const token = getOrCreateCsrfToken();
  if (!token) {
    return {};
  }
  return { [CSRF_HEADER_NAME]: token };
};

const expireLegacyCookie = (name: string) => {
  if (typeof document === "undefined") {
    return;
  }
  const expiry = new Date(0);
  const attributes = ["path=/", "sameSite=Lax", `expires=${expiry.toUTCString()}`, "max-age=0"];
  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    attributes.push("secure");
  }
  document.cookie = [`${name}=`, ...attributes].join("; ");
};

const syncServerSession = async (accessToken?: string | null): Promise<boolean> => {
  if (typeof window === "undefined") {
    return false;
  }

  let token = accessToken?.trim() || null;

  if (!token) {
    token = await getSupabaseAccessToken();
  }

  if (!token) {
    return false;
  }

  try {
    const csrfHeaders = getCsrfHeaders();
    const response = await fetch("/api/auth/session", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...csrfHeaders,
      },
      credentials: "same-origin",
      body: JSON.stringify({ accessToken: token }),
      cache: "no-store",
      keepalive: true,
    });
    return response.ok;
  } catch {
    return false;
  }
};

export const persistAuthCookies = async (
  email?: string | null,
  accessToken?: string | null
): Promise<boolean> => {
  void email;
  return syncServerSession(accessToken);
};

export const clearAuthCookies = async (): Promise<void> => {
  expireLegacyCookie("gray-auth");
  expireLegacyCookie("gray-auth-email");

  if (typeof window === "undefined") {
    return;
  }

  const csrfHeaders = getCsrfHeaders();
  try {
    await fetch("/api/auth/session", {
      method: "DELETE",
      headers: {
        ...csrfHeaders,
      },
      credentials: "same-origin",
      cache: "no-store",
      keepalive: true,
    });
  } catch {
    // Ignore network errors; cookies are already cleared client-side.
  }
};
