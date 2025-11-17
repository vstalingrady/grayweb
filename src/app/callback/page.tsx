"use client";

import Image from "next/image";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { persistAuthCookies } from "@/lib/auth/cookies";
import {
  normalizeWorkspaceRedirect,
  resolveDefaultWorkspacePath,
  resolveWorkspaceHost,
  resolveWorkspaceOrigin,
} from "@/lib/grayRouting";
import styles from "./page.module.css";

const Spinner = () => (
  <div className={styles.wrapper}>
    <div className={styles.logoShell}>
      <div className={styles.logoGlow} />
      <div className={styles.logoOuter}>
        <div className={styles.logoInner}>
          <Image src="/grayaiwhite.svg" alt="Gray logo" fill priority sizes="320px" />
        </div>
      </div>
    </div>
  </div>
);

export default function GrayCallbackPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <GrayCallbackContent />
    </Suspense>
  );
}

function GrayCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    let isActive = true;

    const decodeParam = (value: string | null): string | null => {
      if (!value) {
        return null;
      }
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    };

    const redirectToLogin = () => {
      if (!isActive) {
        return;
      }
      router.replace("/login");
      router.refresh();
    };

    const processSession = async () => {
      if (typeof window === "undefined") {
        return;
      }

      const supabase = getSupabaseClient();
      if (!supabase) {
        redirectToLogin();
        return;
      }

      const currentHost = window.location.hostname;
      const workspaceHost = resolveWorkspaceHost(currentHost) ?? currentHost;
      const workspaceOrigin = resolveWorkspaceOrigin(
        currentHost,
        window.location.protocol,
        window.location.port
      );
      const rawRedirect = searchParams.get("redirect")?.trim() || "";
      const defaultRedirect = resolveDefaultWorkspacePath(workspaceHost);
      const initialRedirect =
        rawRedirect && rawRedirect.startsWith("/")
          ? rawRedirect
          : defaultRedirect;
      const redirectTarget = normalizeWorkspaceRedirect(
        initialRedirect,
        workspaceHost
      );

      const navigateToDestination = () => {
        if (!isActive) {
          return;
        }

        const normalized =
          redirectTarget.startsWith("/") ? redirectTarget : `/${redirectTarget}`;

        if (workspaceOrigin) {
          window.location.href = `${workspaceOrigin}${normalized}`;
          return;
        }

        router.replace(normalized);
        router.refresh();
      };

      try {
        const currentUrl = new URL(window.location.href);
        const rawHash = currentUrl.hash.startsWith("#")
          ? currentUrl.hash.slice(1)
          : currentUrl.hash;
        const hashParams = new URLSearchParams(rawHash);
        const queryParams = new URLSearchParams(currentUrl.search);

        const stateParam =
          hashParams.get("state") || queryParams.get("state") || "";
        if (stateParam) {
          const processedState = sessionStorage.getItem(
            "auth-callback-processed"
          );
          if (processedState === stateParam) {
            navigateToDestination();
            return;
          }
        }

        const rawError =
          hashParams.get("error_description") ||
          queryParams.get("error_description") ||
          hashParams.get("error") ||
          queryParams.get("error");

        const resolvedError = decodeParam(rawError);
        if (resolvedError) {
          redirectToLogin();
          return;
        }

        let accessToken =
          hashParams.get("access_token") || queryParams.get("access_token");
        let refreshToken =
          hashParams.get("refresh_token") || queryParams.get("refresh_token");

        if (!accessToken || !refreshToken) {
          accessToken =
            sessionStorage.getItem("oauth_access_token") ?? accessToken ?? null;
          refreshToken =
            sessionStorage.getItem("oauth_refresh_token") ?? refreshToken ?? null;
        }

        const authCode = hashParams.get("code") || queryParams.get("code");

        let email: string | undefined;

        if (authCode) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(authCode);

          if (!isActive) {
            return;
          }

          if (error) {
            redirectToLogin();
            return;
          }

          email = data.session?.user?.email ?? data.user?.email ?? undefined;
        } else if (accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (!isActive) {
            return;
          }

          if (error) {
            redirectToLogin();
            return;
          }

          email = data.session?.user?.email ?? data.user?.email ?? undefined;
        } else {
          const { data, error } = await supabase.auth.getSession();

          if (!isActive) {
            return;
          }

          if (error) {
            redirectToLogin();
            return;
          }

          const session = data.session ?? null;
          if (session) {
            email = session.user?.email ?? undefined;
          } else {
            redirectToLogin();
            return;
          }
        }

        if (!email) {
          const { data: userData } = await supabase.auth.getUser();
          if (!isActive) {
            return;
          }
          email = userData.user?.email ?? undefined;
        }

        persistAuthCookies(email);

        sessionStorage.removeItem("oauth_access_token");
        sessionStorage.removeItem("oauth_refresh_token");
        if (stateParam) {
          sessionStorage.setItem("auth-callback-processed", stateParam);
        } else {
          sessionStorage.removeItem("auth-callback-processed");
        }

        window.history.replaceState({}, document.title, currentUrl.pathname);

        navigateToDestination();
      } catch {
        try {
          sessionStorage.removeItem("auth-callback-processed");
        } catch {
          // Ignore storage access issues
        }
        redirectToLogin();
      }
    };

    void processSession();

    return () => {
      isActive = false;
    };
  }, [router, searchParams]);

  return <Spinner />;
}
