import { DEFAULT_HISTORY_SECTIONS } from "@/components/gray/historySeed";
import type { SidebarHistorySection } from "@/components/gray/types";
import { GENERAL_CHAT_SESSION_ID } from "@/components/gray/chat/constants";
import type { ChatSession } from "@/components/gray/chat/types";
import { normalizeConversationIdValue } from "@/components/gray/chat/utils";
import {
  getReadableSessionTitle,
  getSessionSeedFingerprint,
} from "@/components/gray/utils/helperFunctions";
import { HISTORY_DUPLICATE_WINDOW_MS } from "@/components/gray/utils/constants";

type SessionMetadata = { is_pinned?: boolean };

const isSessionPinned = (session: ChatSession): boolean =>
  Boolean((session.metadata as SessionMetadata | undefined)?.is_pinned);

const isPlaceholderTitle = (session: ChatSession): boolean => {
  const normalized = (session.title ?? "").trim().toLowerCase();
  return (
    !normalized ||
    normalized === "new chat" ||
    normalized === "new conversation" ||
    normalized === "new thread" ||
    normalized === "new session"
  );
};

const buildChatHref = (session: ChatSession): string => {
  if (session.scope === "general" || session.id === GENERAL_CHAT_SESSION_ID) {
    return "/g";
  }
  const normalizedConversationId = normalizeConversationIdValue(session.conversationId);
  return `/c/${normalizedConversationId ?? session.id}`;
};

export const buildHistorySections = (sessions: ChatSession[]): SidebarHistorySection[] => {
  const threadSessions = sessions.filter((session) => {
    if (session.scope !== "thread") {
      return false;
    }
    const normalizedConversationId = normalizeConversationIdValue(session.conversationId);
    return typeof normalizedConversationId === "string" && normalizedConversationId.length > 0;
  });

  const dedupeMap = new Map<string, ChatSession>();
  const registerSession = (key: string, session: ChatSession) => {
    const existing = dedupeMap.get(key);
    if (!existing || session.updatedAt > existing.updatedAt) {
      dedupeMap.set(key, session);
    }
  };

  threadSessions.forEach((session) => {
    const normalizedConversationId = session.conversationId?.trim() ?? "";
    const fingerprint = getSessionSeedFingerprint(session);
    const baseKey =
      normalizedConversationId.length > 0
        ? normalizedConversationId
        : fingerprint
          ? `seed:${fingerprint}`
          : session.id;
    const existing = dedupeMap.get(baseKey);
    if (!existing) {
      registerSession(baseKey, session);
      return;
    }
    const isConversationMatch = normalizedConversationId.length > 0;
    const isBurstDuplicate =
      !isConversationMatch &&
      Math.abs(session.updatedAt - existing.updatedAt) <= HISTORY_DUPLICATE_WINDOW_MS;
    if (isConversationMatch || isBurstDuplicate) {
      registerSession(baseKey, session);
      return;
    }
    registerSession(`${baseKey}:${session.id}`, session);
  });

  const dedupedThreadSessions = Array.from(dedupeMap.values());
  if (!dedupedThreadSessions.length) {
    return DEFAULT_HISTORY_SECTIONS.map((section) => ({
      ...section,
      entries: section.entries.map((entry) => ({ ...entry })),
    }));
  }

  const sessionsBySeed = new Map<string, ChatSession[]>();
  dedupedThreadSessions.forEach((session) => {
    const fingerprint = getSessionSeedFingerprint(session);
    if (!fingerprint) {
      return;
    }
    const bucket = sessionsBySeed.get(fingerprint) ?? [];
    bucket.push(session);
    sessionsBySeed.set(fingerprint, bucket);
  });

  const prunedThreadSessions = dedupedThreadSessions.filter((session) => {
    if (!session.isGeneratingTitle) {
      return true;
    }
    if (!isPlaceholderTitle(session)) {
      return true;
    }
    const fingerprint = getSessionSeedFingerprint(session);
    if (!fingerprint) {
      return true;
    }
    const candidates = sessionsBySeed.get(fingerprint) ?? [];
    const hasBetterMatch = candidates.some(
      (candidate) =>
        candidate !== session &&
        !candidate.isGeneratingTitle &&
        Math.abs(candidate.updatedAt - session.updatedAt) <= HISTORY_DUPLICATE_WINDOW_MS
    );
    return !hasBetterMatch;
  });

  const pinnedSessions: ChatSession[] = [];
  const unpinnedSessions: ChatSession[] = [];
  prunedThreadSessions.forEach((session) => {
    if (isSessionPinned(session)) {
      pinnedSessions.push(session);
    } else {
      unpinnedSessions.push(session);
    }
  });

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const oneWeekAgo = new Date(today);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const currentYear = now.getFullYear();

  const groups = new Map<
    string,
    {
      id: string;
      label: string;
      entries: SidebarHistorySection["entries"];
      sortKey: number;
    }
  >();

  if (pinnedSessions.length > 0) {
    pinnedSessions.sort((a, b) => b.updatedAt - a.updatedAt);
    const pinnedEntries = pinnedSessions.map((session) => ({
      id: session.id,
      title: getReadableSessionTitle(session),
      href: buildChatHref(session),
      createdAt: session.updatedAt,
      isGeneratingTitle: session.isGeneratingTitle,
      isPinned: true,
    }));
    groups.set("pinned", {
      id: "pinned",
      label: "Pinned",
      entries: pinnedEntries,
      sortKey: Number.POSITIVE_INFINITY,
    });
  }

  unpinnedSessions.forEach((session) => {
    const date = new Date(session.updatedAt);

    let groupId: string;
    let label: string;
    let sortKey: number;

    if (date >= today) {
      groupId = "recent";
      label = "Recent";
      sortKey = Number.MAX_SAFE_INTEGER;
    } else if (date >= yesterday) {
      groupId = "yesterday";
      label = "Yesterday";
      sortKey = Number.MAX_SAFE_INTEGER - 1;
    } else if (date >= oneWeekAgo) {
      groupId = "this-week";
      label = "This Week";
      sortKey = Number.MAX_SAFE_INTEGER - 2;
    } else {
      groupId = `${date.getFullYear()}-${date.getMonth()}`;
      label =
        date.getFullYear() === currentYear
          ? date.toLocaleDateString([], { month: "long" })
          : date.toLocaleDateString([], { month: "long", year: "numeric" });
      sortKey = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
    }

    if (!groups.has(groupId)) {
      groups.set(groupId, {
        id: groupId,
        label,
        entries: [],
        sortKey,
      });
    }

    groups.get(groupId)?.entries.push({
      id: session.id,
      title: getReadableSessionTitle(session),
      href: buildChatHref(session),
      createdAt: session.updatedAt,
      isGeneratingTitle: session.isGeneratingTitle,
    });
  });

  return Array.from(groups.values())
    .sort((a, b) => b.sortKey - a.sortKey)
    .map((group) => {
      const sorted = group.entries.sort((a, b) => b.createdAt - a.createdAt);
      const seen = new Set<string>();
      const deduped: typeof sorted = [];
      sorted.forEach((entry) => {
        const day = new Date(entry.createdAt).toDateString();
        const key = `${entry.title.toLowerCase()}::${day}`;
        if (seen.has(key)) {
          return;
        }
        seen.add(key);
        deduped.push(entry);
      });
      return {
        id: group.id,
        label: group.label,
        entries: deduped,
      };
    });
};

