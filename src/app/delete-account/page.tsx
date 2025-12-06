/* eslint-disable react-hooks/set-state-in-effect */
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

  // Handle locking the target user for deletion
  useEffect(() => {
    if (loading || !user) return;

    // If we are starting the flow (not verified yet), lock the target email
    const isVerified = searchParams?.get("verified") === "true";
    const storedTarget = window.sessionStorage.getItem("delete_account_target");

    if (!isVerified) {
      // If we are just arriving effectively as a fresh start for this flow, overwrite
      // We only do this if we are not already in a weird state? 
      // Actually, if I just land here, I am deleting MY account.
      if (storedTarget !== user.email) {
        window.sessionStorage.setItem("delete_account_target", user.email);
      }
    } else {
      // We are verified (came back from auth)
      // Check if we have a stored target
      if (storedTarget && storedTarget !== user.email) {
        setError(`Account mismatch. You started deletion for ${storedTarget} but logged in as ${user.email}. Please log in as the correct user.`);
        setStatus("error");
        // We do NOT set isAuthenticated(false) here, because we want renderBody to show the error message.
        // The handleDelete function will enforce the safety check.
      }
    }
  }, [loading, user, searchParams]);


  useEffect(() => {
    if (status === "deleting" || status === "success") {
      return;
    }
    if (!loading && !user) {
      const redirect = encodeURIComponent("/delete-account?verified=true");
      router.replace(`/login?redirect=${redirect}`);
    }
  }, [loading, router, user, status]);

  // Check if we are returning from an OAuth flow that was initiated for verification
  useEffect(() => {
    const verifiedParam = searchParams?.get("verified");
    if (verifiedParam === "true") {
      // Check for mismatch before approving authentication
      const storedTarget = window.sessionStorage.getItem("delete_account_target");

      // We need user to be loaded to compare. 
      // If user is loading, we wait. This effect depends on searchParams only in original code.
      // But we need to wait for user to verify.

      // The logic is split. Let's combine or be careful.
      // If I set isAuthenticated(true) here, the renderBody will show.
      // If I wait for the other effect to check mismatch, I might flash the UI.

      // Better to coordinate. 
      // But purely functional:
      // If verified=true, we WANT to set authenticated.
      // But if there is a mismatch, we want to BLOCK.

      // Let's modify this effect to only clean URL, and let the mismatch logic handle the auth state?
      // Or just set authenticated here, and let the mismatch logic immediately unset it and show error?
      // React state updates are batched usually checking mismatch might happen in next render cycle or same.

      // If I let this run, it sets IsAuthenticated(true).
      // Then my new effect runs, checks user vs stored, and sets Error + IsAuthenticated(false).
      // That seems acceptable.

      setIsAuthenticated(true);

      // Clean up URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("verified");
      window.history.replaceState({}, "", newUrl.toString());
    }
  }, [searchParams]);

  const handleDelete = useCallback(async () => {
    if (!user || status === "deleting") {
      return;
    }

    // Safety check: Ensure the current user matches the stored target
    const storedTarget = window.sessionStorage.getItem("delete_account_target");
    if (storedTarget && storedTarget !== user.email) {
      setError(`Account mismatch. You started deletion for ${storedTarget} but logged in as ${user.email}.`);
      setStatus("error");
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
