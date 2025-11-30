"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import styles from "./page.module.css";
import LoginForm from "@/components/LoginForm";

export default function DeleteAccountPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, deleteUserAccount } = useUser();
  const [status, setStatus] = useState<"idle" | "deleting" | "error" | "success">("idle");
  const [error, setError] = useState<string | null>(null);
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check if we are returning from an OAuth flow that was initiated for verification
  useEffect(() => {
    const verifiedParam = searchParams?.get("verified");
    if (verifiedParam === "true") {
      setIsAuthenticated(true);
      // Clean up URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("verified");
      window.history.replaceState({}, "", newUrl.toString());
    }
  }, [searchParams]);

  useEffect(() => {
    if (status === "deleting" || status === "success") {
      return;
    }
    if (!loading && !user) {
      const redirect = encodeURIComponent("/delete-account?verified=true");
      router.replace(`/login?redirect=${redirect}`);
    }
  }, [loading, router, user, status]);

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
      // Use window.location to ensure full state reset
      window.location.href = "/confirm-delete";
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete account.";
      setError(message);
      setStatus("error");
    }
  }, [deleteUserAccount, status, user, confirmationEmail]);

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
        <div style={{ width: "100%", height: "100%" }}>
          <LoginForm
            initialMode="signin"
            headerText="Delete Account"
            subtitleText="Please log in again to confirm your identity."
            redirectTo="/delete-account?verified=true"
            onSuccess={() => setIsAuthenticated(true)}
          />
        </div>
      );
    }

    const description =
      status === "deleting"
        ? "Deleting your workspace data..."
        : "Identity verified. This action cannot be undone.";

    const isMatch = confirmationEmail === user.email;

    return (
      <div className={styles["delete-account__card"]}>
        <h1>Final confirmation</h1>
        <p className={styles["delete-account__description"]}>
          {description} To permanently delete your account, type your email <strong>{user.email}</strong> below.
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
            onClick={() => setIsAuthenticated(false)}
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
      {isAuthenticated ? renderBody() : (
        // When not authenticated, LoginForm handles its own layout, so we render it directly
        // However, LoginForm's layout is full screen fixed. 
        // We can wrap it or just let it take over since this page is a full screen flow.
        <LoginForm
          initialMode="signin"
          headerText="Delete Account"
          subtitleText="Please log in again to confirm your identity."
          redirectTo="/delete-account?verified=true"
          onSuccess={() => setIsAuthenticated(true)}
        />
      )}
    </main>
  );
}
