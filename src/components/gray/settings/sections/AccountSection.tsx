"use client";

import type { ChangeEvent, RefObject } from "react";
import { UserCircle } from "lucide-react";
import styles from "../SettingsStyles.module.css";
import type { User } from "@/lib/api";

type Translator = (message: string, vars?: Record<string, string | number>) => string;

export type AccountSectionProps = {
  t: Translator;
  user: User | null;
  tierLevel: number;
  avatarFileInputRef: RefObject<HTMLInputElement | null>;
  avatarUploadState: "idle" | "uploading" | "error" | "success";
  avatarUploadError: string | null;
  onAvatarFileChange: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onNavigateToPricing: () => void;
  onDeleteAccount: () => void;
};

export function AccountSection({
  t,
  user,
  tierLevel,
  avatarFileInputRef,
  avatarUploadState,
  avatarUploadError,
  onAvatarFileChange,
  onNavigateToPricing,
  onDeleteAccount,
}: AccountSectionProps) {
  return (
    <>
      <div className={styles.settingsPageHeader}>
        <h2 className={styles.settingsPageTitle}>{t("Account")}</h2>
      </div>

      <div className={styles.userProfileCard}>
        <div className={styles.avatarLarge}>
          {user?.profile_picture_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.profile_picture_url} alt="" />
          ) : (
            <UserCircle size={40} />
          )}
        </div>
        <div>
          <div className={styles.userName}>{user?.full_name || "Gray User"}</div>
          {user?.email ? (
            <div className={`${styles.settingsItemDescription} ${styles.userEmail}`}>{user.email}</div>
          ) : null}
        </div>
        <div className={styles.userProfileActions}>
          <input
            ref={avatarFileInputRef}
            type="file"
            accept="image/*"
            onChange={onAvatarFileChange}
            style={{ display: "none" }}
          />
          <button
            type="button"
            className={styles.settingsAction}
            onClick={() => avatarFileInputRef.current?.click()}
            disabled={avatarUploadState === "uploading"}
          >
            {avatarUploadState === "uploading" ? t("Uploading…") : t("Change avatar")}
          </button>
          <button className={styles.settingsAction} style={{ marginLeft: 8 }}>
            {t("Sign out")}
          </button>
        </div>
      </div>
      {avatarUploadError ? (
        <p className={styles.settingsItemDescription} style={{ color: "#fca5a5", marginTop: 10 }}>
          {avatarUploadError}
        </p>
      ) : null}

      <div className={styles.settingsSection}>
        <h3 className={styles.settingsSectionTitle}>{t("Your Subscription")}</h3>
        {tierLevel < 1 ? (
          <div className={styles.settingsUpgradeCard}>
            <div className={styles.settingsUpgradeText}>
              <h4>Supercharge your experience</h4>
              <p>Unlock everything Gray has to offer.</p>
            </div>
            <button
              type="button"
              className={`${styles.settingsAction} ${styles.settingsPrimaryButton}`}
              onClick={onNavigateToPricing}
            >
              {t("Upgrade plan")}
            </button>
          </div>
        ) : (
          <div
            className={styles.settingsSubscriptionCard}
            data-variant={tierLevel >= 2 ? "primary" : "highlighted"}
          >
            <div className={styles.settingsUpgradeText}>
              <h4>
                {t("Current Plan")}: {tierLevel >= 2 ? "Pioneer" : "Voyager"}
              </h4>
              <p>
                {tierLevel >= 2
                  ? "Top-tier models, top limits, and early access."
                  : "More messages, longer memory, and calendar routines."}
              </p>
            </div>
            <button
              type="button"
              className={`${styles.settingsSubscriptionButton} ${
                tierLevel >= 2
                  ? styles.settingsSubscriptionButtonPrimary
                  : styles.settingsSubscriptionButtonOutline
              }`}
              onClick={onNavigateToPricing}
            >
              View plan
            </button>
          </div>
        )}
      </div>

      <div className={styles.settingsSection}>
        <div className={styles.settingsDangerCard}>
          <div className={styles.settingsLabelGroup}>
            <span className={styles.settingsLabel}>{t("Delete account")}</span>
            <span className={styles.deleteAccountHelper}>
              {t("Permanently delete your account and data")}
            </span>
          </div>
          <button
            className={`${styles.settingsAction} ${styles.settingsActionDanger}`}
            onClick={onDeleteAccount}
          >
            {t("Delete")}
          </button>
        </div>
      </div>
    </>
  );
}
