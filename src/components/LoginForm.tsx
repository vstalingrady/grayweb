"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { FaDiscord, FaGoogle } from "react-icons/fa6";
import ShaderBackground from "@/components/shaders/ShaderBackground";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getSupabaseAuthStorageKeys } from "@/lib/supabaseStorage";
import {
  hostFromUrl,
  isLocalHostname,
  isProductionHost,
  isGrayWorkspaceHost,
  normalizeWorkspaceRedirect,
  resolveDefaultWorkspacePath,
  resolveWorkspaceHost,
  resolveWorkspaceOrigin,
} from "@/lib/grayRouting";
import styles from "./LoginForm.module.css";
import { persistAuthCookies, clearAuthCookies } from "@/lib/auth/cookies";

type MessageState =
  | { type: "idle" }
  | { type: "success"; text: string }
  | { type: "error"; text: string };

type AuthMode = "signin" | "signup";

type LoginFormProps = {
  initialMode?: AuthMode;
};

const providers = [
  { id: "google" as const, label: "Google", icon: FaGoogle },
  { id: "discord" as const, label: "Discord", icon: FaDiscord },
];

const envRedirect = process.env.NEXT_PUBLIC_AUTH_REDIRECT?.trim();
const envSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
const CALLBACK_PATH = "/callback";
const SUPABASE_STORAGE_KEYS = getSupabaseAuthStorageKeys();
const MIN_PASSWORD_LENGTH = 8;

const resolveSiteOrigin = (): string => {
  if (typeof window !== "undefined" && window.location?.origin) {
    const { origin, hostname } = window.location;

    // Development environment - use localhost-derived origin
    if (isLocalHostname(hostname)) {
      return origin;
    }

    // Dedicated Gray hosts should respect their own origins
    if (isProductionHost(hostname) || isGrayWorkspaceHost(hostname)) {
      return origin;
    }

    // Default to production for unknown hosts
    return `https://gray.alignment.id`;
  }

  if (envSiteUrl) {
    try {
      const normalized = envSiteUrl.startsWith("http")
        ? envSiteUrl
        : `https://${envSiteUrl}`;
      return new URL(normalized).origin;
    } catch {
      // Ignore invalid SITE_URL values
    }
  }

  // Server-side: check environment for proper fallback
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3000";
  }

  // Server-side fallback to production
  return `https://gray.alignment.id`;
};

const resolveHostContext = (): string | null => {
  if (typeof window !== "undefined" && window.location) {
    return window.location.hostname;
  }

  return hostFromUrl(envSiteUrl);
};

const ensureAbsoluteUrl = (target: string): string => {
  if (target.startsWith("http://") || target.startsWith("https://")) {
    return target;
  }

  const origin = resolveSiteOrigin();
  return new URL(target, origin).toString();
};

