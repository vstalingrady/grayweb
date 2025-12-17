"use client";

import type { Dispatch, SetStateAction } from "react";
import styles from "../SettingsStyles.module.css";
import { API_KEY_PROVIDERS } from "@/components/gray/settings/types";

type Translator = (message: string, vars?: Record<string, string | number>) => string;

export type ApiKeysSectionProps = {
  t: Translator;
  tierLevel: number;
  apiKeysStorageKey: string;
  apiKeys: Record<string, string>;
  setApiKeys: Dispatch<SetStateAction<Record<string, string>>>;
  apiKeyDrafts: Record<string, string>;
  setApiKeyDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  apiKeyVisibility: Record<string, boolean>;
  setApiKeyVisibility: Dispatch<SetStateAction<Record<string, boolean>>>;
  apiKeyStatus: string | null;
  setApiKeyStatus: Dispatch<SetStateAction<string | null>>;
  onUpgradeClick: () => void;
};

export function ApiKeysSection({
  t,
  tierLevel,
  apiKeysStorageKey,
  apiKeys,
  setApiKeys,
  apiKeyDrafts,
  setApiKeyDrafts,
  apiKeyVisibility,
  setApiKeyVisibility,
  apiKeyStatus,
  setApiKeyStatus,
  onUpgradeClick,
}: ApiKeysSectionProps) {
  return (
    <>
      <div className={styles.settingsPageHeader}>
        <h2 className={styles.settingsPageTitle}>{t("API Keys")}</h2>
      </div>

      <div className={styles.settingsSection}>
        <p className={styles.settingsItemDescription} style={{ marginTop: 0 }}>
          {t("Bring your own API keys for select models. Keys are stored locally in your browser.")}
        </p>
      </div>

      {tierLevel < 1 ? (
        <div
          className={styles.settingsSection}
          style={{
            borderRadius: 16,
            padding: 24,
            border: "1px solid rgba(255, 255, 255, 0.08)",
            background:
              "radial-gradient(120% 120% at 50% 0%, rgba(255, 255, 255, 0.08), rgba(10, 10, 10, 0.9))",
          }}
        >
          <h3 className={styles.settingsSectionTitle} style={{ marginBottom: 8 }}>
            {t("Voyager feature")}
          </h3>
          <p className={styles.settingsItemDescription} style={{ marginTop: 0, marginBottom: 16 }}>
            {t("Upgrade to Voyager to access this feature.")}
          </p>
          <button type="button" className={styles.settingsAction} onClick={onUpgradeClick}>
            {t("Upgrade")}
          </button>
        </div>
      ) : (
        <div className={styles.settingsSection}>
          {apiKeyStatus ? (
            <p className={styles.settingsItemDescription} style={{ marginTop: 0, marginBottom: 16 }}>
              {apiKeyStatus}
            </p>
          ) : null}

          {API_KEY_PROVIDERS.map((provider) => {
            const draft = apiKeyDrafts[provider.id] ?? "";
            const isVisible = Boolean(apiKeyVisibility[provider.id]);
            const isSaved = Boolean(apiKeys[provider.id]);
            return (
              <div key={provider.id} className={styles.settingsSection} style={{ marginBottom: 20 }}>
                <h3 className={styles.settingsSectionTitle} style={{ marginBottom: 10 }}>
                  {provider.label}
                </h3>
                <p className={styles.settingsItemDescription} style={{ marginTop: 0, marginBottom: 10 }}>
                  {t(provider.helper)}
                  {isSaved ? ` • ${t("Saved")}` : ""}
                </p>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <input
                    className={styles.settingsInput}
                    style={{ flex: "1 1 360px" }}
                    type={isVisible ? "text" : "password"}
                    value={draft}
                    onChange={(event) => {
                      const next = event.target.value;
                      setApiKeyDrafts((prev) => ({ ...prev, [provider.id]: next }));
                      setApiKeyStatus(null);
                    }}
                    placeholder={t("Enter API key")}
                    aria-label={t("{provider} API key", { provider: provider.label })}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    className={styles.settingsAction}
                    onClick={() =>
                      setApiKeyVisibility((prev) => ({ ...prev, [provider.id]: !Boolean(prev[provider.id]) }))
                    }
                  >
                    {isVisible ? t("Hide") : t("Show")}
                  </button>
                  <button
                    type="button"
                    className={styles.settingsAction}
                    onClick={() => {
                      const nextKey = draft.trim();
                      const nextStored: Record<string, string> = { ...apiKeys };
                      if (nextKey) {
                        nextStored[provider.id] = nextKey;
                      } else {
                        delete nextStored[provider.id];
                      }
                      if (typeof window !== "undefined") {
                        window.localStorage.setItem(apiKeysStorageKey, JSON.stringify(nextStored));
                      }
                      setApiKeys(nextStored);
                      setApiKeyStatus(t("Saved."));
                    }}
                  >
                    {t("Save")}
                  </button>
                  <button
                    type="button"
                    className={styles.settingsAction}
                    onClick={() => {
                      const nextStored: Record<string, string> = { ...apiKeys };
                      delete nextStored[provider.id];
                      if (typeof window !== "undefined") {
                        window.localStorage.setItem(apiKeysStorageKey, JSON.stringify(nextStored));
                      }
                      setApiKeys(nextStored);
                      setApiKeyDrafts((prev) => ({ ...prev, [provider.id]: "" }));
                      setApiKeyStatus(t("Cleared."));
                    }}
                  >
                    {t("Clear")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
