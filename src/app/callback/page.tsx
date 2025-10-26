"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";
import styles from "./page.module.css";

type Status = "processing" | "success" | "error";

export default function GrayCallbackPage() {
  return (
    <Suspense fallback={<ProcessingFallback />}>
      <GrayCallbackContent />
    </Suspense>
  );
}

function ProcessingFallback() {
  return (
    <main className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.glow} />
        <h1>gray_aligned</h1>
        <p className={styles.status} data-state="processing">
          Finalizing your login…
        </p>
      </div>
    </main>
  );
}

function GrayCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>("processing");
  const [message, setMessage] = useState<string>("Finalizing your login…");

  useEffect(() => {
    let isMounted = true;

    const processSession = async () => {
      // Check if we've already processed tokens in this session
      if (typeof window !== "undefined") {
        const processed = sessionStorage.getItem('auth-callback-processed');
        if (processed) {
          console.log('Auth callback already processed, redirecting to final destination');
          const redirectTarget = new URLSearchParams(window.location.search).get("redirect")?.trim() || "/";
          router.replace(redirectTarget);
          router.refresh();
          return;
        }
      }
      const supabase = getSupabaseClient();
      if (!supabase) {
        if (!isMounted) {
          return;
        }
        setStatus("error");
        setMessage("Supabase client is not configured. Check environment.");
        return;
      }

      const redirectTarget = searchParams.get("redirect")?.trim() || "/";

      try {
        if (!isMounted) {
          return;
        }

        console.log('Current URL:', window.location.href);
        console.log('Hash:', window.location.hash);
        console.log('Search params:', window.location.search);

        // Check hash parameters first
        const hash = window.location.hash.startsWith("#")
          ? window.location.hash.slice(1)
          : window.location.hash;
        console.log('Processed hash:', hash);

        let params = new URLSearchParams(hash);
        console.log('URLSearchParams keys from hash:', Array.from(params.keys()));

        let accessToken = params.get("access_token");
        let refreshToken = params.get("refresh_token");

        // If no tokens in hash, check URL search parameters
        if (!accessToken && !refreshToken) {
          console.log('No tokens in hash, checking URL search params...');
          params = new URLSearchParams(window.location.search);
          console.log('URLSearchParams keys from search:', Array.from(params.keys()));

          accessToken = params.get("access_token");
          refreshToken = params.get("refresh_token");
        }

        // If we found tokens in URL, store them for potential later use
        if (accessToken && refreshToken && typeof window !== "undefined") {
          sessionStorage.setItem('oauth_access_token', accessToken);
          sessionStorage.setItem('oauth_refresh_token', refreshToken);
          console.log('Stored tokens in sessionStorage');
        }

        console.log('Final access token present:', !!accessToken);
        console.log('Final refresh token present:', !!refreshToken);

        // If no tokens found in current URL, check sessionStorage (in case we stored them)
        if (!accessToken && !refreshToken && typeof window !== "undefined") {
          accessToken = sessionStorage.getItem('oauth_access_token');
          refreshToken = sessionStorage.getItem('oauth_refresh_token');
          console.log('Retrieved tokens from sessionStorage - Access token present:', !!accessToken);
        }

        if (!accessToken || !refreshToken) {
          setStatus("error");
          setMessage("Missing auth tokens in callback.");
          return;
        }

        window.history.replaceState(
          {},
          document.title,
          window.location.pathname + window.location.search
        );

        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (!isMounted) {
          return;
        }

        if (error) {
          setStatus("error");
          setMessage(error.message);
          return;
        }

        let email = data?.user?.email;
        if (!email) {
          const { data: userData } = await supabase.auth.getUser();
          email = userData.user?.email;
        }

        const expiration = new Date();
        expiration.setDate(expiration.getDate() + 30);
        const baseAttributes = [
          "path=/",
          "sameSite=Lax",
          `expires=${expiration.toUTCString()}`,
        ];
        if (window.location.protocol === "https:") {
          baseAttributes.push("secure");
        }
        document.cookie = ["gray-auth=1", ...baseAttributes].join("; ");

        if (email) {
          document.cookie = [
            `gray-auth-email=${encodeURIComponent(email)}`,
            ...baseAttributes,
          ].join("; ");
        }

        setStatus("success");
        setMessage("Signed in. Taking you to your workspace…");

        // Clean up stored tokens and mark as processed
        if (typeof window !== "undefined") {
          sessionStorage.removeItem('oauth_access_token');
          sessionStorage.removeItem('oauth_refresh_token');
          sessionStorage.setItem('auth-callback-processed', 'true');
        }

        setTimeout(() => {
          router.replace(redirectTarget);
          router.refresh();
        }, 1200);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setStatus("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to verify Supabase session."
        );
      }
    };

    void processSession();

    return () => {
      isMounted = false;
    };
  }, [router, searchParams]);

  return (
    <main className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.glow} />
        <h1>gray_aligned</h1>
        <p className={styles.status} data-state={status}>
          {message}
        </p>
        {status === "error" && (
          <button
            className={styles.retry}
            type="button"
            onClick={() => router.replace("/login")}
          >
            Back to sign in
          </button>
        )}
      </div>
    </main>
  );
}
