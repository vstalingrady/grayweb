import { apiFetch } from "./request";
import { sendChatMessageStream } from "./chatStream";
import type {
    ChatRequest,
    ChatResponse,
    ChatStarterRequest,
    ChatStarterResponse,
    ChatStreamEvent,
    ConversationSummary,
    ChatMessage,
    ConversationUpdatePayload,
    ConversationUsage
} from "./types";
import { ApiError } from "./errors";

export class ChatService {
    async sendMessage(request: ChatRequest): Promise<ChatResponse> {
        return apiFetch<ChatResponse>('/api/chat', {
            method: 'POST',
            body: JSON.stringify(request),
        });
    }

    async requestChatStarter(payload: ChatStarterRequest): Promise<ChatStarterResponse> {
        return apiFetch<ChatStarterResponse>('/api/chat/starter', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    }

    sendMessageStream(
        request: ChatRequest,
        options?: { signal?: AbortSignal }
    ): AsyncGenerator<ChatStreamEvent, void, unknown> {
        return sendChatMessageStream(request, options);
    }

    async listUserConversations(userId: number, limit = 100): Promise<ConversationSummary[]> {
        const params = new URLSearchParams({ limit: String(limit) });
        return apiFetch<ConversationSummary[]>(`/users/${userId}/conversations?${params.toString()}`);
    }

    async deleteConversation(conversationId: string): Promise<void> {
        await apiFetch<void>(`/api/conversation/${encodeURIComponent(conversationId)}`, {
            method: 'DELETE',
        });
    }

    async deleteAllConversations(userId: number): Promise<void> {
        await apiFetch<void>(`/users/${userId}/conversations`, {
            method: 'DELETE',
        });
    }

    async overwriteConversationHistory(
        conversationId: string,
        messages: { role: 'user' | 'model'; text: string }[]
    ): Promise<void> {
        await apiFetch<void>(`/api/conversation/${encodeURIComponent(conversationId)}/history`, {
            method: 'PUT',
            body: JSON.stringify({ messages }),
        });
    }

    async saveMessage(conversationId: string, role: 'user' | 'model', text: string, userId?: number): Promise<void> {
        await apiFetch(`/api/conversation/${encodeURIComponent(conversationId)}/messages`, {
            method: 'POST',
            body: JSON.stringify({ role, text, user_id: userId }),
        });
    }

    async updateConversation(conversationId: string, payload: ConversationUpdatePayload): Promise<ConversationSummary> {
        return apiFetch<ConversationSummary>(`/api/conversation/${encodeURIComponent(conversationId)}/metadata`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    }

    async getConversation(conversationId: string): Promise<ChatMessage[]> {
        try {
            return await apiFetch<ChatMessage[]>(`/api/conversation/${encodeURIComponent(conversationId)}`);
        } catch (error) {
            if (error instanceof ApiError && error.status === 404) {
                return [];
            }
            throw error;
        }
    }

    async getConversationUsage(conversationId: string): Promise<ConversationUsage | null> {
        try {
            const payload = await apiFetch<{
                conversation_id: string;
                message_count: number;
                conversation_tokens: number;
                limit: number;
                model_limit?: number;
                provider: string;
                model_name?: string | null;
                model_label?: string | null;
                context_warning?: string | null;
                suggested_models?: Array<{
                    model_id: string;
                    name: string;
                    context_limit: number;
                }> | null;
            }>(`/api/conversation/${encodeURIComponent(conversationId)}/usage`);

            const normalizedLimit =
                typeof payload.limit === "number" && Number.isFinite(payload.limit)
                    ? payload.limit
                    : 0;

            return {
                conversationId: payload.conversation_id,
                messageCount: payload.message_count,
                conversationTokens: payload.conversation_tokens,
                limit: normalizedLimit,
                modelLimit: payload.model_limit,
                provider: payload.provider ?? "local",
                modelName: payload.model_name ?? null,
                modelLabel: payload.model_label ?? null,
                contextWarning: payload.context_warning ?? null,
                suggestedModels: payload.suggested_models ?? null,
            };
        } catch (error) {
            if (error instanceof ApiError && error.status === 404) {
                return null;
            }
            throw error;
        }
    }

    async compressConversation(conversationId: string): Promise<{ success: boolean; message: string }> {
        return apiFetch<{ success: boolean; message: string }>(`/api/conversation/${encodeURIComponent(conversationId)}/compress`, {
            method: 'POST',
        });
    }

    async createConversation(title: string, userId: number): Promise<{ id: string; title: string; history: ChatMessage[] }> {
        return apiFetch('/api/conversation', {
            method: 'POST',
            body: JSON.stringify({ title, user_id: userId }),
        });
    }
}

export const chatService = new ChatService();
