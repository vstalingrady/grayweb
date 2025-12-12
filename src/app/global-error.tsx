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
    // Optional: Log the error to an error reporting service
    console.error(error);
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
