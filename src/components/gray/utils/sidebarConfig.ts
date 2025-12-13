import {
    Gem,
    MessageSquarePlus,
    History,
    Search,
    FileText
} from "lucide-react";
import type { SidebarNavItem, SidebarNavKey } from "@/components/gray/types";

export const SIDEBAR_ITEMS: SidebarNavItem[] = [
    { id: "general", label: "General", icon: Gem },
    { id: "threads", label: "Chat", icon: MessageSquarePlus },
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
    reference: "/reference",
    history: "/history",
};
