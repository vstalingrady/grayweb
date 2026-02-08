import { getSupabaseClient } from "../supabaseClient";

type AccessTokenOptions = {
  forceRefresh?: boolean;
};

let inFlightTokenRefresh: Promise<string | null> | null = null;

const TOKEN_EXPIRY_SKEW_MS = 30_000;

const isValidAuthToken = (token: string | null): token is string => {
  return typeof token === "string" && token.length > 20 && token.split(".").length === 3;
};

const decodeBase64Url = (value: string): string | null => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  const base64 = `${normalized}${padding}`;
  try {
    if (typeof window !== "undefined" && typeof window.atob === "function") {
      return window.atob(base64);
    }
    if (typeof Buffer !== "undefined") {
      return Buffer.from(base64, "base64").toString("utf8");
    }
  } catch {
    return null;
  }
  return null;
};

const parseJwtExpMs = (token: string): number | null => {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }
  const payload = decodeBase64Url(parts[1]);
  if (!payload) {
    return null;
  }
  try {
    const parsed = JSON.parse(payload) as { exp?: number };
    if (typeof parsed.exp !== "number") {
      return null;
    }
    return parsed.exp * 1000;
  } catch {
    return null;
  }
};

const isTokenFresh = (token: string): boolean => {
  const expMs = parseJwtExpMs(token);
  if (!expMs) {
    return true;
  }
  return expMs - Date.now() > TOKEN_EXPIRY_SKEW_MS;
};

const refreshSupabaseAccessToken = async () => {
  const supabase = getSupabaseClient();
  if (!supabase || typeof window === "undefined") {
    return null;
  }
  if (inFlightTokenRefresh) {
    return inFlightTokenRefresh;
  }
  inFlightTokenRefresh = (async () => {
    const authClient = supabase.auth as {
      refreshSession?: () => Promise<{
        data: { session: { access_token?: string | null } | null };
        error: unknown;
      }>;
      getSession: () => Promise<{
        data: { session: { access_token?: string | null } | null };
        error: unknown;
      }>;
    };
    const refreshResult =
      typeof authClient.refreshSession === "function"
        ? await authClient.refreshSession()
        : await authClient.getSession();
    const { data, error } = refreshResult;
    if (error) {
      console.warn("[Auth] Failed to refresh auth session:", error);
      return null;
    }
    const token = data.session?.access_token ?? null;
    if (!isValidAuthToken(token) || !isTokenFresh(token)) {
      return null;
    }
    return token;
  })();
  try {
    return await inFlightTokenRefresh;
  } finally {
    inFlightTokenRefresh = null;
  }
};

export const getSupabaseAccessToken = async (
  options: AccessTokenOptions = {}
): Promise<string | null> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }

  if (!options.forceRefresh) {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.warn("[Auth] Failed to load auth session:", error);
    }
    const token = data.session?.access_token ?? null;
    if (isValidAuthToken(token) && isTokenFresh(token)) {
      return token;
    }
  }

  return refreshSupabaseAccessToken();
};
