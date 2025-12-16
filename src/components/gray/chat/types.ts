import type {
    ChatStreamTiming,
    GroundingMetadata,
    MediaUpload,
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
    attachments?: MediaUpload[];
    backendTimings?: ChatStreamTiming;
    /**
     * History of assistant responses for this message.
     * Index 0 is the original, subsequent entries are regenerations.
     */
    variants?: string[];
    activeVariantIndex?: number;
    reasoningSeconds?: number;
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
    metadata?: Record<string, unknown>;
    pendingAutoStream?: boolean;
    isGeneratingTitle?: boolean;
};

export type ConversationHistoryEntryPayload = {
    role: "user" | "model";
    text: string;
    updated_at?: string;
    metadata?: Record<string, unknown>;
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
    pinSession: (sessionId: string, pinned: boolean) => Promise<void>;
    deleteSession: (sessionId: string) => void;
    clearAllConversations: () => void;
    getSession: (sessionId: string) => ChatSession | undefined;
    ensureSession: (sessionId: string, initializer: () => ChatSession) => ChatSession;
    markHasSeenGeneralChat: () => Promise<void>;
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
    autoWebSearchEnabled: boolean;
    setAutoWebSearchEnabled: (value: boolean) => void;
    webSearchEnabled: boolean;
    remindersEnabled: boolean;
    toggleRemindersEnabled: () => void;
    loadConversationMessages: (sessionId: string) => Promise<void>;
    reasoningMode: boolean;
    setReasoningMode: (value: boolean) => void;
    modelTier: "lite" | "pro" | "pioneer";
    setModelTier: (value: "lite" | "pro" | "pioneer") => void;
    selectedModelId: string | null;
    setSelectedModelId: (id: string | null) => void;
    visibleModelIds: string[] | null;
    setVisibleModelIds: (ids: string[] | null) => void;
    questionnaireSession: QuestionnaireSession | null;
    startQuestionnaire: (mode: "quick" | "deep") => void;
    cancelQuestionnaire: () => void;
    remoteConversationsLoaded: boolean;
};

export type GrayReminderEntityType = "plan" | "habit" | "reminder";
export type GrayReminderPayloadType = "gray.reminder" | "gray.plan" | "gray.habit";
export type GrayReminderStatus = "created" | "updated" | "completed" | "deleted";
export type GrayReminderSource = "native/backend" | "legacy";

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
