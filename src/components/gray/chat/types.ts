import type { RefObject, ReactNode } from "react";
import type {
    ChatStreamTiming,
    GroundingMetadata,
    MediaUpload,
    ContextCache,
} from "@/lib/api";
import type { QuestionnaireSession } from "@/lib/questionnaire";

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
    id: string;
    role: ChatRole;
    content: string;
    createdAt: number;
    reminders?: GrayReminderCreatedPayload[];
    groundingMetadata?: GroundingMetadata;
    backendTimings?: ChatStreamTiming;
    /**
     * History of assistant responses for this message.
     * Index 0 is the original, subsequent entries are regenerations.
     */
    variants?: string[];
    activeVariantIndex?: number;
};

export type ChatSessionScope = "general" | "thread";
export type ChatTitleMode = "auto" | "manual";

export type ChatSession = {
    id: string;
    title: string;
    titleMode: ChatTitleMode;
    createdAt: number;
    updatedAt: number;
    messages: ChatMessage[];
    isResponding: boolean;
    scope: ChatSessionScope;
    conversationId?: string;
    pendingAutoStream?: boolean;
    isGeneratingTitle?: boolean;
};

export type ChatContextValue = {
    sessions: ChatSession[];
    createThreadSession: (
        initialMessage?: string,
        options?: {
            autoStream?: boolean;
        }
    ) => Promise<ChatSession>;
    sendGeneralMessage: (content: string) => Promise<string>;
    appendMessage: (
        sessionId: string,
        role: ChatRole,
        content: string,
        tempId?: string,
        metadata?: GroundingMetadata
    ) => ChatMessage | null;
    updateMessage: (
        sessionId: string,
        messageId: string,
        partial: Partial<ChatMessage>
    ) => void;
    deleteMessage: (sessionId: string, messageId: string) => void;
    updateSession: (sessionId: string, partial: Partial<ChatSession>) => void;
    renameSession: (sessionId: string, title: string) => void;
    deleteSession: (sessionId: string) => void;
    getSession: (sessionId: string) => ChatSession | undefined;
    ensureSession: (sessionId: string, initializer: () => ChatSession) => ChatSession;
    generalSessionId: string | null;
    workspaceContext: string | null;
    setWorkspaceContext: (context: string | null) => void;
    applyAutoTitle: (sessionId: string, candidate?: string | null) => void;
    hasAutoStreamTriggered: (sessionId: string, messageId?: string | null) => boolean;
    markAutoStreamTriggered: (sessionId: string, messageId?: string | null) => void;
    resetAutoStreamState: (sessionId?: string | null) => void;
    personalizedSystemPrompt: string;
    attachments: MediaUpload[];
    isAttachmentUploading: boolean;
    attachmentError: string | null;
    uploadAttachments: (files: FileList | File[]) => Promise<void>;
    removeAttachment: (id: number) => void;
    clearAttachments: () => void;
    mapsEnabled: boolean;
    mapsWidgetEnabled: boolean;
    mapsLatitude: string;
    mapsLongitude: string;
    setMapsEnabled: (value: boolean) => void;
    setMapsWidgetEnabled: (value: boolean) => void;
    setMapsLatitude: (value: string) => void;
    setMapsLongitude: (value: string) => void;
    mapPayload: Record<string, number | boolean | undefined>;
    toggleMapsEnabled: () => void;
    toggleWebSearchEnabled: () => void;
    // Deprecated properties kept for compatibility if needed, but effectively unused
    pendingLocationRequestMessage: string | null;
    isHandlingLocationRequest: boolean;
    contextCaches: ContextCache[];
    contextCacheLabel: string;
    contextCacheContent: string;
    selectedContextCacheId: number | null;
    contextCacheMessage: string | null;
    isContextCacheSaving: boolean;
    createContextCache: (conversationId?: string) => Promise<void>;
    selectContextCacheId: (cacheId: number | null) => void;
    setContextCacheLabel: (value: string) => void;
    setContextCacheContent: (value: string) => void;
    webSearchEnabled: boolean;
    setWebSearchEnabled: (value: boolean) => void;
    toggleWebSearchEnabled: () => void;
    remindersEnabled: boolean;
    toggleRemindersEnabled: () => void;
    fileSearchStores: { name: string; display_name?: string }[];
    fileSearchDisplayName: string;
    setFileSearchDisplayName: (value: string) => void;
    fileSearchStatus: string | null;
    isCreatingFileSearchStore: boolean;
    handleCreateFileSearchStore: () => Promise<void>;
    selectedFileSearchStore: string;
    setSelectedFileSearchStore: (value: string) => void;
    fileSearchUploadFile: File | null;
    setFileSearchUploadFile: (value: File | null) => void;
    fileSearchUploadStatus: string | null;
    handleFileSearchUpload: () => Promise<void>;
    fileSearchChunking: { maxTokensPerChunk: string; maxOverlapTokens: string };
    setFileSearchChunking: (value: { maxTokensPerChunk: string; maxOverlapTokens: string }) => void;
    fileSearchImportName: string;
    setFileSearchImportName: (value: string) => void;
    fileSearchImportStatus: string | null;
    handleFileSearchImport: () => Promise<void>;
    fileSearchUploadInputRef: RefObject<HTMLInputElement | null>;
    loadConversationMessages: (sessionId: string) => Promise<void>;
    reasoningMode: boolean;
    setReasoningMode: (value: boolean) => void;
    modelTier: "lite" | "pro";
    setModelTier: (value: "lite" | "pro") => void;
    questionnaireSession: QuestionnaireSession | null;
    startQuestionnaire: (mode: "quick" | "deep") => void;
    cancelQuestionnaire: () => void;
};

export type GrayReminderEntityType = "plan" | "habit" | "reminder";
export type GrayReminderPayloadType = "gray.reminder" | "gray.plan" | "gray.habit";
export type GrayReminderStatus = "created" | "updated" | "completed" | "deleted";
export type GrayReminderSource = "mcp/plans-habits-server" | "mcp";

export interface GrayReminderCreatedPayload {
    type: GrayReminderPayloadType;
    source: GrayReminderSource;
    status: GrayReminderStatus;
    entity: GrayReminderEntityType;
    delivery_mode?: string | null;
    data: {
        id: number | string;
        user_id: number;
        label: string;
        time_iso?: string | null;
        raw: Record<string, unknown>;
        delivery_mode?: string | null;
        summary?: string | null;
        reminder_id?: number | string | null;
        reminder_status?: string | null;
        reminder?: Record<string, unknown> | null;
    };
}

export type SaveContextCacheOptions = {
    skipMessage?: boolean;
    skipReset?: boolean;
};
