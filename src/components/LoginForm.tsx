"use client";

import { FormEvent, useMemo, useState } from "react";
import { Chrome, Discord, Loader2, Lock, Mail } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import styles from "./LoginForm.module.css";

type MessageState =
  | { type: "idle" }
  | { type: "success"; text: string }
  | { type: "error"; text: string };

const providers = [
  { id: "google" as const, label: "Google", icon: Chrome },
  { id: "discord" as const, label: "Discord", icon: Discord },
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
      <header className={styles.header}>
        <h2>Welcome back</h2>
        <p>Authenticate to continue building your noir workspace.</p>
      </header>

      <div className={styles.oauthGroup}>
        {providers.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={styles.oauthButton}
            onClick={() => handleOAuth(id)}
            disabled={loading}
          >
            <Icon size={18} />
            Continue with {label}
          </button>
        ))}
      </div>

      <p className={styles.divider}>or</p>

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
          <a className={styles.forgot} href="https://app.supabase.com/" target="_blank" rel="noreferrer">
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

        <button type="submit" className={styles.submitButton} disabled={loading}>
          {loading ? <Loader2 size={18} className={styles.loader} /> : "Sign In"}
        </button>
      </form>

      <p className={styles.supporting}>
        New here? Invite-only access opens soon. Request access from the team.
      </p>
    </div>
  );
}
