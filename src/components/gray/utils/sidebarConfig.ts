import {
    Gem,
    MessageSquarePlus,
    LayoutDashboard,
    History,
    Search,
    FileText
} from "lucide-react";
import type { SidebarNavItem, SidebarNavKey } from "@/components/gray/types";

export const SIDEBAR_ITEMS: SidebarNavItem[] = [
    { id: "general", label: "General", icon: Gem },
    { id: "threads", label: "Threads", icon: MessageSquarePlus },
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "reference", label: "Reference", icon: FileText },
    { id: "history", label: "History", icon: History },
];

export const SIDEBAR_RAIL_ITEMS: SidebarNavItem[] = [
    { id: "search", label: "Search", icon: Search },
    ...SIDEBAR_ITEMS,
];

export const NAVIGATION_ROUTES: Partial<Record<SidebarNavKey, string>> = {
    general: "/g",
    threads: "/",
    dashboard: "/dashboard",
    reference: "/reference",
    history: "/history",
};
