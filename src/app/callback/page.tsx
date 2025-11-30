"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getSupabaseAuthStorageKeys } from "@/lib/supabaseStorage";
import {
  normalizeWorkspaceRedirect,
  resolveDefaultWorkspacePath,
  resolveWorkspaceHost,
} from "@/lib/grayRouting";

const sanitizeRedirect = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) {
    return null;
  }

  try {
    const parsed = new URL(trimmed, "http://localhost");
    const isLoopback = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    if (!isLoopback) {
      return null;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
};

const resolveDestination = (
  rawRedirect: string | null,
  workspaceHost: string | null,
  origin: string
): string => {
  if (rawRedirect && (rawRedirect.startsWith("http://") || rawRedirect.startsWith("https://"))) {
    return rawRedirect;
  }

  const redirectTarget =
    sanitizeRedirect(rawRedirect) ?? resolveDefaultWorkspacePath(workspaceHost);
  const normalized = normalizeWorkspaceRedirect(redirectTarget, workspaceHost ?? undefined);

  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return normalized;
  }

  return new URL(normalized, origin).toString();
};

const findCodeVerifier = (): { verifier: string; storageKey: string } | null => {
  if (typeof window === "undefined") {
    console.log("[VERIFIER DEBUG] Window is undefined");
    return null;
  }

  const candidateKeys = new Set<string>();
  const storageKeys = getSupabaseAuthStorageKeys().filter((key) =>
    key.endsWith("code-verifier")
  );
  console.log("[VERIFIER DEBUG] Storage keys from getSupabaseAuthStorageKeys:", storageKeys);
  storageKeys.forEach((key) => candidateKeys.add(key));

  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.endsWith("code-verifier")) {
        candidateKeys.add(key);
      }
    }
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const key = window.sessionStorage.key(i);
      if (key && key.endsWith("code-verifier")) {
        candidateKeys.add(key);
      }
    }
  } catch {
    // Ignore storage access errors
  }

  console.log("[VERIFIER DEBUG] All candidate keys:", Array.from(candidateKeys));

  for (const key of candidateKeys) {
    try {
      const raw = window.localStorage.getItem(key);
      console.log(`[VERIFIER DEBUG] Key: ${key}, raw value:`, raw);
      if (!raw) {
        console.log(`[VERIFIER DEBUG] Key ${key} has no value, skipping`);
        continue;
      }

      // Parse JSON if the value is JSON-encoded (localStorage often stores as JSON string)
      let parsed = raw;
      try {
        parsed = JSON.parse(raw);
        console.log(`[VERIFIER DEBUG] Successfully parsed JSON, parsed value:`, parsed);
      } catch {
        console.log(`[VERIFIER DEBUG] Not JSON-encoded, using raw value`);
      }

      const [verifier] = parsed.split("/");
      console.log(`[VERIFIER DEBUG] Key: ${key}, extracted verifier: "${verifier}", length: ${verifier?.length}`);
      if (verifier && verifier.trim().length > 0) {
        console.log(`[VERIFIER DEBUG] Found valid verifier for key ${key}`);
        return { verifier: verifier.trim(), storageKey: key };
      }
    } catch (err) {
      console.log(`[VERIFIER DEBUG] Error processing key ${key}:`, err);
      // Skip malformed entries
    }
  }

  console.log("[VERIFIER DEBUG] No valid verifier found, returning null");
  return null;
};

