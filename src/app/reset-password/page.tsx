"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import styles from "@/components/LoginForm.module.css";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "idle" | "success" | "error";
    text?: string;
  }>({ type: "idle" });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const supabase = getSupabaseClient();

    if (!supabase) {
      setMessage({
        type: "error",
        text: "Supabase client is not configured. Check environment variables.",
      });
      return;
    }

    if (!password || !confirmPassword) {
      setMessage({
        type: "error",
        text: "Enter and confirm your new password.",
      });
      return;
    }

    if (password !== confirmPassword) {
      setMessage({
        type: "error",
        text: "Passwords do not match.",
      });
      return;
    }

    if (password.length < 8) {
      setMessage({
        type: "error",
        text: "Password must be at least 8 characters long.",
      });
      return;
    }

    setLoading(true);
    setMessage({
      type: "idle",
    });

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        throw error;
      }

      setMessage({
        type: "success",
        text: "Your password has been updated. You can now sign in with your new password.",
      });

      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (error) {
      const text =
        error instanceof Error ? error.message : "Unable to update password.";
      setMessage({
        type: "error",
        text,
      });
    } finally {
      setLoading(false);
    }
  };

  const renderedMessage =
    message.type === "idle"
      ? null
      : (
        <p
          className={`${styles.authFeedback} ${
            message.type === "success"
              ? styles.authFeedbackSuccess
              : styles.authFeedbackError
          }`}
        >
          {message.text}
        </p>
      );

  return (
    <main className={styles.authPage}>
      <div className={styles.authShell}>
        <section className={styles.authContent} style={{ width: "100%" }}>
          <div className={styles.authPanel}>
            <header className={styles.authHeading}>
              <h1 className={styles.authTitle}>Reset your password</h1>
              <p className={styles.authSubtitle}>
                Choose a new password for your Gray account.
              </p>
            </header>

            <form className={styles.authForm} onSubmit={handleSubmit}>
              <div className={styles.authFields}>
                <div className={styles.authField}>
                  <label className={styles.authFieldLabel} htmlFor="password">
                    New password
                  </label>
                  <input
                    id="password"
                    type="password"
                    className={styles.authFieldInput}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={loading}
                    required
                  />
                </div>

                <div className={styles.authField}>
                  <label className={styles.authFieldLabel} htmlFor="confirmPassword">
                    Confirm new password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    className={styles.authFieldInput}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    disabled={loading}
                    required
                  />
                </div>
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
                  "Update password"
                )}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
