"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";
import styles from "./page.module.css";

type Status = "processing" | "success" | "error";

export default function AlignmentGrayLanding() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [status, setStatus] = useState<Status>("processing");
  const [message, setMessage] = useState<string>("Finalizing your login…");

  useEffect(() => {
    let isMounted = true;

    const processSession = async () => {
      const redirectTarget = searchParams.get("redirect")?.trim() || "/";

      try {
        if (!isMounted) {
          return;
        }

        const hash = window.location.hash.startsWith("#")
          ? window.location.hash.slice(1)
          : window.location.hash;
        const params = new URLSearchParams(hash);
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");

        if (!accessToken || !refreshToken) {
          setStatus("error");
          setMessage("Missing auth tokens in callback.");
          return;
        }

        // Clear the hash to avoid exposing tokens in browser history.
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname + window.location.search
        );

        const { error } = await supabase.auth.setSession({
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

        setStatus("success");
        setMessage("Signed in. Taking you to your workspace…");
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
  }, [router, searchParams, supabase]);

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
            onClick={() => router.replace("/")}
          >
            Back to sign in
          </button>
        )}
      </div>
    </main>
  );
}
