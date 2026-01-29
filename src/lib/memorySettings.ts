export type MemorySettings = {
  autoRecall: boolean;
  autoCapture: boolean;
  captureMode: "all" | "everything";
  maxRecallResults: number;
  profileFrequency: number;
};

export type MemorySettingsUserShape = {
  supermemory_auto_recall?: boolean | null;
  supermemory_auto_capture?: boolean | null;
  supermemory_capture_mode?: "all" | "everything" | null;
  supermemory_max_recall_results?: number | null;
  supermemory_profile_frequency?: number | null;
};

export const DEFAULT_MEMORY_SETTINGS: MemorySettings = {
  autoRecall: true,
  autoCapture: true,
  captureMode: "all",
  maxRecallResults: 10,
  profileFrequency: 50,
};

const MEMORY_SETTINGS_STORAGE_PREFIX = "gray_memory_settings";

export const buildMemorySettingsStorageKey = (userId: number | string | null | undefined) =>
  `${MEMORY_SETTINGS_STORAGE_PREFIX}:${userId ?? "anon"}`;

const clampNumber = (
  value: unknown,
  min: number,
  max: number,
  fallback: number
) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
};

const coerceBoolean = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;

const coerceCaptureMode = (value: unknown, fallback: "all" | "everything") =>
  value === "everything" || value === "all" ? value : fallback;

const normalizeOptionalNumber = (value: unknown, min: number, max: number): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
};

export const parseMemorySettings = (value: unknown): MemorySettings => {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_MEMORY_SETTINGS };
  }
  const record = value as Record<string, unknown>;
  return {
    autoRecall: coerceBoolean(record.autoRecall, DEFAULT_MEMORY_SETTINGS.autoRecall),
    autoCapture: coerceBoolean(record.autoCapture, DEFAULT_MEMORY_SETTINGS.autoCapture),
    captureMode: coerceCaptureMode(record.captureMode, DEFAULT_MEMORY_SETTINGS.captureMode),
    maxRecallResults: clampNumber(
      record.maxRecallResults,
      1,
      20,
      DEFAULT_MEMORY_SETTINGS.maxRecallResults
    ),
    profileFrequency: clampNumber(
      record.profileFrequency,
      1,
      500,
      DEFAULT_MEMORY_SETTINGS.profileFrequency
    ),
  };
};

export const extractMemorySettingsFromUser = (
  user: MemorySettingsUserShape | null | undefined
): Partial<MemorySettings> | null => {
  if (!user) {
    return null;
  }
  const settings: Partial<MemorySettings> = {};
  let hasValue = false;
  if (typeof user.supermemory_auto_recall === "boolean") {
    settings.autoRecall = user.supermemory_auto_recall;
    hasValue = true;
  }
  if (typeof user.supermemory_auto_capture === "boolean") {
    settings.autoCapture = user.supermemory_auto_capture;
    hasValue = true;
  }
  if (user.supermemory_capture_mode === "all" || user.supermemory_capture_mode === "everything") {
    settings.captureMode = user.supermemory_capture_mode;
    hasValue = true;
  }
  const maxRecall = normalizeOptionalNumber(user.supermemory_max_recall_results, 1, 20);
  if (maxRecall !== null) {
    settings.maxRecallResults = maxRecall;
    hasValue = true;
  }
  const profileFrequency = normalizeOptionalNumber(user.supermemory_profile_frequency, 1, 500);
  if (profileFrequency !== null) {
    settings.profileFrequency = profileFrequency;
    hasValue = true;
  }
  return hasValue ? settings : null;
};

export const mergeMemorySettings = (
  base: MemorySettings,
  overrides: Partial<MemorySettings> | null | undefined
): MemorySettings => {
  if (!overrides) {
    return { ...base };
  }
  return parseMemorySettings({ ...base, ...overrides });
};

export const memorySettingsToUserUpdate = (
  settings: MemorySettings
): MemorySettingsUserShape => ({
  supermemory_auto_recall: settings.autoRecall,
  supermemory_auto_capture: settings.autoCapture,
  supermemory_capture_mode: settings.captureMode,
  supermemory_max_recall_results: settings.maxRecallResults,
  supermemory_profile_frequency: settings.profileFrequency,
});

export const loadMemorySettings = (storageKey: string): MemorySettings => {
  if (typeof window === "undefined") {
    return { ...DEFAULT_MEMORY_SETTINGS };
  }
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return { ...DEFAULT_MEMORY_SETTINGS };
    }
    return parseMemorySettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_MEMORY_SETTINGS };
  }
};

export const saveMemorySettings = (storageKey: string, settings: MemorySettings) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(settings));
  } catch {
    // ignore storage failures
  }
};

export const clearMemorySettings = (storageKey: string) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // ignore storage failures
  }
};
