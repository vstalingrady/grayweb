import { type ComponentType } from "react";

export type SidebarNavKey =
  | "general"
  | "new-thread"
  | "dashboard"
  | "history"
  | "search";

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
};

export type HabitItem = {
  id: string;
  label: string;
  streakLabel: string;
  previousLabel: string;
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
  proactivity: ProactivityItem;
};
