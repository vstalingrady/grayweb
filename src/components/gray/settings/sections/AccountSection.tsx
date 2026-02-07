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
  isCompactLayout?: boolean;
  showAccountActions?: boolean;
  avatarFileInputRef: RefObject<HTMLInputElement | null>;
  avatarUploadState: "idle" | "uploading" | "error" | "success";
  avatarUploadError: string | null;
  onAvatarFileChange: (event: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onNavigateToPricing: () => void;
};

const parseExpiryDate = (value?: string | null): Date | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const hasTimezone = /[zZ]$|[+-]\d{2}:\d{2}$/.test(trimmed);
  const normalized = hasTimezone ? trimmed : `${trimmed}Z`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const buildRenewalLabel = (currentUser: User | null): string => {
  const expiresAt = parseExpiryDate(currentUser?.subscription_expires_at);
  if (!expiresAt) {
    return "Next payment date unavailable.";
  }

  const now = new Date();
  const diffMs = expiresAt.getTime() - now.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const daysRemaining = Math.ceil(diffMs / dayMs);

  const formattedDate = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(expiresAt);

  if (daysRemaining <= 0) {
    return `Renews today (${formattedDate}).`;
  }
  if (daysRemaining === 1) {
    return `Renews in 1 day (${formattedDate}).`;
  }
  return `Renews in ${daysRemaining} days (${formattedDate}).`;
};

export function AccountSection({
  t,
  user,
  tierLevel,
  isCompactLayout = false,
  showAccountActions = true,
  avatarFileInputRef,
  avatarUploadState,
  avatarUploadError,
  onAvatarFileChange,
  onNavigateToPricing,
}: AccountSectionProps) {
  const profileName = user?.full_name || "Gray User";

  return (
    <>
      <div className={styles.settingsPageHeader}>
        <h2 className={styles.settingsPageTitle}>{t("Account")}</h2>
      </div>

      {isCompactLayout ? (
        <div className={styles.settingsSection}>
          <h3 className={styles.settingsSectionTitle}>{t("Profile")}</h3>
          <div className={styles.settingsRow}>
            <div className={styles.settingsFlexRow}>
              <div className={styles.avatarLarge} style={{ width: 44, height: 44 }}>
                {user?.profile_picture_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.profile_picture_url} alt="" />
                ) : (
                  <UserCircle size={32} />
                )}
              </div>
              <div className={styles.settingsLabelGroup}>
                <span className={styles.settingsLabel}>{profileName}</span>
                {user?.email ? (
                  <span className={styles.settingsItemDescription}>{user.email}</span>
                ) : null}
              </div>
            </div>
            <div className={styles.settingsFlexRow}>
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
            </div>
          </div>
        </div>
      ) : (
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
            <div className={styles.userName}>{profileName}</div>
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
          </div>
        </div>
      )}
      {avatarUploadError ? (
        <p className={styles.settingsItemDescription} style={{ color: "#fca5a5", marginTop: 10 }}>
          {avatarUploadError}
        </p>
      ) : null}

      {showAccountActions ? (
        <>
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
                data-variant={tierLevel >= 3 ? "primary" : "highlighted"}
              >
                <div className={styles.settingsUpgradeText}>
                  <h4>
                    {t("Current Plan")}: {tierLevel >= 3 ? "Pioneer" : tierLevel >= 2 ? "Voyager" : "Pathfinder"}
                  </h4>
                  <p>
                    {buildRenewalLabel(user)}
                  </p>
                </div>
                <button
                  type="button"
                  className={`${styles.settingsSubscriptionButton} ${tierLevel >= 3
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
        </>
      ) : null}
    </>
  );
}
