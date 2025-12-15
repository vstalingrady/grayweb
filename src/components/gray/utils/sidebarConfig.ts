import {
    Gem,
    MessageSquarePlus,
    History,
    Calendar
} from "lucide-react";
import type { SidebarNavItem, SidebarNavKey } from "@/components/gray/types";

export const SIDEBAR_ITEMS: SidebarNavItem[] = [
    { id: "general", label: "General", icon: Gem },
    { id: "threads", label: "Chat", icon: MessageSquarePlus },
    { id: "calendar", label: "Calendar", icon: Calendar },
    { id: "history", label: "History", icon: History },
];

export const SIDEBAR_RAIL_ITEMS: SidebarNavItem[] = [
    ...SIDEBAR_ITEMS,
];

export const NAVIGATION_ROUTES: Partial<Record<SidebarNavKey, string>> = {
    general: "/g",
    threads: "/",
    history: "/history",
    calendar: "/cal",
};
