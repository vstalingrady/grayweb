"use client";

import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  UserCircle,
  Settings as SettingsIcon,
  Palette,
  Moon,
  Sun,
  Database,
  Bell,
  Brain,
  KeyRound,
  Pencil,
} from "lucide-react";
import railNavStyles from "../sidebar/RailNav.module.css";
import styles from "./SettingsStyles.module.css";
import { useI18n } from "@/contexts/I18nContext";
import { useUser } from "@/contexts/UserContext";
import { useNotificationPreferences } from "@/contexts/NotificationPreferencesContext";
import { useChatStore } from "@/components/gray/ChatProvider";
import { clampPercent, getContextUsageUsedTokens, getContextUsageVisualizationLimit } from "@/components/gray/contextUsage";
import { utilityService, chatService } from "@/lib/api";
import { requestNotificationPermission } from "@/lib/notificationUtils";
import { clearGrayLocalCache } from "@/lib/localCache";
import { AccountSection } from "./sections/AccountSection";
import { ApiKeysSection } from "./sections/ApiKeysSection";
import { DataControlsSection } from "./sections/DataControlsSection";
import { ModelsSection } from "./sections/ModelsSection";
import { NotificationsSection } from "./sections/NotificationsSection";
import { PersonalizationSection } from "./sections/PersonalizationSection";
import { PreferencesSection } from "./sections/PreferencesSection";
import { normalizePlanTier, PLAN_TIER_LEVELS } from "@/components/gray/utils/helperFunctions";
import {
  API_KEY_PROVIDERS,
  type SettingsModalProps,
  type SettingsSection,
  type ThemeMode,
} from "./types";

const THEME_STORAGE_KEY = "gray_theme";
const CONVERSATION_MEMORY_STORAGE_PREFIX = "gray_conversation_memory";
const MODEL_IMPROVEMENT_STORAGE_PREFIX = "gray_model_improvement";
const API_KEYS_STORAGE_PREFIX = "gray_api_keys";

const resolveInitialTheme = (): ThemeMode => {
  if (typeof window === "undefined") {
    return "system";
  }

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }

  return "system";
};

const resolveThemeFromProfile = (value: unknown): ThemeMode | null => {
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return null;
};

const resolveResponseLanguageFromProfile = (value: unknown): string | null => {
  if (value === "auto" || value === "en" || value === "id") {
    return value;
  }
  return null;
};

