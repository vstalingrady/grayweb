"use client";

import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { FaDiscord, FaGoogle } from "react-icons/fa6";
import { Turnstile, TurnstileInstance } from "@marsidev/react-turnstile";
import ShaderBackground from "@/components/shaders/ShaderBackground";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getSupabaseAuthStorageKeys } from "@/lib/supabaseStorage";
import { useI18n } from "@/contexts/I18nContext";
import {
  buildCallbackDestination,
  ensureAbsoluteUrl,
  resolvePostAuthDestination,
} from "@/components/login/loginRedirect";
import {
  isLocalHostname,
  hostFromUrl,
  normalizeWorkspaceRedirect,
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

const SUPABASE_STORAGE_KEYS = getSupabaseAuthStorageKeys();
const MIN_PASSWORD_LENGTH = 8;
const isAuthDebugEnabled = process.env.NODE_ENV !== "production";

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
  const [pendingEmailConfirmation, setPendingEmailConfirmation] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [shouldUseCaptcha, setShouldUseCaptcha] = useState(false);
  const turnstileRef = useRef<TurnstileInstance | null>(null);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";
  const supabaseHost = hostFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);

  const searchParams = useSearchParams();

  useEffect(() => {
    setAuthMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!turnstileSiteKey) {
      setShouldUseCaptcha(false);
      setCaptchaToken(null);
      return;
    }

    const { hostname } = window.location;
    const isLocal = isLocalHostname(hostname);
    const isSupabaseLocal = isLocalHostname(supabaseHost);
    const shouldEnable = !(isLocal && isSupabaseLocal);
    setShouldUseCaptcha(shouldEnable);

    if (!shouldEnable) {
      setCaptchaToken(null);
    }
  }, [turnstileSiteKey, supabaseHost]);


  useEffect(() => {
    setMessage({ type: "idle" });
    if (authMode === "signup") {
      setPassword("");
    }
    setShowPassword(false);
    setPendingEmailConfirmation(false);
    setCaptchaToken(null);
    if (turnstileRef.current) {
      turnstileRef.current.reset();
    }
  }, [authMode]);

  const resetCaptcha = () => {
    setCaptchaToken(null);
    if (turnstileRef.current) {
      turnstileRef.current.reset();
    }
  };

  const ensureCaptcha = () => {
    if (!shouldUseCaptcha) {
      return true;
    }
    if (captchaToken) {
      return true;
    }
    setMessage({
      type: "error",
      text: t("Please complete the verification step before continuing."),
    });
    return false;
  };

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
      if (isTimeoutOrDuplicate) {
        return t(
          "Captcha verification expired or was already used. Please complete the verification again to continue."
        );
      }
      return t("Turnstile verification failed. Please complete the captcha check again to continue.");
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

    if (!ensureCaptcha()) {
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
      if (isAuthDebugEnabled) {
        console.log("[AUTH DEBUG] Generated OAuth redirectTo:", callbackUrl);
      }
      const captchaTokenValue = shouldUseCaptcha ? captchaToken : null;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: callbackUrl,
          skipBrowserRedirect: true,
          scopes:
            provider === "discord"
              ? "identify email guilds"
              : "email profile openid",
          ...(captchaTokenValue ? { captchaToken: captchaTokenValue } : {}),
        },
      });
      if (error) {
        throw error;
      }

      if (data.url) {
        if (isAuthDebugEnabled) {
          console.log(`[AUTH PERF] OAuth ${provider} redirecting to:`, data.url);
        }
        window.location.replace(data.url);
        return;
      }


      if (isAuthDebugEnabled) {
        console.log(`[AUTH PERF] OAuth ${provider} initiated in ${(performance.now() - perfStart).toFixed(2)}ms`);
      }
    } catch (error) {
      const text = handleCaptchaErrorReset(error) || "OAuth request failed.";
      setMessage({ type: "error", text });
    } finally {
      setLoading(false);
      if (shouldUseCaptcha) {
        resetCaptcha();
      }
    }
  };

  const performPostAuthNavigation = useCallback((destination: string) => {
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
  }, [reconfirmDelete]);

  useEffect(() => {
    if (deleted) {
      return;
    }

    let cancelled = false;

    const syncExistingSession = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      const accessToken = session?.access_token;
      if (!accessToken) {
        return;
      }

      const synced = await persistAuthCookies(session?.user?.email ?? null, accessToken);
      if (!synced || cancelled) {
        return;
      }

      const destination = redirectTo ?? resolvePostAuthDestination();
      performPostAuthNavigation(destination);
    };

    void syncExistingSession();

    return () => {
      cancelled = true;
    };
  }, [deleted, redirectTo, performPostAuthNavigation]);

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

    if (!ensureCaptcha()) {
      return;
    }

    setLoading(true);
    try {
      const captchaTokenValue = shouldUseCaptcha ? captchaToken : null;
      const isSignIn = authMode === "signin";
      if (isSignIn) {
        const authStart = performance.now();
        const { data, error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
          ...(captchaTokenValue ? { options: { captchaToken: captchaTokenValue } } : {}),
        });

        if (isAuthDebugEnabled) {
          console.log(
            `[AUTH PERF] Sign in request took ${(performance.now() - authStart).toFixed(2)}ms`
          );
        }

        if (error) {
          throw error;
        }

        // Optimize: Batch storage operations
        if (typeof window !== "undefined") {
          if (!remember) {
            SUPABASE_STORAGE_KEYS.forEach((key) => {
              window.localStorage.removeItem(key);
            });
            void clearAuthCookies();
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
        if (isAuthDebugEnabled) {
          console.log(`[AUTH PERF] Total sign in flow took ${(performance.now() - perfStart).toFixed(2)}ms`);
        }
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
          ...(captchaTokenValue ? { captchaToken: captchaTokenValue } : {}),
        },
      });
      if (isAuthDebugEnabled) {
        console.log(`[AUTH PERF] Sign up request took ${(performance.now() - authStart).toFixed(2)}ms`);
      }

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
            void clearAuthCookies();
          } else {
            await persistAuthCookies(sessionEmail, data.session?.access_token ?? null);
          }
        }
        const destination = resolvePostAuthDestination();
        if (isAuthDebugEnabled) {
          console.log(`[AUTH PERF] Total sign up flow took ${(performance.now() - perfStart).toFixed(2)}ms`);
        }
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
      if (shouldUseCaptcha) {
        resetCaptcha();
      }
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

    if (!ensureCaptcha()) {
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
          ...(shouldUseCaptcha && captchaToken ? { captchaToken } : {}),
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
      if (shouldUseCaptcha) {
        resetCaptcha();
      }
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

    if (!ensureCaptcha()) {
      return;
    }

    setLoading(true);
    setMessage({ type: "idle" });

    try {
      const redirectTo = ensureAbsoluteUrl("/reset-password");
      const { error } = await supabase.auth.resetPasswordForEmail(
        trimmedEmail,
        {
          redirectTo,
          ...(shouldUseCaptcha && captchaToken ? { captchaToken } : {}),
        }
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
      if (shouldUseCaptcha) {
        resetCaptcha();
      }
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

              {shouldUseCaptcha && turnstileSiteKey ? (
                <div className={styles.authCaptcha}>
                  <Turnstile
                    ref={turnstileRef}
                    siteKey={turnstileSiteKey}
                    options={{
                      theme: isLightTheme ? "light" : "dark",
                    }}
                    onSuccess={(token) => setCaptchaToken(token)}
                    onExpire={() => setCaptchaToken(null)}
                    onError={() => setCaptchaToken(null)}
                  />
                </div>
              ) : null}

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
