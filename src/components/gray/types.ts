import { type ComponentType } from "react";

export type SidebarNavKey =
  | "general"
  | "threads"
  | "dashboard"
  | "history"
  | "search"
  | "calendar"
  | "analytics";

export type SidebarNavItem = {
  id: SidebarNavKey;
  icon: ComponentType<{ size?: number }>;
  label: string;
};

export type SidebarHistoryEntry = {
  id: string;
  title: string;
  href: string;
  createdAt: number;
  isGeneratingTitle?: boolean;
  isPinned?: boolean;
};

export type SidebarHistorySection = {
  id: string;
  label: string;
  entries: SidebarHistoryEntry[];
};

export type HistoryGroup = {
  period: string;
  items: string[];
};

export type PlanItem = {
  id: string;
  label: string;
  completed: boolean;
  createdAt?: string;
  updatedAt?: string;
  deadline?: string | null;
  scheduleSlot?: string | null;
  details?: string | null;
  reminderAt?: string | null;
  color?: string | null;
};

export type PlanUpdates = {
  label: string;
  details?: string | null;
  deadline?: string | null;
  scheduleSlot?: string | null;
  reminderAt?: string | null;
  color?: string | null;
};

export type HabitItem = {
  id: string;
  label: string;
  previousLabel: string;
  completed?: boolean;
  details?: string | null;
  createdAt?: string;
  updatedAt?: string;
  reminderAt?: string | null;
};

export type HabitUpdates = {
  label: string;
  details?: string | null;
  previousLabel?: string | null;
  reminderAt?: string | null;
};

export type DayEvent = {
  id: string;
  start: string;
  end?: string;
  label: string;
};

export type ProactivityItem = {
  id: string;
  label: string;
  description: string;
  cadence: string;
  time: string;
  times?: string[];
  channels?: string[];
  timezone?: string | null;
};

export type CalendarDisplayEvent = {
  id: string;
  label: string;
  rangeLabel: string;
  topOffset: number;
  height: number;
};

export type PulseEntry = {
  id: string;
  dateKey: string;
  timestamp: number;
  plans: PlanItem[];
  habits: HabitItem[];
  proactivity: ProactivityItem | null;
};

export type ContextUsageSummary = {
  conversationId: string | null;
  messageCount: number;
  conversationTokens: number;
  workspaceTokens: number;
  totalTokens: number;
  tokensRemaining: number;
  limit: number;
  modelLimit?: number | null;
  provider: string;
  modelName: string | null;
  modelLabel: string | null;
};
