"use client";

import { useEffect } from "react";
import { useI18n } from "@/contexts/I18nContext";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();
  useEffect(() => {
    console.error(error);

    const message = typeof error?.message === "string" ? error.message : "";
    const staleActionError =
      message.includes("Failed to find Server Action") ||
      message.includes("older or newer deployment");
    if (!staleActionError) {
      return;
    }

    const reloadGuardKey = "gray_server_action_reload_at";
    const reloadCooldownMs = 5 * 60 * 1000;
    let shouldReload = true;
    try {
      const previousReload = sessionStorage.getItem(reloadGuardKey);
      if (previousReload) {
        const previousReloadMs = Number(previousReload);
        if (Number.isFinite(previousReloadMs) && Date.now() - previousReloadMs < reloadCooldownMs) {
          shouldReload = false;
        }
      }
      if (shouldReload) {
        sessionStorage.setItem(reloadGuardKey, String(Date.now()));
      }
    } catch {
      shouldReload = true;
    }

    if (shouldReload) {
      window.location.reload();
    }
  }, [error]);

  return (
    <html>
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <div style={{ 
          display: "flex", 
          flexDirection: "column", 
          alignItems: "center", 
          justifyContent: "center", 
          height: "100vh", 
          color: "white", 
          backgroundColor: "black", 
          gap: "1rem" 
        }}>
          <h2>{t("Something went wrong!")}</h2>
          <button 
            onClick={() => reset()} 
            style={{ 
              padding: "0.5rem 1rem", 
              borderRadius: "0.5rem", 
              backgroundColor: "white", 
              color: "black", 
              border: "none", 
              cursor: "pointer",
              fontSize: "1rem"
            }}
          >
            {t("Try again")}
          </button>
        </div>
      </body>
    </html>
  );
}
