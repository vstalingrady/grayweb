"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { Fragment, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Check,
  UserCircle,
  Settings as SettingsIcon,
  Palette,
  Moon,
  Sun,
  Trash2,
  Database,
  Bell,
  Brain,
  KeyRound,
  Lock,
  Pencil,
} from "lucide-react";
import styles from "@/app/gray/GrayPageClient.module.css";
import { useI18n } from "@/contexts/I18nContext";
import { useUser } from "@/contexts/UserContext";
import { useChatStore } from "@/components/gray/ChatProvider";
import { GRAY_BRAND, ALL_PIONEER_MODEL_IDS, PIONEER_GROUPS } from "@/components/gray/modelCatalog";
import type { ContextUsageSummary } from "@/components/gray/types";
import { clampPercent, getContextUsageUsedTokens, getContextUsageVisualizationLimit } from "@/components/gray/contextUsage";
import { apiService } from "@/lib/api";
import type { Locale } from "@/lib/i18n";
import { requestNotificationPermission } from "@/lib/notificationUtils";
import { clearGrayLocalCache } from "@/lib/localCache";

type SelectOption = { value: string; label: string };

type SettingsSelectProps = {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  icon?: React.ElementType;
};

function SettingsSelect({ value, options, onChange, icon: Icon }: SettingsSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeLabel = useMemo(() => {
    const match = options.find((option) => option.value === value);
    return match?.label ?? value;
  }, [options, value]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className={styles.settingsSelectButton} style={{ position: "relative" }} ref={containerRef}>
      <button
        type="button"
        className={styles.settingsSelectTrigger}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen ? "true" : "false"}
      >
        {Icon ? <Icon size={14} /> : null}
        <span className={styles.settingsSelectValue}>{activeLabel}</span>
        <ChevronDown
          size={14}
          className={styles.settingsSelectChevron}
          aria-hidden="true"
          data-open={isOpen ? "true" : "false"}
        />
      </button>

      {isOpen ? (
        <div className={styles.settingsSelectMenu} role="listbox">
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected ? "true" : "false"}
                className={styles.settingsSelectOption}
                data-selected={selected ? "true" : "false"}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                <span>{option.label}</span>
                {selected ? <Check size={14} aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

type SettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  initialSection?: SettingsSection;
  contextUsage?: ContextUsageSummary | null;
};

type SettingsSection =
  | "account"
  | "preferences"
  | "personalization"
  | "models"
  | "api_keys"
  | "data_controls"
  | "notifications";

type ThemeMode = "dark" | "light" | "system";
const THEME_STORAGE_KEY = "gray_theme";
const NOTIFICATIONS_STORAGE_PREFIX = "gray_notifications";
const CONVERSATION_MEMORY_STORAGE_PREFIX = "gray_conversation_memory";
const MODEL_IMPROVEMENT_STORAGE_PREFIX = "gray_model_improvement";
const API_KEYS_STORAGE_PREFIX = "gray_api_keys";

type ApiKeyProvider = {
  id: string;
  label: string;
  helper: string;
};

const API_KEY_PROVIDERS: ApiKeyProvider[] = [
  { id: "openrouter", label: "OpenRouter", helper: "Routes to all models. Get key at openrouter.ai" },
  { id: "anthropic", label: "Anthropic", helper: "Direct API for Claude models" },
  { id: "openai", label: "OpenAI", helper: "Direct API for GPT models" },
  { id: "google", label: "Google", helper: "Direct API for Gemini models" },
  { id: "deepseek", label: "DeepSeek", helper: "Direct API for DeepSeek models" },
  { id: "x-ai", label: "xAI", helper: "Direct API for Grok models" },
];

type NotificationPreferences = {
  device: boolean;
  tasks: boolean;
  proactivity: boolean;
  calendarEvents: boolean;
};

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  device: false,
  tasks: true,
  proactivity: true,
  calendarEvents: true,
};

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

export function SettingsModal({
  isOpen,
  onClose,
  initialSection = "account",
  contextUsage = null,
}: SettingsModalProps) {
  const { t, locale: activeLocale, setLocale } = useI18n();
  const { user, updateUser } = useUser();
  const {
    webSearchEnabled,
    setWebSearchEnabled,
    visibleModelIds,
    setVisibleModelIds,
    selectedModelId,
    clearAllConversations,
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

  const notificationsStorageKey = `${NOTIFICATIONS_STORAGE_PREFIX}:${user?.id ?? "anon"}`;
  const conversationMemoryStorageKey = `${CONVERSATION_MEMORY_STORAGE_PREFIX}:${user?.id ?? "anon"}`;
  const modelImprovementStorageKey = `${MODEL_IMPROVEMENT_STORAGE_PREFIX}:${user?.id ?? "anon"}`;
  const apiKeysStorageKey = `${API_KEYS_STORAGE_PREFIX}:${user?.id ?? "anon"}`;

  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES
  );
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
    const raw = (user?.plan_tier ?? "scout").toLowerCase();
    if (raw === "pioneer") return 2;
    if (raw === "voyager") return 1;
    return 0;
  }, [user?.plan_tier]);

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

  // Load response language preference
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("gray_response_language");
      if (stored) setResponseLanguage(stored);
    }
  }, []);

  const handleResponseLanguageChange = (val: string) => {
    setResponseLanguage(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("gray_response_language", val);
    }
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
      const upload = await apiService.uploadMediaFile(file);
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

  const [contextActionState, setContextActionState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [contextActionMessage, setContextActionMessage] = useState<string | null>(null);

  const [aboutSaveState, setAboutSaveState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [customSaveState, setCustomSaveState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [avatarUploadState, setAvatarUploadState] = useState<"idle" | "uploading" | "error">("idle");
  const [avatarUploadError, setAvatarUploadError] = useState<string | null>(null);
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync state with user profile and chat store
  useEffect(() => {
    if (user) {
      setNickname(user.personalization_nickname || "");
      setOccupation(user.personalization_occupation || "");
      setAbout(user.personalization_about || "");
      setCustomInstructions(user.personalization_custom_instructions || "");
    }
  }, [user]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (typeof window !== "undefined") {
      try {
        const storedPrefs = window.localStorage.getItem(notificationsStorageKey);
        if (storedPrefs) {
          const parsed = JSON.parse(storedPrefs) as Partial<NotificationPreferences>;
          setNotificationPreferences({
            ...DEFAULT_NOTIFICATION_PREFERENCES,
            ...parsed,
          });
        } else {
          setNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
        }
      } catch {
        setNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
      }

      if (typeof Notification !== "undefined") {
        setNotificationPermission(Notification.permission);
      } else {
        setNotificationPermission("unsupported");
      }

      try {
        const storedMemory = window.localStorage.getItem(conversationMemoryStorageKey);
        setConversationMemoryEnabled(storedMemory !== "0");
      } catch {
        setConversationMemoryEnabled(true);
      }

      try {
        const storedModelImprovement = window.localStorage.getItem(modelImprovementStorageKey);
        const resolvedValue =
          typeof user?.improve_model_for_everyone === "boolean"
            ? user.improve_model_for_everyone
            : storedModelImprovement === "1";
        setModelImprovementEnabled(resolvedValue);
      } catch {
        setModelImprovementEnabled(typeof user?.improve_model_for_everyone === "boolean" ? user.improve_model_for_everyone : false);
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
    notificationsStorageKey,
    isOpen,
    onClose,
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

  const setNotificationPreference = (
    key: keyof NotificationPreferences,
    value: boolean
  ) => {
    setNotificationPreferences((current) => {
      const next = { ...current, [key]: value };
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(notificationsStorageKey, JSON.stringify(next));
        } catch {
          // ignore storage failures
        }
      }
      return next;
    });
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

  const applyTheme = (nextTheme: ThemeMode) => {
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
      const result = await apiService.compressConversation(conversationId);
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

  const renderToggle = (checked: boolean, onChange: () => void, label?: string, disabled = false) => (
    <button
      type="button"
      className={styles.settingsToggle}
      role="switch"
      aria-checked={checked ? "true" : "false"}
      aria-disabled={disabled ? "true" : "false"}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        onChange();
      }}
      aria-label={label}
    >
      <span className={styles.settingsToggleThumb} />
    </button>
  );

  const renderLogo = (src: string, alt: string, muted: boolean) => (
    <span
      aria-hidden="true"
      style={{
        width: 22,
        height: 22,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 6,
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <Image
        src={src}
        alt={alt}
        width={18}
        height={18}
        style={{
          filter: "brightness(0.85) saturate(0.95)",
          opacity: 0.9,
        }}
      />
    </span>
  );

  return (
    <div className={styles.settingsOverlay} role="dialog" aria-modal="true">
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
              <h3 className={styles.mobileProfileName}>{user?.full_name || "Gray User"}</h3>
              {user?.personalization_nickname ? (
                <span className={styles.mobileProfileHandle}>@{user.personalization_nickname}</span>
              ) : null}
              <button
                className={styles.railNav}
                style={{ width: "auto", height: 32, padding: "0 16px", borderRadius: 16, background: "#1c1c1e", fontSize: "0.9rem", color: "#fff" }}
                onClick={() => {
                  setActiveSection("account");
                  setMobileView("detail");
                }}
              >
                {t("Edit profile")}
              </button>
            </div>

            <div className={styles.mobileGroupLabel}>{t("My Gray")}</div>
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

            <div className={styles.mobileGroupLabel}>{t("Account")}</div>
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
                  <div className={styles.userName}>
                    {user?.full_name || "Gray User"}
                  </div>
                  {user?.email ? (
                    <div className={`${styles.settingsItemDescription} ${styles.userEmail}`}>
                      {user.email}
                    </div>
                  ) : null}
                </div>
                <div className={styles.userProfileActions}>
                  <input
                    ref={avatarFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarFileChange}
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
                  <button className={styles.settingsAction} style={{ marginLeft: 8 }}>{t("Sign out")}</button>
                </div>
              </div>
              {avatarUploadError ? (
                <p className={styles.settingsItemDescription} style={{ color: "#fca5a5", marginTop: 10 }}>
                  {avatarUploadError}
                </p>
              ) : null}

              <div className={styles.settingsSection}>
                <h3 className={styles.settingsSectionTitle}>{t("Your Subscription")}</h3>
                <div className={styles.settingsUpgradeCard}>
                  <div className={styles.settingsUpgradeText}>
                    <h4>Supercharge your experience</h4>
                    <p>Unlock everything Gray has to offer.</p>
                  </div>
                  <button className={`${styles.settingsAction} ${styles.settingsPrimaryButton}`}>
                    {t("Upgrade plan")}
                  </button>
                </div>
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
                    onClick={handleDeleteAccount}
                  >
                    {t("Delete")}
                  </button>
                </div>
              </div>
            </>
          )}

          {activeSection === "preferences" && (
            <>
              <div className={styles.settingsPageHeader}>
                <h2 className={styles.settingsPageTitle}>{t("Preferences")}</h2>
              </div>

              <div className={styles.settingsSection}>
                <div className={styles.settingsRow}>
                  <div className={styles.settingsLabelGroup}>
                    <span className={styles.settingsLabel}>{t("Appearance")}</span>
                    <span className={styles.settingsItemDescription}>{t("How Gray looks on your device")}</span>
                  </div>
                  <SettingsSelect
                    value={theme}
                    onChange={(val) => applyTheme(val as ThemeMode)}
                    icon={theme === "light" ? Sun : Moon}
                    options={[
                      { value: "system", label: t("System (Dark)") },
                      { value: "dark", label: t("Dark") },
                      { value: "light", label: t("Light") },
                    ]}
                  />
                </div>

                <div className={styles.settingsRow}>
                  <div className={styles.settingsLabelGroup}>
                    <span className={styles.settingsLabel}>{t("Language")}</span>
                    <span className={styles.settingsItemDescription}>{t("The language used in the user interface")}</span>
                  </div>
                  <SettingsSelect
                    value={activeLocale}
                    onChange={(val) => setLocale(val as Locale)}
                    options={[
                      { value: "en", label: "English" },
                      { value: "id", label: "Bahasa Indonesia" },
                    ]}
                  />
                </div>

                <div className={styles.settingsRow}>
                  <div className={styles.settingsLabelGroup}>
                    <span className={styles.settingsLabel}>{t("Preferred response language")}</span>
                    <span className={styles.settingsItemDescription}>{t("The language used for AI responses")}</span>
                  </div>
                  <SettingsSelect
                    value={responseLanguage}
                    onChange={handleResponseLanguageChange}
                    options={[
                      { value: "auto", label: t("Automatic (detect input)") },
                      { value: "en", label: "English" },
                      { value: "id", label: "Bahasa Indonesia" },
                    ]}
                  />
                </div>

              </div>
            </>
          )}

          {activeSection === "personalization" && (
            <>
              <div className={styles.settingsPageHeader}>
                <h2 className={styles.settingsPageTitle}>{t("Personalization")}</h2>
              </div>

              <div className={styles.settingsSection}>
                <h3 className={styles.settingsSectionTitle}>{t("Quick toggles")}</h3>

                <div className={styles.settingsRow}>
                  <div className={styles.settingsLabelGroup}>
                    <span className={styles.settingsLabel}>{t("Web search")}</span>
                    <span className={styles.settingsItemDescription}>
                      {t("Let Gray search for answers automatically.")}
                    </span>
                  </div>
                  {renderToggle(webSearchEnabled, () => setWebSearchEnabled(!webSearchEnabled), t("Toggle Web search"))}
                </div>

              </div>

              <div className={styles.settingsSection}>
                <h3 className={styles.settingsSectionTitle}>{t("Artificial Intelligence")}</h3>

                <div className={styles.settingsRow}>
                  <span className={styles.settingsLabel}>{t("Model")}</span>
                  <button className={styles.settingsAction}>{t("Upgrade to choose")}</button>
                </div>
              </div>

              <div className={styles.settingsSection}>
                <h3 className={styles.settingsSectionTitle}>{t("About you")}</h3>
                <div className={styles.settingsFormGrid}>
                  <div className={styles.settingsFormField}>
                    <label className={styles.settingsFormLabel} htmlFor="settings-nickname">
                      {t("Nickname")}
                    </label>
                    <input
                      id="settings-nickname"
                      className={styles.settingsInput}
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder={t("What should Gray call you?")}
                    />
                  </div>

                  <div className={styles.settingsFormField}>
                    <label className={styles.settingsFormLabel} htmlFor="settings-occupation">
                      {t("Occupation")}
                    </label>
                    <input
                      id="settings-occupation"
                      className={styles.settingsInput}
                      value={occupation}
                      onChange={(e) => setOccupation(e.target.value)}
                      placeholder={t("Role, industry, or focus")}
                    />
                  </div>
                </div>

                <label className={styles.settingsFormLabel} htmlFor="settings-about" style={{ marginTop: 12 }}>
                  {t("About")}
                </label>
                <textarea
                  id="settings-about"
                  className={styles.settingsTextarea}
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  placeholder={t("Share anything that helps Gray personalize responses.")}
                />
                <div className={styles.settingsButtonGroup}>
                  <button
                    type="button"
                    className={`${styles.settingsAction} ${styles.settingsPrimaryButton}`}
                    onClick={handleSaveBio}
                  >
                    {aboutSaveState === "saving" ? t("Saving...") :
                      aboutSaveState === "success" ? t("Saved") : t("Save")}
                  </button>
                </div>
              </div>

              <div className={styles.settingsSection}>
                <h3 className={styles.settingsSectionTitle}>{t("Custom instructions")}</h3>
                <textarea
                  className={styles.settingsTextarea}
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder={t("Paste instructions here if you prefer to edit them manually.")}
                />
                <div className={styles.settingsButtonGroup}>
                  <button
                    type="button"
                    className={styles.settingsSecondaryButton}
                    onClick={handleClearCustomInstructions}
                  >
                    <Trash2 size={14} />
                    {t("Clear")}
                  </button>
                  <button
                    type="button"
                    className={`${styles.settingsAction} ${styles.settingsPrimaryButton}`}
                    onClick={handleSaveCustomInstructions}
                  >
                    {customSaveState === "saving" ? t("Saving...") :
                      customSaveState === "success" ? t("Saved") : t("Save")}
                  </button>
                </div>
              </div>

            </>
          )}

          {activeSection === "models" && (
            <>
              <div className={styles.settingsPageHeader}>
                <h2 className={styles.settingsPageTitle}>{t("Models")}</h2>
              </div>

              <div className={styles.settingsSection}>
                <p className={styles.settingsItemDescription} style={{ marginTop: 0, marginBottom: 16 }}>
                  {t("Choose which models appear in your model selector. This won't affect existing conversations.")}
                </p>

                {modelsStatus ? (
                  <p className={styles.settingsItemDescription} style={{ marginTop: 0, marginBottom: 16 }}>
                    {modelsStatus}
                  </p>
                ) : null}

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                  <button
                    type="button"
                    className={styles.settingsAction}
                    onClick={() => {
                      if (tierLevel < 1) {
                        setModelsStatus(t("Upgrade to Voyager to customize models."));
                        return;
                      }
                      setVisibleModelIds(null);
                      setModelsStatus(null);
                    }}
                  >
                    {t("Show all")}
                  </button>
                  <button
                    type="button"
                    className={styles.settingsAction}
                    onClick={() => {
                      if (tierLevel < 1) {
                        setModelsStatus(t("Upgrade to Voyager to customize models."));
                        return;
                      }
                      if (selectedModelId && ALL_PIONEER_MODEL_IDS.includes(selectedModelId)) {
                        setVisibleModelIds([selectedModelId]);
                      } else {
                        setVisibleModelIds([]);
                      }
                      setModelsStatus(null);
                    }}
                  >
                    {t("Unselect all")}
                  </button>
                </div>

                <input
                  className={styles.settingsInput}
                  value={modelSearchQuery}
                  onChange={(event) => setModelSearchQuery(event.target.value)}
                  placeholder={t("Search models...")}
                  aria-label={t("Search models")}
                />
              </div>

              <div className={styles.settingsSection}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  {renderLogo(GRAY_BRAND.iconPath, GRAY_BRAND.label, false)}
                  <h3 className={styles.settingsSectionTitle} style={{ margin: 0 }}>
                    {t("Gray")}
                  </h3>
                </div>
                <div className={styles.settingsRow}>
                  <div className={styles.settingsLabelGroup}>
                    <span className={styles.settingsLabel}>{t("Gray Lite")}</span>
                    <span className={styles.settingsItemDescription}>{t("Gray Lite is always available.")}</span>
                  </div>
                </div>
              </div>

              {PIONEER_GROUPS.map((group) => {
                const normalizedQuery = modelSearchQuery.trim().toLowerCase();
                const visibleIds = visibleModelIds ?? ALL_PIONEER_MODEL_IDS;
                const matchesGroup = !normalizedQuery || group.label.toLowerCase().includes(normalizedQuery);
                const filteredModels = group.models.filter((model) => {
                  if (!normalizedQuery) return true;
                  const haystack = `${group.label} ${model.label} ${model.id}`.toLowerCase();
                  return matchesGroup || haystack.includes(normalizedQuery);
                });

                if (filteredModels.length === 0) {
                  return null;
                }

                return (
                  <div key={group.id} className={styles.settingsSection}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                      {renderLogo(group.iconPath, group.label, tierLevel < 1)}
                      <h3 className={styles.settingsSectionTitle} style={{ margin: 0 }}>
                        {group.label}
                      </h3>
                    </div>
                    {(() => {
                      const modelRows = filteredModels.map((model) => {
                        const isSelected = selectedModelId === model.id;
                        const isEnabled = visibleModelIds === null || visibleIds.includes(model.id);
                        const requiredTier = model.tierRequired ?? "voyager";
                        const requiredLevel = requiredTier === "pioneer" ? 2 : 1;
                        const isTierLocked = tierLevel < requiredLevel;
                        const isScoutLocked = tierLevel < 1;
                        const isLocked = isScoutLocked || isTierLocked;

                        return { model, isSelected, isEnabled, requiredTier, isLocked };
                      });

                      const firstLockedIndex = modelRows.findIndex((row) => row.isLocked);
                      const lockedRequiresPioneer = modelRows.some((row) => row.isLocked && row.requiredTier === "pioneer");
                      const premiumNote = lockedRequiresPioneer
                        ? t("Upgrade to Voyager or Pioneer to access.")
                        : t("Upgrade to Voyager to access.");

                      return modelRows.map((row, index) => (
                        <Fragment key={row.model.id}>
                          {index === firstLockedIndex ? (
                            <div className={styles.settingsTierSeparator} role="separator" aria-label={t("Premium models")}>
                              <div className={styles.settingsTierSeparatorTitle}>{t("Premium models")}</div>
                              <div className={styles.settingsTierSeparatorSubtitle}>{premiumNote}</div>
                            </div>
                          ) : null}

                          <div
                            className={styles.settingsRow}
                            style={row.isLocked ? { opacity: 0.5, filter: "grayscale(1)" } : undefined}
                          >
                            <div className={styles.settingsLabelGroup}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                {renderLogo(group.iconPath, group.label, false)}
                                <span className={styles.settingsLabel}>{row.model.label}</span>
                              </div>
                              <span className={styles.settingsItemDescription}>
                                {row.model.cost ? (
                                  <span className={styles.monoText}>{row.model.cost}</span>
                                ) : (
                                  row.model.id
                                )}
                                {row.isSelected ? ` • ${t("Selected")}` : ""}
                              </span>
                            </div>
                            {row.isLocked ? (
                              <div style={{ padding: "0 10px", opacity: 0.5 }}>
                                <Lock size={16} />
                              </div>
                            ) : (
                              renderToggle(
                                row.isEnabled,
                                () => {
                                  if (row.isSelected) {
                                    setModelsStatus(t("You can't hide the currently selected model."));
                                    return;
                                  }
                                  if (visibleModelIds === null) {
                                    const next = ALL_PIONEER_MODEL_IDS.filter((id) => id !== row.model.id);
                                    setVisibleModelIds(next);
                                    setModelsStatus(null);
                                    return;
                                  }
                                  if (row.isEnabled) {
                                    setVisibleModelIds(visibleModelIds.filter((id) => id !== row.model.id));
                                    setModelsStatus(null);
                                    return;
                                  }
                                  const next = Array.from(new Set([...visibleModelIds, row.model.id]));
                                  setVisibleModelIds(next.length === ALL_PIONEER_MODEL_IDS.length ? null : next);
                                  setModelsStatus(null);
                                },
                                t("Toggle {model}", { model: row.model.label })
                              )
                            )}
                          </div>
                        </Fragment>
                      ));
                    })()}
                  </div>
                );
              })}
            </>
          )}

          {activeSection === "api_keys" && (
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
                  <button type="button" className={styles.settingsAction} onClick={() => router.push("/pricing")}>
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
          )}

          {activeSection === "data_controls" && (
            <>
              <div className={styles.settingsPageHeader}>
                <h2 className={styles.settingsPageTitle}>{t("Data Controls")}</h2>
              </div>

              <div className={styles.settingsSection}>
                <div className={styles.settingsRow}>
                  <div className={styles.settingsLabelGroup}>
                    <span className={styles.settingsLabel}>{t("Improve the model for everyone")}</span>
                  </div>
                  <button
                    type="button"
                    className={styles.settingsRowLink}
                    aria-pressed={modelImprovementEnabled}
                    aria-label={t("Toggle Improve the model for everyone")}
                    onClick={() => {
                      const previous = modelImprovementEnabled;
                      const next = !previous;
                      setModelImprovementEnabled(next);
                      if (typeof window !== "undefined") {
                        try {
                          window.localStorage.setItem(modelImprovementStorageKey, next ? "1" : "0");
                        } catch {
                          // ignore storage failures
                        }
                      }
                      if (!user?.id) {
                        return;
                      }
                      void updateUser({ improve_model_for_everyone: next }).catch((error) => {
                        console.error("Failed to update model improvement preference:", error);
                        setModelImprovementEnabled(previous);
                        if (typeof window !== "undefined") {
                          try {
                            window.localStorage.setItem(modelImprovementStorageKey, previous ? "1" : "0");
                          } catch {
                            // ignore storage failures
                          }
                        }
                      });
                    }}
                  >
                    <span className={styles.settingsValue}>{modelImprovementEnabled ? t("On") : t("Off")}</span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                </div>

                <div className={styles.settingsRow}>
                  <div className={styles.settingsLabelGroup}>
                    <span className={styles.settingsLabel}>{t("Conversation memory")}</span>
                    <span className={styles.settingsItemDescription}>
                      {t("Allow Gray to remember details from your previous conversations.")}
                    </span>
                  </div>
                  {renderToggle(
                    conversationMemoryEnabled,
                    () => {
                      const next = !conversationMemoryEnabled;
                      setConversationMemoryEnabled(next);
                      if (typeof window !== "undefined") {
                        try {
                          window.localStorage.setItem(conversationMemoryStorageKey, next ? "1" : "0");
                        } catch {
                          // ignore storage failures
                        }
                      }
                    },
                    t("Toggle Conversation memory")
                  )}
                </div>
              </div>

              <div className={styles.settingsSection}>
                <div className={styles.settingsRow}>
                  <div className={styles.settingsLabelGroup}>
                    <span className={styles.settingsLabel}>{t("Clear local cache")}</span>
                    <span className={styles.settingsItemDescription}>
                      {t("Reset local preferences and cached state on this device.")}
                    </span>
                  </div>
                  <button className={styles.settingsAction} type="button" onClick={handleClearLocalCache}>
                    {t("Clear")}
                  </button>
                </div>

                <div className={styles.settingsRow}>
                  <div className={styles.settingsLabelGroup}>
                    <span className={styles.settingsLabel}>{t("Delete All Conversations")}</span>
                    <span className={styles.settingsItemDescription}>
                      {t("Delete all of your conversation data.")}
                    </span>
                  </div>
                  <button
                    className={styles.settingsAction}
                    type="button"
                    disabled={isDeletingAllConversations}
                    onClick={async () => {
                      if (!confirm(t("Are you sure you want to delete ALL conversations? This cannot be undone."))) {
                        return;
                      }

                      setIsDeletingAllConversations(true);
                      try {
                        if (user?.id) {
                          await apiService.deleteAllConversations(user.id);
                        }
                        clearAllConversations();
                      } catch (error) {
                        console.error("Failed to delete all conversations:", error);
                        alert(t("Failed to delete conversations. Please try again."));
                      } finally {
                        setIsDeletingAllConversations(false);
                      }
                    }}
                  >
                    {isDeletingAllConversations ? t("Deleting…") : t("Delete")}
                  </button>
                </div>
              </div>
            </>
          )}

          {activeSection === "notifications" && (
            <>
              <div className={styles.settingsPageHeader}>
                <h2 className={styles.settingsPageTitle}>{t("Notifications")}</h2>
              </div>

              <div className={styles.settingsSection}>
                <h3 className={styles.settingsSectionTitle}>{t("Device notifications")}</h3>

                <div className={styles.settingsRow}>
                  <div className={styles.settingsLabelGroup}>
                    <span className={styles.settingsLabel}>{t("Desktop & mobile")}</span>
                    <span className={styles.settingsItemDescription}>
                      {notificationPermission === "unsupported"
                        ? t("Notifications are not supported on this device.")
                        : notificationPermission === "denied"
                          ? t("Notifications are blocked in your browser settings.")
                          : t("Show notifications on this device.")}
                    </span>
                  </div>
                  {renderToggle(
                    notificationPreferences.device && notificationPermission === "granted",
                    () => void handleToggleDeviceNotifications(),
                    t("Toggle device notifications")
                  )}
                </div>
              </div>

              <div className={styles.settingsSection}>
                <h3 className={styles.settingsSectionTitle}>{t("What to notify")}</h3>

                <div className={styles.settingsRow}>
                  <div className={styles.settingsLabelGroup}>
                    <span className={styles.settingsLabel}>{t("Tasks")}</span>
                    <span className={styles.settingsItemDescription}>
                      {t("Reminders and updates about your tasks.")}
                    </span>
                  </div>
                  {renderToggle(
                    notificationPreferences.tasks,
                    () => setNotificationPreference("tasks", !notificationPreferences.tasks),
                    t("Toggle task notifications")
                  )}
                </div>

                <div className={styles.settingsRow}>
                  <div className={styles.settingsLabelGroup}>
                    <span className={styles.settingsLabel}>{t("Proactivity")}</span>
                    <span className={styles.settingsItemDescription}>
                      {t("Daily check-ins and proactive summaries.")}
                    </span>
                  </div>
                  {renderToggle(
                    notificationPreferences.proactivity,
                    () =>
                      setNotificationPreference(
                        "proactivity",
                        !notificationPreferences.proactivity
                      ),
                    t("Toggle proactivity notifications")
                  )}
                </div>

                <div className={styles.settingsRow}>
                  <div className={styles.settingsLabelGroup}>
                    <span className={styles.settingsLabel}>{t("Calendar events")}</span>
                    <span className={styles.settingsItemDescription}>
                      {t("Upcoming event reminders and changes.")}
                    </span>
                  </div>
                  {renderToggle(
                    notificationPreferences.calendarEvents,
                    () =>
                      setNotificationPreference(
                        "calendarEvents",
                        !notificationPreferences.calendarEvents
                      ),
                    t("Toggle calendar event notifications")
                  )}
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
