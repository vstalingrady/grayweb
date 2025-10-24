"use client";

import { FormEvent, useMemo, useState } from "react";
import { Gem, Loader2, Lock, Mail } from "lucide-react";
import { FaDiscord, FaGoogle } from "react-icons/fa6";
import { getSupabaseClient } from "@/lib/supabaseClient";
import styles from "./LoginForm.module.css";

type MessageState =
  | { type: "idle" }
  | { type: "success"; text: string }
  | { type: "error"; text: string };

const providers = [
  { id: "google" as const, label: "Google", icon: FaGoogle, color: "#EA4335" },
  { id: "discord" as const, label: "Discord", icon: FaDiscord, color: "#5865F2" },
];

export default function LoginForm() {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<MessageState>({ type: "idle" });

  const handleOAuth = async (provider: "google" | "discord") => {
    setLoading(true);
    setMessage({ type: "idle" });

    try {
      const redirectTo =
        typeof window !== "undefined" ? window.location.origin : undefined;
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

      setMessage({
        type: "success",
        text: `Redirecting to ${provider} for authentication…`,
      });
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

    if (!email || !password) {
      setMessage({
        type: "error",
        text: "Please enter both email and password to continue.",
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

      if (!remember && data.session) {
        await supabase.auth.setSession(
          {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          },
          { persistSession: false }
        );
      }

      setMessage({
        type: "success",
        text: "Signed in successfully. Redirecting…",
      });
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
          {providers.map(({ id, label, icon: Icon, color }) => (
            <button
              key={id}
              type="button"
              className={styles.oauthButton}
              onClick={() => handleOAuth(id)}
              disabled={loading}
            >
              <span className={styles.brandIcon} style={{ color }}>
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
          <a href="#signup">Sign Up</a>
        </footer>
      </div>

      <aside className={styles.accent}>
        <div className={styles.glow} />
        <Gem size={120} strokeWidth={1.4} className={styles.accentIcon} />
      </aside>
    </div>
  );
}
