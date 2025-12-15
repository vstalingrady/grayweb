"use client";

import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { FaDiscord, FaGoogle } from "react-icons/fa6";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import ShaderBackground from "@/components/shaders/ShaderBackground";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getSupabaseAuthStorageKeys } from "@/lib/supabaseStorage";
import { useI18n } from "@/contexts/I18nContext";
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
  deleted?: boolean;
  reconfirmDelete?: boolean;
  headerText?: string;
  subtitleText?: string;
  redirectTo?: string;
  onSuccess?: () => void;
};

const providers = [
  { id: "google" as const, label: "Google", icon: FaGoogle },
  { id: "discord" as const, label: "Discord", icon: FaDiscord },
];

const envRedirect = process.env.NEXT_PUBLIC_AUTH_REDIRECT?.trim();
const envSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
const FALLBACK_TURNSTILE_SITE_KEY = "0x4AAAAAACDfOE8EWig4fsrM";
const envTurnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
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
    // If we are on the server and in dev, we might be behind a proxy or in a container.
    // Ideally we use the configured site URL.
    if (envSiteUrl) {
      return envSiteUrl;
    }
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

  // If we are in the browser, use the current origin to ensure protocol and port match
  if (typeof window !== "undefined") {
    const origin = window.location.origin;
    return new URL(target, origin).toString();
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

  return "/g";
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
      return window.location.origin;
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

const buildCallbackDestination = (customRedirect?: string): string => {
  if (customRedirect) {
    const absoluteTarget = ensureAbsoluteUrl(customRedirect);
    const encoded = encodeURIComponent(absoluteTarget);
    const origin = resolveCallbackOrigin();
    return `${origin}${CALLBACK_PATH}?redirect=${encoded}`;
  }
  const target = resolvePostAuthDestination();
  const absoluteTarget = ensureAbsoluteUrl(target);
  const encoded = encodeURIComponent(absoluteTarget);
  const origin = resolveCallbackOrigin();
  return `${origin}${CALLBACK_PATH}?redirect=${encoded}`;
};



export default function LoginForm({
  initialMode = "signin",
  deleted,
  reconfirmDelete,
  headerText,
  subtitleText,
  redirectTo,
  onSuccess,
}: LoginFormProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [isLightTheme, setIsLightTheme] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const root = document.documentElement;
    const syncTheme = () => setIsLightTheme(root.classList.contains("light"));
    syncTheme();

    const observer = new MutationObserver(() => syncTheme());
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const shouldEnableCaptcha = useMemo(() => {
    // Return false during SSR and initial client render to avoid hydration mismatch
    if (!isMounted) {
      return false;
    }
    const { hostname, port } = window.location;
    if (isLocalHostname(hostname) || port === "3000") {
      return false;
    }
    return true;
  }, [isMounted]);
  const turnstileSiteKey =
    shouldEnableCaptcha
      ? envTurnstileSiteKey && envTurnstileSiteKey.length > 0
        ? envTurnstileSiteKey
        : FALLBACK_TURNSTILE_SITE_KEY
      : undefined;
  const pathname = usePathname();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<MessageState>(
    deleted
      ? {
        type: "success",
        text: t(
          "Your account has been permanently deleted. We've cleared your data, but you're always welcome back."
        ),
      }
      : reconfirmDelete
        ? {
          type: "success",
          text: t(
            "Please re-login to confirm the permanent deletion of your account. This final step helps us ensure your data is securely erased."
          ),
        }
        : { type: "idle" }
  );
  const [authMode, setAuthMode] = useState<AuthMode>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | undefined>();
  const [pendingEmailConfirmation, setPendingEmailConfirmation] = useState(false);
  const turnstileRef = useRef<TurnstileInstance | undefined>(undefined);

  const searchParams = useSearchParams();

  useEffect(() => {
    setAuthMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    setMessage({ type: "idle" });
    if (authMode === "signup") {
      setPassword("");
    }
    setShowPassword(false);
    setCaptchaToken(undefined);
    setPendingEmailConfirmation(false);
  }, [authMode]);

  const handleCaptchaErrorReset = (error: unknown) => {
    const raw =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "";
    const normalized = raw.toLowerCase();
    const isVerificationFailed = normalized.includes("captcha verification process failed");
    const isTimeoutOrDuplicate =
      normalized.includes("captcha protection: request disallowed (timeout-or-duplicate)") ||
      normalized.includes("timeout-or-duplicate");

    if (isVerificationFailed || isTimeoutOrDuplicate) {
      setCaptchaToken(undefined);
      try {
        turnstileRef.current?.reset();
      } catch {
        // Best-effort reset; ignore failures.
      }
      if (isTimeoutOrDuplicate) {
        return t(
          "Captcha verification expired or was already used. Please complete the verification again to continue."
        );
      }
      return t(
        "Turnstile verification failed. Please complete the captcha check again to continue."
      );
    }
    return raw;
  };

  // Check for OAuth callback errors
  useEffect(() => {
    // Check URL params first
    const errorParam = searchParams?.get("error");
    const reconfirmDeleteParam = searchParams?.get("reconfirm-delete");

    if (errorParam) {
      setMessage({ type: "error", text: decodeURIComponent(errorParam) });
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("error");
      window.history.replaceState({}, "", newUrl.toString());
      return;
    }

    if (reconfirmDeleteParam === "true") {
      setMessage({
        type: "success",
        text: "Please re-login to confirm the permanent deletion of your account. This final step helps us ensure your data is securely erased.",
      });
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("reconfirm-delete");
      window.history.replaceState({}, "", newUrl.toString());
      return;
    }

    try {
      const callbackError = sessionStorage.getItem("auth-callback-error");
      if (callbackError) {
        setMessage({ type: "error", text: callbackError });
        sessionStorage.removeItem("auth-callback-error");
      }
    } catch {
      // Ignore storage access issues
    }
  }, [searchParams]);

  const handleOAuth = async (provider: "google" | "discord") => {
    const perfStart = performance.now();
    const supabase = getSupabaseClient();
    if (!supabase) {
      setMessage({
        type: "error",
        text: t("Supabase client is not configured. Check environment variables."),
      });
      return;
    }

    // Require captcha completion when Turnstile is enabled
    if (turnstileSiteKey && !captchaToken) {
      setMessage({
        type: "error",
        text: t("Please complete the verification step before continuing."),
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
      const callbackUrl = ensureAbsoluteUrl(buildCallbackDestination(redirectTo));
      console.log("[AUTH DEBUG] Generated OAuth redirectTo:", callbackUrl);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: callbackUrl,
          skipBrowserRedirect: true,
          scopes:
            provider === "discord"
              ? "identify email guilds"
              : "email profile openid",
          captchaToken,
        },
      });
      if (error) {
        throw error;
      }

      if (data.url) {
        console.log(`[AUTH PERF] OAuth ${provider} redirecting to:`, data.url);
        window.location.replace(data.url);
        return;
      }


      console.log(`[AUTH PERF] OAuth ${provider} initiated in ${(performance.now() - perfStart).toFixed(2)}ms`);
    } catch (error) {
      const text = handleCaptchaErrorReset(error) || "OAuth request failed.";
      setMessage({ type: "error", text });
      setLoading(false);
    }
  };

  const performPostAuthNavigation = (destination: string) => {
    if (typeof window === "undefined") {
      return;
    }

    if (reconfirmDelete) {
      window.location.href = "/confirm-delete";
      return;
    }

    // Optimize: Direct assignment for absolute URLs
    if (destination.startsWith("http://") || destination.startsWith("https://")) {
      window.location.href = destination;
      return;
    }

    const { hostname, protocol, port } = window.location;

    // Optimize: Batch hostname checks
    const isLocal = isLocalHostname(hostname);
    const workspaceHost = resolveWorkspaceHost(hostname);

    // Fast path for same-origin navigation
    if (!workspaceHost && isLocal) {
      const normalizedPath = destination.startsWith("/") ? destination : `/${destination}`;
      window.location.href = normalizedPath;
      return;
    }

    // Workspace navigation
    if (workspaceHost) {
      const workspaceOrigin = resolveWorkspaceOrigin(hostname, protocol, port);
      const normalizedPath = normalizeWorkspaceRedirect(destination, workspaceHost);
      const finalPath = normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`;
      window.location.href = `${workspaceOrigin}${finalPath}`;
      return;
    }

    // Fallback
    window.location.href = ensureAbsoluteUrl(destination);
  };

  const handleEmailAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const perfStart = performance.now();
    setMessage({ type: "idle" });
    setPendingEmailConfirmation(false);
    const supabase = getSupabaseClient();

    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      setMessage({
        type: "error",
        text: t("Please enter both email and password to continue."),
      });
      return;
    }

    // Enforce captcha when Turnstile is configured
    if (turnstileSiteKey && !captchaToken) {
      setMessage({
        type: "error",
        text: t("Please complete the verification step before continuing."),
      });
      return;
    }

    if (authMode === "signup" && password.length < MIN_PASSWORD_LENGTH) {
      setMessage({
        type: "error",
        text: t("Password must be at least {min} characters long.", {
          min: MIN_PASSWORD_LENGTH,
        }),
      });
      return;
    }

    if (trimmedEmail !== email) {
      setEmail(trimmedEmail);
    }

    if (!supabase) {
      setMessage({
        type: "error",
        text: t("Supabase client is not configured. Check environment variables."),
      });
      return;
    }

    setLoading(true);
    try {
      const isSignIn = authMode === "signin";
      if (isSignIn) {
        const authStart = performance.now();
        const { data, error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
          options: { captchaToken },
        });
        console.log(`[AUTH PERF] Sign in request took ${(performance.now() - authStart).toFixed(2)}ms`);

        if (error) {
          throw error;
        }

        // Optimize: Batch storage operations
        if (typeof window !== "undefined") {
          if (!remember) {
            SUPABASE_STORAGE_KEYS.forEach((key) => {
              window.localStorage.removeItem(key);
            });
            clearAuthCookies();
          } else {
            await persistAuthCookies(
              data.session?.user?.email ?? data.user?.email ?? trimmedEmail,
              data.session?.access_token ?? null
            );
          }
        }

        if (onSuccess) {
          onSuccess();
          return;
        }

        const destination = redirectTo ?? resolvePostAuthDestination();
        console.log(`[AUTH PERF] Total sign in flow took ${(performance.now() - perfStart).toFixed(2)}ms`);
        if (typeof window !== "undefined") {
          performPostAuthNavigation(destination);
        }
        return;
      }

      const authStart = performance.now();
      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          emailRedirectTo: ensureAbsoluteUrl(buildCallbackDestination(redirectTo)),
          captchaToken,
        },
      });
      console.log(`[AUTH PERF] Sign up request took ${(performance.now() - authStart).toFixed(2)}ms`);

      if (error) {
        throw error;
      }

      const sessionEmail =
        data.session?.user?.email ?? data.user?.email ?? trimmedEmail ?? null;

      if (data.session) {
        // Optimize: Batch storage operations
        if (typeof window !== "undefined") {
          if (!remember) {
            SUPABASE_STORAGE_KEYS.forEach((key) => {
              window.localStorage.removeItem(key);
            });
            clearAuthCookies();
          } else {
            await persistAuthCookies(sessionEmail, data.session?.access_token ?? null);
          }
        }
        const destination = resolvePostAuthDestination();
        console.log(`[AUTH PERF] Total sign up flow took ${(performance.now() - perfStart).toFixed(2)}ms`);
        if (typeof window !== "undefined") {
          performPostAuthNavigation(destination);
        }
        return;
      }

      setPassword("");
      setMessage({
        type: "success",
        text: t(
          "Check your email to confirm your account. Once verified, return here to sign in."
        ),
      });
      setPendingEmailConfirmation(true);
    } catch (error) {
      const baseText =
        authMode === "signin" ? t("Unable to sign in.") : t("Unable to sign up.");
      const detail = handleCaptchaErrorReset(error);
      const text = detail || baseText;
      setMessage({ type: "error", text });
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    const supabase = getSupabaseClient();
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setMessage({
        type: "error",
        text: t(
          "Enter your account email above, then click “Resend verification email” again."
        ),
      });
      return;
    }

    if (!supabase) {
      setMessage({
        type: "error",
        text: t("Supabase client is not configured. Check environment variables."),
      });
      return;
    }

    if (turnstileSiteKey && !captchaToken) {
      setMessage({
        type: "error",
        text: t("Please complete the verification step before continuing."),
      });
      return;
    }

    setLoading(true);
    setMessage({ type: "idle" });

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: trimmedEmail,
        options: {
          emailRedirectTo: ensureAbsoluteUrl(buildCallbackDestination(redirectTo)),
          captchaToken,
        },
      });

      if (error) {
        throw error;
      }

      setMessage({
        type: "success",
        text: t(
          "We’ve sent another confirmation email. It may take a minute to arrive; please also check your spam or promotions folder."
        ),
      });
      setPendingEmailConfirmation(true);
    } catch (error) {
      const detail = handleCaptchaErrorReset(error);
      const baseText = t("Unable to resend verification email.");
      setMessage({
        type: "error",
        text: detail || baseText,
      });
      setPendingEmailConfirmation(false);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const supabase = getSupabaseClient();
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setMessage({
        type: "error",
        text: t(
          "Enter your account email above, then click “Forgot password?” again."
        ),
      });
      return;
    }

    if (!supabase) {
      setMessage({
        type: "error",
        text: t("Supabase client is not configured. Check environment variables."),
      });
      return;
    }

    setLoading(true);
    setMessage({ type: "idle" });

    try {
      const redirectTo = ensureAbsoluteUrl("/reset-password");
      const { error } = await supabase.auth.resetPasswordForEmail(
        trimmedEmail,
        { redirectTo }
      );

      if (error) {
        throw error;
      }

      setMessage({
        type: "success",
        text: t("Check your email for a password reset link."),
      });
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : t("Unable to send password reset email.");
      setMessage({ type: "error", text });
    } finally {
      setLoading(false);
    }
  };
  const isSignIn = authMode === "signin";
  const heading = headerText ?? (isSignIn ? t("Welcome back") : t("Welcome"));
  const subtitle = subtitleText ?? (isSignIn
    ? t("Accelerate your personal growth.")
    : t("Create your account to start accelerating your personal growth."));
  const submitLabel = isSignIn ? t("Sign In") : t("Create Account");
  const footerPrompt = isSignIn
    ? t("Don't have an account?")
    : t("Already have an account?");
  const footerAction = isSignIn ? t("Sign Up") : t("Sign In");

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
          <ShaderBackground
            className={styles.authVisualGradient}
            fullHeight={false}
            colors={
              isLightTheme
                ? ["#ffffff", "#f4f4f4", "#dedede", "#b6b6b6", "#6b6b6b"]
                : undefined
            }
            backgroundColor={isLightTheme ? "#ffffff" : undefined}
            speed={isLightTheme ? 1.1 : undefined}
          >
            <div className={styles.authGlassFrame}>
              <div className={styles.authVisual}>
                <div className={styles.authOrb}>
                  <Image
                    src={
                      isLightTheme
                        ? "/grayaiblacknotspinning.svg"
                        : "/grayaiwhitenotspinning.svg"
                    }
                    alt={t("Gray emblem")}
                    width={180}
                    height={180}
                    priority
                    className={styles.authOrbLogo}
                    style={{ height: "auto" }}
                  />
                </div>
              </div>
            </div>
            <div className={styles.authMantra}>
              <span className={styles.authMantraLine}>{t("For the best in us.")}</span>
              <span className={`${styles.authMantraLine} ${styles.authMantraLineAlt}`}>
                {t("Maximize human potential.")}
              </span>
            </div>
          </ShaderBackground>
        </aside>
        <div className={styles.authContent}>
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
                  {t("Continue with {provider}", { provider: label })}
                </button>
              ))}
            </div>

            <div className={styles.authDivider}>{t("or continue with email")}</div>

            <form className={styles.authForm} onSubmit={handleEmailAuth}>
              <div className={styles.authFields}>
                <div className={styles.authField}>
                  <label className={styles.authFieldLabel} htmlFor="email">
                    {t("Email")}
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
                    {t("Password")}
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
                        showPassword ? t("Hide password") : t("Show password")
                      }
                      disabled={loading}
                    >
                      {showPassword ? t("Hide") : t("Show")}
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
                  <span className={styles.authRememberLabel}>{t("Remember me")}</span>
                </label>
                <button
                  type="button"
                  className={styles.authForgot}
                  onClick={handleForgotPassword}
                  disabled={loading}
                >
                  {t("Forgot password?")}
                </button>
              </div>

              {turnstileSiteKey && (
                <div style={{ marginBottom: "1rem" }}>
                  <Turnstile
                    ref={turnstileRef}
                    siteKey={turnstileSiteKey}
                    onSuccess={(token) => setCaptchaToken(token)}
                    onExpire={() => setCaptchaToken(undefined)}
                    onError={() => setCaptchaToken(undefined)}
                    options={{ theme: "auto", appearance: "always" }}
                  />
                </div>
              )}

              {renderedMessage}

              {pendingEmailConfirmation && message.type === "success" && (
                <button
                  type="button"
                  className={styles.authResendVerification}
                  onClick={handleResendVerification}
                  disabled={loading}
                >
                  {t("Resend verification email")}
                </button>
              )}

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
        </div>
      </div>
    </div>
  );
}
