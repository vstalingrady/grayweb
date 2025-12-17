"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import styles from "./page.module.css";
import LoginForm from "@/components/LoginForm";
import { useI18n } from "@/contexts/I18nContext";
import { useHasHydrated } from "@/components/gray/hooks/useHasHydrated";

export default function DeleteAccountPage() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading, deleteUserAccount } = useUser();
  const hasHydrated = useHasHydrated();
  const [status, setStatus] = useState<"idle" | "deleting" | "error" | "success">("idle");
  const [error, setError] = useState<string | null>(null);
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const verifiedOnceRef = useRef(false);
  const suppressVerificationRef = useRef(false);
  const verifiedParam = searchParams?.get("verified") === "true";
  const isIdentityVerified = !suppressVerificationRef.current && (isAuthenticated || verifiedParam || verifiedOnceRef.current);

  useEffect(() => {
    if (!verifiedParam) {
      return;
    }

    verifiedOnceRef.current = true;
    suppressVerificationRef.current = false;

    if (typeof window === "undefined") {
      return;
    }

    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete("verified");
    window.history.replaceState({}, "", newUrl.toString());
  }, [verifiedParam]);

  useEffect(() => {
    if (status === "deleting" || status === "success") {
      return;
    }
    if (!loading && !user) {
      const redirect = encodeURIComponent("/delete-account?verified=true");
      router.replace(`/login?redirect=${redirect}`);
    }
  }, [loading, router, user, status]);

  useEffect(() => {
    if (loading || !user) {
      return;
    }

    if (isIdentityVerified) {
      return;
    }

    try {
      const storedTarget = window.sessionStorage.getItem("delete_account_target");
      if (storedTarget !== user.email) {
        window.sessionStorage.setItem("delete_account_target", user.email);
      }
    } catch {
      // sessionStorage may be unavailable
    }
  }, [isIdentityVerified, loading, user]);

  const storedTarget = (() => {
    if (!hasHydrated) {
      return null;
    }
    try {
      return window.sessionStorage.getItem("delete_account_target");
    } catch {
      return null;
    }
  })();
  const mismatchError =
    isIdentityVerified && user && storedTarget && storedTarget !== user.email
      ? t(
        "Account mismatch. You started deletion for {target} but logged in as {current}. Please log in as the correct user.",
        { target: storedTarget, current: user.email }
      )
      : null;

  const displayError = mismatchError ?? error;
  const displayStatus = mismatchError ? "error" : status;

  const handleDelete = useCallback(async () => {
    if (!user || status === "deleting") {
      return;
    }

    // Safety check: Ensure the current user matches the stored target
    const storedTarget = (() => {
      try {
        return window.sessionStorage.getItem("delete_account_target");
      } catch {
        return null;
      }
    })();
    if (storedTarget && storedTarget !== user.email) {
      setError(
        t(
          "Account mismatch. You started deletion for {target} but logged in as {current}. Please log in as the correct user.",
          { target: storedTarget, current: user.email }
        )
      );
      setStatus("error");
      return;
    }

    if (confirmationEmail !== user.email) {
      setError(t("Email does not match."));
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
      const message =
        err instanceof Error ? err.message : t("Failed to delete account.");
      setError(message);
      setStatus("error");
    }
  }, [deleteUserAccount, status, user, confirmationEmail, t]);

  const handleCancel = () => {
    verifiedOnceRef.current = false;
    suppressVerificationRef.current = true;
    setIsAuthenticated(false);
  };

  const renderVerifiedBody = (currentUser: NonNullable<typeof user>) => {
    const description =
      displayStatus === "deleting"
        ? t("Deleting your workspace data...")
        : t("Identity verified. This action cannot be undone.");

    const isMatch = confirmationEmail === currentUser.email;

    return (
      <div className={styles["delete-account__card"]}>
        <h1>{t("Final confirmation")}</h1>
        <p className={styles["delete-account__description"]}>
          {description}{" "}
          {t("To permanently delete your account, type your email")}{" "}
          <strong>{currentUser.email}</strong>{" "}
          {t("below.")}
        </p>

        <input
          type="email"
          className={styles["delete-account__input"]}
          placeholder={currentUser.email}
          value={confirmationEmail}
          onChange={(e) => {
            setConfirmationEmail(e.target.value);
            if (error) setError(null);
          }}
          disabled={displayStatus === "deleting"}
        />

        {displayError ? <p className={styles["delete-account__error"]}>{displayError}</p> : null}

        <div className={styles["delete-account__actions"]}>
          <button
            type="button"
            className={styles["delete-account__cancel"]}
            onClick={handleCancel}
            disabled={displayStatus === "deleting"}
          >
            {t("Cancel")}
          </button>
          <button
            type="button"
            className={styles["delete-account__button"]}
            disabled={displayStatus === "deleting" || !isMatch || Boolean(mismatchError)}
            onClick={handleDelete}
          >
            {displayStatus === "deleting"
              ? t("Deleting...")
              : displayStatus === "error"
                ? t("Retry delete")
                : t("Delete account")}
          </button>
        </div>
      </div>
    );
  };

  if (loading || !user) {
    return (
      <main className={styles["delete-account"]}>
        <div className={styles["delete-account__card"]}>
          <LoaderCircle className={styles["delete-account__spinner"]} size={20} />
          <p>{t("Verifying your session...")}</p>
        </div>
      </main>
    );
  }

  if (!isIdentityVerified) {
    return (
      <main className={styles["delete-account"]}>
        <LoginForm
          initialMode="signin"
          headerText={t("Delete Account")}
          subtitleText={t("Please log in again to confirm your identity.")}
          redirectTo="/delete-account?verified=true"
          onSuccess={() => {
            suppressVerificationRef.current = false;
            setIsAuthenticated(true);
          }}
        />
      </main>
    );
  }

  return <main className={styles["delete-account"]}>{renderVerifiedBody(user)}</main>;
}
