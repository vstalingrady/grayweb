"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronDown,
  UserCircle,
  Settings as SettingsIcon,
  Palette,
  Moon,
  Sun,
  Trash2,
  Globe,
  Database,
  Building2
} from "lucide-react";
import styles from "@/app/gray/GrayPageClient.module.css";
import { useI18n } from "@/contexts/I18nContext";
import { useUser } from "@/contexts/UserContext";
import { useChatStore } from "@/components/gray/ChatProvider";

type SettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

type SettingsSection =
  | "account"
  | "preferences"
  | "personalization"
  | "data_controls";

type ThemeMode = "dark" | "light" | "system";
const THEME_STORAGE_KEY = "gray_theme";

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

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { t } = useI18n();
  const { user, updateUser } = useUser();
  const { webSearchEnabled, setWebSearchEnabled } = useChatStore();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<SettingsSection>("account");

  // Preferences State
  const [theme, setTheme] = useState<ThemeMode>("system");
  const [autosuggestEnabled, setAutosuggestEnabled] = useState(true);
  const [dataRetentionEnabled, setDataRetentionEnabled] = useState(true);
  const [allowLinkSharing, setAllowLinkSharing] = useState(false);

  // Personalization State
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("Boulder, CO"); // Local only, no backend field
  const [savedMemoriesEnabled, setSavedMemoriesEnabled] = useState(true); // Placeholder for now
  const [customInstructions, setCustomInstructions] = useState("");
  const [showCalendar, setShowCalendar] = useState(true);

  const [aboutSaveState, setAboutSaveState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [customSaveState, setCustomSaveState] = useState<"idle" | "saving" | "success" | "error">("idle");

  // Sync state with user profile and chat store
  useEffect(() => {
    if (user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBio(user.personalization_about || "");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCustomInstructions(user.personalization_custom_instructions || "");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowCalendar(user.personalization_show_calendar ?? true);
    }
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(resolveInitialTheme());
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
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
  }, [isOpen, onClose]);

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

  const handleDeleteAccount = () => {
    onClose();
    router.push("/delete-account");
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

  const cycleTheme = () => {
    const modes: ThemeMode[] = ["system", "dark", "light"];
    const nextIndex = (modes.indexOf(theme) + 1) % modes.length;
    applyTheme(modes[nextIndex]);
  };

  const getThemeLabel = (current: ThemeMode) => {
    switch (current) {
      case "system": return t("System (Dark)");
      case "dark": return t("Dark");
      case "light": return t("Light");
    }
  };

  const handleSaveBio = async () => {
    if (!user?.id) return;
    setAboutSaveState("saving");
    try {
      await updateUser({ personalization_about: bio });
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

  const handleClearBio = () => {
    setBio("");
  };

  const handleClearCustomInstructions = () => {
    setCustomInstructions("");
  };

  const handleLocationToggle = async () => {
    if (!user?.id) return;
    // Optimistic update handled by UI re-render on user context change,
    // but we trigger the update here.
    await updateUser({ maps_enabled: !user.maps_enabled });
  };

  const handleCalendarToggle = async () => {
    if (!user?.id) return;
    // Optimistic update handled by UI re-render on user context change
    await updateUser({ personalization_show_calendar: !user.personalization_show_calendar });
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

  // Helper for toggle switch
  const renderToggle = (checked: boolean, onChange: () => void, label?: string) => (
    <button
      type="button"
      className={styles.settingsToggle}
      role="switch"
      aria-checked={checked ? "true" : "false"}
      onClick={onChange}
      aria-label={label}
    >
      <span className={styles.settingsToggleThumb} />
    </button>
  );

  return (
    <div className={styles.settingsOverlay} role="dialog" aria-modal="true">
      <div className={styles.settingsContainer}>
        {/* Left Sidebar */}
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
            {renderNavItem("data_controls", t("Data Controls"), Database)}
          </div>
        </aside>

        {/* Right Content */}
        <main className={styles.settingsContent}>
          {activeSection === "account" && (
            <>
              <div className={styles.settingsPageHeader}>
                <h2 className={styles.settingsPageTitle}>{t("Account")}</h2>
              </div>

              <div className={styles.userProfileCard}>
                <div className={styles.avatarLarge}>
                  <UserCircle size={40} />
                </div>
                <div>
                  <div className={styles.userName}>
                    {user?.full_name || "Gray User"}
                  </div>
                </div>
                <div className={styles.userProfileActions}>
                  <button className={styles.settingsAction}>{t("Change avatar")}</button>
                </div>
              </div>

              <div className={styles.settingsSection}>
                <div className={styles.settingsRow}>
                  <div className={styles.settingsLabelGroup}>
                    <span className={styles.settingsLabel}>{t("Full Name")}</span>
                    <span className={styles.settingsValue}>{user?.full_name || "Gray User"}</span>
                  </div>
                  <button className={styles.settingsAction}>{t("Change full name")}</button>
                </div>
                <div className={styles.settingsRow}>
                  <div className={styles.settingsLabelGroup}>
                    <span className={styles.settingsLabel}>{t("Email")}</span>
                    <span className={styles.settingsValue}>{user?.email || "user@example.com"}</span>
                  </div>
                </div>
              </div>

              <div className={styles.settingsSection}>
                <h3 className={styles.settingsSectionTitle}>{t("Your Subscription")}</h3>
                <div className={styles.settingsUpgradeCard}>
                  <div className={styles.settingsUpgradeText}>
                    <h4>Upgrade to Pro</h4>
                    <p>Unlock everything Gray has to offer.</p>
                  </div>
                  <button className={`${styles.settingsAction} ${styles.settingsPrimaryButton}`}>
                    {t("Upgrade plan")}
                  </button>
                </div>
              </div>

              <div className={styles.settingsSection}>
                <h3 className={styles.settingsSectionTitle}>{t("System")}</h3>
                <div className={styles.settingsRow}>
                  <span className={styles.settingsLabel}>{t("Support")}</span>
                  <button className={styles.settingsAction}>{t("Contact")}</button>
                </div>
                <div className={styles.settingsRow}>
                  <span className={styles.settingsLabel}>{t("You are signed in as")} {user?.email}</span>
                  <button className={styles.settingsAction}>{t("Sign out")}</button>
                </div>
                <div className={styles.settingsRow}>
                  <div className={styles.settingsLabelGroup}>
                    <span className={styles.settingsLabel}>{t("Delete account")}</span>
                    <span className={styles.deleteAccountHelper}>
                      {t("Permanently delete your account and data")}
                    </span>
                  </div>
                  <button
                    className={styles.settingsAction}
                    onClick={handleDeleteAccount}
                  >
                    {t("Learn more")}
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
                  <button
                    className={styles.settingsSelectButton}
                    onClick={cycleTheme}
                  >
                    {theme === "light" ? <Sun size={14} /> : <Moon size={14} />}
                    <span>{getThemeLabel(theme)}</span>
                    <ChevronDown size={14} style={{ opacity: 0.5 }} />
                  </button>
                </div>

                <div className={styles.settingsRow}>
                  <div className={styles.settingsLabelGroup}>
                    <span className={styles.settingsLabel}>{t("Language")}</span>
                    <span className={styles.settingsItemDescription}>{t("The language used in the user interface")}</span>
                  </div>
                  <button className={styles.settingsSelectButton}>
                    <span>{t("Default")}</span>
                    <ChevronDown size={14} style={{ opacity: 0.5 }} />
                  </button>
                </div>

                <div className={styles.settingsRow}>
                  <div className={styles.settingsLabelGroup}>
                    <span className={styles.settingsLabel}>{t("Preferred response language")}</span>
                    <span className={styles.settingsItemDescription}>{t("The language used for AI responses")}</span>
                  </div>
                  <button className={styles.settingsSelectButton}>
                    <span>{t("Automatic (detect input)")}</span>
                    <ChevronDown size={14} style={{ opacity: 0.5 }} />
                  </button>
                </div>

                <div className={styles.settingsRow}>
                  <div className={styles.settingsLabelGroup}>
                    <span className={styles.settingsLabel}>{t("Autosuggest")}</span>
                    <span className={styles.settingsItemDescription}>
                      {t("Enable dropdown and tab-complete suggestions while typing a query")}
                    </span>
                  </div>
                  {renderToggle(autosuggestEnabled, () => setAutosuggestEnabled(!autosuggestEnabled), t("Toggle Autosuggest"))}
                </div>
              </div>

              <div className={styles.settingsSection}>
                <h3 className={styles.settingsSectionTitle}>{t("Artificial Intelligence")}</h3>

                <div className={styles.settingsRow}>
                  <span className={styles.settingsLabel}>{t("Model")}</span>
                  <button className={styles.settingsAction}>{t("Upgrade to choose")}</button>
                </div>

                <div className={styles.settingsRow}>
                  <span className={styles.settingsLabel}>{t("Image generation model")}</span>
                  <button className={styles.settingsAction}>{t("Upgrade to select")}</button>
                </div>

                <div className={styles.settingsRow}>
                  <span className={styles.settingsLabel}>{t("Video generation model")}</span>
                  <button className={styles.settingsAction}>{t("Upgrade to Max")}</button>
                </div>

                <div className={styles.settingsRow}>
                  <div className={styles.settingsLabelGroup}>
                    <span className={styles.settingsLabel}>{t("AI data retention")}</span>
                    <span className={styles.settingsItemDescription}>
                      {t("AI Data Retention allows Gray to use your searches to improve AI models. Turn this setting off if you wish to exclude your data from this process.")}
                    </span>
                  </div>
                  {renderToggle(dataRetentionEnabled, () => setDataRetentionEnabled(!dataRetentionEnabled), t("Toggle AI data retention"))}
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
                <h3 className={styles.settingsSectionTitle}>{t("Settings")}</h3>
                <p className={styles.settingsItemDescription} style={{ marginBottom: 12 }}>
                  {t("Quick toggles for Gray's automations.")}
                </p>

                <div className={styles.settingsRow}>
                  <div className={styles.settingsLabelGroup}>
                    <span className={styles.settingsLabel}>{t("Web search")}</span>
                    <span className={styles.settingsItemDescription}>
                      {t("Let Gray search for answers automatically.")}
                    </span>
                  </div>
                  {renderToggle(webSearchEnabled, () => setWebSearchEnabled(!webSearchEnabled), t("Toggle Web search"))}
                </div>

                <div className={styles.settingsRow}>
                  <div className={styles.settingsLabelGroup}>
                    <span className={styles.settingsLabel}>{t("Show Calendar")}</span>
                    <span className={styles.settingsItemDescription}>
                      {t("Display the daily schedule view.")}
                    </span>
                  </div>
                  {renderToggle(showCalendar, handleCalendarToggle, t("Toggle Calendar"))}
                </div>
              </div>

              <div className={styles.settingsSection}>
                <h3 className={styles.settingsSectionTitle}>{t("Introduce yourself")}</h3>
                <textarea
                  className={styles.settingsTextarea}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder={t("I'm a software engineer who likes to play guitar and go hiking")}
                />
                <div className={styles.settingsButtonGroup}>
                  <button
                    className={styles.settingsSecondaryButton}
                    onClick={handleClearBio}
                  >
                    <Trash2 size={14} />
                    {t("Clear")}
                  </button>
                  <button
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
                    className={styles.settingsSecondaryButton}
                    onClick={handleClearCustomInstructions}
                  >
                    <Trash2 size={14} />
                    {t("Clear")}
                  </button>
                  <button
                    className={`${styles.settingsAction} ${styles.settingsPrimaryButton}`}
                    onClick={handleSaveCustomInstructions}
                  >
                    {customSaveState === "saving" ? t("Saving...") :
                      customSaveState === "success" ? t("Saved") : t("Save")}
                  </button>
                </div>
              </div>

              <div className={styles.settingsSection}>
                <div className={`${styles.settingsRow} ${styles.settingsRowFlexStart}`}>
                  <div className={styles.settingsLabelGroup}>
                    <span className={styles.settingsLabel}>{t("Location")}</span>
                    <span className={styles.settingsItemDescription}>
                      {t("Enter a location or enable precise location to get more accurate weather and sports")}
                    </span>
                    <span className={styles.settingsItemDescription} style={{ color: "#71717a", marginTop: 4 }}>
                      {t("You are not sharing your location")}
                    </span>
                  </div>
                  {renderToggle(user?.maps_enabled ?? false, handleLocationToggle, t("Toggle Location"))}
                </div>

                <div className={styles.settingsFullWidthInput}>
                  <input
                    type="text"
                    className={styles.settingsInput}
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder={t("City, State, or Country")}
                  />
                </div>
              </div>

              <div className={styles.settingsSection}>
                <h3 className={styles.settingsSectionTitle}>{t("Memory")}</h3>
                <div className={styles.settingsRow}>
                  <div className={styles.settingsLabelGroup}>
                    <span className={styles.settingsLabel}>{t("Reference saved memories")}</span>
                    <span className={styles.settingsItemDescription}>
                      {t("Let Gray save and use memories when answering. Incognito searches are never stored.")}
                    </span>
                  </div>
                  {renderToggle(savedMemoriesEnabled, () => setSavedMemoriesEnabled(!savedMemoriesEnabled), t("Toggle Saved Memories"))}
                </div>

                <div className={styles.settingsRow}>
                  <span className={styles.settingsLabel}>{t("Edit your saved memories")}</span>
                  <button className={styles.settingsAction}>
                    {t("Manage")}
                    <ChevronLeft size={12} className={styles.settingsActionChevron} />
                  </button>
                </div>
              </div>

              <div className={styles.settingsSection}>
                <h3 className={styles.settingsSectionTitle}>{t("Shopping")}</h3>
                <div className={styles.settingsRow}>
                  <span className={styles.settingsLabel}>{t("Virtual try on avatar")}</span>
                  <button className={styles.settingsAction}>
                    {t("Manage")}
                    <ChevronLeft size={12} className={styles.settingsActionChevron} />
                  </button>
                </div>
              </div>

              <div className={styles.settingsSection}>
                <h3 className={styles.settingsSectionTitle}>{t("Watchlists")}</h3>
                <p className={`${styles.settingsItemDescription} ${styles.settingsDescriptionMargin}`}>{t("Manage your watchlists")}</p>

                <div className={styles.settingsRow}>
                  <div className={styles.settingsFlexRow}>
                    <div className={styles.watchlistIcon}>
                      <Globe size={18} />
                    </div>
                    <div className={styles.settingsItemMeta}>
                      <span className={styles.settingsItemTitle}>{t("Sports")}</span>
                      <span className={styles.settingsItemSubtitle}>{t("Event updates, breaking news, and live scores")}</span>
                    </div>
                  </div>
                  <button className={styles.settingsAction}>
                    {t("Manage")}
                    <ChevronLeft size={12} className={styles.settingsActionChevron} />
                  </button>
                </div>

                <div className={styles.settingsRow}>
                  <div className={styles.settingsFlexRow}>
                    <div className={styles.watchlistIcon}>
                      <Building2 size={18} />
                    </div>
                    <div className={styles.settingsItemMeta}>
                      <span className={styles.settingsItemTitle}>{t("Finance")}</span>
                      <span className={styles.settingsItemSubtitle}>{t("Set your watchlist for daily updates and summaries")}</span>
                    </div>
                  </div>
                  <button className={styles.settingsAction}>
                    {t("Manage")}
                    <ChevronLeft size={12} className={styles.settingsActionChevron} />
                  </button>
                </div>
              </div>
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
                    <span className={styles.settingsLabel}>{t("Improve the Model")}</span>
                    <span className={styles.settingsItemDescription}>
                      {t("By allowing your data to be used for training our models, you help enhance your own experience and improve the quality of the model for all users. We take measures to ensure your privacy is protected throughout the process.")}
                    </span>
                  </div>
                  {renderToggle(dataRetentionEnabled, () => setDataRetentionEnabled(!dataRetentionEnabled), t("Toggle AI data retention"))}
                </div>

                <div className={styles.settingsRow}>
                  <div className={styles.settingsLabelGroup}>
                    <span className={styles.settingsLabel}>{t("Personalize Grok with your conversation history")} <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 10, background: "#EDEDED", color: "#000", fontWeight: 600, marginLeft: 6 }}>beta</span></span>
                    <span className={styles.settingsItemDescription}>
                      {t("Allow Grok to remember details from your previous conversations. You can delete individual conversations to forget the associated details. Private chats are never stored.")}
                    </span>
                  </div>
                  {renderToggle(webSearchEnabled, () => setWebSearchEnabled(!webSearchEnabled), t("Toggle Conversation History"))}
                </div>

                <div className={styles.settingsRow}>
                  <div className={styles.settingsLabelGroup}>
                    <span className={styles.settingsLabel}>{t("Allow chat link sharing")}</span>
                    <span className={styles.settingsItemDescription}>
                      {t("Allow sharing chats using only your chat link.")}
                    </span>
                  </div>
                  {renderToggle(allowLinkSharing, () => setAllowLinkSharing(!allowLinkSharing), t("Toggle Link Sharing"))}
                </div>
              </div>

              <div className={styles.settingsSection}>
                <h3 className={styles.settingsSectionTitle}>{t("Storage Usage")}</h3>
                <div style={{ padding: "16px 0" }}>
                  {/* Mock progress bar */}
                  <div style={{ height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3, width: "100%", overflow: "hidden" }}>
                    <div style={{ height: "100%", background: "#4B5563", width: "1%" }} />
                  </div>
                  <p className={styles.settingsItemDescription} style={{ marginTop: 8 }}>
                    {t("4.88 MB used of 1.07 GB")}
                  </p>
                </div>

                <div className={styles.settingsRow}>
                  <div className={styles.settingsLabelGroup}>
                    <span className={styles.settingsLabel}>{t("See Files and Assets")}</span>
                    <span className={styles.settingsItemDescription}>
                      {t("See all the files and assets you have uploaded to Grok. You can also delete them here.")}
                    </span>
                  </div>
                  <button className={styles.settingsAction}>{t("Manage")}</button>
                </div>

                <div className={styles.settingsRow}>
                  <div className={styles.settingsLabelGroup}>
                    <span className={styles.settingsLabel}>{t("See Shared Links")}</span>
                    <span className={styles.settingsItemDescription}>
                      {t("See all the shared links you have created. You can also delete them and revoke access here.")}
                    </span>
                  </div>
                  <button className={styles.settingsAction}>{t("Manage")}</button>
                </div>

                <div className={styles.settingsRow}>
                  <div className={styles.settingsLabelGroup}>
                    <span className={styles.settingsLabel}>{t("See Deleted Conversations")}</span>
                    <span className={styles.settingsItemDescription}>
                      {t("View and restore conversations that you have deleted. Deleted conversations are permanently removed after 30 days.")}
                    </span>
                  </div>
                  <button className={styles.settingsAction}>{t("Manage")}</button>
                </div>

                <div className={styles.settingsRow}>
                  <div className={styles.settingsLabelGroup}>
                    <span className={styles.settingsLabel}>{t("Clear Cache")}</span>
                    <span className={styles.settingsItemDescription}>
                      {t("Clear the local cache and application state on your device.")}
                    </span>
                  </div>
                  <button className={styles.settingsAction}>{t("Clear")}</button>
                </div>

                <div className={styles.settingsRow}>
                  <div className={styles.settingsLabelGroup}>
                    <span className={styles.settingsLabel}>{t("Export Account Data")}</span>
                    <span className={styles.settingsItemDescription}>
                      {t("You can download all data associated with your account below. This data includes everything stored in all xAI products.")}
                    </span>
                  </div>
                  <button className={styles.settingsAction}>{t("Export")}</button>
                </div>
              </div>

              <div className={styles.settingsSection}>
                <div className={styles.settingsRow}>
                  <div className={styles.settingsLabelGroup}>
                    <span className={styles.settingsLabel}>{t("Delete All Conversations")}</span>
                    <span className={styles.settingsItemDescription}>
                      {t("Delete all of your conversation data.")}
                    </span>
                  </div>
                  <button className={styles.settingsAction}>{t("Delete")}</button>
                </div>

                <div className={styles.settingsRow}>
                  <div className={styles.settingsLabelGroup}>
                    <span className={styles.settingsLabel}>{t("Delete Account")}</span>
                    <span className={styles.settingsItemDescription}>
                      {t("Permanently delete your account and associated data from the xAI platform. Deletions are immediate and cannot be undone.")}
                    </span>
                  </div>
                  <button className={styles.settingsAction}>{t("Delete")}</button>
                </div>
              </div>
            </>
          )}

          {activeSection !== "account" && activeSection !== "preferences" && activeSection !== "personalization" && (
            <div className={styles.settingsPageHeader}>
              <h2 className={styles.settingsPageTitle}>
                {activeSection.charAt(0).toUpperCase() + activeSection.slice(1)}
              </h2>
              <p className={styles.comingSoonText}>
                Settings for {activeSection} are coming soon.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
