import type { ContextUsageSummary } from "@/components/gray/types";

export type SettingsSection =
  | "account"
  | "preferences"
  | "personalization"
  | "models"
  | "api_keys"
  | "data_controls"
  | "notifications";

export type ThemeMode = "dark" | "light" | "system";

export type SettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  initialSection?: SettingsSection;
  contextUsage?: ContextUsageSummary | null;
};

export type ApiKeyProvider = {
  id: string;
  label: string;
  helper: string;
};

export const API_KEY_PROVIDERS: ApiKeyProvider[] = [
  { id: "openrouter", label: "OpenRouter", helper: "Routes to all models. Get key at openrouter.ai" },
  { id: "anthropic", label: "Anthropic", helper: "Direct API for Claude models" },
  { id: "openai", label: "OpenAI", helper: "Direct API for GPT models" },
  { id: "google", label: "Google", helper: "Direct API for Gemini models" },
  { id: "deepseek", label: "DeepSeek", helper: "Direct API for DeepSeek models" },
  { id: "x-ai", label: "xAI", helper: "Direct API for Grok models" },
];

export type NotificationPreferences = {
  device: boolean;
  tasks: boolean;
  proactivity: boolean;
  calendarEvents: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  device: false,
  tasks: true,
  proactivity: true,
  calendarEvents: true,
};
