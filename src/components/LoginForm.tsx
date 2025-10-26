"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Loader2, Lock, Mail } from "lucide-react";
import { FaDiscord, FaGoogle } from "react-icons/fa6";
import { getSupabaseClient } from "@/lib/supabaseClient";
import styles from "./LoginForm.module.css";

type MessageState =
  | { type: "idle" }
  | { type: "success"; text: string }
  | { type: "error"; text: string };

const providers = [
  { id: "google" as const, label: "Google", icon: FaGoogle },
  { id: "discord" as const, label: "Discord", icon: FaDiscord },
];

const envRedirect = process.env.NEXT_PUBLIC_AUTH_REDIRECT?.trim();
const envSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

const DEFAULT_APP_PATH = "/";
const CALLBACK_PATH = "/callback";
// Prefer configured site URL; fall back to production domain
const FALLBACK_BASE = envSiteUrl || "https://gray.alignment.id";
const SUPABASE_STORAGE_KEY = (() => {
  if (!supabaseUrl) {
    return undefined;
  }

  try {
    const hostname = new URL(supabaseUrl).hostname;
    const projectRef = hostname.split(".")[0];
    return `sb-${projectRef}-auth-token`;
  } catch {
    return undefined;
  }
})();

const ensureAbsoluteUrl = (target: string): string => {
  if (target.startsWith("http://") || target.startsWith("https://")) {
    return target;
  }

  if (typeof window !== "undefined") {
    return new URL(target, window.location.origin).toString();
  }

  return new URL(target, FALLBACK_BASE).toString();
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
  if (envRedirect) {
    return envRedirect;
  }

  if (typeof window !== "undefined") {
    const url = new URL(window.location.href);
    const sanitized = sanitizeRedirect(url.searchParams.get("redirect"));
    if (sanitized) {
      return sanitized;
    }
  }

  return DEFAULT_APP_PATH;
};

const buildCallbackDestination = (): string => {
  const target = resolvePostAuthDestination();
  const encoded = encodeURIComponent(target);
  return `${CALLBACK_PATH}?redirect=${encoded}`;
};

const persistAuthCookies = (email?: string | null) => {
  if (typeof window === "undefined") {
    return;
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
};

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<MessageState>({ type: "idle" });

  const handleOAuth = async (provider: "google" | "discord") => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setMessage({
        type: "error",
        text: "Supabase client is not configured. Check environment variables.",
      });
      return;
    }

    setLoading(true);
    setMessage({ type: "idle" });

    try {
      const redirectTo = ensureAbsoluteUrl(buildCallbackDestination());
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          scopes:
            provider === "discord"
              ? "identify email guilds"
              : "email profile openid",
        },
      });
      if (error) {
        throw error;
      }
    } catch (error) {
      const text =
        error instanceof Error ? error.message : "OAuth request failed.";
      setMessage({ type: "error", text });
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage({ type: "idle" });
    const supabase = getSupabaseClient();

    if (!email || !password) {
      setMessage({
        type: "error",
        text: "Please enter both email and password to continue.",
      });
      return;
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
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      if (
        !remember &&
        data.session &&
        typeof window !== "undefined" &&
        SUPABASE_STORAGE_KEY
      ) {
        window.localStorage.removeItem(SUPABASE_STORAGE_KEY);
        window.localStorage.removeItem(`${SUPABASE_STORAGE_KEY}-code-verifier`);
        window.localStorage.removeItem(`${SUPABASE_STORAGE_KEY}-user`);
      }

      persistAuthCookies(data.session?.user?.email ?? data.user?.email ?? email);

      const destination = resolvePostAuthDestination();
      if (typeof window !== "undefined") {
        const absoluteDestination = ensureAbsoluteUrl(destination);
        if (
          absoluteDestination.startsWith("http://") ||
          absoluteDestination.startsWith("https://")
        ) {
          window.location.href = absoluteDestination;
        } else {
          router.replace(destination);
          router.refresh();
        }
      }
    } catch (error) {
      const text =
        error instanceof Error ? error.message : "Unable to sign in.";
      setMessage({ type: "error", text });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.content}>
        <header className={styles.header}>
          <h1>Welcome back</h1>
          <p>Sign in to continue crafting your black noir experience.</p>
        </header>

        <div className={styles.oauthRow}>
          {providers.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={styles.oauthButton}
              onClick={() => handleOAuth(id)}
              disabled={loading}
            >
              <span className={styles.brandIcon}>
                <Icon size={18} />
              </span>
              Continue with {label}
            </button>
          ))}
        </div>

        <p className={styles.divider}>or sign in with email</p>

        <form className={styles.form} onSubmit={handleEmailLogin}>
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="email">
              Email
            </label>
            <div className={styles.inputWrapper}>
              <Mail size={18} className={styles.inputIcon} />
              <input
                id="email"
                type="email"
                placeholder="your@email.com"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="password">
              Password
            </label>
            <div className={styles.inputWrapper}>
              <Lock size={18} className={styles.inputIcon} />
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
          </div>

          <div className={styles.row}>
            <label className={styles.remember}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
              />
              Remember me
            </label>
            <a
              className={styles.forgot}
              href="https://app.supabase.com/"
              target="_blank"
              rel="noreferrer"
            >
              Forgot password?
            </a>
          </div>

          {message.type !== "idle" && (
            <div
              className={`${styles.message} ${
                message.type === "success"
                  ? styles.messageSuccess
                  : styles.messageError
              }`}
            >
              {message.text}
            </div>
          )}

          <button
            type="submit"
            className={styles.submitButton}
            disabled={loading}
          >
            {loading ? (
              <Loader2 size={18} className={styles.loader} />
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <footer className={styles.footer}>
          <span>Don&apos;t have an account?</span>
          <a href="/signup">Sign Up</a>
        </footer>
      </div>

      <aside className={styles.accent}>
        <div className={styles.glow} />
        <Image
          src="/grayaiwhite.svg"
          alt="Gray AI emblem"
          width={140}
          height={140}
          priority
          className={styles.accentImage}
        />
      </aside>
    </div>
  );
}