const sanitizeRedirect = (target: string | null | undefined): string | null => {
  if (!target) {
    return null;
  }

  try {
    const trimmed = target.trim();
    if (!trimmed) {
      return null;
    }

    const url = new URL(trimmed, "http://localhost");
    if (url.origin !== "http://localhost") {
      return null;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
};

const resolvePostAuthDestination = (): string => {
  const host = resolveHostContext();
  const workspaceHost = resolveWorkspaceHost(host) ?? host;

  if (envRedirect) {
    try {
      const u = new URL(envRedirect, "https://placeholder");
      if (!u.host) {
        return normalizeWorkspaceRedirect(envRedirect, workspaceHost);
      }

      if (
        isProductionHost(u.host) ||
        (workspaceHost && u.hostname === workspaceHost) ||
        (host && u.hostname === host)
      ) {
        return envRedirect;
      }
    } catch {
      // Ignore invalid auth redirect configuration
    }
  }

  if (typeof window !== "undefined") {
    const url = new URL(window.location.href);
    const sanitized = sanitizeRedirect(url.searchParams.get("redirect"));
    if (sanitized) {
      return normalizeWorkspaceRedirect(sanitized, workspaceHost);
    }
  }

  return resolveDefaultWorkspacePath(workspaceHost);
};

const buildLoopbackOrigin = (
  protocol?: string,
  port?: string | null | undefined
): string => {
  const normalizedProtocol =
    protocol && protocol.endsWith(":") ? protocol : `${protocol ?? "http"}:`;
  const portSuffix = port ? `:${port}` : "";
  return `${normalizedProtocol}//localhost${portSuffix}`;
};

const isLoopbackHost = (host: string | null | undefined): boolean =>
  host === "localhost" || host === "127.0.0.1";

const resolveCallbackOrigin = (): string => {
  if (typeof window !== "undefined" && window.location) {
    const { hostname, protocol, port } = window.location;

    if (isLoopbackHost(hostname)) {
      return buildLoopbackOrigin(protocol, port);
    }

    const workspaceOrigin = resolveWorkspaceOrigin(hostname, protocol, port);

    if (workspaceOrigin) {
      try {
        const parsed = new URL(workspaceOrigin);
        if (isLoopbackHost(parsed.hostname)) {
          return buildLoopbackOrigin(parsed.protocol, parsed.port);
        }
        return parsed.origin;
      } catch {
        return workspaceOrigin;
      }
    }

    return window.location.origin;
  }

  const origin = resolveSiteOrigin();
  try {
    const parsed = new URL(origin);
    if (isLoopbackHost(parsed.hostname)) {
      return buildLoopbackOrigin(parsed.protocol, parsed.port);
    }
    return parsed.origin;
  } catch {
    return origin;
  }
};

const buildCallbackDestination = (): string => {
  const target = resolvePostAuthDestination();
  const encoded = encodeURIComponent(target);
  const origin = resolveCallbackOrigin();
  return `${origin}${CALLBACK_PATH}?redirect=${encoded}`;
};

const overrideSupabaseRedirectUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("redirect_to", buildCallbackDestination());
    return parsed.toString();
  } catch {
    return url;
  }
};

