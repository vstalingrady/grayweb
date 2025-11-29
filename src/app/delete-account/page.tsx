"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import styles from "./page.module.css";

export default function DeleteAccountPage() {
  const router = useRouter();
  const { user, loading, deleteUserAccount } = useUser();
  const [status, setStatus] = useState<"idle" | "deleting" | "error" | "success">("idle");
  const [error, setError] = useState<string | null>(null);
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    if (status === "deleting" || status === "success") {
      return;
    }
    if (!loading && !user) {
      const redirect = encodeURIComponent("/delete-account");
      router.replace(`/login?redirect=${redirect}`);
    }
  }, [loading, router, user, status]);

  const handleReauthenticate = useCallback(async () => {
    if (!user || isAuthenticating) {
      return;
    }

    if (!password) {
      setAuthError("Please enter your password.");
      return;
    }

    setIsAuthenticating(true);
    setAuthError(null);

    try {
      const { getSupabaseClient } = await import("@/lib/supabaseClient");
      const supabase = getSupabaseClient();

      if (!supabase) {
        throw new Error("Authentication service unavailable");
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: password,
      });

      if (signInError) {
        throw signInError;
      }

      setIsAuthenticated(true);
      setPassword(""); // Clear password from memory
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to verify password.";
      setAuthError(message);
    } finally {
      setIsAuthenticating(false);
    }
  }, [user, password, isAuthenticating]);

  const handleDelete = useCallback(async () => {
    if (!user || status === "deleting") {
      return;
    }

    if (confirmationEmail !== user.email) {
      setError("Email does not match.");
      return;
    }

    setStatus("deleting");
    setError(null);
    try {
      await deleteUserAccount();
      setStatus("success");
      router.replace("/login?reconfirm-delete=true");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete account.";
      setError(message);
      setStatus("error");
    }
  }, [deleteUserAccount, router, status, user, confirmationEmail]);

  const renderBody = () => {
    if (loading || !user) {
      return (
        <div className={styles["delete-account__card"]}>
          <LoaderCircle className={styles["delete-account__spinner"]} size={20} />
          <p>Verifying your session...</p>
        </div>
      );
    }


    if (!isAuthenticated) {
      return (
        <div className={styles["delete-account__card"]}>
          <h1>Delete Account</h1>
          <p className={styles["delete-account__description"]}>
            To confirm deletion, please re-enter your password for <strong>{user.email}</strong>.
          </p>

          <input
            type="password"
            className={styles["delete-account__input"]}
            placeholder="Enter your password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (authError) setAuthError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleReauthenticate();
              }
            }}
            disabled={isAuthenticating}
            autoFocus
          />

          {authError ? <p className={styles["delete-account__error"]}>{authError}</p> : null}

          <div className={styles["delete-account__actions"]}>
            <button
              type="button"
              className={styles["delete-account__cancel"]}
              onClick={() => router.back()}
              disabled={isAuthenticating}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles["delete-account__button"]}
              disabled={isAuthenticating || !password}
              onClick={handleReauthenticate}
            >
              {isAuthenticating ? "Verifying..." : "Continue"}
            </button>
          </div>
        </div>
      );
    }

    const description =
      status === "deleting"
        ? "Deleting your workspace data..."
        : "You re-authenticated successfully. This action cannot be undone.";

    const isMatch = confirmationEmail === user.email;

    return (
      <div className={styles["delete-account__card"]}>
        <h1>Delete Account</h1>
        <p className={styles["delete-account__description"]}>
          {description} To confirm, please type your email <strong>{user.email}</strong> below.
        </p>

        <input
          type="email"
          className={styles["delete-account__input"]}
          placeholder={user.email}
          value={confirmationEmail}
          onChange={(e) => {
            setConfirmationEmail(e.target.value);
            if (error) setError(null);
          }}
          disabled={status === "deleting"}
        />

        {error ? <p className={styles["delete-account__error"]}>{error}</p> : null}

        <div className={styles["delete-account__actions"]}>
          <button
            type="button"
            className={styles["delete-account__cancel"]}
            onClick={() => router.back()}
            disabled={status === "deleting"}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles["delete-account__button"]}
            disabled={status === "deleting" || !isMatch}
            onClick={handleDelete}
          >
            {status === "deleting" ? "Deleting..." : status === "error" ? "Retry delete" : "Delete account"}
          </button>
        </div>
      </div>
    );
  };

  return (
    <main className={styles["delete-account"]}>
      {renderBody()}
    </main>
  );
}
