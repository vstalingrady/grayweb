"use client";

import { useEffect, useRef } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { useUser } from "@/contexts/UserContext";
import {
  buildMemorySettingsStorageKey,
  extractMemorySettingsFromUser,
  loadMemorySettings,
  mergeMemorySettings,
  parseMemorySettings,
  saveMemorySettings,
} from "@/lib/memorySettings";

type ThemeMode = "light" | "dark" | "system";

const THEME_STORAGE_KEY = "gray_theme";
const RESPONSE_LANGUAGE_STORAGE_KEY = "gray_response_language";
const CONVERSATION_MEMORY_STORAGE_PREFIX = "gray_conversation_memory";
const MODEL_IMPROVEMENT_STORAGE_PREFIX = "gray_model_improvement";

const isThemeMode = (value: unknown): value is ThemeMode =>
  value === "light" || value === "dark" || value === "system";

const applyThemeToDocument = (mode: ThemeMode) => {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return;
  }
  const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
  const shouldBeLight = mode === "light" || (mode === "system" && prefersLight);
  document.documentElement.classList.toggle("light", shouldBeLight);
};

const readLocalStorage = (key: string): string | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeLocalStorage = (key: string, value: string) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore storage failures
  }
};

export function UserSettingsSync() {
  const { user, updateUser } = useUser();
  const { locale, setLocale } = useI18n();
  const didBootstrapRef = useRef<number | null>(null);

  useEffect(() => {
    if (!user?.id) {
      didBootstrapRef.current = null;
      return;
    }

    // Apply persisted settings from DB to this device (post-login / after clearing local cache).
    const backendTheme = user.theme_mode;
    if (isThemeMode(backendTheme)) {
      writeLocalStorage(THEME_STORAGE_KEY, backendTheme);
      applyThemeToDocument(backendTheme);
    }

    const backendLocale = user.ui_locale;
    if (backendLocale === "en" || backendLocale === "id") {
      if (backendLocale !== locale) {
        setLocale(backendLocale);
      }
    }

    const backendResponseLanguage = user.preferred_response_language;
    if (backendResponseLanguage === "auto" || backendResponseLanguage === "en" || backendResponseLanguage === "id") {
      writeLocalStorage(RESPONSE_LANGUAGE_STORAGE_KEY, backendResponseLanguage);
    }

    if (typeof user.conversation_memory_enabled === "boolean") {
      const memoryKey = `${CONVERSATION_MEMORY_STORAGE_PREFIX}:${user.id}`;
      writeLocalStorage(memoryKey, user.conversation_memory_enabled ? "1" : "0");
    }

    if (typeof user.improve_model_for_everyone === "boolean") {
      const improvementKey = `${MODEL_IMPROVEMENT_STORAGE_PREFIX}:${user.id}`;
      writeLocalStorage(improvementKey, user.improve_model_for_everyone ? "1" : "0");
    }

    const accountMemorySettings = extractMemorySettingsFromUser(user);
    if (accountMemorySettings) {
      const memoryKey = buildMemorySettingsStorageKey(user.id);
      const localSettings = loadMemorySettings(memoryKey);
      const mergedSettings = mergeMemorySettings(localSettings, accountMemorySettings);
      saveMemorySettings(memoryKey, mergedSettings);
    }
  }, [
    locale,
    setLocale,
    user,
    user?.conversation_memory_enabled,
    user?.id,
    user?.improve_model_for_everyone,
    user?.preferred_response_language,
    user?.supermemory_auto_capture,
    user?.supermemory_auto_recall,
    user?.supermemory_capture_mode,
    user?.supermemory_max_recall_results,
    user?.supermemory_profile_frequency,
    user?.theme_mode,
    user?.ui_locale,
  ]);

  useEffect(() => {
    if (!user?.id) {
      didBootstrapRef.current = null;
      return;
    }
    if (didBootstrapRef.current === user.id) {
      return;
    }
    didBootstrapRef.current = user.id;

    // Bootstrap per-user DB settings from existing localStorage values (migration).
    const pending: {
      theme_mode?: ThemeMode | null;
      ui_locale?: "en" | "id" | null;
      preferred_response_language?: "auto" | "en" | "id" | null;
      conversation_memory_enabled?: boolean | null;
      improve_model_for_everyone?: boolean | null;
      supermemory_auto_recall?: boolean | null;
      supermemory_auto_capture?: boolean | null;
      supermemory_capture_mode?: "all" | "everything" | null;
      supermemory_max_recall_results?: number | null;
      supermemory_profile_frequency?: number | null;
    } = {};

    if (!isThemeMode(user.theme_mode)) {
      const localTheme = readLocalStorage(THEME_STORAGE_KEY);
      if (isThemeMode(localTheme)) {
        pending.theme_mode = localTheme;
      }
    }

    if (user.ui_locale == null) {
      const storedLocale = readLocalStorage("gray_locale");
      if (storedLocale === "en" || storedLocale === "id") {
        pending.ui_locale = storedLocale;
      }
    }

    if (!user.preferred_response_language) {
      const localResponse = readLocalStorage(RESPONSE_LANGUAGE_STORAGE_KEY);
      if (localResponse === "auto" || localResponse === "en" || localResponse === "id") {
        pending.preferred_response_language = localResponse;
      }
    }

    if (typeof user.conversation_memory_enabled !== "boolean") {
      const memoryKey = `${CONVERSATION_MEMORY_STORAGE_PREFIX}:${user.id}`;
      const raw = readLocalStorage(memoryKey);
      if (raw === "0" || raw === "1") {
        pending.conversation_memory_enabled = raw === "1";
      }
    }

    if (typeof user.improve_model_for_everyone !== "boolean") {
      const improvementKey = `${MODEL_IMPROVEMENT_STORAGE_PREFIX}:${user.id}`;
      const raw = readLocalStorage(improvementKey);
      if (raw === "0" || raw === "1") {
        pending.improve_model_for_everyone = raw === "1";
      }
    }

    const memorySettingsKey = buildMemorySettingsStorageKey(user.id);
    const rawMemorySettings = readLocalStorage(memorySettingsKey);
    if (rawMemorySettings) {
      try {
        const parsed = parseMemorySettings(JSON.parse(rawMemorySettings));
        if (typeof user.supermemory_auto_recall !== "boolean") {
          pending.supermemory_auto_recall = parsed.autoRecall;
        }
        if (typeof user.supermemory_auto_capture !== "boolean") {
          pending.supermemory_auto_capture = parsed.autoCapture;
        }
        const hasCaptureMode =
          user.supermemory_capture_mode === "all" || user.supermemory_capture_mode === "everything";
        if (!hasCaptureMode) {
          pending.supermemory_capture_mode = parsed.captureMode;
        }
        if (typeof user.supermemory_max_recall_results !== "number") {
          pending.supermemory_max_recall_results = parsed.maxRecallResults;
        }
        if (typeof user.supermemory_profile_frequency !== "number") {
          pending.supermemory_profile_frequency = parsed.profileFrequency;
        }
      } catch {
        // ignore invalid local memory settings
      }
    }

    if (Object.keys(pending).length === 0) {
      return;
    }

    void updateUser(pending).catch(() => undefined);
  }, [
    locale,
    updateUser,
    user?.conversation_memory_enabled,
    user?.id,
    user?.improve_model_for_everyone,
    user?.preferred_response_language,
    user?.supermemory_auto_capture,
    user?.supermemory_auto_recall,
    user?.supermemory_capture_mode,
    user?.supermemory_max_recall_results,
    user?.supermemory_profile_frequency,
    user?.theme_mode,
    user?.ui_locale,
  ]);

  return null;
}