export default function CallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  const code = searchParams?.get("code") ?? null;
  const redirectParam = searchParams?.get("redirect") ?? null;
  const workspaceHost = useMemo(() => {
    if (typeof window === "undefined") {
      return null;
    }
    return resolveWorkspaceHost(window.location.host);
  }, []);

  useEffect(() => {
    const processCallback = async () => {
      const supabase = getSupabaseClient();
      const currentOrigin =
        typeof window !== "undefined" ? window.location.origin : undefined;
      if (!supabase || !currentOrigin) {
        const message = "Supabase client is not configured.";
        try {
          sessionStorage.setItem("auth-callback-error", message);
        } catch {
          /* ignore */
        }
        router.replace(`/login?error=${encodeURIComponent(message)}`);
        return;
      }

      if (!code) {
        const message = "No authorization code provided.";
        try {
          sessionStorage.setItem("auth-callback-error", message);
        } catch {
          /* ignore */
        }
        router.replace(`/login?error=${encodeURIComponent(message)}`);
        return;
      }

      try {
        const perfStart = performance.now();

        // Debug logging for troubleshooting auth issues
        console.log("[AUTH DEBUG] Callback processing started");
        console.log("[AUTH DEBUG] Origin:", currentOrigin);
        console.log("[AUTH DEBUG] Code:", code ? "Present" : "Missing");

        if (typeof window !== "undefined") {
          const sbKeys = Object.keys(window.localStorage).filter(k => k.startsWith("sb-"));
          console.log("[AUTH DEBUG] Supabase keys in localStorage:", sbKeys);
          sbKeys.forEach(k => {
            if (k.endsWith("code-verifier")) {
              console.log(`[AUTH DEBUG] Found verifier key: ${k}, value length: ${window.localStorage.getItem(k)?.length}`);
            }
          });
        }

        // CRITICAL: Extract the code verifier BEFORE calling exchangeCodeForSession
        // because Supabase's SDK will delete it from storage even if the exchange fails
        const codeVerifier = findCodeVerifier();
        console.log("[AUTH DEBUG] Pre-extracted code verifier:", codeVerifier ? "Found" : "Not found");

        let data: { session?: any; user?: any } | null = null;

        try {
          const { data: primaryData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          console.log(`[AUTH PERF] Client-side code exchange took ${(performance.now() - perfStart).toFixed(2)}ms`);
          if (exchangeError) {
            throw exchangeError;
          }
          data = primaryData;
        } catch (primaryError) {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
          const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

          if (
            codeVerifier &&
            supabaseUrl &&
            supabaseAnonKey &&
            typeof fetch !== "undefined"
          ) {
            console.log(`[AUTH DEBUG] Found PKCE verifier in storage key ${codeVerifier.storageKey}`);
            console.warn("[AUTH DEBUG] Primary exchange failed; attempting manual PKCE exchange");
            console.log(`[AUTH DEBUG] Sending verifier (length ${codeVerifier.verifier.length}):`, codeVerifier.verifier);
            console.log(`[AUTH DEBUG] Sending auth_code (length ${code.length}):`, code.substring(0, 10) + "...");
            const manualStart = performance.now();
            const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=pkce`, {
              method: "POST",
              headers: {
                "content-type": "application/json",
                apikey: supabaseAnonKey,
              },
              body: JSON.stringify({
                auth_code: code,
                code_verifier: codeVerifier.verifier,
              }),
            });

            const payload = await response.json().catch(() => null);
            if (!response.ok) {
              const detail =
                payload?.error_description ||
                payload?.error ||
                payload?.message ||
                "Code exchange failed.";
              throw new Error(detail);
            }

            const accessToken = payload?.access_token ?? null;
            const refreshToken = payload?.refresh_token ?? null;

            if (!accessToken || !refreshToken) {
              throw new Error("Code exchange response missing tokens.");
            }

            const { data: manualData, error: setSessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (setSessionError) {
              throw setSessionError;
            }

            data = manualData;
            console.log(`[AUTH PERF] Manual PKCE exchange + session set took ${(performance.now() - manualStart).toFixed(2)}ms`);

            try {
              window.localStorage.removeItem(codeVerifier.storageKey);
              window.sessionStorage.removeItem(codeVerifier.storageKey);
            } catch {
              // Ignore cleanup errors
            }
          } else {
            console.error("[AUTH ERROR] Code verifier not found in storage; cannot complete PKCE exchange.");
            throw primaryError;
          }
        }

        if (!data) {
          throw new Error("No session returned from code exchange.");
        }

        const accessToken =
          data.session?.access_token ??
          data.session?.provider_token ??
          data.session?.access_token ??
          null;

        if (accessToken) {
          const syncStart = performance.now();
          await fetch("/api/auth/session", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ accessToken }),
          }).catch(() => {
            // Continue even if cookie sync fails; the Supabase session is still active client-side.
          });
          console.log(`[AUTH PERF] Session sync took ${(performance.now() - syncStart).toFixed(2)}ms`);
        }

        const destination = resolveDestination(redirectParam, workspaceHost, currentOrigin);
        console.log(`[AUTH DEBUG] Redirecting to: ${destination}`);
        window.location.replace(destination);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unable to complete sign-in.";
        setError(message);
        try {
          sessionStorage.setItem("auth-callback-error", message);
        } catch {
          /* ignore */
        }
        router.replace(`/login?error=${encodeURIComponent(message)}`);
      }
    };

    processCallback();
  }, [code, redirectParam, router, workspaceHost]);

  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        placeItems: "center",
        padding: "1.5rem",
        margin: 0,
        width: "100vw",
        height: "100vh",
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: 520, width: "100%", textAlign: "center" }}>
        <p style={{ fontSize: "1.1rem", fontWeight: 600 }}>Completing sign-in…</p>
        <p style={{ marginTop: "0.75rem", color: "#6b7280" }}>
          {error ?? "Please wait while we finish logging you in."}
        </p>
      </div>
    </main>
  );
}
