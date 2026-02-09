"use client";

import { useEffect } from "react";
import { clearSupabaseAuthStorage } from "@/lib/supabaseStorage";
import { clearAuthCookies } from "@/lib/auth/cookies";
import { useI18n } from "@/contexts/I18nContext";

export default function ConfirmDeletePage() {
  const { t } = useI18n();

  useEffect(() => {
    // Ensure all auth state is cleared immediately
    clearSupabaseAuthStorage();
    void clearAuthCookies();

    // Redirect to login after 2.5 seconds
    const timeout = setTimeout(() => {
      // Use window.location for a full page reload to prevent stale state
      window.location.href = "/login";
    }, 2500);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        placeItems: "center",
        padding: "1.5rem",
        margin: 0,
        width: "100vw",
        height: "100vh",
        boxSizing: "border-box",
        background: "var(--bg-base, #020202)",
        color: "var(--fg-primary, #f5f5f5)",
      }}
    >
      <div style={{ maxWidth: 520, width: "100%", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.8rem", fontWeight: 600, margin: "0 0 1rem 0" }}>
          {t("Account Deleted")}
        </h1>
        <p style={{ fontSize: "1.1rem", marginTop: "0.75rem", color: "var(--fg-muted, #6b7280)" }}>
          {t("Your account and all associated data have been permanently deleted.")}
        </p>
        <p style={{ fontSize: "0.9rem", marginTop: "1rem", color: "var(--fg-subtle, #4a4a4a)" }}>
          {t("Redirecting to login page...")}
        </p>
      </div>
    </main>
  );
}