export function SettingsModal({
  isOpen,
  onClose,
  initialSection = "account",
  contextUsage = null,
}: SettingsModalProps) {
  const { t, locale: activeLocale, setLocale } = useI18n();
  const { user, updateUser } = useUser();
  const { notificationPreferences, setNotificationPreference } = useNotificationPreferences();
  const {
    autoWebSearchEnabled,
    setAutoWebSearchEnabled,
    visibleModelIds,
    setVisibleModelIds,
    selectedModelId,
    modelTier,
    clearAllConversations,
    contextCacheId,
    setContextCacheId,
  } = useChatStore();
  const router = useRouter();
  const resolveSection = (value: string): SettingsSection => {
    if (
      value === "preferences" ||
      value === "personalization" ||
      value === "models" ||
      value === "api_keys" ||
      value === "data_controls" ||
      value === "notifications"
    ) {
      return value;
    }
    return "account";
  };

  const [activeSection, setActiveSection] = useState<SettingsSection>(() =>
    resolveSection(initialSection)
  );

  const conversationMemoryStorageKey = `${CONVERSATION_MEMORY_STORAGE_PREFIX}:${user?.id ?? "anon"}`;
  const modelImprovementStorageKey = `${MODEL_IMPROVEMENT_STORAGE_PREFIX}:${user?.id ?? "anon"}`;
  const apiKeysStorageKey = `${API_KEYS_STORAGE_PREFIX}:${user?.id ?? "anon"}`;

  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">(
    "unsupported"
  );
  const [modelImprovementEnabled, setModelImprovementEnabled] = useState(false);
  const [conversationMemoryEnabled, setConversationMemoryEnabled] = useState(true);
  // Preferences State
  const [theme, setTheme] = useState<ThemeMode>(() => resolveInitialTheme());
  const [responseLanguage, setResponseLanguage] = useState("auto");
  const [modelSearchQuery, setModelSearchQuery] = useState("");
  const [modelsStatus, setModelsStatus] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [apiKeyDrafts, setApiKeyDrafts] = useState<Record<string, string>>({});
  const [apiKeyVisibility, setApiKeyVisibility] = useState<Record<string, boolean>>({});
  const [apiKeyStatus, setApiKeyStatus] = useState<string | null>(null);
  const [isDeletingAllConversations, setIsDeletingAllConversations] = useState(false);
  const [isClearingLocalCache, setIsClearingLocalCache] = useState(false);

  // Mobile View State
  const [isMobile, setIsMobile] = useState(false);
  const [mobileView, setMobileView] = useState<"root" | "detail">("root");

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.matchMedia("(max-width: 768px)").matches);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setMobileView("root");
    }
  }, [isOpen]);

  const tierLevel = useMemo(() => {
    const normalized = normalizePlanTier(user);
    return PLAN_TIER_LEVELS[normalized] ?? 0;
  }, [user]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const raw = window.localStorage.getItem(apiKeysStorageKey);
    if (!raw) {
      setApiKeys({});
      setApiKeyDrafts({});
      return;
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object") {
        setApiKeys({});
        setApiKeyDrafts({});
        return;
      }
      const next: Record<string, string> = {};
      for (const provider of API_KEY_PROVIDERS) {
        const maybe = (parsed as Record<string, unknown>)[provider.id];
        if (typeof maybe === "string" && maybe.trim().length > 0) {
          next[provider.id] = maybe.trim();
        }
      }
      setApiKeys(next);
      setApiKeyDrafts(next);
    } catch {
      setApiKeys({});
      setApiKeyDrafts({});
    }
  }, [apiKeysStorageKey]);

  const handleResponseLanguageChange = (val: string) => {
    const previous = responseLanguage;
    setResponseLanguage(val);
    if (!user) {
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("gray_response_language", val);
        } catch {
          // ignore storage failures
        }
      }
      return;
    }
    void updateUser({ preferred_response_language: val as "auto" | "en" | "id" }).catch((error) => {
      console.error("Failed to persist response language preference:", error);
      setResponseLanguage(previous);
    });
  };

  const handleLocaleChange = (next: typeof activeLocale) => {
    setLocale(next);
    if (!user) {
      return;
    }
    void updateUser({ ui_locale: next }).catch((error) => {
      console.error("Failed to persist UI language preference:", error);
    });
  };

  const handleAvatarFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) {
      return;
    }

    if (!file.type?.startsWith("image/")) {
      setAvatarUploadState("error");
      setAvatarUploadError(t("Please choose an image file."));
      return;
    }

    // Keep parity with backend MAX_MEDIA_UPLOAD_SIZE_BYTES (10MB).
    if (file.size > 10 * 1024 * 1024) {
      setAvatarUploadState("error");
      setAvatarUploadError(t("Image is too large (max 10MB)."));
      return;
    }

    setAvatarUploadState("uploading");
    setAvatarUploadError(null);
    try {
      const upload = await utilityService.uploadMediaFile(file);
      const avatarUrl = upload.public_url ?? `/api/uploads/${upload.id}/file`;
      await updateUser({ profile_picture_url: avatarUrl });
      setAvatarUploadState("idle");
    } catch (error) {
      setAvatarUploadState("error");
      setAvatarUploadError(error instanceof Error ? error.message : t("Failed to upload avatar."));
    }
  };

  // Personalization State (mirrors legacy PersonalizationPanel fields)
  const [nickname, setNickname] = useState("");
  const [occupation, setOccupation] = useState("");
  const [about, setAbout] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [location, setLocation] = useState("");
  const [timeZone, setTimeZone] = useState("");

  const [contextActionState, setContextActionState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [contextActionMessage, setContextActionMessage] = useState<string | null>(null);

  const [aboutSaveState, setAboutSaveState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [customSaveState, setCustomSaveState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [localeSaveState, setLocaleSaveState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [avatarUploadState, setAvatarUploadState] = useState<"idle" | "uploading" | "error">("idle");
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null);
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);

  const resolvedDeviceTimeZone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  }, []);

  const supportedTimeZones = useMemo(() => {
    if (typeof Intl === "undefined") {
      return [];
    }
    const supportedValuesOf = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
    if (typeof supportedValuesOf !== "function") {
      return [];
    }
    try {
      return supportedValuesOf("timeZone") ?? [];
    } catch {
      return [];
    }
  }, []);

  // Sync state with user profile and chat store
  useEffect(() => {
    if (user) {
      setNickname(user.personalization_nickname || "");
      setOccupation(user.personalization_occupation || "");
      setAbout(user.personalization_about || "");
      setCustomInstructions(user.personalization_custom_instructions || "");
      setLocation(user.personalization_location || "");
      setTimeZone(user.personalization_time_zone || resolvedDeviceTimeZone);
    }
  }, [resolvedDeviceTimeZone, user]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (typeof window !== "undefined") {
      if (typeof Notification !== "undefined") {
        setNotificationPermission(Notification.permission);
      } else {
        setNotificationPermission("unsupported");
      }

      const resolvedTheme = resolveThemeFromProfile(user?.theme_mode) ?? resolveInitialTheme();
      setTheme(resolvedTheme);

      const resolvedResponseLanguage =
        resolveResponseLanguageFromProfile(user?.preferred_response_language) ??
        (() => {
          try {
            return window.localStorage.getItem("gray_response_language");
          } catch {
            return null;
          }
        })() ??
        "auto";
      setResponseLanguage(resolvedResponseLanguage);

      try {
        const storedMemory = window.localStorage.getItem(conversationMemoryStorageKey);
        const resolvedMemory =
          typeof user?.conversation_memory_enabled === "boolean"
            ? user.conversation_memory_enabled
            : storedMemory !== "0";
        setConversationMemoryEnabled(resolvedMemory);
      } catch {
        setConversationMemoryEnabled(
          typeof user?.conversation_memory_enabled === "boolean"
            ? user.conversation_memory_enabled
            : true
        );
      }

      try {
        const storedModelImprovement = window.localStorage.getItem(modelImprovementStorageKey);
        const resolvedValue =
          typeof user?.improve_model_for_everyone === "boolean"
            ? user.improve_model_for_everyone
            : storedModelImprovement === "1";
        setModelImprovementEnabled(resolvedValue);
      } catch {
        setModelImprovementEnabled(
          typeof user?.improve_model_for_everyone === "boolean"
            ? user.improve_model_for_everyone
            : false
        );
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [
    conversationMemoryStorageKey,
    modelImprovementStorageKey,
    isOpen,
    onClose,
    user?.conversation_memory_enabled,
    user?.improve_model_for_everyone,
    user?.preferred_response_language,
    user?.theme_mode,
  ]);

  useEffect(() => {
    if (aboutSaveState === "success") {
      const timer = setTimeout(() => setAboutSaveState("idle"), 2000);
      return () => clearTimeout(timer);
    }
  }, [aboutSaveState]);

  useEffect(() => {
    if (customSaveState === "success") {
      const timer = setTimeout(() => setCustomSaveState("idle"), 2000);
      return () => clearTimeout(timer);
    }
  }, [customSaveState]);

  useEffect(() => {
    if (localeSaveState === "success") {
      const timer = setTimeout(() => setLocaleSaveState("idle"), 2000);
      return () => clearTimeout(timer);
    }
  }, [localeSaveState]);

  useEffect(() => {
    if (contextActionState === "success") {
      const timer = setTimeout(() => {
        setContextActionState("idle");
        setContextActionMessage(null);
      }, 2400);
      return () => clearTimeout(timer);
    }
  }, [contextActionState]);

  const handleDeleteAccount = () => {
    onClose();
    router.push("/delete-account");
  };

  const handleToggleDeviceNotifications = async () => {
    const wantsEnabled = !notificationPreferences.device;
    if (!wantsEnabled) {
      setNotificationPreference("device", false);
      return;
    }

    const permission = await requestNotificationPermission();
    if (!permission) {
      setNotificationPermission("unsupported");
      setNotificationPreference("device", false);
      return;
    }
    setNotificationPermission(permission);
    if (permission === "granted") {
      setNotificationPreference("device", true);
    } else {
      setNotificationPreference("device", false);
    }
  };

  const handleClearLocalCache = () => {
    if (typeof window === "undefined" || isClearingLocalCache) {
      return;
    }
    setIsClearingLocalCache(true);
    clearGrayLocalCache();
    window.location.reload();
  };

  const applyTheme = (nextTheme: ThemeMode, options?: { syncUser?: boolean }) => {
    const root = document.documentElement;
    const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    const shouldBeLight = nextTheme === "light" || (nextTheme === "system" && prefersLight);
    root.classList.toggle("light", shouldBeLight);

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // ignore storage failures
    }

    setTheme(nextTheme);
    if (options?.syncUser === false || !user) {
      return;
    }
    void updateUser({ theme_mode: nextTheme }).catch((error) => {
      console.error("Failed to persist theme preference:", error);
    });
  };



  const handleSaveBio = async () => {
    if (!user?.id) return;
    setAboutSaveState("saving");
    try {
      await updateUser({
        personalization_nickname: nickname,
        personalization_occupation: occupation,
        personalization_about: about,
      });
      setAboutSaveState("success");
    } catch (e) {
      console.error(e);
      setAboutSaveState("error");
    }
  };

  const handleSaveCustomInstructions = async () => {
    if (!user?.id) return;
    setCustomSaveState("saving");
    try {
      await updateUser({ personalization_custom_instructions: customInstructions });
      setCustomSaveState("success");
    } catch (e) {
      console.error(e);
      setCustomSaveState("error");
    }
  };

  const handleSaveLocale = async () => {
    if (!user?.id) return;
    setLocaleSaveState("saving");
    try {
      const normalizedLocation = location.trim();
      const normalizedTimeZone = timeZone.trim();
      await updateUser({
        personalization_location: normalizedLocation.length > 0 ? normalizedLocation : null,
        personalization_time_zone: normalizedTimeZone.length > 0 ? normalizedTimeZone : null,
      });
      setLocaleSaveState("success");
    } catch (e) {
      console.error(e);
      setLocaleSaveState("error");
    }
  };

  const handleClearCustomInstructions = () => {
    setCustomInstructions("");
  };

  const handleCompressConversation = async () => {
    const conversationId = contextUsage?.conversationId;
    if (!conversationId) {
      setContextActionState("error");
      setContextActionMessage(t("No active conversation to compress"));
      return;
    }

    setContextActionState("loading");
    setContextActionMessage(t("Compressing..."));
    try {
      const result = await chatService.compressConversation(conversationId);
      setContextActionState("success");
      setContextActionMessage(result.message || t("Conversation compressed successfully"));
    } catch (e) {
      setContextActionState("error");
      setContextActionMessage(e instanceof Error ? e.message : t("Failed to compress conversation"));
    }
  };

  if (!isOpen) {
    return null;
  }

  // Helper to render navigation items
  const renderNavItem = (
    id: SettingsSection,
    label: string,
    Icon: React.ElementType
  ) => (
    <button
      type="button"
      className={styles.settingsNavItem}
      data-active={activeSection === id}
      onClick={() => setActiveSection(id)}
    >
      <Icon className={styles.settingsNavItemIcon} />
      <span>{label}</span>
    </button>
  );

  const handleOverlayPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    onClose();
  };

  const handleOverlayMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }
    if (event.button !== 0) {
      return;
    }
    onClose();
  };

  return (
    <div
      className={styles.settingsOverlay}
      role="dialog"
      aria-modal="true"
      onPointerDown={handleOverlayPointerDown}
      onMouseDown={handleOverlayMouseDown}
    >
      <div className={styles.settingsContainer} data-mobile-view={mobileView}>
        {/* Mobile Root View */}
        {isMobile && mobileView === "root" && (
          <div className={styles.mobileSettingsRoot}>
            <header className={styles.mobileSettingsHeader}>
              <button className={styles.mobileSettingsBack} onClick={onClose}>
                <ChevronLeft size={20} />
              </button>
              <h2 className={styles.mobileSettingsTitle}>{t("Settings")}</h2>
              <div style={{ width: 36 }} /> {/* Spacer */}
            </header>

            <div className={styles.mobileProfileSection}>
              <div className={styles.mobileProfileAvatar}>
                {user?.profile_picture_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.profile_picture_url} alt="" />
                ) : (
                  <UserCircle size={48} />
                )}
                <button
                  className={styles.mobileProfileEditButton}
                  onClick={() => {
                    setActiveSection("account");
                    setMobileView("detail");
                  }}
                >
                  <Pencil size={14} />
                </button>
              </div>
              {user?.email ? (
                <span className={styles.mobileProfileEmail}>{user.email}</span>
              ) : (
                <h3 className={styles.mobileProfileName}>{user?.full_name || "Gray User"}</h3>
              )}
              <button
                className={railNavStyles.railNav}
                style={{ width: "auto", height: 32, padding: "0 16px", borderRadius: 16, background: "#1c1c1e", fontSize: "0.9rem", color: "#fff" }}
                onClick={() => {
                  setActiveSection("account");
                  setMobileView("detail");
                }}
              >
                {t("Edit profile")}
              </button>
            </div>

            <div className={styles.mobileGroup}>
              <button
                className={styles.mobileGroupItem}
                onClick={() => {
                  setActiveSection("personalization");
                  setMobileView("detail");
                }}
              >
                <Palette className={styles.mobileGroupItemIcon} size={20} />
                <span className={styles.mobileGroupItemLabel}>{t("Personalization")}</span>
                <ChevronRight className={styles.mobileGroupItemArrow} size={16} />
              </button>
              <button
                className={styles.mobileGroupItem}
                onClick={() => {
                  setActiveSection("api_keys");
                  setMobileView("detail");
                }}
              >
                <KeyRound className={styles.mobileGroupItemIcon} size={20} />
                <span className={styles.mobileGroupItemLabel}>{t("Apps & connectors")}</span>
                <ChevronRight className={styles.mobileGroupItemArrow} size={16} />
              </button>
            </div>

            <div className={styles.mobileGroup}>
              <div className={styles.mobileGroupItem}>
                <Database className={styles.mobileGroupItemIcon} size={20} />
                <div style={{ flex: 1 }}>
                  <span className={styles.mobileGroupItemLabel} style={{ display: "block" }}>{t("Workspace")}</span>
                  <span className={styles.mobileGroupItemValue} style={{ fontSize: "0.85rem", color: "#888" }}>Personal</span>
                </div>
              </div>
              <button
                className={styles.mobileGroupItem}
                onClick={() => {
                  // Navigate to pro/pricing? For now just account section
                  setActiveSection("account");
                  setMobileView("detail");
                }}
              >
                <div className={styles.mobileGroupItemIcon} style={{ width: 20, height: 20, borderRadius: "50%", border: "1px solid #fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 10, fontWeight: "bold" }}>+</span>
                </div>
                <span className={styles.mobileGroupItemLabel}>{t("Upgrade to Pro")}</span>
                <ChevronRight className={styles.mobileGroupItemArrow} size={16} />
              </button>
              <div className={styles.mobileGroupItem}>
                <UserCircle className={styles.mobileGroupItemIcon} size={20} />
                <div style={{ flex: 1 }}>
                  <span className={styles.mobileGroupItemLabel} style={{ display: "block" }}>{t("Email")}</span>
                  <span className={`${styles.mobileGroupItemMono} ${styles.mobileMonoText}`}>{user?.email}</span>
                </div>
              </div>
            </div>

            <div className={styles.mobileGroupLabel}>{t("Appearance")}</div>
            <div className={styles.mobileGroup} style={{ background: "transparent", margin: "0 16px 24px" }}>
              <div className={styles.mobileThemeGrid}>
                <button
                  className={styles.mobileThemeOption}
                  data-active={theme === "system"}
                  onClick={() => applyTheme("system")}
                >
                  <div className={styles.mobileThemePreview}>
                    <div style={{ width: "50%", height: "50%", background: "#444", borderRadius: "50%" }} />
                  </div>
                  <span style={{ fontSize: "0.8rem" }}>System</span>
                </button>
                <button
                  className={styles.mobileThemeOption}
                  data-active={theme === "dark"}
                  onClick={() => applyTheme("dark")}
                >
                  <div className={styles.mobileThemePreview} style={{ background: "#000" }}>
                    <Moon size={16} color="#fff" />
                  </div>
                  <span style={{ fontSize: "0.8rem" }}>Dark</span>
                </button>
                <button
                  className={styles.mobileThemeOption}
                  data-active={theme === "light"}
                  onClick={() => applyTheme("light")}
                >
                  <div className={styles.mobileThemePreview} style={{ background: "#eee" }}>
                    <Sun size={16} color="#000" />
                  </div>
                  <span style={{ fontSize: "0.8rem" }}>Light</span>
                </button>
              </div>
            </div>

            <div className={styles.mobileGroupLabel}>{t("Data & Information")}</div>
            <div className={styles.mobileGroup}>
              <button
                className={styles.mobileGroupItem}
                onClick={() => {
                  setActiveSection("notifications");
                  setMobileView("detail");
                }}
              >
                <Bell className={styles.mobileGroupItemIcon} size={20} />
                <span className={styles.mobileGroupItemLabel}>{t("Notifications")}</span>
                <ChevronRight className={styles.mobileGroupItemArrow} size={16} />
              </button>
              <button
                className={styles.mobileGroupItem}
                onClick={() => {
                  setActiveSection("data_controls");
                  setMobileView("detail");
                }}
              >
                <Database className={styles.mobileGroupItemIcon} size={20} />
                <span className={styles.mobileGroupItemLabel}>{t("Data controls")}</span>
                <ChevronRight className={styles.mobileGroupItemArrow} size={16} />
              </button>
            </div>

          </div>
        )}

        {/* Left Sidebar (Desktop Only) */}
        {!isMobile && (
          <aside className={styles.settingsSidebar}>
            <div className={styles.settingsSidebarHeader}>
              <button
                type="button"
                className={styles.settingsSidebarBack}
                onClick={onClose}
              >
                <ChevronLeft size={16} />
                {t("Back")}
              </button>
            </div>

            <div className={styles.settingsNavGroup}>
              <div className={styles.settingsNavLabel}>{t("Account")}</div>
              {renderNavItem("account", t("Account"), UserCircle)}
              {renderNavItem("preferences", t("Preferences"), SettingsIcon)}
              {renderNavItem("personalization", t("Personalization"), Palette)}
              {renderNavItem("models", t("Models"), Brain)}
              {/* Hidden until backend integration complete */}
              {/* {renderNavItem("api_keys", t("API Keys"), KeyRound)} */}
              {renderNavItem("data_controls", t("Data Controls"), Database)}
              {renderNavItem("notifications", t("Notifications"), Bell)}
            </div>

            <div className={styles.settingsSidebarFooter}>
              <div className={styles.settingsSidebarFooterDivider} aria-hidden="true" />
              <div className={styles.settingsSidebarContextHeader}>
                <span className={styles.settingsSidebarContextTitle}>{t("Context")}</span>
                <button
                  type="button"
                  className={styles.settingsSidebarContextAction}
                  onClick={() => void handleCompressConversation()}
                  disabled={contextActionState === "loading" || !contextUsage?.conversationId}
                >
                  {contextActionState === "loading" ? t("Compressing...") : t("Compress")}
                </button>
              </div>
              {contextUsage?.conversationId ? (
                (() => {
                  const usedTokens = Math.max(0, getContextUsageUsedTokens(contextUsage));
                  const visualizationLimit = getContextUsageVisualizationLimit(contextUsage);
                  const percentUsed =
                    visualizationLimit > 0 ? clampPercent((usedTokens / visualizationLimit) * 100) : 0;
                  const widthPercent = percentUsed > 0 && percentUsed < 0.5 ? 0.5 : percentUsed;
                  const usedLabel = usedTokens.toLocaleString();
                  const limitLabel = visualizationLimit.toLocaleString();
                  const contextLimitLabel =
                    typeof contextUsage.limit === "number" && contextUsage.limit > 0
                      ? t("{used} of {limit} tokens used", { used: usedLabel, limit: limitLabel })
                      : t("{used} tokens used (visualized against {limit})", { used: usedLabel, limit: limitLabel });

                  return (
                    <>
                      <div className={styles.settingsContextBar} aria-label={contextLimitLabel}>
                        <div className={styles.settingsContextBarFill} style={{ width: `${widthPercent}%` }} />
                      </div>
                      <p className={styles.settingsSidebarContextMeta}>{contextLimitLabel}</p>
                    </>
                  );
                })()
              ) : (
                <p className={styles.settingsSidebarContextMeta} data-variant="muted">
                  {t("Open a conversation to see context usage.")}
                </p>
              )}
              {contextActionMessage ? (
                <p className={styles.settingsSidebarContextMeta} data-variant="muted">
                  {contextActionMessage}
                </p>
              ) : null}
            </div>
          </aside>
        )}



        {/* Right Content */}
        <main className={styles.settingsContent}>
          {/* Mobile Detail Header */}
          {isMobile && mobileView === "detail" && (
            <div className={styles.mobileSettingsHeader} style={{ marginBottom: 0 }}>
              <button
                className={styles.mobileSettingsBack}
                onClick={() => setMobileView("root")}
              >
                <ChevronLeft size={20} />
              </button>
              <h2 className={styles.mobileSettingsTitle}>
                {activeSection === "account" ? t("Account") :
                  activeSection === "preferences" ? t("Preferences") :
                    activeSection === "personalization" ? t("Personalization") :
                      activeSection === "models" ? t("Models") :
                        activeSection === "api_keys" ? t("API Keys") :
                          activeSection === "data_controls" ? t("Data Controls") :
                            activeSection === "notifications" ? t("Notifications") : ""}
              </h2>
              <div style={{ width: 36 }} />
            </div>
          )}

          {activeSection === "account" && (
            <AccountSection
              t={t}
              user={user}
              tierLevel={tierLevel}
              avatarFileInputRef={avatarFileInputRef}
              avatarUploadState={avatarUploadState}
              avatarUploadError={avatarUploadError}
              onAvatarFileChange={handleAvatarFileChange}
              onNavigateToPricing={() => {
                onClose();
                router.push("/pricing");
              }}
              onDeleteAccount={handleDeleteAccount}
            />
          )}

          {activeSection === "preferences" && (
            <PreferencesSection
              t={t}
              theme={theme}
              onThemeChange={applyTheme}
              activeLocale={activeLocale}
              onLocaleChange={handleLocaleChange}
              responseLanguage={responseLanguage}
              onResponseLanguageChange={handleResponseLanguageChange}
            />
          )}

          {activeSection === "personalization" && (
            <PersonalizationSection
              t={t}
              autoWebSearchEnabled={autoWebSearchEnabled}
              onToggleAutoWebSearch={() => setAutoWebSearchEnabled(!autoWebSearchEnabled)}
              nickname={nickname}
              onNicknameChange={setNickname}
              occupation={occupation}
              onOccupationChange={setOccupation}
              about={about}
              onAboutChange={setAbout}
              aboutSaveState={aboutSaveState}
              onSaveBio={handleSaveBio}
              location={location}
              onLocationChange={setLocation}
              timeZone={timeZone}
              onTimeZoneChange={setTimeZone}
              resolvedDeviceTimeZone={resolvedDeviceTimeZone}
              supportedTimeZones={supportedTimeZones}
              localeSaveState={localeSaveState}
              onUseDeviceTimeZone={() => setTimeZone(resolvedDeviceTimeZone)}
              onSaveLocale={handleSaveLocale}
              customInstructions={customInstructions}
              onCustomInstructionsChange={setCustomInstructions}
              customSaveState={customSaveState}
              onClearCustomInstructions={handleClearCustomInstructions}
              onSaveCustomInstructions={handleSaveCustomInstructions}
            />
          )}

          {activeSection === "models" && (
            <ModelsSection
              t={t}
              tierLevel={tierLevel}
              selectedModelId={selectedModelId}
              modelTier={modelTier}
              visibleModelIds={visibleModelIds}
              onVisibleModelIdsChange={setVisibleModelIds}
              modelSearchQuery={modelSearchQuery}
              onModelSearchQueryChange={setModelSearchQuery}
              modelsStatus={modelsStatus}
              onModelsStatusChange={setModelsStatus}
            />
          )}

          {activeSection === "api_keys" && (
            <ApiKeysSection
              t={t}
              tierLevel={tierLevel}
              apiKeysStorageKey={apiKeysStorageKey}
              apiKeys={apiKeys}
              setApiKeys={setApiKeys}
              apiKeyDrafts={apiKeyDrafts}
              setApiKeyDrafts={setApiKeyDrafts}
              apiKeyVisibility={apiKeyVisibility}
              setApiKeyVisibility={setApiKeyVisibility}
              apiKeyStatus={apiKeyStatus}
              setApiKeyStatus={setApiKeyStatus}
              onUpgradeClick={() => router.push("/pricing")}
            />
          )}

          {activeSection === "data_controls" && (
            <DataControlsSection
              t={t}
              userId={typeof user?.id === "number" ? user.id : null}
              tierLevel={tierLevel}
              updateUser={updateUser}
              modelImprovementEnabled={modelImprovementEnabled}
              setModelImprovementEnabled={setModelImprovementEnabled}
              modelImprovementStorageKey={modelImprovementStorageKey}
              conversationMemoryEnabled={conversationMemoryEnabled}
              setConversationMemoryEnabled={setConversationMemoryEnabled}
              conversationMemoryStorageKey={conversationMemoryStorageKey}
              contextCacheId={contextCacheId}
              setContextCacheId={setContextCacheId}
              onClearLocalCache={handleClearLocalCache}
              isDeletingAllConversations={isDeletingAllConversations}
              setIsDeletingAllConversations={setIsDeletingAllConversations}
              clearAllConversations={clearAllConversations}
              onUpgradeClick={() => router.push("/pricing")}
            />
          )}

          {activeSection === "notifications" && (
            <NotificationsSection
              t={t}
              notificationPermission={notificationPermission}
              notificationPreferences={notificationPreferences}
              onToggleDeviceNotifications={handleToggleDeviceNotifications}
              setNotificationPreference={setNotificationPreference}
            />
          )}
        </main>
      </div>
    </div>
  );
}