export default function LoginForm({ initialMode = "signin" }: LoginFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<MessageState>({ type: "idle" });
  const [authMode, setAuthMode] = useState<AuthMode>(initialMode);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    setAuthMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    setMessage({ type: "idle" });
    if (authMode === "signup") {
      setPassword("");
    }
    setShowPassword(false);
  }, [authMode]);

  const handleOAuth = async (provider: "google" | "discord") => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setMessage({
        type: "error",
        text: "Supabase client is not configured. Check environment variables.",
      });
      return;
    }

    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.removeItem("auth-callback-processed");
      } catch {
        // Ignore storage access issues
      }
    }

    setLoading(true);
    setMessage({ type: "idle" });

    try {
      const redirectTo = ensureAbsoluteUrl(buildCallbackDestination());
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          scopes:
            provider === "discord"
              ? "identify email guilds"
              : "email profile openid",
          skipBrowserRedirect: true,
        },
      });
      if (error) {
        throw error;
      }

      const targetUrl = data?.url
        ? overrideSupabaseRedirectUrl(data.url)
        : null;

      if (!targetUrl) {
        throw new Error("Unable to initiate OAuth flow.");
      }

      window.location.assign(targetUrl);
    } catch (error) {
      const text =
        error instanceof Error ? error.message : "OAuth request failed.";
      setMessage({ type: "error", text });
    } finally {
      setLoading(false);
    }
  };

  const performPostAuthNavigation = (destination: string) => {
    if (typeof window === "undefined") {
      return;
    }

    if (destination.startsWith("http://") || destination.startsWith("https://")) {
      window.location.href = destination;
      return;
    }

    const { hostname, protocol, port } = window.location;
    const workspaceHost = resolveWorkspaceHost(hostname);
    const workspaceOrigin = resolveWorkspaceOrigin(hostname, protocol, port);
    const shouldUseFallback = !workspaceHost && isLocalHostname(hostname);
    const fallbackWorkspaceHost = "gray.localhost";
    const fallbackWorkspaceOrigin = `${protocol}//${fallbackWorkspaceHost}${port ? `:${port}` : ""}`;
    const effectiveHost = workspaceHost ?? (shouldUseFallback ? fallbackWorkspaceHost : undefined);
    const effectiveOrigin = workspaceOrigin ?? (shouldUseFallback ? fallbackWorkspaceOrigin : undefined);

    if (effectiveHost && effectiveOrigin) {
      const normalizedPath = normalizeWorkspaceRedirect(destination, effectiveHost);
      const finalPath = normalizedPath.startsWith("/")
        ? normalizedPath
        : `/${normalizedPath}`;
      window.location.href = `${effectiveOrigin}${finalPath}`;
      return;
    }

    const absoluteDestination = ensureAbsoluteUrl(destination);
    window.location.href = absoluteDestination;
  };

  const handleEmailAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage({ type: "idle" });
    const supabase = getSupabaseClient();

    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      setMessage({
        type: "error",
        text: "Please enter both email and password to continue.",
      });
      return;
    }

    if (authMode === "signup" && password.length < MIN_PASSWORD_LENGTH) {
      setMessage({
        type: "error",
        text: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
      });
      return;
    }

    if (trimmedEmail !== email) {
      setEmail(trimmedEmail);
    }

    if (!supabase) {
      setMessage({
        type: "error",
        text: "Supabase client is not configured. Check environment variables.",
      });
      return;
    }

    setLoading(true);
    try {
      const isSignIn = authMode === "signin";
      if (isSignIn) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });

        if (error) {
          throw error;
        }

        if (!remember && typeof window !== "undefined") {
          SUPABASE_STORAGE_KEYS.forEach((key) => {
            window.localStorage.removeItem(key);
          });
          clearAuthCookies();
        }

        if (remember) {
          persistAuthCookies(
            data.session?.user?.email ?? data.user?.email ?? trimmedEmail
          );
        } else {
          clearAuthCookies();
        }

        const destination = resolvePostAuthDestination();
        if (typeof window !== "undefined") {
          performPostAuthNavigation(destination);
        }
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          emailRedirectTo: ensureAbsoluteUrl(buildCallbackDestination()),
        },
      });

      if (error) {
        throw error;
      }

      const sessionEmail =
        data.session?.user?.email ?? data.user?.email ?? trimmedEmail ?? null;

      if (data.session) {
        if (!remember && typeof window !== "undefined") {
          SUPABASE_STORAGE_KEYS.forEach((key) => {
            window.localStorage.removeItem(key);
          });
          clearAuthCookies();
        }
        if (remember) {
          persistAuthCookies(sessionEmail);
        } else {
          clearAuthCookies();
        }
        const destination = resolvePostAuthDestination();
        if (typeof window !== "undefined") {
          performPostAuthNavigation(destination);
        }
        return;
      }

      setPassword("");
      setMessage({
        type: "success",
        text: "Check your email to confirm your account. Once verified, return here to sign in.",
      });
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : authMode === "signin"
            ? "Unable to sign in."
            : "Unable to sign up.";
      setMessage({ type: "error", text });
    } finally {
      setLoading(false);
    }
  };

  const isSignIn = authMode === "signin";
  const heading = isSignIn ? "Welcome back" : "Welcome";
  const subtitle = isSignIn
    ? "Accelerate your personal growth."
    : "Create your account to start accelerating your personal growth.";
  const submitLabel = isSignIn ? "Sign In" : "Create Account";
  const footerPrompt = isSignIn
    ? "Don't have an account?"
    : "Already have an account?";
  const footerAction = isSignIn ? "Sign Up" : "Sign In";

  const handleModeToggle = () => {
    setAuthMode(isSignIn ? "signup" : "signin");
    if (typeof pathname === "string") {
      if (isSignIn && pathname.startsWith("/login")) {
        router.replace("/signup");
      } else if (!isSignIn && pathname.startsWith("/signup")) {
        router.replace("/login");
      }
    }
  };

  const renderedMessage =
    message.type === "idle"
      ? null
      : (
        <p
          className={`${styles.authFeedback} ${message.type === "success"
            ? styles.authFeedbackSuccess
            : styles.authFeedbackError
            }`}
        >
          {message.text}
        </p>
      );

  return (
    <div className={styles.authPage}>
      <div className={styles.authShell}>
        <aside className={styles.authVisualPanel} aria-hidden>
          <ShaderBackground className={styles.authVisualGradient} fullHeight={false}>
            <div className={styles.authGlassFrame}>
              <span className={styles.authGlassGlow} />
              <span className={styles.authGlassSurface} />
              <div className={styles.authGlassCore}>
                <span className={styles.authGlassCoreSheen} />
                <div className={styles.authVisual}>
                  <div className={styles.authOrb}>
                    <Image
                      src="/grayaiwhitenotspinning.svg"
                      alt="Gray emblem"
                      width={180}
                      height={180}
                      priority
                      className={styles.authOrbLogo}
                      style={{ height: "auto", width: "clamp(140px, 28vw, 180px)" }}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.authMantra}>
              <span className={styles.authMantraLine}>For the best in us.</span>
              <span className={`${styles.authMantraLine} ${styles.authMantraLineAlt}`}>
                Maximize human potential.
              </span>
            </div>
          </ShaderBackground>
        </aside>
        <section className={styles.authContent}>
          <Image
            src="/alignmentlogo.svg"
            alt="Alignment logo"
            width={140}
            height={36}
            priority
            className={styles.authAlignmentLogo}
          />
          <div className={styles.authPanel}>
            <header className={styles.authHeading}>
              <h1 className={styles.authTitle}>{heading}</h1>
              <p className={styles.authSubtitle}>{subtitle}</p>
            </header>

            <div className={styles.authOauth}>
              {providers.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  className={styles.authOauthButton}
                  onClick={() => handleOAuth(id)}
                  disabled={loading}
                >
                  <span className={styles.authOauthIcon}>
                    <Icon size={18} />
                  </span>
                  Continue with {label}
                </button>
              ))}
            </div>

            <div className={styles.authDivider}>or continue with email</div>

            <form className={styles.authForm} onSubmit={handleEmailAuth}>
              <div className={styles.authFields}>
                <div className={styles.authField}>
                  <label className={styles.authFieldLabel} htmlFor="email">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    className={styles.authFieldInput}
                    placeholder="you@example.com"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={loading}
                    required
                  />
                </div>

                <div className={styles.authField}>
                  <label className={styles.authFieldLabel} htmlFor="password">
                    Password
                  </label>
                  <div className={styles.authFieldInputWrapper}>
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      className={styles.authFieldInput}
                      placeholder="••••••••"
                      autoComplete={
                        isSignIn ? "current-password" : "new-password"
                      }
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      disabled={loading}
                      required
                    />
                    <button
                      type="button"
                      className={styles.authPasswordToggle}
                      onClick={() => setShowPassword((value) => !value)}
                      aria-pressed={showPassword}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      disabled={loading}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
              </div>

              <div className={styles.authOptions}>
                <label className={styles.authRemember}>
                  <input
                    type="checkbox"
                    className={styles.authToggleInput}
                    checked={remember}
                    onChange={(event) => setRemember(event.target.checked)}
                    disabled={loading}
                  />
                  <span className={styles.authToggleTrack} aria-hidden>
                    <span className={styles.authToggleThumb} />
                  </span>
                  <span className={styles.authRememberLabel}>Remember me</span>
                </label>
                <a
                  className={styles.authForgot}
                  href="https://app.supabase.com/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Forgot password?
                </a>
              </div>

              {renderedMessage}

              <button
                type="submit"
                className={styles.authSubmit}
                disabled={loading}
              >
                {loading ? (
                  <LoaderCircle size={18} className={styles.authSpinner} />
                ) : (
                  submitLabel
                )}
              </button>
            </form>

            <div className={styles.authFooter}>
              <span className={styles.authFooterPrompt}>{footerPrompt}</span>
              <button
                type="button"
                className={styles.authFooterLink}
                onClick={handleModeToggle}
                disabled={loading}
              >
                {footerAction}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
